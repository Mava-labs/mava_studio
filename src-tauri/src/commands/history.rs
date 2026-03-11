use chrono::Utc;
use tauri::State;
use serde::Deserialize;

use crate::state::AppState;

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// Scope descriptor matching the frontend DirtyScope type.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeArg {
    pub kind: String,
    pub id:   Option<String>,
}

impl ScopeArg {
    pub fn scope_id(&self) -> &str {
        self.id.as_deref().unwrap_or("")
    }
}

/// Flush a serialised scope diff blob to the WAL history table.
/// Called by useAutosave for non-page scopes.
/// `proto_blob` is the base64-encoded JSON snapshot of the scope.
#[tauri::command]
pub async fn flush_scope_wal(
    project_id: String,
    scope: ScopeArg,
    proto_blob: String, // base64-encoded JSON scope snapshot
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db      = state.project_db(&project_id).await?;
    let version = state.next_wal_version(&project_id).await?;
    let now     = now_ms();

    // Decode base64 → raw bytes
    let blob_bytes = base64_decode(&proto_blob)?;

    sqlx::query(
        "INSERT INTO history (project_id, scope_kind, scope_id, version, proto_blob, created_at)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&project_id)
    .bind(&scope.kind)
    .bind(scope.scope_id())
    .bind(version)
    .bind(&blob_bytes)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Lightweight autosave for a metadata scope — serialises current project
/// document state for the given scope and appends to WAL.
/// Called by useAutosave for metadata scopes (module, lesson, course etc.)
/// Unlike flush_scope_wal this does not require the frontend to pass a blob —
/// Rust reads the current document and extracts the relevant scope.
#[tauri::command]
pub async fn autosave_scope(
    project_id: String,
    scope: ScopeArg,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db      = state.project_db(&project_id).await?;
    let version = state.next_wal_version(&project_id).await?;
    let now     = now_ms();

    // Read the current document blob
    let row: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT proto_blob FROM document WHERE id = ?"
    )
    .bind(&project_id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    let (doc_blob,) = row.ok_or("Document not found")?;

    // For now we store the full document blob scoped to this key.
    // When proto is fully wired, extract only the relevant sub-message.
    sqlx::query(
        "INSERT INTO history (project_id, scope_kind, scope_id, version, proto_blob, created_at)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&project_id)
    .bind(&scope.kind)
    .bind(scope.scope_id())
    .bind(version)
    .bind(&doc_blob)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Commit a named version snapshot — packs the current document blob
/// into the snapshots table as a restorable checkpoint.
#[tauri::command]
pub async fn commit_snapshot(
    project_id: String,
    label: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db  = state.project_db(&project_id).await?;
    let now = now_ms();

    // Read current document
    let row: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT proto_blob FROM document WHERE id = ?"
    )
    .bind(&project_id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    let (doc_blob,) = row.ok_or("Document not found")?;

    // Get next version number
    let version_row: (Option<i64>,) = sqlx::query_as(
        "SELECT MAX(version) FROM snapshots WHERE project_id = ?"
    )
    .bind(&project_id)
    .fetch_one(&db)
    .await
    .map_err(|e| e.to_string())?;
    let next_version = version_row.0.unwrap_or(0) + 1;

    sqlx::query(
        "INSERT INTO snapshots (project_id, version, label, proto_blob, created_at)
         VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&project_id)
    .bind(next_version)
    .bind(label.unwrap_or_default())
    .bind(&doc_blob)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reconstruct the state of a scope at a given version number.
///
/// Strategy (forward replay from nearest snapshot):
///   1. Find the nearest snapshot at or before target_version
///   2. Collect all WAL diffs for the scope from that snapshot's version forward
///   3. Apply diffs in order (last-write-wins per scope key)
///   4. Return the reconstructed JSON blob as base64
#[tauri::command]
pub async fn reconstruct_version(
    project_id: String,
    scope_id: String,
    target_version: i64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db = state.project_db(&project_id).await?;

    // Step 1: Find nearest snapshot <= target_version
    let snapshot_row: Option<(Vec<u8>, i64)> = sqlx::query_as(
        "SELECT proto_blob, version FROM snapshots
         WHERE project_id = ? AND version <= ?
         ORDER BY version DESC
         LIMIT 1"
    )
    .bind(&project_id)
    .bind(target_version)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    // If no snapshot, fall back to the base document
    let (base_blob, base_version) = match snapshot_row {
        Some((blob, ver)) => (blob, ver),
        None => {
            let row: (Vec<u8>,) = sqlx::query_as(
                "SELECT proto_blob FROM document WHERE id = ?"
            )
            .bind(&project_id)
            .fetch_one(&db)
            .await
            .map_err(|e| e.to_string())?;
            (row.0, 0)
        }
    };

    // Step 2: Collect WAL diffs from base_version to target_version for this scope
    // scope_id matching: empty scope_id means the diff applies globally
    let diff_rows: Vec<(Vec<u8>, i64)> = sqlx::query_as(
        "SELECT proto_blob, version FROM history
         WHERE project_id = ?
           AND (scope_id = '' OR scope_id = ?)
           AND version > ?
           AND version <= ?
         ORDER BY version ASC"
    )
    .bind(&project_id)
    .bind(&scope_id)
    .bind(base_version)
    .bind(target_version)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    // Step 3: Apply diffs — last diff for a given version wins
    // For now, last WAL entry for the scope is the reconstructed state.
    // When proto sub-message extraction is wired, apply field-level merging here.
    let reconstructed = if let Some((last_diff, _)) = diff_rows.last() {
        last_diff.clone()
    } else {
        base_blob
    };

    // Step 4: Return as base64
    Ok(base64_encode(&reconstructed))
}

// ── Base64 helpers ────────────────────────────────────────────────────────────

fn base64_encode(data: &[u8]) -> String {
    use std::io::Write;
    let mut enc = base64::write::EncoderStringWriter::new(
        &base64::engine::general_purpose::STANDARD
    );
    enc.write_all(data).unwrap();
    enc.into_inner()
}

fn base64_decode(data: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("base64 decode error: {}", e))
}