/**
 * useEditorSelection.ts
 *
 * Manages hover and selection state for the editor canvas.
 * Handles the three-tier click interaction:
 *   - click            → select clicked (root-level) element
 *   - click again while selected → select the deepest child under the pointer
 *   - dblclick         → select deepest target immediately
 *
 * Multi-select (shift/ctrl/cmd-click) is a separate `selectedIds` Set on top
 * of the single "active" element (`useElementStore().activeElementId`, which
 * still drives the Styles/Properties panels — those only ever edit one
 * element at a time). `selectedIds` exists for the canvas overlay (multiple
 * rings) and group operations (align/distribute/drag-together).
 */

import { ref, readonly, computed } from 'vue'
import { useElementStore } from '../stores/element'

const hoveredId = ref<string | null>(null)
const selectedIds = ref<Set<string>>(new Set())

export function useEditorSelection() {
    const elementStore = useElementStore()

    // ─── Hover ───────────────────────────────────────────────────────────────

    function onMouseEnter(id: string) {
        hoveredId.value = id
    }

    function onMouseLeave() {
        hoveredId.value = null
    }

    // ─── Selection ───────────────────────────────────────────────────────────

    function selectOnly(id: string) {
        selectedIds.value = new Set([id])
        elementStore.setActiveElement(id)
    }

    function toggleInSelection(id: string) {
        const next = new Set(selectedIds.value)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        selectedIds.value = next
        // Keep the panels pointed at the most recently touched member —
        // null once the set empties out entirely.
        elementStore.setActiveElement([...next].pop() ?? null)
    }

    /** Replace the whole selection (e.g. after a marquee/rect-select) at once. */
    function setSelection(ids: string[]) {
        selectedIds.value = new Set(ids)
        elementStore.setActiveElement(ids.length ? ids[ids.length - 1] : null)
    }

    // ─── Click ───────────────────────────────────────────────────────────────

    /**
     * Resolves which element should become selected on a click event.
     *
     * Rules:
     * - dblclick always selects the deepest element under the pointer (targetId)
     * - if nothing is selected, select the clicked (root-level) element
     * - if the clicked root is already the sole selection, select targetId
     *   (the specific child under the pointer) instead — lets a second click
     *   drill into a container without needing double-click
     * - otherwise select the clicked (root-level) element
     */
    function resolveSelection(
        clickedId: string,
        targetId: string,
        isDouble: boolean,
    ): string {
        if (isDouble) return targetId
        if (selectedIds.value.size === 1 && selectedIds.value.has(clickedId)) return targetId
        return clickedId
    }

    function onClick(clickedId: string, targetId: string, event: MouseEvent) {
        event.stopPropagation()

        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            toggleInSelection(targetId)
            return
        }

        const next = resolveSelection(clickedId, targetId, false)
        selectOnly(next)
    }

    function onDblClick(targetId: string, event: MouseEvent) {
        event.stopPropagation()
        selectOnly(targetId)
    }

    function clearSelection() {
        selectedIds.value = new Set()
        elementStore.setActiveElement(null)
    }

    return {
        hoveredId: readonly(hoveredId),
        selectedIds: readonly(selectedIds),
        /** Convenience single-id view — the panels' notion of "the" active element. */
        selectedId: computed(() => elementStore.activeElementId),
        onMouseEnter,
        onMouseLeave,
        onClick,
        onDblClick,
        clearSelection,
        toggleInSelection,
        selectOnly,
        setSelection,
    }
}
