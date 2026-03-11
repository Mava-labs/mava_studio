pub mod migrations;

use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::Path;
use anyhow::Result;

/// Connection pool for a single project .mava SQLite file.
pub type ProjectDb = SqlitePool;

/// Connection pool for the app-level state database.
pub type AppDb = SqlitePool;

/// Open or create a project database at the given path.
/// Runs schema migrations before returning.
pub async fn open_project_db(path: &Path) -> Result<ProjectDb> {
    let url = format!(
        "sqlite://{}?mode=rwc",
        path.to_str().expect("non-UTF8 path")
    );

    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await?;

    // Enable WAL mode for better concurrent read performance
    // and crash safety during writes.
    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA synchronous=NORMAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(&pool)
        .await?;

    migrations::run_project_migrations(&pool).await?;
    Ok(pool)
}

/// Open or create the app-level state database.
/// Lives in the Tauri app data directory.
pub async fn open_app_db(app_data_dir: &Path) -> Result<AppDb> {
    let path = app_data_dir.join("app_state.sqlite");
    let url = format!(
        "sqlite://{}?mode=rwc",
        path.to_str().expect("non-UTF8 path")
    );

    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await?;

    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(&pool)
        .await?;

    migrations::run_app_migrations(&pool).await?;
    Ok(pool)
}