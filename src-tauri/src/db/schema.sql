-- ============================================================
-- PROJECT DATABASE SCHEMA (.mava file)
-- Each .mava file is a SQLite database.
-- This schema is applied on create and checked on open.
-- ============================================================

-- Format version for migration gating
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Full serialised project document (proto blob, base64-encoded).
-- One row per project — id matches project_id in the document.
CREATE TABLE IF NOT EXISTS document (
    id          TEXT PRIMARY KEY,
    proto_blob  BLOB    NOT NULL,  -- serialised ProjectDocument
    updated_at  INTEGER NOT NULL
);

-- Individual page blobs stored separately from the project document
-- so large projects don't load all pages at once.
CREATE TABLE IF NOT EXISTS pages (
    id          TEXT PRIMARY KEY,
    project_id  TEXT    NOT NULL,
    proto_blob  BLOB    NOT NULL,  -- serialised Page
    updated_at  INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES document(id)
);

-- Component definitions stored separately for the same reason.
CREATE TABLE IF NOT EXISTS components (
    id          TEXT PRIMARY KEY,
    project_id  TEXT    NOT NULL,
    proto_blob  BLOB    NOT NULL,  -- serialised ComponentDefinition
    updated_at  INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES document(id)
);

-- Append-only WAL for incremental scope diffs.
-- Each row is a serialised ScopedDiff proto blob.
CREATE TABLE IF NOT EXISTS history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  TEXT    NOT NULL,
    scope_kind  TEXT    NOT NULL,
    scope_id    TEXT    NOT NULL DEFAULT '',
    version     INTEGER NOT NULL,
    proto_blob  BLOB    NOT NULL,  -- serialised ScopedDiff
    created_at  INTEGER NOT NULL,
    session_id  TEXT    NOT NULL DEFAULT '',
    FOREIGN KEY (project_id) REFERENCES document(id)
);

CREATE INDEX IF NOT EXISTS idx_history_scope
    ON history (project_id, scope_kind, scope_id, version);

-- Named version snapshots (commit checkpoints).
-- Full document state at a point in time.
CREATE TABLE IF NOT EXISTS snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  TEXT    NOT NULL,
    version     INTEGER NOT NULL,
    label       TEXT    NOT NULL DEFAULT '',
    proto_blob  BLOB    NOT NULL,  -- serialised ProjectDocument at this version
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES document(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_version
    ON snapshots (project_id, version);

-- Undo/redo entries flushed from memory when stack exceeds threshold.
-- before/after are JSON snapshots of the affected scope.
CREATE TABLE IF NOT EXISTS undo_log (
    action_id   TEXT    PRIMARY KEY,
    project_id  TEXT    NOT NULL,
    label       TEXT    NOT NULL,
    scope_kind  TEXT    NOT NULL,
    scope_id    TEXT    NOT NULL DEFAULT '',
    before_json TEXT    NOT NULL,
    after_json  TEXT    NOT NULL,
    created_at  INTEGER NOT NULL,
    session_id  TEXT    NOT NULL DEFAULT '',
    FOREIGN KEY (project_id) REFERENCES document(id)
);

CREATE INDEX IF NOT EXISTS idx_undo_log_project
    ON undo_log (project_id, created_at);

-- Locally-imported media (image/video/audio), content-addressed by SHA-256
-- so the same file imported twice (or shared across pages) is only stored
-- once. A MediaAsset's url becomes "mava-blob:<hash>" when it references a
-- row here, vs. a real http(s) URL when the author deliberately links to an
-- external resource — see commands/media.rs.
CREATE TABLE IF NOT EXISTS media_blobs (
    hash        TEXT    PRIMARY KEY,
    project_id  TEXT    NOT NULL,
    mime_type   TEXT    NOT NULL,
    data        BLOB    NOT NULL,
    size_bytes  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES document(id)
);

CREATE INDEX IF NOT EXISTS idx_media_blobs_project
    ON media_blobs (project_id);

-- ============================================================
-- APP STATE DATABASE SCHEMA (app_state.sqlite)
-- Stored in Tauri app data directory.
-- Tracks recent projects and app-level preferences.
-- ============================================================

CREATE TABLE IF NOT EXISTS recent_projects (
    project_id    TEXT    PRIMARY KEY,
    project_name  TEXT    NOT NULL,
    archive_path  TEXT    NOT NULL,
    thumbnail     TEXT,              -- data-URL or path, nullable
    last_opened_at INTEGER NOT NULL
);