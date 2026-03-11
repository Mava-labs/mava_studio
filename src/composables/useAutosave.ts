/**
 * useAutosave.ts
 * Composable — watches dirty scopes and flushes them to the SQLite WAL
 * via Rust on a debounced interval. Invisible to the user.
 *
 * Usage:
 *   Mount once in the root editor layout component while a project is open.
 *   Call start() when a project loads, stop() when it closes.
 *
 * Flow:
 *   User mutates state
 *     → markDirty() called by store
 *     → debounce timer resets
 *     → 2s of inactivity
 *     → flush() serialises dirty scopes and calls Rust
 *     → clearDirty() called per scope
 *     → lastSavedAt updated
 */

import { ref, watch, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useProjectMetadataStore, type DirtyScope } from '../stores/projectMetadata';
import { usePagesStore } from '../stores/pages';

/* ============================================================
   CONFIG
   ============================================================ */

/** Milliseconds of inactivity before autosave fires. */
const DEBOUNCE_MS = 2000;

/** Maximum time between autosaves even if edits are continuous. */
const MAX_FLUSH_INTERVAL_MS = 15_000;

/* ============================================================
   COMPOSABLE
   ============================================================ */

export function useAutosave() {
    const project = useProjectMetadataStore();
    const pages = usePagesStore();

    const isFlushingRef = ref(false);
    const lastFlushAt = ref<number>(0);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let maxIntervalTimer: ReturnType<typeof setTimeout> | null = null;
    let stopWatcher: (() => void) | null = null;

    /* ----------------------------------------------------------
       FLUSH
    ---------------------------------------------------------- */

    async function flush() {
        if (!project.projectId || isFlushingRef.value) return;
        if (!project.hasDirtyScopes) return;

        isFlushingRef.value = true;
        lastFlushAt.value = Date.now();

        try {
            // Flush page content via pagesStore (it knows which pages are dirty)
            await pages.saveDirtyPages();

            // Flush all remaining non-page metadata scopes
            const remaining = [...project.dirtyScopes].filter(k => !k.startsWith('page:'));

            for (const scopeKey of remaining) {
                const scope = _parseScopeKey(scopeKey);
                if (!scope) continue;

                // Ask Rust to serialise the current state of this scope to a proto blob
                // and write it to the WAL. Rust owns the serialisation logic.
                try {
                    await invoke<void>('autosave_scope', {
                        projectId: project.projectId,
                        scope,
                    });
                    project.clearDirty(scope);
                } catch (err) {
                    console.error(`[autosave] Failed to flush scope ${scopeKey}:`, err);
                    // Non-fatal — will retry on next flush cycle
                }
            }
        } finally {
            isFlushingRef.value = false;
        }
    }

    /* ----------------------------------------------------------
       DEBOUNCE LOGIC
    ---------------------------------------------------------- */

    function _scheduleFlush() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flush, DEBOUNCE_MS);
    }

    function _scheduleMaxInterval() {
        if (maxIntervalTimer) return; // already scheduled
        maxIntervalTimer = setTimeout(async () => {
            maxIntervalTimer = null;
            await flush();
        }, MAX_FLUSH_INTERVAL_MS);
    }

    /* ----------------------------------------------------------
       START / STOP
    ---------------------------------------------------------- */

    function start() {
        if (stopWatcher) return; // already running

        // Watch dirty scopes — any change reschedules the debounce
        stopWatcher = watch(
            () => project.dirtyScopes.size,
            (size) => {
                if (size === 0) return;
                _scheduleFlush();
                _scheduleMaxInterval();
            },
            { immediate: false }
        );
    }

    function stop() {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (maxIntervalTimer) clearTimeout(maxIntervalTimer);
        stopWatcher?.();
        stopWatcher = null;
        debounceTimer = null;
        maxIntervalTimer = null;
    }

    /** Force an immediate flush — call before project close or window unload. */
    async function flushNow() {
        if (debounceTimer) clearTimeout(debounceTimer);
        await flush();
    }

    onUnmounted(stop);

    /* ----------------------------------------------------------
       HELPERS
    ---------------------------------------------------------- */

    /** Parse a dirty scope key back into a DirtyScope object. */
    function _parseScopeKey(key: string): DirtyScope | null {
        const [kind, id] = key.split(':');
        switch (kind) {
            case 'project': return { kind: 'project' };
            case 'course': return { kind: 'course' };
            case 'mediaLibrary': return { kind: 'mediaLibrary' };
            case 'scripts': return { kind: 'scripts' };
            case 'dslTriggers': return { kind: 'dslTriggers' };
            case 'module': return id ? { kind: 'module', id } : null;
            case 'lesson': return id ? { kind: 'lesson', id } : null;
            case 'component': return id ? { kind: 'component', id } : null;
            default: return null;
        }
    }

    /* ----------------------------------------------------------
       PUBLIC
    ---------------------------------------------------------- */

    return {
        isFlushing: isFlushingRef,
        lastFlushAt,
        start,
        stop,
        flushNow,
    };
}