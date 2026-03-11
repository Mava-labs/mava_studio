use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Page as returned to / received from the frontend.
/// Elements are kept as raw JSON values — Rust does not need to
/// inspect element internals, only store and retrieve them.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id:      String,
    pub visible: bool,
    pub stage:   Stage,
    /// Flat element map — key is element id, value is the full element JSON.
    pub elements: HashMap<String, serde_json::Value>,
    pub root_ids: Vec<String>,
    pub metadata: PageMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stage {
    pub width:      f64,
    pub height:     f64,
    pub background: String,
    pub display:    serde_json::Value, // GridDisplay | FlexDisplay
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageMetadata {
    pub title:       String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration:    Option<i64>,
    pub version:     i32,
    pub created_at:  i64,
    pub updated_at:  i64,
    pub last_edited_by: LastEditedBy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastEditedBy {
    pub user_id: String,
    pub name:    String,
}

/// Result type returned to frontend after loading a page.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadPageResult {
    pub page: Page,
}