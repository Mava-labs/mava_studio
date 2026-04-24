// src/cf/commands.rs
//
// Tauri command handlers for CF Mapper and Inspector.
// These are intentionally thin — they resolve paths, load/write cache,
// delegate to mapper.rs / inspector.rs, and return serialisable results.
//
// Register in main.rs:
//   .invoke_handler(tauri::generate_handler![
//       cf_cache_framework,
//       cf_mapper_run,
//       cf_inspector_run,
//       cf_get_brief,
//       cf_list_cached_frameworks,
//   ])

use tauri::AppHandle;

use super::types::*;
use super::cache::{
    read_framework, write_framework, write_brief, read_brief,
    list_cached_versions, now_ms,
};
use super::mapper::run_mapper;
use super::inspector::run_inspector;
use super::validation::compute_checksum;

// ─────────────────────────────────────────────────────────────────────────────
// cf_cache_framework
//
// Called when the user imports a CF bundle into Mava Studio.
// Parses the bundle JSON, validates the checksum, writes to app-data cache.
// Returns the framework_id, version, and checksum for the Vue layer to
// store in CourseFrameworkAlignment.
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cf_cache_framework(
    app: AppHandle,
    input: CacheFrameworkInput,
) -> CacheFrameworkOutput {
    // Parse
    let framework: CompetenceFramework = match serde_json::from_str(&input.bundle_json) {
        Ok(f) => f,
        Err(e) => {
            return CacheFrameworkOutput {
                success: false,
                framework_id: String::new(),
                framework_version: String::new(),
                checksum: String::new(),
                cached_at: 0,
                errors: vec![format!("Failed to parse framework JSON: {}", e)],
            };
        }
    };

    // Verify checksum
    let computed = compute_checksum(&framework);
    if let Some(claimed) = &framework.metadata.checksum {
        if claimed != &computed {
            return CacheFrameworkOutput {
                success: false,
                framework_id: framework.id,
                framework_version: framework.metadata.version,
                checksum: computed,
                cached_at: 0,
                errors: vec![
                    "Checksum mismatch — framework may be corrupt or tampered with. \
                     Re-export from CF Builder."
                        .into(),
                ],
            };
        }
    }

    let framework_id = framework.id.clone();
    let version = framework.metadata.version.clone();
    let checksum = computed;

    // Write to cache
    if let Err(e) = write_framework(&app, &framework).await {
        return CacheFrameworkOutput {
            success: false,
            framework_id,
            framework_version: version,
            checksum,
            cached_at: 0,
            errors: vec![format!("Failed to write framework to cache: {}", e)],
        };
    }

    CacheFrameworkOutput {
        success: true,
        framework_id,
        framework_version: version,
        checksum,
        cached_at: now_ms(),
        errors: vec![],
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// cf_mapper_run
//
// Called when the user opens the Mapper panel or imports a framework.
// Loads the cached framework, builds a CourseBrief, writes it to cache.
// Returns the full CourseBrief so Vue can store brief_id in the project.
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cf_mapper_run(
    app: AppHandle,
    input: MapperRunInput,
) -> MapperRunOutput {
    // Parse framework from the supplied JSON
    // (caller passes the raw bundle JSON — cache is written here too)
    let framework: CompetenceFramework = match serde_json::from_str(&input.framework_json) {
        Ok(f) => f,
        Err(e) => {
            return MapperRunOutput {
                success: false,
                brief: None,
                warnings: vec![],
                errors: vec![format!("Failed to parse framework JSON: {}", e)],
            };
        }
    };

    // Ensure framework is cached (idempotent)
    if let Err(e) = write_framework(&app, &framework).await {
        return MapperRunOutput {
            success: false,
            brief: None,
            warnings: vec![],
            errors: vec![format!("Failed to cache framework: {}", e)],
        };
    }

    // Run Mapper
    let result = run_mapper(&framework, input.existing_brief_id.as_deref());

    if !result.validation.valid {
        return MapperRunOutput {
            success: false,
            brief: None,
            warnings: result.warnings,
            errors: result.validation.errors,
        };
    }

    let brief = match result.brief {
        Some(b) => b,
        None => {
            return MapperRunOutput {
                success: false,
                brief: None,
                warnings: result.warnings,
                errors: vec!["Mapper produced no brief despite valid framework.".into()],
            };
        }
    };

    // Write brief to cache
    if let Err(e) = write_brief(&app, &brief).await {
        return MapperRunOutput {
            success: false,
            brief: None,
            warnings: result.warnings,
            errors: vec![format!("Failed to cache brief: {}", e)],
        };
    }

    MapperRunOutput {
        success: true,
        brief: Some(brief),
        warnings: result.warnings,
        errors: vec![],
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// cf_inspector_run
//
// Called by the Vue Inspector panel on debounced project change.
// Accepts a ProjectInspectorSlice (CF-relevant subset of ProjectData)
// and a pre-loaded CourseBrief from the caller.
// Returns a full InspectorReport.
//
// The brief is passed directly from Vue (loaded from cache on project open)
// rather than re-read from disk on every Inspector run, keeping it fast.
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cf_inspector_run(
    input: InspectorRunInput,
) -> InspectorRunOutput {
    let report = run_inspector(&input.project_slice, &input.brief, &input.strictness);
    InspectorRunOutput {
        success: true,
        report: Some(report),
        errors: vec![],
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// cf_get_brief
//
// Called on project open. Loads a CourseBrief from the app-data cache.
// If the brief is missing or stale (checksum mismatch), the caller should
// invoke cf_mapper_run to rebuild it.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize)]
pub struct GetBriefInput {
    pub framework_id: String,
    pub framework_version: String,
    pub brief_id: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct GetBriefOutput {
    pub found: bool,
    pub brief: Option<CourseBrief>,
    /// True if the brief checksum matches the cached framework.
    /// If false, caller should trigger cf_mapper_run to rebuild.
    pub is_fresh: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn cf_get_brief(
    app: AppHandle,
    input: GetBriefInput,
) -> GetBriefOutput {
    let brief = match read_brief(
        &app,
        &input.framework_id,
        &input.framework_version,
        &input.brief_id,
    ).await {
        Ok(Some(b)) => b,
        Ok(None) => return GetBriefOutput {
            found: false, brief: None, is_fresh: false, error: None,
        },
        Err(e) => return GetBriefOutput {
            found: false,
            brief: None,
            is_fresh: false,
            error: Some(e.to_string()),
        },
    };

    // Check freshness against cached framework
    let is_fresh = match read_framework(
        &app,
        &input.framework_id,
        &input.framework_version,
    ).await {
        Ok(Some(fw)) => {
            let current_checksum = compute_checksum(&fw);
            current_checksum == brief.framework_checksum
        }
        _ => false,
    };

    GetBriefOutput {
        found: true,
        brief: Some(brief),
        is_fresh,
        error: None,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// cf_list_cached_frameworks
//
// Returns all cached framework versions for display in the Mapper panel.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CachedFrameworkEntry {
    pub framework_id: String,
    pub versions: Vec<String>,
}

#[tauri::command]
pub async fn cf_list_cached_frameworks(
    app: AppHandle,
    framework_ids: Vec<String>,
) -> Vec<CachedFrameworkEntry> {
    let mut entries = Vec::new();
    for id in framework_ids {
        let versions = list_cached_versions(&app, &id).await.unwrap_or_default();
        entries.push(CachedFrameworkEntry {
            framework_id: id,
            versions,
        });
    }
    entries
}
