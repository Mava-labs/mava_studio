use std::collections::HashMap;
use std::path::PathBuf;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

use crate::db;
use crate::models::project::*;
use crate::state::{AppState, ProjectSession};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

/// Serialise ProjectData to JSON bytes for storage.
fn serialise_project(data: &ProjectData) -> Result<Vec<u8>, String> {
    serde_json::to_vec(data).map_err(|e| e.to_string())
}

/// Deserialise ProjectData from stored JSON bytes.
fn deserialise_project(bytes: &[u8]) -> Result<ProjectData, String> {
    serde_json::from_slice(bytes).map_err(|e| e.to_string())
}

/// Upsert the recent_projects record in the app db.
async fn upsert_recent(
    app_db: &db::AppDb,
    project_id: &str,
    project_name: &str,
    archive_path: &str,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO recent_projects (project_id, project_name, archive_path, last_opened_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
             project_name   = excluded.project_name,
             archive_path   = excluded.archive_path,
             last_opened_at = excluded.last_opened_at"
    )
    .bind(project_id)
    .bind(project_name)
    .bind(archive_path)
    .bind(now_ms())
    .execute(app_db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Create a brand-new project, initialise its SQLite file, and open a session.
#[tauri::command]
pub async fn create_project(
    name: String,
    path: String,        // workspace / temp path (legacy, may be same as archive_path)
    archive_path: String, // where the .mava SQLite file lives
    state: State<'_, AppState>,
) -> Result<CreateProjectResult, String> {
    let db_path = PathBuf::from(&archive_path);

    // Open (creates if not exists) and migrate
    let project_db = db::open_project_db(&db_path)
        .await
        .map_err(|e| e.to_string())?;

    let project_id = new_id();
    let session_id = new_id();
    let page_id    = new_id();
    let course_id  = new_id();
    let now        = now_ms();

    // Build initial course
    let course = Course {
        id:          course_id.clone(),
        modules:     vec![],
        cf_node_ids: vec![],
        metadata: CourseMetadata {
            title:       name.clone(),
            subtitle:    None,
            description: String::new(),
            category:    None,
            target_audience: None,
            difficulty:  None,
            duration:    0,
            prerequisites: vec![],
            tags:        vec![],
            cover_image: None,
            author:      None,
            languages:   vec![],
            visibility:  Some("draft".into()),
            licensing:   None,
            pricing:     None,
            release_schedule: None,
            completion_requirements: vec![],
            url:         None,
            published_at: serde_json::Value::String("pending".into()),
            version:     1,
            created_at:  now,
            updated_at:  now,
            last_edited_by: LastEditedBy { user_id: String::new(), name: String::new() },
        },
    };

    let project_data = ProjectData {
        project_version:      1,
        project_id:           project_id.clone(),
        project_name:         name.clone(),
        project_path:         Some(path.clone()),
        project_archive_path: Some(archive_path.clone()),
        created_at:           now,
        updated_at:           now,
        authors:              vec![],
        course,
        modules_by_id:        HashMap::new(),
        lessons_by_id:        HashMap::new(),
        pages_by_id:          HashMap::new(),
        component_library:    HashMap::new(),
        media_library:        HashMap::new(),
        dsl_triggers:         HashMap::new(),
        action_scripts:       HashMap::new(),
    };

    // Persist document blob
    let blob = serialise_project(&project_data)?;
    sqlx::query(
        "INSERT INTO document (id, proto_blob, updated_at) VALUES (?, ?, ?)"
    )
    .bind(&project_id)
    .bind(&blob)
    .bind(now)
    .execute(&project_db)
    .await
    .map_err(|e| e.to_string())?;

    // Write meta
    sqlx::query(
        "INSERT INTO meta (key, value) VALUES ('project_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&project_id)
    .execute(&project_db)
    .await
    .map_err(|e| e.to_string())?;

    // Create initial blank page blob
    let page_blob = build_blank_page_blob(&page_id, &project_id, now)?;
    sqlx::query(
        "INSERT INTO pages (id, project_id, proto_blob, updated_at) VALUES (?, ?, ?, ?)"
    )
    .bind(&page_id)
    .bind(&project_id)
    .bind(&page_blob)
    .bind(now)
    .execute(&project_db)
    .await
    .map_err(|e| e.to_string())?;

    // Register session
    let session = ProjectSession {
        file_path:   db_path,
        db:          project_db,
        session_id:  session_id.clone(),
        user_id:     String::new(),
        wal_version: 0,
    };
    state.sessions.write().await.insert(project_id.clone(), session);

    // Update recent projects
    upsert_recent(&state.app_db, &project_id, &name, &archive_path).await?;

    let session_lock = SessionLock {
        session_id,
        user_id:   String::new(),
        user_name: String::new(),
        role:      "owner".into(),
        locked_at: now,
        file_path: archive_path,
    };

    Ok(CreateProjectResult {
        project_data,
        new_page_id: page_id,
        session_lock,
    })
}

/// Load an existing project from a .mava file path.
#[tauri::command]
pub async fn load_project(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<LoadProjectResult, String> {
    let db_path = PathBuf::from(&file_path);
    if !db_path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let project_db = db::open_project_db(&db_path)
        .await
        .map_err(|e| e.to_string())?;

    // Read the project_id from meta
    let row: (String,) = sqlx::query_as(
        "SELECT value FROM meta WHERE key = 'project_id'"
    )
    .fetch_one(&project_db)
    .await
    .map_err(|e| format!("Failed to read project meta: {}", e))?;
    let project_id = row.0;

    // Load document blob
    let row: (Vec<u8>, i64) = sqlx::query_as(
        "SELECT proto_blob, updated_at FROM document WHERE id = ?"
    )
    .bind(&project_id)
    .fetch_one(&project_db)
    .await
    .map_err(|e| format!("Failed to load document: {}", e))?;

    let mut project_data = deserialise_project(&row.0)?;
    project_data.project_archive_path = Some(file_path.clone());

    let session_id = new_id();
    let now        = now_ms();

    // Register session
    let session = ProjectSession {
        file_path:   db_path,
        db:          project_db,
        session_id:  session_id.clone(),
        user_id:     String::new(),
        wal_version: _get_current_wal_version_sync(&project_id, &state).await,
    };
    state.sessions.write().await.insert(project_id.clone(), session);

    // Update recent projects
    upsert_recent(
        &state.app_db,
        &project_id,
        &project_data.project_name,
        &file_path,
    ).await?;

    let session_lock = SessionLock {
        session_id,
        user_id:   String::new(),
        user_name: String::new(),
        role:      "editor".into(),
        locked_at: now,
        file_path,
    };

    Ok(LoadProjectResult { project_data, session_lock })
}

/// Explicit full save — overwrites the document blob.
#[tauri::command]
pub async fn save_project(
    project_id: String,
    project_data: ProjectData,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db  = state.project_db(&project_id).await?;
    let now = now_ms();
    let blob = serialise_project(&project_data)?;

    sqlx::query(
        "INSERT INTO document (id, proto_blob, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET proto_blob = excluded.proto_blob, updated_at = excluded.updated_at"
    )
    .bind(&project_id)
    .bind(&blob)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Release the session lock and close the db pool.
#[tauri::command]
pub async fn close_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.write().await;
    if let Some(session) = sessions.remove(&project_id) {
        session.db.close().await;
    }
    Ok(())
}

/// Return the 10 most recently opened projects.
#[tauri::command]
pub async fn get_recent_projects(
    state: State<'_, AppState>,
) -> Result<Vec<RecentProject>, String> {
    let rows: Vec<(String, String, String, Option<String>, i64)> = sqlx::query_as(
        "SELECT project_id, project_name, archive_path, thumbnail, last_opened_at
         FROM recent_projects
         ORDER BY last_opened_at DESC
         LIMIT 10"
    )
    .fetch_all(&state.app_db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(project_id, project_name, archive_path, thumbnail, last_opened_at)| {
        RecentProject { project_id, project_name, archive_path, thumbnail, last_opened_at }
    }).collect())
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn build_blank_page_blob(page_id: &str, _project_id: &str, now: i64) -> Result<Vec<u8>, String> {
    use crate::models::page::*;

    let page = Page {
        id:       page_id.to_string(),
        visible:  true,
        stage: Stage {
            width:      1280.0,
            height:     720.0,
            background: "#1e1e1e".into(),
            display:    serde_json::json!({ "columns": "1", "rows": "1", "gap": "0" }),
        },
        elements:  HashMap::new(),
        root_ids:  vec![],
        metadata: PageMetadata {
            title:          "Page 1".into(),
            description:    None,
            duration:       None,
            version:        1,
            created_at:     now,
            updated_at:     now,
            last_edited_by: LastEditedBy { user_id: String::new(), name: String::new() },
        },
    };

    serde_json::to_vec(&page).map_err(|e| e.to_string())
}

async fn _get_current_wal_version_sync(
    project_id: &str,
    state: &AppState,
) -> i64 {
    // We need the db before the session is registered, so query directly
    // This is called only during load_project before session insertion
    // Return 0 as safe default — the version will catch up from the db
    let sessions = state.sessions.read().await;
    sessions.get(project_id).map(|s| s.wal_version).unwrap_or(0)
}