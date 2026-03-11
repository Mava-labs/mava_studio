use serde::{Deserialize, Serialize};

/// Matches the UndoAction type on the TypeScript side.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoAction {
    pub id:            String,
    pub label:         String,
    pub scope:         ScopeRef,
    pub before:        String, // JSON snapshot
    pub after:         String, // JSON snapshot
    pub created_at:    i64,
    pub flushed_to_wal: bool,
}

/// Serialisable scope reference — mirrors the DirtyScope discriminated union.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeRef {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id:   Option<String>,
}

/// A single WAL entry — the serialised state of a scope at a point in time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopedDiff {
    pub scope_kind: String,
    pub scope_id:   String,
    pub payload:    String, // JSON-encoded scope snapshot
    pub created_at: i64,
    pub session_id: String,
}

/// Row shape read from the history table.
#[derive(Debug)]
pub struct HistoryRow {
    pub id:         i64,
    pub scope_kind: String,
    pub scope_id:   String,
    pub version:    i64,
    pub proto_blob: Vec<u8>,
    pub created_at: i64,
    pub session_id: String,
}

/// Row shape read from the snapshots table.
#[derive(Debug)]
pub struct SnapshotRow {
    pub id:         i64,
    pub version:    i64,
    pub label:      String,
    pub proto_blob: Vec<u8>,
    pub created_at: i64,
}