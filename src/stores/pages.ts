/**
 * pages.ts
 * Pinia store — page content cache, loading, and persistence bridge.
 *
 * Responsibilities:
 *   - LRU cache of up to 15 loaded pages (stage config + element maps)
 *   - Load pages from Rust via Tauri invoke (replaces direct FS reads)
 *   - Persist pages via Tauri invoke on explicit save
 *   - Delegate dirty marking to projectMetadata store
 *   - Expose restoreSnapshot() for useUndoRedo dispatcher
 *
 * NOT responsible for:
 *   - Element mutations      → elementStore
 *   - Undo/redo stack        → projectMetadata store
 *   - Selection state        → elementStore
 *   - Canvas/zoom/pan        → stageStore
 */

import { defineStore } from 'pinia';
import { ref, readonly } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Page } from '../types/project';
import { useProjectMetadataStore } from './projectMetadata';
import { useNotificationStore } from './notification';

/* ============================================================
   CONSTANTS
   ============================================================ */

const LRU_MAX = 15;

const DEFAULT_STAGE: Page['stage'] = {
    width: 1280,
    height: 720,
    background: '#1e1e1e',
    display: { columns: '1', rows: '1', gap: '0' },
};

/* ============================================================
   TAURI PAYLOAD TYPES
   ============================================================ */

interface LoadPageResult {
    page: Page;
}

interface SavePagePayload {
    projectId: string;
    page: Page;
}

/* ============================================================
   LRU HELPERS
   ============================================================ */

/**
 * A minimal LRU cache backed by a Map (insertion-order iteration).
 * Most-recently-used entries stay; oldest entry is evicted at capacity.
 */
class LruCache<K, V> {
    private readonly map = new Map<K, V>();
    constructor(private readonly max: number) { }

    get(key: K): V | undefined {
        if (!this.map.has(key)) return undefined;
        // Re-insert to mark as most recent
        const val = this.map.get(key)!;
        this.map.delete(key);
        this.map.set(key, val);
        return val;
    }

    set(key: K, value: V): K | null {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, value);
        if (this.map.size > this.max) {
            const oldest = this.map.keys().next().value as K;
            this.map.delete(oldest);
            return oldest; // caller can react to eviction
        }
        return null;
    }

    has(key: K): boolean { return this.map.has(key); }
    delete(key: K): void { this.map.delete(key); }
    keys(): K[] { return [...this.map.keys()]; }
    values(): V[] { return [...this.map.values()]; }

    toRecord(): Record<string, V> {
        return Object.fromEntries(this.map) as Record<string, V>;
    }
}

/* ============================================================
   STORE
   ============================================================ */

