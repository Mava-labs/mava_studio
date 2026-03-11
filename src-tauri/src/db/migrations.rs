use sqlx::SqlitePool;
use anyhow::Result;

/// Current schema version for project databases.
/// Increment this when the schema changes — add a migration arm below.
const PROJECT_SCHEMA_VERSION: i64 = 1;

/// Current schema version for the app state database.
const APP_SCHEMA_VERSION: i64 = 1;

/// Apply all pending project database migrations.
pub async fn run_project_migrations(pool: &SqlitePool) -> Result<()> {
    // Ensure the meta table exists first (bootstraps everything else)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )"
    )
    .execute(pool)
    .await?;

    let version = get_version(pool, "schema_version").await?;

    if version < 1 {
        apply_project_v1(pool).await?;
        set_version(pool, "schema_version", PROJECT_SCHEMA_VERSION).await?;
    }

    // Future migrations:
    // if version < 2 { apply_project_v2(pool).await?; ... }

    Ok(())
}

/// Apply all pending app state database migrations.
pub async fn run_app_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )"
    )
    .execute(pool)
    .await?;

    let version = get_version(pool, "schema_version").await?;

    if version < 1 {
        apply_app_v1(pool).await?;
        set_version(pool, "schema_version", APP_SCHEMA_VERSION).await?;
    }

    Ok(())
}

// ── Migration implementations ────────────────────────────────────────────────

async fn apply_project_v1(pool: &SqlitePool) -> Result<()> {
    // Document table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS document (
            id         TEXT    PRIMARY KEY,
            proto_blob BLOB    NOT NULL,
            updated_at INTEGER NOT NULL
        )"
    ).execute(pool).await?;

    // Pages
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS pages (
            id         TEXT    PRIMARY KEY,
            project_id TEXT    NOT NULL,
            proto_blob BLOB    NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES document(id)
        )"
    ).execute(pool).await?;

    // Components
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS components (
            id         TEXT    PRIMARY KEY,
            project_id TEXT    NOT NULL,
            proto_blob BLOB    NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES document(id)
        )"
    ).execute(pool).await?;

    // History WAL
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT    NOT NULL,
            scope_kind TEXT    NOT NULL,
            scope_id   TEXT    NOT NULL DEFAULT '',
            version    INTEGER NOT NULL,
            proto_blob BLOB    NOT NULL,
            created_at INTEGER NOT NULL,
            session_id TEXT    NOT NULL DEFAULT '',
            FOREIGN KEY (project_id) REFERENCES document(id)
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_history_scope
         ON history (project_id, scope_kind, scope_id, version)"
    ).execute(pool).await?;

    // Snapshots
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS snapshots (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT    NOT NULL,
            version    INTEGER NOT NULL,
            label      TEXT    NOT NULL DEFAULT '',
            proto_blob BLOB    NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES document(id)
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_snapshots_version
         ON snapshots (project_id, version)"
    ).execute(pool).await?;

    // Undo log
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS undo_log (
            action_id  TEXT    PRIMARY KEY,
            project_id TEXT    NOT NULL,
            label      TEXT    NOT NULL,
            scope_kind TEXT    NOT NULL,
            scope_id   TEXT    NOT NULL DEFAULT '',
            before_json TEXT   NOT NULL,
            after_json  TEXT   NOT NULL,
            created_at  INTEGER NOT NULL,
            session_id  TEXT    NOT NULL DEFAULT '',
            FOREIGN KEY (project_id) REFERENCES document(id)
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_undo_log_project
         ON undo_log (project_id, created_at)"
    ).execute(pool).await?;

    Ok(())
}

async fn apply_app_v1(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS recent_projects (
            project_id     TEXT    PRIMARY KEY,
            project_name   TEXT    NOT NULL,
            archive_path   TEXT    NOT NULL,
            thumbnail      TEXT,
            last_opened_at INTEGER NOT NULL
        )"
    ).execute(pool).await?;

    Ok(())
}

// ── Version helpers ──────────────────────────────────────────────────────────

async fn get_version(pool: &SqlitePool, key: &str) -> Result<i64> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM meta WHERE key = ?"
    )
    .bind(key)
    .fetch_optional(pool)
    .await?;

    Ok(row
        .and_then(|(v,)| v.parse::<i64>().ok())
        .unwrap_or(0))
}

async fn set_version(pool: &SqlitePool, key: &str, version: i64) -> Result<()> {
    sqlx::query(
        "INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(key)
    .bind(version.to_string())
    .execute(pool)
    .await?;
    Ok(())
}