use serde::{Deserialize, Serialize};

/// Mirrors the TypeScript `DirtyScope` discriminated union.
/// Used both as an incoming command argument and as a field on UndoAction.
///
/// TS sends e.g. { kind: 'module', id: 'abc' } or { kind: 'project' } (no id).
/// The Option<String> on id handles both cases correctly.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeRef {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub id: Option<String>,
}

impl ScopeRef {
    /// Returns the id as a str slice, or empty string for scopes without an id
    /// (project, course, mediaLibrary, scripts, dslTriggers).
    pub fn _scope_id(&self) -> &str {
        self.id.as_deref().unwrap_or("")
    }
}

/// Matches the TypeScript `UndoAction` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoAction {
    pub id:             String,
    pub label:          String,
    pub scope:          ScopeRef,
    pub before:         String, // JSON snapshot — may be empty if flushed and cleared
    pub after:          String, // JSON snapshot — may be empty if flushed and cleared
    pub created_at:     i64,
    pub flushed_to_wal: bool,
}

/// A single WAL entry — the serialised state of a scope at a point in time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct _ScopedDiff {
    pub scope_kind: String,
    pub scope_id:   String,
    pub payload:    String, // JSON-encoded scope snapshot
    pub created_at: i64,
    pub session_id: String,
}

/// Row shape read from the history table — internal only, not sent to frontend.
#[derive(Debug)]
pub struct _HistoryRow {
    pub id:         i64,
    pub scope_kind: String,
    pub scope_id:   String,
    pub version:    i64,
    pub proto_blob: Vec<u8>,
    pub created_at: i64,
    pub session_id: String,
}

/// Row shape read from the snapshots table — internal only.
#[derive(Debug)]
pub struct _SnapshotRow {
    pub id:         i64,
    pub version:    i64,
    pub label:      String,
    pub proto_blob: Vec<u8>,
    pub created_at: i64,
}