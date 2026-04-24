// src/cf/cache.rs
//
// CF bundle and CourseBrief file system cache.
//
// Layout under app_data_dir:
//   mava_studio/cf_cache/{framework_id}/{framework_version}/framework.json
//   mava_studio/cf_cache/{framework_id}/{framework_version}/brief_{brief_id}.json
//
// {framework_id} is sanitised: '/' and ':' replaced with '_' for filesystem safety.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use tauri::Manager;

use super::types::{CourseBrief, CompetenceFramework};

// ─────────────────────────────────────────────────────────────────────────────
// PATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/// Sanitise a string for use as a filesystem path component.
/// Replaces '/', ':', '\\', and whitespace with '_'.
fn fs_safe(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '/' | ':' | '\\' | ' ' | '\t' => '_',
            c => c,
        })
        .collect()
}

/// Returns the root cache directory: {app_data_dir}/mava_studio/cf_cache
pub fn cache_root(app: &tauri::AppHandle) -> Result<PathBuf> {
    let app_data = app.path().app_data_dir()
        .context("Could not resolve app data directory")?;
    Ok(app_data.join("mava_studio").join("cf_cache"))
}

/// Returns the versioned framework directory:
///   {cache_root}/{framework_id_safe}/{framework_version_safe}
pub fn framework_dir(
    app: &tauri::AppHandle,
    framework_id: &str,
    framework_version: &str,
) -> Result<PathBuf> {
    Ok(cache_root(app)?
        .join(fs_safe(framework_id))
        .join(fs_safe(framework_version)))
}

/// Returns the path to the cached framework JSON file.
pub fn framework_json_path(
    app: &tauri::AppHandle,
    framework_id: &str,
    framework_version: &str,
) -> Result<PathBuf> {
    Ok(framework_dir(app, framework_id, framework_version)?.join("framework.json"))
}

/// Returns the path to a cached brief JSON file.
pub fn brief_json_path(
    app: &tauri::AppHandle,
    framework_id: &str,
    framework_version: &str,
    brief_id: &str,
) -> Result<PathBuf> {
    Ok(framework_dir(app, framework_id, framework_version)?
        .join(format!("brief_{}.json", fs_safe(brief_id))))
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAMEWORK CACHE
// ─────────────────────────────────────────────────────────────────────────────

/// Write a CompetenceFramework to the cache.
/// Creates directories as needed.
pub async fn write_framework(
    app: &tauri::AppHandle,
    framework: &CompetenceFramework,
) -> Result<PathBuf> {
    let path = framework_json_path(
        app,
        &framework.id,
        &framework.metadata.version,
    )?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create cache dir: {:?}", parent))?;
    }

    let json = serde_json::to_string_pretty(framework)
        .context("Failed to serialise framework")?;

    tokio::fs::write(&path, json)
        .await
        .with_context(|| format!("Failed to write framework cache: {:?}", path))?;

    Ok(path)
}

/// Read a CompetenceFramework from the cache.
/// Returns None if the file does not exist.
pub async fn read_framework(
    app: &tauri::AppHandle,
    framework_id: &str,
    framework_version: &str,
) -> Result<Option<CompetenceFramework>> {
    let path = framework_json_path(app, framework_id, framework_version)?;

    if !path.exists() {
        return Ok(None);
    }

    let json = tokio::fs::read_to_string(&path)
        .await
        .with_context(|| format!("Failed to read framework cache: {:?}", path))?;

    let framework: CompetenceFramework = serde_json::from_str(&json)
        .context("Failed to parse cached framework JSON")?;

    Ok(Some(framework))
}

/// Check whether a specific framework version is cached.
pub async fn _framework_is_cached(
    app: &tauri::AppHandle,
    framework_id: &str,
    framework_version: &str,
) -> bool {
    framework_json_path(app, framework_id, framework_version)
        .map(|p| p.exists())
        .unwrap_or(false)
}

/// List all cached versions of a framework.
/// Returns a Vec of version strings in filesystem order.
pub async fn list_cached_versions(
    app: &tauri::AppHandle,
    framework_id: &str,
) -> Result<Vec<String>> {
    let root = cache_root(app)?.join(fs_safe(framework_id));

    if !root.exists() {
        return Ok(vec![]);
    }

    let mut entries = tokio::fs::read_dir(&root)
        .await
        .with_context(|| format!("Failed to read cache dir: {:?}", root))?;

    let mut versions = Vec::new();
    while let Some(entry) = entries.next_entry().await? {
        if entry.file_type().await?.is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                versions.push(name.to_string());
            }
        }
    }
    Ok(versions)
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIEF CACHE
// ─────────────────────────────────────────────────────────────────────────────

/// Write a CourseBrief to the cache.
pub async fn write_brief(
    app: &tauri::AppHandle,
    brief: &CourseBrief,
) -> Result<PathBuf> {
    let path = brief_json_path(
        app,
        &brief.framework_id,
        &brief.framework_version,
        &brief.brief_id,
    )?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create brief cache dir: {:?}", parent))?;
    }

    let json = serde_json::to_string_pretty(brief)
        .context("Failed to serialise brief")?;

    tokio::fs::write(&path, json)
        .await
        .with_context(|| format!("Failed to write brief cache: {:?}", path))?;

    Ok(path)
}

/// Read a CourseBrief from the cache.
/// Returns None if the file does not exist.
pub async fn read_brief(
    app: &tauri::AppHandle,
    framework_id: &str,
    framework_version: &str,
    brief_id: &str,
) -> Result<Option<CourseBrief>> {
    let path = brief_json_path(app, framework_id, framework_version, brief_id)?;

    if !path.exists() {
        return Ok(None);
    }

    let json = tokio::fs::read_to_string(&path)
        .await
        .with_context(|| format!("Failed to read brief cache: {:?}", path))?;

    let brief: CourseBrief = serde_json::from_str(&json)
        .context("Failed to parse cached brief JSON")?;

    Ok(Some(brief))
}

/// Generate a fresh brief_id from the current timestamp + framework_id hash.
pub fn new_brief_id(framework_id: &str, framework_version: &str) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let slug = fs_safe(framework_id);
    format!("brief_{}_{}__{}", slug, fs_safe(framework_version), ts)
}

/// Current Unix timestamp in milliseconds.
pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
