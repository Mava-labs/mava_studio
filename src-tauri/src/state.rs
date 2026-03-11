use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::RwLock;
use crate::db::{AppDb, ProjectDb};

/// State for a single open project session.
#[derive(Debug)]
pub struct ProjectSession {
    /// Path to the .mava SQLite file.
    pub file_path:  PathBuf,
    /// Connection pool for this project's database.
    pub db:         ProjectDb,
    /// Session id — matches the SessionLock on the frontend.
    pub session_id: String,
    /// User id of whoever holds the lock.
    pub user_id:    String,
    /// Current WAL version counter — incremented on every flush.
    pub wal_version: i64,
}

/// Global application state managed by Tauri.
/// Wrapped in RwLock so commands can take concurrent read locks
/// and exclusive write locks only when mutating sessions.
pub struct AppState {
    /// App-level database (recent projects, preferences).
    pub app_db: AppDb,
    /// Currently open project sessions keyed by project_id.
    pub sessions: RwLock<HashMap<String, ProjectSession>>,
}

impl AppState {
    pub fn new(app_db: AppDb) -> Self {
        Self {
            app_db,
            sessions: RwLock::new(HashMap::new()),
        }
    }

    /// Get the db pool for an open project.
    /// Returns an error string if the project is not open.
    pub async fn project_db(&self, project_id: &str) -> Result<ProjectDb, String> {
        let sessions = self.sessions.read().await;
        sessions
            .get(project_id)
            .map(|s| s.db.clone())
            .ok_or_else(|| format!("No open session for project {}", project_id))
    }

    /// Increment and return the next WAL version for a project.
    pub async fn next_wal_version(&self, project_id: &str) -> Result<i64, String> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(project_id)
            .ok_or_else(|| format!("No open session for project {}", project_id))?;
        session.wal_version += 1;
        Ok(session.wal_version)
    }
}