/**
 * useUndoRedo.ts
 * Composable — keyboard bindings and scope-based undo/redo dispatch.
 *
 * Dispatch map:
 *   scope.kind === 'page' | 'component'  →  elementStore.restoreSnapshot()
 *   everything else                       →  projectMetadata.restoreScope()
 *
 * Usage:
 *   Mount once in the root editor layout while a project is open.
 *   Keyboard listeners are registered on mount and cleaned up on unmount.
 */

import { onMounted, onUnmounted } from 'vue';
import { useProjectMetadataStore } from '../stores/projectMetadata';
import { useElementStore } from '../stores/element';
import { usePagesStore } from '../stores/pages';
import type { UndoAction } from '../stores/projectMetadata';
import type { Page } from '../types/project';

/* ============================================================
   COMPOSABLE
   ============================================================ */

export function useUndoRedo() {
    const project = useProjectMetadataStore();
    const elements = useElementStore();
    const pages = usePagesStore();

    /* ----------------------------------------------------------
       DISPATCH
    ---------------------------------------------------------- */

    /**
     * Apply a restored snapshot to the store that owns the affected scope.
     * This is the single dispatch point — useUndoRedo never touches data directly.
     */
    async function _applySnapshot(action: UndoAction, direction: 'undo' | 'redo') {
        const snapshot = direction === 'undo' ? action.before : action.after;
        const scope = action.scope;

        if (!snapshot) {
            console.warn(`[useUndoRedo] Empty snapshot for action "${action.label}" — skipping`);
            return;
        }

        try {
            const parsed = JSON.parse(snapshot);

            switch (scope.kind) {
                // ── Page / component element trees ───────────────
                case 'page':
                case 'component': {
                    const pageId = 'id' in scope ? scope.id : pages.activePageId;
                    if (!pageId) return;
                    elements.restoreSnapshot(pageId, parsed as Page);
                    break;
                }

                // ── Project-level metadata ────────────────────────
                case 'project':
                case 'course':
                case 'module':
                case 'lesson':
                case 'mediaLibrary':
                case 'scripts':
                case 'dslTriggers':
                case 'variables':
                    // projectMetadata owns these — delegate restoration
                    project.restoreScope(scope, parsed);
                    break;

                default:
                    console.warn(`[useUndoRedo] Unknown scope kind: ${(scope as any).kind}`);
            }
        } catch (err) {
            console.error('[useUndoRedo] Failed to parse or apply snapshot:', err);
        }
    }

    /* ----------------------------------------------------------
       UNDO / REDO
    ---------------------------------------------------------- */

    async function undo() {
        if (!project.canUndo) return;
        const action = await project.undo();
        if (action) await _applySnapshot(action, 'undo');
    }

    async function redo() {
        if (!project.canRedo) return;
        const action = await project.redo();
        if (action) await _applySnapshot(action, 'redo');
    }

    /* ----------------------------------------------------------
       KEYBOARD HANDLER
    ---------------------------------------------------------- */

    function _onKeyDown(e: KeyboardEvent) {
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const mod = isMac ? e.metaKey : e.ctrlKey;

        if (!mod) return;

        // Don't intercept shortcuts while typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
            e.preventDefault();
            redo();
        }
    }

    /* ----------------------------------------------------------
       LIFECYCLE
    ---------------------------------------------------------- */

    onMounted(() => {
        window.addEventListener('keydown', _onKeyDown);
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', _onKeyDown);
    });

    /* ----------------------------------------------------------
       PUBLIC
    ---------------------------------------------------------- */

    return {
        undo,
        redo,
        canUndo: project.canUndo,
        canRedo: project.canRedo,
        nextUndoLabel: project.nextUndoLabel,
        nextRedoLabel: project.nextRedoLabel,
    };
}