export const usePagesStore = defineStore('pages', () => {

    /* ----------------------------------------------------------
       STATE
    ---------------------------------------------------------- */

    /**
     * LRU cache of loaded pages.
     * Exposed as a reactive Record for template access — kept in sync with the LRU instance.
     */
    const pagesCache = ref<Record<string, Page>>({});
    const activePageId = ref<string | null>(null);
    const isLoadingPage = ref<boolean>(false);

    // Internal LRU — single source of truth, pagesCache is its reactive mirror
    const lru = new LruCache<string, Page>(LRU_MAX);

    const project = useProjectMetadataStore();
    const notification = useNotificationStore();

    /* ----------------------------------------------------------
       HELPERS
    ---------------------------------------------------------- */

    /** Sync the LRU state into the reactive Record. */
    function _syncCache() {
        pagesCache.value = lru.toRecord();
    }

    /** Apply sane defaults to any page coming from disk or Rust. */
    function _withDefaults(page: Page): Page {
        return {
            ...page,
            stage: {
                width: page.stage?.width > 0 ? page.stage.width : DEFAULT_STAGE.width,
                height: page.stage?.height > 0 ? page.stage.height : DEFAULT_STAGE.height,
                background: page.stage?.background ?? DEFAULT_STAGE.background,
                display: page.stage?.display ?? DEFAULT_STAGE.display,
            },
            elements: page.elements ?? {},
            rootIds: page.rootIds ?? [],
        };
    }

    /* ----------------------------------------------------------
       READ ACCESSORS
    ---------------------------------------------------------- */

    function getPage(pageId: string): Page | null {
        return lru.get(pageId) ?? null;
    }

    function getActivePageData(): Page | null {
        if (!activePageId.value) return null;
        return lru.get(activePageId.value) ?? null;
    }

    function getElementById(elementId: string): import('../types/element').Element | null {
        const page = getActivePageData();
        return page?.elements[elementId] ?? null;
    }

    /* ----------------------------------------------------------
       LOAD
    ---------------------------------------------------------- */

    /**
     * Load a page into the LRU cache and set it active.
     * If already cached, just promotes it and switches active.
     * Evicted page id is returned from LRU.set — no extra cleanup needed
     * since the page was already saved before being evicted (see _evictSave).
     */
    async function loadPage(pageId: string): Promise<'Ok' | 'Error'> {
        // Already in cache — promote and switch
        if (lru.has(pageId)) {
            lru.get(pageId); // promotes to most-recent
            activePageId.value = pageId;
            _syncCache();
            return 'Ok';
        }

        if (!project.projectId) {
            notification.addNotification('No active project.', { type: 'error' });
            return 'Error';
        }

        isLoadingPage.value = true;
        try {
            const result = await invoke<LoadPageResult>('load_page', {
                projectId: project.projectId,
                pageId,
            });

            const page = _withDefaults(result.page);
            const evicted = lru.set(pageId, page);

            // If LRU evicted a page, ensure it was already persisted.
            // We don't re-save here — the dirty system handles that.
            // Just log in dev if something slipped through.
            if (evicted && import.meta.env.DEV) {
                console.warn(`[pagesStore] Page ${evicted} evicted from LRU cache.`);
            }

            activePageId.value = pageId;
            _syncCache();
            return 'Ok';
        } catch (err) {
            notification.addNotification('Failed to load page.', { type: 'error' });
            console.error('[pagesStore] loadPage error:', err);
            return 'Error';
        } finally {
            isLoadingPage.value = false;
        }
    }

    /* ----------------------------------------------------------
       WRITE / PERSIST
    ---------------------------------------------------------- */

    /**
     * Write a page into the cache. Used by elementStore after mutations.
     * Marks the page scope dirty for autosave — does NOT persist immediately.
     */
    function commitPageToCache(page: Page) {
        lru.set(page.id, page);
        _syncCache();
        project.markDirty({ kind: 'page', id: page.id });
    }

    /**
     * Explicitly persist a single page to SQLite via Rust.
     * Called on autosave flush or explicit save — not on every mutation.
     */
    async function savePage(pageId: string): Promise<void> {
        const page = lru.get(pageId);
        if (!page || !project.projectId) return;
        await invoke<void>('save_page', {
            projectId: project.projectId,
            page,
        } satisfies SavePagePayload);
        project.clearDirty({ kind: 'page', id: pageId });
    }

    /**
     * Persist all dirty pages currently in cache.
     * Called by useAutosave when flushing page scopes.
     */
    async function saveDirtyPages(): Promise<void> {
        const dirtyPageIds = lru.keys().filter(id =>
            project.dirtyScopes.has(`page:${id}`)
        );
        await Promise.all(dirtyPageIds.map(savePage));
    }

    /* ----------------------------------------------------------
       SNAPSHOT RESTORE (for useUndoRedo)
    ---------------------------------------------------------- */

    /**
     * Replace a page in cache with a deserialised snapshot.
     * Called by useUndoRedo dispatcher when scope.kind === 'page'.
     * Does NOT mark dirty — the undo system handles that.
     */
    function restoreSnapshot(pageId: string, snapshot: Page) {
        const page = _withDefaults(snapshot);
        lru.set(pageId, page);
        _syncCache();
        project.markDirty({ kind: 'page', id: pageId });
    }

    /* ----------------------------------------------------------
       UNLOAD
    ---------------------------------------------------------- */

    function unloadPage(pageId: string) {
        lru.delete(pageId);
        _syncCache();
        if (activePageId.value === pageId) activePageId.value = null;
    }

    /* ----------------------------------------------------------
       PUBLIC API
    ---------------------------------------------------------- */

    return {
        // State
        pagesCache: readonly(pagesCache),
        activePageId: readonly(activePageId),
        isLoadingPage: readonly(isLoadingPage),

        // Read
        getPage,
        getActivePageData,
        getElementById,

        // Load / unload
        loadPage,
        unloadPage,

        // Write
        commitPageToCache,
        savePage,
        saveDirtyPages,

        // Undo restore
        restoreSnapshot,
    };
});