/**
 * projectMetadata.ts
 * Pinia store — project-level state, persistence coordination, and undo/redo.
 *
 * Scope:
 *   - Project identity, authors, file-lock / session
 *   - Course, modules, lessons (ordered references + full entities)
 *   - Component library (ComponentDefinition records)
 *   - Media library, DSL triggers, action scripts
 *   - CF node stubs (cfNodesById — logic TBD when CF system is designed)
 *   - Undo/redo stack with memory threshold + WAL flush coordination
 *   - Dirty tracking per scope for autosave
 *   - Tauri persistence bridge (create, load, save, commit, close)
 *   - Recent projects list
 *
 * Out of scope (own stores):
 *   - Page element trees + stage  → usePagesStore / useStageStore
 *   - Notifications               → useNotificationStore
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type {
    ProjectData,
    Course,
    Module,
    Lesson,
    Author,
    DSLTriggerDocument,
    ScriptDef,
} from '../types/project';
import type { Element } from '../types/element';

/* ============================================================
   SUPPLEMENTARY TYPES
   ============================================================ */

/** A component in the shared library — wraps an Element tree with identity. */
export interface ComponentDefinition {
    id: string;
    name: string;
    /** Semver string e.g. "1.0.0". Bump on any structural change. */
    version: string;
    /** 'local' = authored here. 'marketplace' = imported, pinned. */
    source: 'local' | 'marketplace';
    /** Only set for marketplace components. */
    marketplaceRef?: {
        publisherId: string;
        packageId: string;
        pinnedVersion: string;
        originUrl: string;
    };
    authorId: string;
    rootIds: string[];
    elementsById: Record<string, Element>;
    /** Declared prop schema — what consumers can override at the usage site. */
    props: ComponentPropSchema[];
    createdAt: number;
    updatedAt: number;
}

export interface ComponentPropSchema {
    key: string;
    type: 'string' | 'number' | 'boolean' | 'color' | 'image' | 'any';
    defaultValue?: unknown;
    required?: boolean;
    description?: string;
}

export interface MediaAsset {
    id: string;
    name: string;
    /** MIME type e.g. "image/webp", "audio/mp3" */
    type: string;
    /** Relative path within the project archive or absolute URL */
    url: string;
    /** SHA-256 of asset content — used for dedup and integrity checks */
    hash?: string;
    sizeBytes?: number;
    createdAt: number;
}

/** Lightweight record persisted to app config for the start screen. */
export interface RecentProject {
    projectId: string;
    projectName: string;
    archivePath: string;
    thumbnail?: string;
    lastOpenedAt: number;
}

/** Active file-lock — only one editor session at a time. */
export interface SessionLock {
    sessionId: string;
    userId: string;
    userName: string;
    role: Author['role'];
    lockedAt: number;
    filePath: string;
}

/**
 * Granular dirty flags per scope.
 * Drives what gets flushed to the WAL on autosave.
 * Page scope is included here so pagesStore can delegate dirty marking
 * without owning persistence logic itself.
 */
export type DirtyScope =
    | { kind: 'project' }
    | { kind: 'course' }
    | { kind: 'module'; id: string }
    | { kind: 'lesson'; id: string }
    | { kind: 'page'; id: string }
    | { kind: 'component'; id: string }
    | { kind: 'mediaLibrary' }
    | { kind: 'scripts' }
    | { kind: 'dslTriggers' };

/* ============================================================
   UNDO / REDO TYPES
   ============================================================ */

/**
 * A single undoable action pushed by any store (pagesStore, stageStore, or here).
 *
 * State-based approach: before/after snapshots of the affected scope.
 * Simpler than operation-based diffs and easier to debug. Switch to
 * operation-based if snapshot sizes become a memory concern.
 */
export interface UndoAction {
    /** Unique action id — correlates with the WAL entry if flushed. */
    id: string;
    /** Human-readable label for the history panel. */
    label: string;
    /** Which scope this action belongs to — drives WAL scoping on flush. */
    scope: DirtyScope;
    /**
     * Serialised state before the action.
     * Stored as a JSON string to avoid retaining deep reactive object graphs.
     * Cleared from memory once flushed to WAL (reloaded on demand).
     */
    before: string;
    /** Serialised state after the action. */
    after: string;
    createdAt: number;
    /**
     * True once flushed to the WAL.
     * before/after are cleared from memory at that point to cap memory use.
     */
    flushedToWal: boolean;
}

/**
 * How many undo steps to keep fully in memory.
 * Entries older than this threshold are flushed to the WAL automatically.
 */
const UNDO_MEMORY_THRESHOLD = 50;

/* ============================================================
   CF STUB TYPES
   // CF_STUB — competence framework system is not yet designed.
   // Replace with proper CF types when that system is built.
   ============================================================ */

