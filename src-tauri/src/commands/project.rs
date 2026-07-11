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

fn serialise_project(data: &ProjectData) -> Result<Vec<u8>, String> {
    serde_json::to_vec(data).map_err(|e| e.to_string())
}

fn deserialise_project(bytes: &[u8]) -> Result<ProjectData, String> {
    serde_json::from_slice(bytes).map_err(|e| e.to_string())
}

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
    path: String,
    archive_path: String,
    state: State<'_, AppState>,
) -> Result<CreateProjectResult, String> {
    let db_path = PathBuf::from(&archive_path);

    let project_db = db::open_project_db(&db_path)
        .await
        .map_err(|e| e.to_string())?;

    let project_id = new_id();
    let session_id = new_id();
    let course_id  = new_id();
    let module_id  = new_id();
    let lesson_id  = new_id();
    let page_id    = new_id();
    let now        = now_ms();
    let blank = LastEditedBy { user_id: String::new(), name: String::new() };

    // ── Scaffold: 1 module → 1 lesson → 1 page ───────────────────────────

    let lesson = Lesson {
        id:          lesson_id.clone(),
        kind:        "activity".into(),
        visible:     true,
        cf_node_ids: vec![],
        summary:     None,
        pages: vec![ChildRef {
            id:    page_id.clone(),
            name:  "Page 1".into(),
            order: 1,
        }],
        metadata: LessonMetadata {
            title:                     "Lesson 1".into(),
            description:               None,
            duration:                  0,
            url:                       None,
            version:                   1,
            created_at:                now,
            updated_at:                now,
            last_edited_by:            blank.clone(),
            estimated_completion_time: None,
            required:                  Some(true),
            auto_complete:             Some(false),
            prerequisites:             vec![],
            tags:                      vec![],
        },
    };

    let module = Module {
        id:          module_id.clone(),
        visible:     true,
        notes:       None,
        cf_node_ids: vec![],
        lessons: vec![ChildRef {
            id:    lesson_id.clone(),
            name:  "Lesson 1".into(),
            order: 1,
        }],
        metadata: ModuleMetadata {
            title:                     "Module 1".into(),
            description:               None,
            duration:                  0,
            url:                       None,
            version:                   1,
            created_at:                now,
            updated_at:                now,
            last_edited_by:            blank.clone(),
            overview:                  None,
            estimated_completion_time: None,
            prerequisites:             vec![],
            unlock_conditions:         vec![],
            tags:                      vec![],
        },
    };

    let course = Course {
        id:          course_id.clone(),
        cf_node_ids: vec![],
        modules: vec![ChildRef {
            id:    module_id.clone(),
            name:  "Module 1".into(),
            order: 1,
        }],
        metadata: CourseMetadata {
            title:                   name.clone(),
            subtitle:                None,
            description:             String::new(),
            category:                None,
            target_audience:         None,
            difficulty:              None,
            duration:                0,
            prerequisites:           vec![],
            tags:                    vec![],
            cover_image:             None,
            author:                  None,
            languages:               vec![],
            visibility:              Some("draft".into()),
            licensing:               None,
            pricing:                 None,
            release_schedule:        None,
            completion_requirements: vec![],
            url:                     None,
            published_at:            serde_json::Value::String("pending".into()),
            version:                 1,
            created_at:              now,
            updated_at:              now,
            last_edited_by:          blank.clone(),
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
        modules_by_id:     HashMap::from([(module_id.clone(), module)]),
        lessons_by_id:     HashMap::from([(lesson_id.clone(), lesson)]),
        pages_by_id:       HashMap::new(), // pages owned by pagesStore
        component_library: HashMap::new(),
        media_library:     HashMap::new(),
        variable_definitions: HashMap::new(),
        dsl_triggers:      HashMap::new(),
        action_scripts:    HashMap::new(),
    };

    let blob = serialise_project(&project_data)?;
    sqlx::query("INSERT INTO document (id, proto_blob, updated_at) VALUES (?, ?, ?)")
        .bind(&project_id).bind(&blob).bind(now)
        .execute(&project_db).await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO meta (key, value) VALUES ('project_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&project_id)
    .execute(&project_db).await.map_err(|e| e.to_string())?;

    let page_blob = build_blank_page_blob(&page_id, now)?;
    sqlx::query("INSERT INTO pages (id, project_id, proto_blob, updated_at) VALUES (?, ?, ?, ?)")
        .bind(&page_id).bind(&project_id).bind(&page_blob).bind(now)
        .execute(&project_db).await.map_err(|e| e.to_string())?;

    state.sessions.write().await.insert(project_id.clone(), ProjectSession {
        file_path:   db_path,
        db:          project_db,
        session_id:  session_id.clone(),
        user_id:     String::new(),
        wal_version: 0,
    });

    upsert_recent(&state.app_db, &project_id, &name, &archive_path).await?;

    Ok(CreateProjectResult {
        project_data,
        new_page_id: page_id,
        session_lock: SessionLock {
            session_id,
            user_id:   String::new(),
            user_name: String::new(),
            role:      "owner".into(),
            locked_at: now,
            file_path: archive_path,
        },
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

    let row: (String,) = sqlx::query_as("SELECT value FROM meta WHERE key = 'project_id'")
        .fetch_one(&project_db).await
        .map_err(|e| format!("Failed to read project meta: {}", e))?;
    let project_id = row.0;

    let row: (Vec<u8>, i64) = sqlx::query_as(
        "SELECT proto_blob, updated_at FROM document WHERE id = ?"
    )
    .bind(&project_id)
    .fetch_one(&project_db).await
    .map_err(|e| format!("Failed to load document: {}", e))?;

    let mut project_data = deserialise_project(&row.0)?;
    project_data.project_archive_path = Some(file_path.clone());

    // ── Migrate old projects with empty hierarchy ─────────────────────────
    // Projects created before the scaffold fix have modules_by_id: {}.
    // Detect this and insert a default module → lesson → page so the
    // explorer tree is never empty after open.
    if project_data.modules_by_id.is_empty() {
        let module_id = new_id();
        let lesson_id = new_id();
        let now_local = now_ms();
        let blank = LastEditedBy { user_id: String::new(), name: String::new() };

        // Try to find any existing page in the pages table to attach
        let existing_page: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM pages WHERE project_id = ? LIMIT 1"
        )
        .bind(&project_id)
        .fetch_optional(&project_db)
        .await
        .map_err(|e| e.to_string())?;

        let page_id = existing_page
            .map(|(id,)| id)
            .unwrap_or_else(new_id);

        let lesson = Lesson {
            id:          lesson_id.clone(),
            kind:        "activity".into(),
            visible:     true,
            cf_node_ids: vec![],
            summary:     None,
            pages: vec![ChildRef {
                id:    page_id.clone(),
                name:  "Page 1".into(),
                order: 1,
            }],
            metadata: LessonMetadata {
                title:                     "Lesson 1".into(),
                description:               None,
                duration:                  0,
                url:                       None,
                version:                   1,
                created_at:                now_local,
                updated_at:                now_local,
                last_edited_by:            blank.clone(),
                estimated_completion_time: None,
                required:                  Some(true),
                auto_complete:             Some(false),
                prerequisites:             vec![],
                tags:                      vec![],
            },
        };

        let module = Module {
            id:          module_id.clone(),
            visible:     true,
            notes:       None,
            cf_node_ids: vec![],
            lessons: vec![ChildRef {
                id:    lesson_id.clone(),
                name:  "Lesson 1".into(),
                order: 1,
            }],
            metadata: ModuleMetadata {
                title:                     "Module 1".into(),
                description:               None,
                duration:                  0,
                url:                       None,
                version:                   1,
                created_at:                now_local,
                updated_at:                now_local,
                last_edited_by:            blank.clone(),
                overview:                  None,
                estimated_completion_time: None,
                prerequisites:             vec![],
                unlock_conditions:         vec![],
                tags:                      vec![],
            },
        };

        // Link module into course
        project_data.course.modules = vec![ChildRef {
            id:    module_id.clone(),
            name:  "Module 1".into(),
            order: 1,
        }];
        project_data.modules_by_id.insert(module_id, module);
        project_data.lessons_by_id.insert(lesson_id, lesson);

        // Persist the migrated document blob
        let migrated_blob = serialise_project(&project_data)?;
        sqlx::query(
            "UPDATE document SET proto_blob = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&migrated_blob)
        .bind(now_local)
        .bind(&project_id)
        .execute(&project_db)
        .await
        .map_err(|e| e.to_string())?;
    }

    let session_id = new_id();
    let now        = now_ms();

    state.sessions.write().await.insert(project_id.clone(), ProjectSession {
        file_path:   db_path,
        db:          project_db,
        session_id:  session_id.clone(),
        user_id:     String::new(),
        wal_version: 0,
    });

    upsert_recent(&state.app_db, &project_id, &project_data.project_name, &file_path).await?;

    Ok(LoadProjectResult {
        project_data,
        session_lock: SessionLock {
            session_id,
            user_id:   String::new(),
            user_name: String::new(),
            role:      "editor".into(),
            locked_at: now,
            file_path,
        },
    })
}

/// Explicit full save — overwrites the document blob in the open project db.
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
         ON CONFLICT(id) DO UPDATE SET
             proto_blob = excluded.proto_blob,
             updated_at = excluded.updated_at"
    )
    .bind(&project_id).bind(&blob).bind(now)
    .execute(&db).await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Save As — copies the entire .mava SQLite file to a new path,
/// closes the old session, opens a new one against the copy,
/// and updates the project's archive path in the document blob.
///
/// The original file is left untouched at its old location.
/// The new file becomes the active project going forward.
#[tauri::command]
pub async fn copy_project_to(
    project_id: String,
    destination_path: String,
    state: State<'_, AppState>,
) -> Result<CopyProjectResult, String> {
    let dest = PathBuf::from(&destination_path);

    // Validate destination parent exists
    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            return Err(format!(
                "Destination directory does not exist: {}",
                parent.display()
            ));
        }
    }

    // Get the source path from the current session
    let source_path = {
        let sessions = state.sessions.read().await;
        sessions
            .get(&project_id)
            .map(|s| s.file_path.clone())
            .ok_or_else(|| format!("No open session for project {}", project_id))?
    };

    // Flush WAL to the main db file before copying so the copy is fully consistent.
    // This is done by running a checkpoint on the source connection.
    {
        let db = state.project_db(&project_id).await?;
        sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);")
            .execute(&db)
            .await
            .map_err(|e| format!("WAL checkpoint failed: {}", e))?;
    }

    // Copy the SQLite file to the destination
    std::fs::copy(&source_path, &dest)
        .map_err(|e| format!("Failed to copy project file: {}", e))?;

    // Close the old session
    {
        let mut sessions = state.sessions.write().await;
        if let Some(session) = sessions.remove(&project_id) {
            session.db.close().await;
        }
    }

    // Open new session against the copy
    let new_db = db::open_project_db(&dest)
        .await
        .map_err(|e| e.to_string())?;

    let now        = now_ms();
    let session_id = new_id();

    // Update archive_path inside the copied document blob
    let row: (Vec<u8>,) = sqlx::query_as("SELECT proto_blob FROM document WHERE id = ?")
        .bind(&project_id)
        .fetch_one(&new_db).await
        .map_err(|e| e.to_string())?;

    let mut project_data = deserialise_project(&row.0)?;
    project_data.project_archive_path = Some(destination_path.clone());
    let updated_blob = serialise_project(&project_data)?;

    sqlx::query(
        "UPDATE document SET proto_blob = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&updated_blob).bind(now).bind(&project_id)
    .execute(&new_db).await.map_err(|e| e.to_string())?;

    // Register new session
    state.sessions.write().await.insert(project_id.clone(), ProjectSession {
        file_path:   dest,
        db:          new_db,
        session_id:  session_id.clone(),
        user_id:     String::new(),
        wal_version: 0,
    });

    // Update recent projects to point at new path
    upsert_recent(
        &state.app_db,
        &project_id,
        &project_data.project_name,
        &destination_path,
    ).await?;

    Ok(CopyProjectResult {
        project_data,
        session_lock: SessionLock {
            session_id,
            user_id:   String::new(),
            user_name: String::new(),
            role:      "owner".into(),
            locked_at: now,
            file_path: destination_path,
        },
    })
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

/// Remove a single entry from the recent projects list.
/// Called when the user dismisses a recent item from the Welcome screen.
#[tauri::command]
pub async fn remove_recent_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM recent_projects WHERE project_id = ?")
        .bind(&project_id)
        .execute(&state.app_db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Open the folder containing the project file in the OS file manager.
/// On Windows: Explorer. On macOS: Finder. On Linux: xdg-open.
#[tauri::command]
pub async fn reveal_in_explorer(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let file_path = {
        let sessions = state.sessions.read().await;
        sessions
            .get(&project_id)
            .map(|s| s.file_path.clone())
            .ok_or_else(|| format!("No open session for project {}", project_id))?
    };

    let parent = file_path
        .parent()
        .ok_or_else(|| "Could not determine parent directory".to_string())?;

    #[cfg(target_os = "windows")]
    {
        // On Windows, use `explorer /select,<file>` to highlight the file itself
        std::process::Command::new("explorer")
            .args([
                "/select,",
                file_path.to_str().unwrap_or(parent.to_str().unwrap_or(".")),
            ])
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, use `open -R <file>` to reveal and select the file in Finder
        std::process::Command::new("open")
            .args(["-R", file_path.to_str().unwrap_or(".")])
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, open the parent directory — xdg-open doesn't support file selection
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn build_blank_page_blob(page_id: &str, now: i64) -> Result<Vec<u8>, String> {
    use crate::models::page::*;
    use std::collections::HashMap;

    let page = Page {
        id:      page_id.to_string(),
        visible: true,
        stage: Stage {
            width:      1280.0,
            height:     720.0,
            background: "#1e1e1e".into(),
            display:    serde_json::json!({ "columns": "1", "rows": "1", "gap": "0" }),
        },
        elements: HashMap::new(),
        root_ids: vec![],
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