use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Author ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub user_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub role: String, // "owner" | "editor" | "supervisor"
}

// ── Session lock ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLock {
    pub session_id: String,
    pub user_id:    String,
    pub user_name:  String,
    pub role:       String,
    pub locked_at:  i64,
    pub file_path:  String,
}

// ── Recent project ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub project_id:     String,
    pub project_name:   String,
    pub archive_path:   String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail:      Option<String>,
    pub last_opened_at: i64,
}

// ── Hierarchy refs ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChildRef {
    pub id:    String,
    pub name:  String,
    pub order: i32,
}

// ── Lesson ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonMetadata {
    pub title:       String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub duration:    i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url:         Option<String>,
    pub version:     i32,
    pub created_at:  i64,
    pub updated_at:  i64,
    pub last_edited_by: LastEditedBy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_completion_time: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required:    Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_complete: Option<bool>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub prerequisites: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastEditedBy {
    pub user_id: String,
    pub name:    String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lesson {
    pub id:      String,
    #[serde(rename = "type")]
    pub kind:    String, // "activity" | "assessment"
    pub visible: bool,
    pub pages:   Vec<ChildRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cf_node_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub metadata: LessonMetadata,
}

// ── Module ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleMetadata {
    pub title:       String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub duration:    i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url:         Option<String>,
    pub version:     i32,
    pub created_at:  i64,
    pub updated_at:  i64,
    pub last_edited_by: LastEditedBy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overview:    Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_completion_time: Option<i64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub prerequisites: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unlock_conditions: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Module {
    pub id:      String,
    pub visible: bool,
    pub lessons: Vec<ChildRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes:   Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cf_node_ids: Vec<String>,
    pub metadata: ModuleMetadata,
}

// ── Course ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pricing {
    #[serde(rename = "type")]
    pub kind:     String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount:   Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseMetadata {
    pub title:       String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtitle:    Option<String>,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category:    Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty:  Option<String>,
    pub duration:    i64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub prerequisites: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author:      Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub languages:   Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility:  Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub licensing:   Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pricing:     Option<Pricing>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_schedule: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub completion_requirements: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url:         Option<String>,
    pub published_at: serde_json::Value, // i64 timestamp or "pending"
    pub version:     i32,
    pub created_at:  i64,
    pub updated_at:  i64,
    pub last_edited_by: LastEditedBy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Course {
    pub id:      String,
    pub modules: Vec<ChildRef>,
    #[serde(default)]
    pub cf_node_ids: Vec<String>,
    pub metadata: CourseMetadata,
}

// ── Media asset ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub id:         String,
    pub name:       String,
    #[serde(rename = "type")]
    pub kind:       String,
    pub url:        String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash:       Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    pub created_at: i64,
}

// ── DSL trigger ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DslTrigger {
    pub id:         String,
    pub scope:      String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_id:    Option<String>,
    pub dsl_source: String,
    pub enabled:    bool,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

// ── Action script ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionScript {
    pub id:          String,
    pub name:        String,
    pub scope:       String,
    pub code_ts:     String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compiled_js: Option<String>,
}

// ── Project data (matches TS ProjectData) ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectData {
    pub project_version:  i32,
    pub project_id:       String,
    pub project_name:     String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path:     Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_archive_path: Option<String>,
    pub created_at:       i64,
    pub updated_at:       i64,
    pub authors:          Vec<Author>,
    pub course:           Course,
    pub modules_by_id:    HashMap<String, Module>,
    pub lessons_by_id:    HashMap<String, Lesson>,
    /// Page content excluded — owned by pagesStore on the frontend.
    /// Only page metadata refs are embedded in lessons.
    pub pages_by_id:      HashMap<String, serde_json::Value>,
    pub component_library: HashMap<String, serde_json::Value>,
    pub media_library:    HashMap<String, MediaAsset>,
    pub dsl_triggers:     HashMap<String, DslTrigger>,
    pub action_scripts:   HashMap<String, ActionScript>,
}

// ── Command result types ──────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectResult {
    pub project_data: ProjectData,
    pub new_page_id:  String,
    pub session_lock: SessionLock,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadProjectResult {
    pub project_data: ProjectData,
    pub session_lock: SessionLock,
}

/// Returned by copy_project_to (Save As).
/// Contains the updated project data (with new archive path)
/// and a fresh session lock against the copied file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyProjectResult {
    pub project_data: ProjectData,
    pub session_lock: SessionLock,
}