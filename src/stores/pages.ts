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
import type { Page, ComponentDefinition } from '../types/project';
import { deepClone } from '../types/project';
import type { Element } from '../types/element';
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
    display: { padding: 0, margin: 0, overflow: 'auto', layout: { mode: 'block' } },
};

// The synthetic stage a component gets when edited on the canvas — a component
// has no stage of its own; this is just the editing surface size. Ignored on
// commit (only rootIds/elementsById flow back to the definition).
const DEFAULT_COMPONENT_STAGE: Page['stage'] = {
    width: 800,
    height: 600,
    background: '#1e1e1e',
    display: { padding: 0, margin: 0, overflow: 'auto', layout: { mode: 'block' } },
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
    clear(): void { this.map.clear(); }
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
    const recentActiveIds = ref<string[]>([]);

    /**
     * Ids in `pagesCache`/`activePageId` that are actually *component* editing
     * surfaces (a component tab), not real pages. A component is edited on the
     * canvas as a virtual Page (id = componentId); this set is how the store
     * knows to route its commits/saves/undo to the component library instead
     * of the page-save path. Empty in the normal page-only workflow — every
     * page-path branch below is unchanged when nothing is a component surface.
     */
    const componentSurfaces = ref<Set<string>>(new Set());

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

    function _rememberActive(pageId: string) {
        recentActiveIds.value = [...recentActiveIds.value.filter(id => id !== pageId), pageId];
    }

    /** Apply sane defaults to any page coming from disk or Rust. */
    function _withDefaults(page: Page): Page {
        return {
            ...page,
            stage: {
                width: page.stage?.width > 0 ? page.stage.width : DEFAULT_STAGE.width,
                height: page.stage?.height > 0 ? page.stage.height : DEFAULT_STAGE.height,
                background: page.stage?.background ?? DEFAULT_STAGE.background,
                display: {
                    padding: page.stage?.display?.padding ?? DEFAULT_STAGE.display!.padding,
                    margin: page.stage?.display?.margin ?? DEFAULT_STAGE.display!.margin,
                    overflow: page.stage?.display?.overflow ?? DEFAULT_STAGE.display!.overflow,
                    layout: page.stage?.display?.layout ?? DEFAULT_STAGE.display!.layout,
                },
            },
            elements: page.elements ?? {},
            rootIds: page.rootIds ?? [],
        };
    }

    /* ----------------------------------------------------------
       READ ACCESSORS
    ---------------------------------------------------------- */

    function getPage(pageId: string): Page | null {
        return pagesCache.value[pageId] ?? null;
    }

    function getActivePageData(): Page | null {
        if (!activePageId.value) return null;
        return pagesCache.value[activePageId.value] ?? null;
    }

    function getElementById(elementId: string): import('../types/element').Element | null {
        const page = getActivePageData();
        return page?.elements[elementId] ?? null;
    }

    /* ----------------------------------------------------------
       COMPONENT EDITING SURFACES
    ---------------------------------------------------------- */

    function isComponentSurface(id: string | null): boolean {
        return !!id && componentSurfaces.value.has(id);
    }

    /** The scope (page vs component) the active surface's mutations belong to — used for undo + dirty routing. */
    function activeSurfaceScope(): { kind: 'page' | 'component'; id: string } | null {
        const id = activePageId.value;
        if (!id) return null;
        return { kind: isComponentSurface(id) ? 'component' : 'page', id };
    }

    /** Build the virtual Page that backs editing a component on the canvas. */
    function _componentToPage(def: ComponentDefinition): Page {
        return {
            id: def.id,
            visible: true,
            stage: DEFAULT_COMPONENT_STAGE,
            elements: deepClone(def.elementsById) as Record<string, Element>,
            rootIds: [...def.rootIds],
            metadata: {
                title: def.name,
                version: 1,
                createdAt: def.createdAt,
                updatedAt: def.updatedAt,
                lastEditedBy: { userId: def.authorId, name: '' },
            },
        };
    }

    /**
     * Open (or re-open) a component as the active editing surface — the canvas,
     * element store, and tab strip then treat it exactly like a page. Derived
     * fresh from the (always-current, since commits sync it) component library.
     */
    function openComponentSurface(componentId: string): 'Ok' | 'Error' {
        const def = project.componentLibrary[componentId] as ComponentDefinition | undefined;
        if (!def) {
            notification.addNotification('Component not found.', { type: 'error' });
            return 'Error';
        }
        lru.set(componentId, _componentToPage(def));
        componentSurfaces.value.add(componentId);
        activePageId.value = componentId;
        _rememberActive(componentId);
        _syncCache();
        return 'Ok';
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
        // Component surface — re-derive from the library and activate, never
        // hit Rust's load_page (there's no page row for a component id).
        if (isComponentSurface(pageId)) {
            return openComponentSurface(pageId);
        }

        // Already in cache — promote and switch
        if (lru.has(pageId)) {
            lru.get(pageId); // promotes to most-recent
            activePageId.value = pageId;
            _rememberActive(pageId);
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
            _rememberActive(pageId);
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
        if (isComponentSurface(page.id)) {
            // Sync the edited tree back to the component definition and mark
            // the component scope dirty (updateComponent does the markDirty).
            project.updateComponent(page.id, {
                rootIds: [...page.rootIds],
                elementsById: { ...page.elements },
            });
        } else {
            project.markDirty({ kind: 'page', id: page.id });
        }
    }

    /**
     * Patch the active page's stage (width/height/background) — the "no element
     * selected" Page Settings panel target. Same clone-mutate-commit-undo shape
     * as elementStore.updateElement, just for stage config instead of an element.
     */
    function updateStage(patch: Partial<Page['stage']>): void {
        const page = getActivePageData();
        if (!page) return;

        const before = JSON.stringify(page);
        const updated = deepClone(page);
        updated.stage = { ...updated.stage, ...patch };

        commitPageToCache(updated);
        project.pushUndo({
            label: 'Edit page settings',
            scope: { kind: 'page', id: page.id },
            before,
            after: JSON.stringify(updated),
        });
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

    function closeAll(){
        activePageId.value = null
        recentActiveIds.value = []
        lru.clear()
        _syncCache()
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
        if (isComponentSurface(pageId)) {
            project.updateComponent(pageId, {
                rootIds: [...page.rootIds],
                elementsById: { ...page.elements },
            });
        } else {
            project.markDirty({ kind: 'page', id: pageId });
        }
    }

    /* ----------------------------------------------------------
       UNLOAD
    ---------------------------------------------------------- */

    function unloadPage(pageId: string) {
        const wasActive = activePageId.value === pageId;
        lru.delete(pageId);
        recentActiveIds.value = recentActiveIds.value.filter(id => id !== pageId);

        if (wasActive) {
            const fallbackFromHistory = [...recentActiveIds.value].reverse().find(id => lru.has(id)) ?? null;
            if (fallbackFromHistory) {
                lru.get(fallbackFromHistory);
                activePageId.value = fallbackFromHistory;
                _rememberActive(fallbackFromHistory);
            } else {
                const keys = lru.keys();
                const fallback = keys.length ? keys[keys.length - 1] : null;
                activePageId.value = fallback;
                if (fallback) _rememberActive(fallback);
            }
        }

        _syncCache();
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

        // Component editing surfaces
        openComponentSurface,
        isComponentSurface,
        activeSurfaceScope,

        // Load / unload
        loadPage,
        unloadPage,
        closeAll,

        // Write
        commitPageToCache,
        updateStage,
        savePage,
        saveDirtyPages,

        // Undo restore
        restoreSnapshot,
    };
});