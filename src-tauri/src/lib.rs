mod db;
mod models;
mod commands;
mod state;
mod cf;

/// Auto-generated protobuf types from proto/mava.proto via prost-build.
/// These are NOT a source file — prost compiles them into OUT_DIR at build time.
/// Reference these types when graduating from JSON blobs to proto serialisation.
#[allow(dead_code)]
pub mod proto {
    include!(concat!(env!("OUT_DIR"), "/mava.rs"));
}

use state::AppState;
use tauri::Manager;
use cf::{
    cf_cache_framework,
    cf_mapper_run,
    cf_inspector_run,
    cf_get_brief,
    cf_list_cached_frameworks,
};

use commands::{
    project::{
        create_project, load_project, save_project,
        copy_project_to, close_project,
        get_recent_projects, remove_recent_project,
        reveal_in_explorer,
    },
    pages::{load_page, save_page},
    history::{flush_scope_wal, autosave_scope, commit_snapshot, reconstruct_version},
    undo::{flush_undo_entry, load_undo_entry},
    media::{import_media_asset, extract_media_blob},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Plugins ───────────────────────────────────────────
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())

        // ── App state setup ───────────────────────────────────
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Could not resolve app data directory");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let app_db = tauri::async_runtime::block_on(
                db::open_app_db(&app_data_dir)
            ).expect("Failed to open app state database");

            app.manage(AppState::new(app_db));
            Ok(())
        })

        // ── Commands ──────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // Project lifecycle
            create_project,
            load_project,
            save_project,
            copy_project_to,
            close_project,
            get_recent_projects,
            remove_recent_project,
            reveal_in_explorer,

            // Pages
            load_page,
            save_page,

            // History / WAL
            flush_scope_wal,
            autosave_scope,
            commit_snapshot,
            reconstruct_version,

            // Undo / redo persistence
            flush_undo_entry,
            load_undo_entry,

            // Media (content-addressed blob storage inside the .mava file)
            import_media_asset,
            extract_media_blob,

            // Competence Framework
            cf_cache_framework,
            cf_mapper_run,
            cf_inspector_run,
            cf_get_brief,
            cf_list_cached_frameworks,

            
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}