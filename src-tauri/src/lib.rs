use std::{fs::{File, create_dir_all}, io::{copy, Read, Write}, path::{Path, PathBuf}};

use walkdir::WalkDir;
use zip::{ZipArchive, ZipWriter, write::FileOptions, CompressionMethod};
use chrono::Utc;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn extract_mava_archive(mava_path: String) -> Result<String, String> {
    let archive_path = PathBuf::from(&mava_path);
    if !archive_path.exists() {
        return Err("Archive does not exist".into());
    }

    let mut archive = ZipArchive::new(File::open(&archive_path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    let workspace_dir = std::env::temp_dir().join(format!(
        "mava_workspace_{}",
        chrono::Utc::now().timestamp_millis()
    ));
    create_dir_all(&workspace_dir).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = workspace_dir.join(file.name());

        if file.name().ends_with('/') {
            create_dir_all(&outpath).map_err(|e| e.to_string())?;
            continue;
        }

        if let Some(parent) = outpath.parent() {
            create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
        copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
    }

    Ok(workspace_dir
        .to_str()
        .ok_or_else(|| "Failed to convert workspace path".to_string())?
        .to_string())
}

#[tauri::command]
fn pack_mava_archive(workspace_path: String, dest_mava_path: String) -> Result<(), String> {
    let workspace = PathBuf::from(&workspace_path);
    if !workspace.exists() {
        return Err("Workspace does not exist".into());
    }

    let dest_tmp = PathBuf::from(format!("{}.tmp", dest_mava_path));
    let file = File::create(&dest_tmp).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    for entry in WalkDir::new(&workspace) {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let rel = path.strip_prefix(&workspace).map_err(|e| e.to_string())?;
        if rel.as_os_str().is_empty() {
            continue;
        }

        let name = rel.to_string_lossy().replace("\\", "/");

        if path.is_dir() {
            zip.add_directory(name, options).map_err(|e| e.to_string())?;
        } else {
            zip.start_file(name, options).map_err(|e| e.to_string())?;
            let mut f = File::open(path).map_err(|e| e.to_string())?;
            copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    std::fs::rename(&dest_tmp, &dest_mava_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, extract_mava_archive, pack_mava_archive])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
