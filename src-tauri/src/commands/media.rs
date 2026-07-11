// src/commands/media.rs
//
// Media asset import/retrieval — content-addressed blob storage inside the
// project's own .mava database (media_blobs table, db/migrations.rs v2),
// so a project stays a single self-contained file rather than referencing
// files at their original, machine-specific location on disk.
//
// import_media_asset(): reads a file the author picked via the frontend's
//   file dialog, hashes it, and stores the bytes as a blob keyed by that
//   hash — re-importing identical content (or the same file used by
//   multiple elements) is a dedup no-op, not duplicate storage.
// extract_media_blob(): the reverse — given a hash, writes the blob out to
//   a cache file under the app's data directory (same layout convention as
//   cf/cache.rs's CF bundle cache) and returns that path, so the frontend
//   can convertFileSrc() it into something the webview can actually load.
//   Blobs live in SQLite for portability; the extracted file is just a
//   throwaway local cache, safe to lose and re-extract at any time.

use chrono::Utc;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, State};

use crate::models::project::MediaAsset;
use crate::state::AppState;

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

fn guess_mime(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "mkv" => "video/x-matroska",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        _ => "application/octet-stream",
    }
}

fn mime_to_ext(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        "image/bmp" => "bmp",
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "video/x-msvideo" => "avi",
        "video/x-matroska" => "mkv",
        "audio/mpeg" => "mp3",
        "audio/wav" => "wav",
        "audio/ogg" => "ogg",
        "audio/mp4" => "m4a",
        "audio/flac" => "flac",
        _ => "bin",
    }
}

fn hex_digest(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

#[tauri::command]
pub async fn import_media_asset(
    project_id: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<MediaAsset, String> {
    let db = state.project_db(&project_id).await?;

    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", path, e))?;

    let hash = hex_digest(&bytes);

    let file_name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());

    let ext = std::path::Path::new(&path)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    let mime = guess_mime(&ext);
    let size_bytes = bytes.len() as i64;
    let now = now_ms();

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT hash FROM media_blobs WHERE hash = ? AND project_id = ?"
    )
    .bind(&hash)
    .bind(&project_id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    if existing.is_none() {
        sqlx::query(
            "INSERT INTO media_blobs (hash, project_id, mime_type, data, size_bytes, created_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&hash)
        .bind(&project_id)
        .bind(mime)
        .bind(&bytes)
        .bind(size_bytes)
        .bind(now)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(MediaAsset {
        id: format!("media_{}", uuid::Uuid::new_v4()),
        name: file_name,
        kind: mime.to_string(),
        url: format!("mava-blob:{}", hash),
        hash: Some(hash),
        size_bytes: Some(size_bytes),
        created_at: now,
    })
}

#[tauri::command]
pub async fn extract_media_blob(
    app: AppHandle,
    project_id: String,
    hash: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db = state.project_db(&project_id).await?;

    let row: Option<(Vec<u8>, String)> = sqlx::query_as(
        "SELECT data, mime_type FROM media_blobs WHERE hash = ? AND project_id = ?"
    )
    .bind(&hash)
    .bind(&project_id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    let (data, mime) = row.ok_or_else(|| format!("Media blob {} not found", hash))?;

    let cache_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("mava_studio")
        .join("media_cache");

    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    let file_path = cache_dir.join(format!("{}.{}", hash, mime_to_ext(&mime)));

    // Content-addressed — if it's already on disk, the bytes are guaranteed
    // identical (same hash), so skip rewriting rather than re-extracting on
    // every single insert/load.
    if !file_path.exists() {
        tokio::fs::write(&file_path, &data)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(file_path.to_string_lossy().to_string())
}
