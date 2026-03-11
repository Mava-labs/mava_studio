use chrono::Utc;
use tauri::State;

use crate::models::history::UndoAction;
use crate::state::AppState;

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// Flush an undo action whose payload has exceeded the in-memory threshold
/// to the undo_log table. The frontend clears before/after from memory after this.
#[tauri::command]
pub async fn flush_undo_entry(
    project_id: String,
    entry: UndoAction,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db  = state.project_db(&project_id).await?;
    let now = now_ms();

    sqlx::query(
        "INSERT INTO undo_log
             (action_id, project_id, label, scope_kind, scope_id,
              before_json, after_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(action_id) DO NOTHING"
    )
    .bind(&entry.id)
    .bind(&project_id)
    .bind(&entry.label)
    .bind(&entry.scope.kind)
    .bind(entry.scope.id.as_deref().unwrap_or(""))
    .bind(&entry.before)
    .bind(&entry.after)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reload a previously flushed undo entry by action_id.
/// Called by the frontend when the user tries to undo/redo
/// an action whose payload was evicted from memory.
#[tauri::command]
pub async fn load_undo_entry(
    project_id: String,
    action_id: String,
    state: State<'_, AppState>,
) -> Result<UndoAction, String> {
    let db = state.project_db(&project_id).await?;

    let row: Option<(String, String, String, String, String, String, i64)> = sqlx::query_as(
        "SELECT action_id, label, scope_kind, scope_id, before_json, after_json, created_at
         FROM undo_log
         WHERE action_id = ? AND project_id = ?"
    )
    .bind(&action_id)
    .bind(&project_id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    let (id, label, scope_kind, scope_id, before, after, created_at) =
        row.ok_or_else(|| format!("Undo entry {} not found", action_id))?;

    Ok(UndoAction {
        id,
        label,
        scope: crate::models::history::ScopeRef {
            kind: scope_kind,
            id:   if scope_id.is_empty() { None } else { Some(scope_id) },
        },
        before,
        after,
        created_at,
        flushed_to_wal: true,
    })
}