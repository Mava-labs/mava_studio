/**
 * useDeleteSelection.ts
 *
 * Delete/Backspace removes the currently selected canvas element(s) —
 * elementStore.removeElement() was fully built (recursive removal,
 * delete-animation, undo entry) but nothing anywhere actually called it;
 * there was no keyboard shortcut, context menu item, or panel button wired
 * to it at all. Same "plumbing, not architecture" gap this session has hit
 * a few times now.
 *
 * Same shape as useUndoRedo.ts (global keydown listener, mounted once from
 * App.vue, guards against intercepting Delete/Backspace while the user is
 * actually typing — an input, a textarea, or a contentEditable canvas
 * element mid-edit via useTextEditing.ts all report isContentEditable/tag
 * checks the same way).
 */

import { onMounted, onUnmounted } from 'vue';
import { useElementStore } from '../stores/element';
import { useEditorSelection } from './useEditorSelection';

export function useDeleteSelection() {
    const elementStore = useElementStore();
    const { selectedIds, clearSelection } = useEditorSelection();

    async function deleteSelection() {
        const ids = [...selectedIds.value];
        if (!ids.length) return;

        // Sequential, not Promise.all/a bare loop of un-awaited calls —
        // removeElement() captures the current page snapshot synchronously
        // before its delete animation (an await point), then commits that
        // captured snapshot afterwards. Firing multiple calls without
        // awaiting between them would have them all capture the same
        // pre-deletion snapshot, so whichever commits last would silently
        // undo the others' removals.
        for (const id of ids) {
            await elementStore.removeElement(id);
        }

        clearSelection();
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;

        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

        if (!selectedIds.value.size) return;
        e.preventDefault();
        void deleteSelection();
    }

    onMounted(() => {
        window.addEventListener('keydown', onKeyDown);
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', onKeyDown);
    });

    return { deleteSelection };
}
