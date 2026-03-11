use chrono::Utc;
use tauri::State;

use crate::models::page::{LoadPageResult, Page};
use crate::state::AppState;

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// Load a single page blob from the project database.
#[tauri::command]
pub async fn load_page(
    project_id: String,
    page_id: String,
    state: State<'_, AppState>,
) -> Result<LoadPageResult, String> {
    let db = state.project_db(&project_id).await?;

    let row: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT proto_blob FROM pages WHERE id = ? AND project_id = ?"
    )
    .bind(&page_id)
    .bind(&project_id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    let (blob,) = row.ok_or_else(|| format!("Page {} not found", page_id))?;

    let page: Page = serde_json::from_slice(&blob)
        .map_err(|e| format!("Failed to deserialise page: {}", e))?;

    Ok(LoadPageResult { page })
}

/// Persist a page blob to the project database.
#[tauri::command]
pub async fn save_page(
    project_id: String,
    page: Page,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db  = state.project_db(&project_id).await?;
    let now = now_ms();

    let blob = serde_json::to_vec(&page)
        .map_err(|e| format!("Failed to serialise page: {}", e))?;

    sqlx::query(
        "INSERT INTO pages (id, project_id, proto_blob, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
             proto_blob = excluded.proto_blob,
             updated_at = excluded.updated_at"
    )
    .bind(&page.id)
    .bind(&project_id)
    .bind(&blob)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}