/** Placeholder shape for an imported competence framework node. */
export interface CfNodeStub {
    id: string;
    // CF_STUB: raw payload from the external CF system — shape TBD.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw: Record<string, any>;
}

/* ============================================================
   TAURI COMMAND PAYLOADS
   Map directly to Rust #[tauri::command] signatures.
   ============================================================ */

interface CreateProjectPayload {
    name: string;
    path: string;
    archivePath: string;
}

interface CreateProjectResult {
    projectData: ProjectData;
    newPageId: string;
    sessionLock: SessionLock;
}

interface LoadProjectResult {
    projectData: ProjectData;
    sessionLock: SessionLock;
}

interface SaveScopePayload {
    projectId: string;
    scope: DirtyScope;
    /** base64-encoded protobuf bytes — Rust decodes and writes to SQLite WAL table. */
    protoBlob: string;
}

interface CommitSnapshotPayload {
    projectId: string;
    label: string | null;
}

interface ReconstructVersionPayload {
    projectId: string;
    scopeId: string;
    targetVersion: number;
}

/* ============================================================
   STORE
   ============================================================ */

export const useProjectMetadataStore = defineStore('projectMetadata', () => {

    /* ----------------------------------------------------------
       STATE — PROJECT IDENTITY
    ---------------------------------------------------------- */

    /** Null when no project is open (start screen). */
    const projectId      = ref<string | null>(null);
    const projectName    = ref<string>('');
    const projectVersion = ref<number>(1);
    const projectPath    = ref<string | null>(null);
    const archivePath    = ref<string | null>(null);
    const createdAt      = ref<number>(0);
    const updatedAt      = ref<number>(0);

    const authors = ref<Author[]>([]);
    const session = ref<SessionLock | null>(null);

    /* ----------------------------------------------------------
       STATE — HIERARCHY
    ---------------------------------------------------------- */

    const course      = ref<Course | null>(null);
    const modulesById = ref<Record<string, Module>>({});
    const lessonsById = ref<Record<string, Lesson>>({});

    /**
     * Page meta index — structural references only (id, name, lessonId, order).
     * Full page content (stage + elements) lives in usePagesStore.
     */
    const pageMetaById = ref<Record<string, {
        id: string;
        name: string;
        lessonId: string;
        order: number;
    }>>({});

    /* ----------------------------------------------------------
       STATE — SHARED LIBRARIES
    ---------------------------------------------------------- */

    const componentLibrary = ref<Record<string, ComponentDefinition>>({});
    const mediaLibrary     = ref<Record<string, MediaAsset>>({});
    const dslTriggers      = ref<Record<string, DSLTriggerDocument>>({});
    const actionScripts    = ref<Record<string, ScriptDef>>({});

    /* ----------------------------------------------------------
       STATE — CF STUBS
       // CF_STUB: cfNodeIds on course/module/lesson remain plain string[].
       // cfNodesById holds imported node payloads — no relationship logic yet.
    ---------------------------------------------------------- */

    const cfNodesById = ref<Record<string, CfNodeStub>>({});

    /* ----------------------------------------------------------
       STATE — UNDO / REDO
    ---------------------------------------------------------- */

    /**
     * In-memory undo stack, most recent action last.
     * pagesStore and stageStore push actions here via pushUndo().
     */
    const undoStack = ref<UndoAction[]>([]);

    /**
     * Redo stack, most recently undone action first.
     * Cleared whenever a new action is pushed.
     */
    const redoStack = ref<UndoAction[]>([]);

    /* ----------------------------------------------------------
       STATE — PERSISTENCE COORDINATION
    ---------------------------------------------------------- */

    /** Scopes with unsaved in-memory changes. Cleared after WAL flush. */
    const dirtyScopes = ref<Set<string>>(new Set());
    /** True while a full save is in flight — prevents concurrent saves. */
    const isSaving    = ref<boolean>(false);
    /** Timestamp of last successful persist (WAL flush or full save). */
    const lastSavedAt = ref<number | null>(null);

    /* ----------------------------------------------------------
       STATE — RECENT PROJECTS
    ---------------------------------------------------------- */

    const recentProjects = ref<RecentProject[]>([]);

    /* ----------------------------------------------------------
       COMPUTED
    ---------------------------------------------------------- */

    const isProjectOpen = computed(() => projectId.value !== null);

    const currentUser = computed<Author | null>(() =>
        session.value
            ? authors.value.find(a => a.userId === session.value!.userId) ?? null
            : null
    );

    const canEdit = computed(() =>
        currentUser.value?.role === 'owner' || currentUser.value?.role === 'editor'
    );

    /** Modules in the order the course defines. */
    const orderedModules = computed(() => {
        if (!course.value) return [];
        return course.value.modules
            .slice()
            .sort((a, b) => a.order - b.order)
            .map(r => modulesById.value[r.id])
            .filter(Boolean);
    });

    /** Factory: ordered lessons for a given module id. */
    const orderedLessonsForModule = (moduleId: string) => computed(() => {
        const mod = modulesById.value[moduleId];
        if (!mod) return [];
        return mod.lessons
            .slice()
            .sort((a, b) => a.order - b.order)
            .map(r => lessonsById.value[r.id])
            .filter(Boolean);
    });

    /** Factory: ordered page references for a given lesson id. */
    const orderedPagesForLesson = (lessonId: string) => computed(() => {
        const lesson = lessonsById.value[lessonId];
        if (!lesson) return [];
        return lesson.pages.slice().sort((a, b) => a.order - b.order);
    });

    const localComponents = computed(() =>
        Object.values(componentLibrary.value).filter(c => c.source === 'local')
    );

    const marketplaceComponents = computed(() =>
        Object.values(componentLibrary.value).filter(c => c.source === 'marketplace')
    );

    const hasDirtyScopes  = computed(() => dirtyScopes.value.size > 0);
    const canUndo         = computed(() => undoStack.value.length > 0);
    const canRedo         = computed(() => redoStack.value.length > 0);

    /** Label of the next action to be undone — for toolbar tooltips. */
    const nextUndoLabel = computed(() =>
        undoStack.value.length > 0
            ? undoStack.value[undoStack.value.length - 1].label
            : null
    );

    /** Label of the next action to be redone. */
    const nextRedoLabel = computed(() =>
        redoStack.value.length > 0 ? redoStack.value[0].label : null
    );

    /* ----------------------------------------------------------
       DIRTY TRACKING
    ---------------------------------------------------------- */

    function _scopeKey(scope: DirtyScope): string {
        return 'id' in scope ? `${scope.kind}:${scope.id}` : scope.kind;
    }

    function markDirty(scope: DirtyScope) {
        dirtyScopes.value.add(_scopeKey(scope));
        updatedAt.value = Date.now();
    }

    function clearDirty(scope: DirtyScope) {
        dirtyScopes.value.delete(_scopeKey(scope));
    }

    function clearAllDirty() {
        dirtyScopes.value.clear();
    }

    /* ----------------------------------------------------------
       SCOPE RESTORATION (called by useUndoRedo for non-page scopes)
    ---------------------------------------------------------- */

    /**
     * Restore a non-page scope from a deserialised snapshot.
     * Called by useUndoRedo dispatcher when scope.kind is anything
     * other than 'page' or 'component' (those go to elementStore).
     */
    function restoreScope(scope: DirtyScope, snapshot: unknown) {
        switch (scope.kind) {
            case 'course':
                if (snapshot && typeof snapshot === 'object')
                    course.value = snapshot as Course;
                break;
            case 'module':
                if ('id' in scope && snapshot && typeof snapshot === 'object')
                    modulesById.value[scope.id] = snapshot as Module;
                break;
            case 'lesson':
                if ('id' in scope && snapshot && typeof snapshot === 'object')
                    lessonsById.value[scope.id] = snapshot as Lesson;
                break;
            case 'component':
                if ('id' in scope && snapshot && typeof snapshot === 'object')
                    componentLibrary.value[scope.id] = snapshot as ComponentDefinition;
                break;
            case 'mediaLibrary':
                if (snapshot && typeof snapshot === 'object')
                    mediaLibrary.value = snapshot as Record<string, MediaAsset>;
                break;
            case 'scripts':
                if (snapshot && typeof snapshot === 'object')
                    actionScripts.value = snapshot as Record<string, ScriptDef>;
                break;
            case 'dslTriggers':
                if (snapshot && typeof snapshot === 'object')
                    dslTriggers.value = snapshot as Record<string, DSLTriggerDocument>;
                break;
            default:
                console.warn('[projectMetadata] restoreScope: unhandled scope kind', scope);
        }
        markDirty(scope);
    }

    /* ----------------------------------------------------------
       UNDO / REDO
    ---------------------------------------------------------- */

    /**
     * Push a new undoable action.
     *
     * Called from any store after mutating state — pass serialised
     * before/after snapshots of the affected scope.
     *
     * @example — from pagesStore:
     *   const before = JSON.stringify(pageSnapshot);
     *   applyElementMove(elementId, newPosition);
     *   const after  = JSON.stringify(pageSnapshot);
     *   project.pushUndo({ label: 'Move element', scope: { kind: 'page', id: pageId }, before, after });
     */
    function pushUndo(action: Omit<UndoAction, 'id' | 'createdAt' | 'flushedToWal'>) {
        const entry: UndoAction = {
            ...action,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            flushedToWal: false,
        };

        undoStack.value.push(entry);
        redoStack.value = []; // new action always invalidates redo
        markDirty(action.scope);
        _maybeFlushOldEntries();
    }

    /**
     * Undo the most recent action.
     *
     * Returns the resolved UndoAction so the caller can restore state
     * by applying `action.before` to the relevant store.
     * Returns null if the stack is empty.
     */
    async function undo(): Promise<UndoAction | null> {
        const action = undoStack.value.pop();
        if (!action) return null;

        const resolved = (action.flushedToWal && !action.before)
            ? await _reloadWalEntry(action.id)
            : action;

        redoStack.value.unshift(resolved);
        markDirty(resolved.scope);
        return resolved;
    }

    /**
     * Redo the most recently undone action.
     *
     * Returns the resolved UndoAction so the caller can apply `action.after`.
     * Returns null if the redo stack is empty.
     */
    async function redo(): Promise<UndoAction | null> {
        const action = redoStack.value.shift();
        if (!action) return null;

        const resolved = (action.flushedToWal && !action.after)
            ? await _reloadWalEntry(action.id)
            : action;

        undoStack.value.push(resolved);
        markDirty(resolved.scope);
        return resolved;
    }

    /** Clear both stacks — called on project close or explicit history wipe. */
    function clearHistory() {
        undoStack.value = [];
        redoStack.value = [];
    }

    /**
     * When the stack exceeds UNDO_MEMORY_THRESHOLD, flush the oldest entries
     * to the SQLite WAL table and drop their payloads from memory.
     * The entry record stays on the stack so stack length stays accurate.
     */
    async function _maybeFlushOldEntries() {
        if (undoStack.value.length <= UNDO_MEMORY_THRESHOLD) return;

        const overflow = undoStack.value.length - UNDO_MEMORY_THRESHOLD;
        const toFlush  = undoStack.value.slice(0, overflow);

        for (const entry of toFlush) {
            if (entry.flushedToWal) continue;
            try {
                await invoke<void>('flush_undo_entry', {
                    projectId: projectId.value,
                    entry,
                });
                // Drop payload from memory, keep the shell on the stack
                entry.before      = '';
                entry.after       = '';
                entry.flushedToWal = true;
            } catch (err) {
                // Non-fatal — entry stays in memory, retried next threshold hit
                console.error('[undo] WAL flush failed:', err);
            }
        }
    }

    /** Reload a flushed entry's before/after from the WAL. */
    async function _reloadWalEntry(actionId: string): Promise<UndoAction> {
        return await invoke<UndoAction>('load_undo_entry', {
            projectId: projectId.value,
            actionId,
        });
    }

    /* ----------------------------------------------------------
       PROJECT LIFECYCLE
    ---------------------------------------------------------- */

    /**
     * Create a brand-new project, persist it via Rust, and hydrate store.
     * Called from the start screen after the save dialogue resolves.
     */
    async function createProjectAndPersist(payload: CreateProjectPayload): Promise<CreateProjectResult> {
        const result = await invoke<CreateProjectResult>('create_project', {
            name: payload.name,
            path: payload.path,
            archivePath: payload.archivePath,
        });
        _hydrate(result.projectData);
        session.value = result.sessionLock;
        _addToRecent(result.projectData);
        return result;
    }

    /**
     * Load an existing project from disk.
     * Rust acquires the file lock before returning.
     */
    async function loadProject(filePath: string): Promise<LoadProjectResult> {
        const result = await invoke<LoadProjectResult>('load_project', { filePath });
        _hydrate(result.projectData);
        session.value = result.sessionLock;
        _addToRecent(result.projectData);
        return result;
    }

    /**
     * Explicit full save — serialises all state and writes to SQLite.
     * For frequent autosave, use flushScopeToWal instead.
     */
    async function saveProject(): Promise<void> {
        if (!projectId.value || isSaving.value) return;
        isSaving.value = true;
        try {
            await invoke('save_project', {
                projectId: projectId.value,
                projectData: _snapshot(),
            });
            clearAllDirty();
            lastSavedAt.value = Date.now();
        } finally {
            isSaving.value = false;
        }
    }

    /**
     * Flush a single dirty scope to the SQLite WAL table as a proto blob.
     * Called by the autosave debounce — much lighter than a full save.
     * protoBlob is base64-encoded protobuf produced by the Rust serializer.
     */
    async function flushScopeToWal(scope: DirtyScope, protoBlob: string): Promise<void> {
        if (!projectId.value) return;
        await invoke<void>('flush_scope_wal', {
            projectId: projectId.value,
            scope,
            protoBlob,
        } satisfies SaveScopePayload);
        clearDirty(scope);
        lastSavedAt.value = Date.now();
    }

    /**
     * Commit a named version snapshot.
     * Rust packs the current document blob + pending WAL diffs into the
     * snapshots table, creating a restorable version checkpoint.
     */
    async function commitSnapshot(label?: string): Promise<void> {
        if (!projectId.value) return;
        await invoke<void>('commit_snapshot', {
            projectId: projectId.value,
            label: label ?? null,
        } satisfies CommitSnapshotPayload);
    }

    /**
     * Reconstruct the state of a scope at a historical version number.
     * Rust finds the nearest snapshot <= targetVersion, replays diffs forward,
     * and returns the reconstructed proto blob as base64.
     * The inspector UI deserialises and renders the preview.
     */
    async function reconstructVersion(scopeId: string, targetVersion: number): Promise<string> {
        if (!projectId.value) throw new Error('No project open');
        return await invoke<string>('reconstruct_version', {
            projectId: projectId.value,
            scopeId,
            targetVersion,
        } satisfies ReconstructVersionPayload);
    }

    /** Release file lock and reset store to blank idle state. */
    async function closeProject(): Promise<void> {
        if (!projectId.value) return;
        await invoke<void>('close_project', { projectId: projectId.value });
        _reset();
    }

    /* ----------------------------------------------------------
       COURSE MUTATIONS
    ---------------------------------------------------------- */

    function updateCourseMetadata(patch: Partial<Course['metadata']>) {
        if (!course.value) return;
        course.value.metadata = {
            ...course.value.metadata,
            ...patch,
            updatedAt: Date.now(),
        };
        markDirty({ kind: 'course' });
    }

    /* ----------------------------------------------------------
       MODULE CRUD
    ---------------------------------------------------------- */

    function addModule(module: Module) {
        modulesById.value[module.id] = module;
        course.value?.modules.push({
            name: module.metadata.title,
            id: module.id,
            order: (course.value.modules.length + 1),
        });
        markDirty({ kind: 'module', id: module.id });
        markDirty({ kind: 'course' });
    }

    function updateModule(id: string, patch: Partial<Module>) {
        const mod = modulesById.value[id];
        if (!mod) return;
        modulesById.value[id] = {
            ...mod,
            ...patch,
            metadata: { ...mod.metadata, ...(patch.metadata ?? {}), updatedAt: Date.now() },
        };
        const ref = course.value?.modules.find(m => m.id === id);
        if (ref && patch.metadata?.title) ref.name = patch.metadata.title;
        markDirty({ kind: 'module', id });
    }

    function deleteModule(id: string) {
        modulesById.value[id]?.lessons.forEach(l => deleteLesson(l.id));
        delete modulesById.value[id];
        if (course.value) {
            course.value.modules = course.value.modules
                .filter(m => m.id !== id)
                .map((m, i) => ({ ...m, order: i + 1 }));
        }
        markDirty({ kind: 'course' });
    }

    function reorderModules(orderedIds: string[]) {
        if (!course.value) return;
        course.value.modules = orderedIds.map((id, i) => ({
            id,
            name: modulesById.value[id]?.metadata.title ?? '',
            order: i + 1,
        }));
        markDirty({ kind: 'course' });
    }

    /* ----------------------------------------------------------
       LESSON CRUD
    ---------------------------------------------------------- */

    function addLesson(moduleId: string, lesson: Lesson) {
        lessonsById.value[lesson.id] = lesson;
        const mod = modulesById.value[moduleId];
        if (!mod) return;
        mod.lessons.push({
            name: lesson.metadata.title,
            id: lesson.id,
            order: mod.lessons.length + 1,
        });
        markDirty({ kind: 'lesson', id: lesson.id });
        markDirty({ kind: 'module', id: moduleId });
    }

    function updateLesson(id: string, patch: Partial<Lesson>) {
        const lesson = lessonsById.value[id];
        if (!lesson) return;
        lessonsById.value[id] = {
            ...lesson,
            ...patch,
            metadata: { ...lesson.metadata, ...(patch.metadata ?? {}), updatedAt: Date.now() },
        };
        Object.values(modulesById.value).forEach(mod => {
            const ref = mod.lessons.find(l => l.id === id);
            if (ref && patch.metadata?.title) ref.name = patch.metadata.title;
        });
        markDirty({ kind: 'lesson', id });
    }

    function deleteLesson(id: string) {
        lessonsById.value[id]?.pages.forEach(p => {
            delete pageMetaById.value[p.id];
        });
        delete lessonsById.value[id];
        Object.values(modulesById.value).forEach(mod => {
            mod.lessons = mod.lessons
                .filter(l => l.id !== id)
                .map((l, i) => ({ ...l, order: i + 1 }));
        });
    }

    function reorderLessons(moduleId: string, orderedIds: string[]) {
        const mod = modulesById.value[moduleId];
        if (!mod) return;
        mod.lessons = orderedIds.map((id, i) => ({
            id,
            name: lessonsById.value[id]?.metadata.title ?? '',
            order: i + 1,
        }));
        markDirty({ kind: 'module', id: moduleId });
    }

    /* ----------------------------------------------------------
       PAGE META (structural only — content lives in pagesStore)
    ---------------------------------------------------------- */

    function registerPage(lessonId: string, pageId: string, name: string) {
        const lesson = lessonsById.value[lessonId];
        if (!lesson) return;
        const order = lesson.pages.length + 1;
        lesson.pages.push({ id: pageId, name, order });
        pageMetaById.value[pageId] = { id: pageId, name, lessonId, order };
        markDirty({ kind: 'lesson', id: lessonId });
    }

    function renamePage(pageId: string, name: string) {
        const meta = pageMetaById.value[pageId];
        if (!meta) return;
        meta.name = name;
        const ref = lessonsById.value[meta.lessonId]?.pages.find(p => p.id === pageId);
        if (ref) ref.name = name;
        markDirty({ kind: 'lesson', id: meta.lessonId });
    }

    function deletePage(pageId: string) {
        const meta = pageMetaById.value[pageId];
        if (!meta) return;
        const lesson = lessonsById.value[meta.lessonId];
        if (lesson) {
            lesson.pages = lesson.pages
                .filter(p => p.id !== pageId)
                .map((p, i) => ({ ...p, order: i + 1 }));
        }
        delete pageMetaById.value[pageId];
        markDirty({ kind: 'lesson', id: meta.lessonId });
    }

    function reorderPages(lessonId: string, orderedIds: string[]) {
        const lesson = lessonsById.value[lessonId];
        if (!lesson) return;
        lesson.pages = orderedIds.map((id, i) => ({
            id,
            name: pageMetaById.value[id]?.name ?? '',
            order: i + 1,
        }));
        markDirty({ kind: 'lesson', id: lessonId });
    }

    /* ----------------------------------------------------------
       COMPONENT LIBRARY
    ---------------------------------------------------------- */

    function addComponent(def: ComponentDefinition) {
        componentLibrary.value[def.id] = def;
        markDirty({ kind: 'component', id: def.id });
    }

    function updateComponent(id: string, patch: Partial<ComponentDefinition>) {
        const existing = componentLibrary.value[id];
        if (!existing) return;
        componentLibrary.value[id] = { ...existing, ...patch, updatedAt: Date.now() };
        markDirty({ kind: 'component', id });
    }

    function deleteComponent(id: string) {
        delete componentLibrary.value[id];
        // Pages referencing this will render a missing-component placeholder.
        // pagesStore is responsible for resolving broken references.
        markDirty({ kind: 'project' });
    }

    /** Pin a marketplace component to a newer version. */
    function upgradeMarketplaceComponent(id: string, newVersion: string) {
        const def = componentLibrary.value[id];
        if (!def || def.source !== 'marketplace') return;
        def.marketplaceRef!.pinnedVersion = newVersion;
        def.version  = newVersion;
        def.updatedAt = Date.now();
        markDirty({ kind: 'component', id });
    }

    /* ----------------------------------------------------------
       MEDIA LIBRARY
    ---------------------------------------------------------- */

    function addMedia(asset: MediaAsset) {
        mediaLibrary.value[asset.id] = asset;
        markDirty({ kind: 'mediaLibrary' });
    }

    function deleteMedia(id: string) {
        delete mediaLibrary.value[id];
        markDirty({ kind: 'mediaLibrary' });
    }

    /* ----------------------------------------------------------
       DSL TRIGGERS & ACTION SCRIPTS
    ---------------------------------------------------------- */

    function upsertDslTrigger(trigger: DSLTriggerDocument) {
        dslTriggers.value[trigger.id] = { ...trigger, updatedAt: Date.now() };
        markDirty({ kind: 'dslTriggers' });
    }

    function deleteDslTrigger(id: string) {
        delete dslTriggers.value[id];
        markDirty({ kind: 'dslTriggers' });
    }

    function upsertScript(script: ScriptDef) {
        actionScripts.value[script.id] = script;
        markDirty({ kind: 'scripts' });
    }

    function deleteScript(id: string) {
        delete actionScripts.value[id];
        markDirty({ kind: 'scripts' });
    }

    /* ----------------------------------------------------------
       CF STUBS
       // CF_STUB: all functions below are placeholders.
       // Replace with real logic when the CF system is designed.
    ---------------------------------------------------------- */

    /** Import CF nodes from an external system payload. CF_STUB. */
    function importCfNodes(nodes: CfNodeStub[]) {
        nodes.forEach(n => { cfNodesById.value[n.id] = n; });
        // CF_STUB: no validation, graph building, or conflict resolution yet
    }

    /**
     * Link a CF node to a content entity. CF_STUB.
     * cfNodeIds on course/module/lesson are plain string[] for now —
     * this function is a placeholder for when relationship logic is added.
     */
    function linkCfNode(
        _entityKind: 'course' | 'module' | 'lesson',
        _entityId: string,
        _cfNodeId: string,
    ) {
        // CF_STUB
    }

    /* ----------------------------------------------------------
       AUTHORS / SESSION
    ---------------------------------------------------------- */

    function addAuthor(author: Author) {
        if (!authors.value.find(a => a.userId === author.userId)) {
            authors.value.push(author);
            markDirty({ kind: 'project' });
        }
    }

    function updateAuthorRole(userId: string, role: Author['role']) {
        const author = authors.value.find(a => a.userId === userId);
        if (author) {
            author.role = role;
            markDirty({ kind: 'project' });
        }
    }

    /* ----------------------------------------------------------
       RECENT PROJECTS
    ---------------------------------------------------------- */

    async function loadRecentProjects(): Promise<void> {
        try {
            recentProjects.value = await invoke<RecentProject[]>('get_recent_projects');
        } catch {
            recentProjects.value = [];
        }
    }

    function _addToRecent(data: ProjectData) {
        const entry: RecentProject = {
            projectId:    data.projectId,
            projectName:  data.projectName,
            archivePath:  data.projectArchivePath ?? data.projectPath ?? '',
            lastOpenedAt: Date.now(),
        };
        recentProjects.value = [
            entry,
            ...recentProjects.value.filter(r => r.projectId !== entry.projectId),
        ].slice(0, 10);
    }

    /* ----------------------------------------------------------
       INTERNAL HELPERS
    ---------------------------------------------------------- */

    /** Hydrate store from a full ProjectData snapshot (on create or load). */
    function _hydrate(data: ProjectData) {
        projectId.value      = data.projectId;
        projectName.value    = data.projectName;
        projectVersion.value = data.projectVersion;
        projectPath.value    = data.projectPath ?? null;
        archivePath.value    = data.projectArchivePath ?? null;
        createdAt.value      = data.createdAt;
        updatedAt.value      = data.updatedAt;
        authors.value        = data.authors;
        course.value         = data.course;
        modulesById.value    = data.modulesById;
        lessonsById.value    = data.lessonsById;

        // Build page meta index from lessons
        pageMetaById.value = {};
        Object.values(data.lessonsById).forEach(lesson => {
            lesson.pages.forEach(p => {
                pageMetaById.value[p.id] = {
                    id: p.id, name: p.name, lessonId: lesson.id, order: p.order,
                };
            });
        });

        // Wrap raw Element entries into ComponentDefinition shape.
        // Update this mapping once Rust returns ComponentDefinition directly.
        componentLibrary.value = Object.fromEntries(
            Object.entries(data.componentLibrary).map(([id, el]) => [
                id, _elementToComponentDef(id, el),
            ])
        );

        mediaLibrary.value = Object.fromEntries(
            Object.entries(data.mediaLibrary).map(([id, m]) => [
                id,
                { id: m.id, name: m.name, type: m.type, url: m.url, createdAt: Date.now() } satisfies MediaAsset,
            ])
        );

        dslTriggers.value   = data.dslTriggers;
        actionScripts.value = data.actionScripts;

        clearAllDirty();
        clearHistory();
    }

    /**
     * Produce a full ProjectData snapshot for explicit saves and Rust bridge calls.
     * pagesById is excluded — owned by pagesStore.
     */
    function _snapshot(): ProjectData {
        return {
            projectVersion:     projectVersion.value,
            projectId:          projectId.value!,
            projectName:        projectName.value,
            projectPath:        projectPath.value ?? undefined,
            projectArchivePath: archivePath.value,
            createdAt:          createdAt.value,
            updatedAt:          updatedAt.value,
            authors:            authors.value,
            course:             course.value!,
            modulesById:        modulesById.value,
            lessonsById:        lessonsById.value,
            pagesById:          {}, // excluded — owned by pagesStore
            componentLibrary:   Object.fromEntries(
                Object.entries(componentLibrary.value).map(([id, def]) => [
                    id, def.elementsById[def.rootIds[0]] ?? ({} as Element),
                ])
            ),
            mediaLibrary: Object.fromEntries(
                Object.entries(mediaLibrary.value).map(([id, a]) => [
                    id, { id: a.id, name: a.name, type: a.type, url: a.url },
                ])
            ),
            dslTriggers:   dslTriggers.value,
            actionScripts: actionScripts.value,
        };
    }

    /** Temporary bridge: wrap a bare Element into a minimal ComponentDefinition. */
    function _elementToComponentDef(id: string, el: Element): ComponentDefinition {
        return {
            id,
            name: el.name,
            version: '1.0.0',
            source: 'local',
            authorId: '',
            rootIds: [el.id],
            elementsById: { [el.id]: el },
            props: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    }

    /** Reset all state to blank (called on project close). */
    function _reset() {
        projectId.value        = null;
        projectName.value      = '';
        projectVersion.value   = 1;
        projectPath.value      = null;
        archivePath.value      = null;
        createdAt.value        = 0;
        updatedAt.value        = 0;
        authors.value          = [];
        session.value          = null;
        course.value           = null;
        modulesById.value      = {};
        lessonsById.value      = {};
        pageMetaById.value     = {};
        componentLibrary.value = {};
        mediaLibrary.value     = {};
        dslTriggers.value      = {};
        actionScripts.value    = {};
        cfNodesById.value      = {};
        isSaving.value         = false;
        lastSavedAt.value      = null;
        clearAllDirty();
        clearHistory();
    }

    /* ----------------------------------------------------------
       PUBLIC API
    ---------------------------------------------------------- */

    return {
        // ── State ──────────────────────────────────────────────
        projectId:        readonly(projectId),
        projectName:      readonly(projectName),
        projectVersion:   readonly(projectVersion),
        projectPath:      readonly(projectPath),
        archivePath:      readonly(archivePath),
        createdAt:        readonly(createdAt),
        updatedAt:        readonly(updatedAt),
        authors:          readonly(authors),
        session:          readonly(session),
        course:           readonly(course),
        modulesById:      readonly(modulesById),
        lessonsById:      readonly(lessonsById),
        pageMetaById:     readonly(pageMetaById),
        componentLibrary: readonly(componentLibrary),
        mediaLibrary:     readonly(mediaLibrary),
        dslTriggers:      readonly(dslTriggers),
        actionScripts:    readonly(actionScripts),
        cfNodesById:      readonly(cfNodesById),   // CF_STUB
        undoStack:        readonly(undoStack),
        redoStack:        readonly(redoStack),
        dirtyScopes:      readonly(dirtyScopes),
        isSaving:         readonly(isSaving),
        lastSavedAt:      readonly(lastSavedAt),
        recentProjects:   readonly(recentProjects),

        // ── Computed ───────────────────────────────────────────
        isProjectOpen,
        currentUser,
        canEdit,
        orderedModules,
        orderedLessonsForModule,
        orderedPagesForLesson,
        localComponents,
        marketplaceComponents,
        hasDirtyScopes,
        canUndo,
        canRedo,
        nextUndoLabel,
        nextRedoLabel,

        // ── Project lifecycle ──────────────────────────────────
        createProjectAndPersist,
        loadProject,
        saveProject,
        flushScopeToWal,
        commitSnapshot,
        reconstructVersion,
        closeProject,
        loadRecentProjects,

        // ── Undo / redo ────────────────────────────────────────
        pushUndo,
        undo,
        redo,
        clearHistory,

        // ── Course ─────────────────────────────────────────────
        updateCourseMetadata,

        // ── Modules ────────────────────────────────────────────
        addModule,
        updateModule,
        deleteModule,
        reorderModules,

        // ── Lessons ────────────────────────────────────────────
        addLesson,
        updateLesson,
        deleteLesson,
        reorderLessons,

        // ── Pages (structural) ─────────────────────────────────
        registerPage,
        renamePage,
        deletePage,
        reorderPages,

        // ── Component library ──────────────────────────────────
        addComponent,
        updateComponent,
        deleteComponent,
        upgradeMarketplaceComponent,

        // ── Media ──────────────────────────────────────────────
        addMedia,
        deleteMedia,

        // ── DSL / Scripts ──────────────────────────────────────
        upsertDslTrigger,
        deleteDslTrigger,
        upsertScript,
        deleteScript,

        // ── CF stubs ───────────────────────────────────────────
        importCfNodes,   // CF_STUB
        linkCfNode,      // CF_STUB

        // ── Authors / Session ──────────────────────────────────
        addAuthor,
        updateAuthorRole,

        // ── Dirty tracking ─────────────────────────────────────
        markDirty,
        clearDirty,
        clearAllDirty,

        // ── Scope restoration (useUndoRedo) ────────────────────
        restoreScope,

        // ── Internal (Rust bridge / pagesStore) ────────────────
        _snapshot,
    };
});