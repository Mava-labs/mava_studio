// src/cf/mod.rs
//
// CF module — Competence Framework processing for Mava Studio.
//
// Submodules:
//   types      — all Rust data types (serde mirrors of TypeScript types)
//   validation — checksum, schema validation, component registry
//   cache      — app-data file I/O for framework bundles and briefs
//   mapper     — CourseBrief computation (pure logic, no Tauri)
//   inspector  — InspectorReport computation (pure logic, no Tauri)
//   commands   — #[tauri::command] handlers (thin, delegates to above)

pub mod types;
pub mod validation;
pub mod cache;
pub mod mapper;
pub mod inspector;
pub mod commands;

// Re-export command handlers for ergonomic registration in main.rs
pub use commands::{
    cf_cache_framework,
    cf_mapper_run,
    cf_inspector_run,
    cf_get_brief,
    cf_list_cached_frameworks,
};
