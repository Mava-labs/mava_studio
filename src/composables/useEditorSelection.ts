/**
 * useEditorSelection.ts
 *
 * Manages hover and selection state for the editor canvas.
 * Handles the three-tier click interaction:
 *   - click            → select clicked element
 *   - click inside selected container → select child
 *   - dblclick         → select deepest target immediately
 */

import { ref, readonly } from 'vue'
import { useElementStore } from '../stores/element'

const hoveredId = ref<string | null>(null)
const selectedId = ref<string | null>(null)

export function useEditorSelection() {
    const elementStore = useElementStore()

    // ─── Hover ───────────────────────────────────────────────────────────────

    function onMouseEnter(id: string) {
        hoveredId.value = id
    }

    function onMouseLeave() {
        hoveredId.value = null
    }

    // ─── Click ───────────────────────────────────────────────────────────────

    /**
     * Resolves which element should become selected on a click event.
     *
     * Rules:
     * - dblclick always selects the deepest element under the pointer (targetId)
     * - if nothing is selected, select the clicked element (clickedId)
     * - if clicked element is already selected and is a container,
     *   select targetId (the child under the pointer)
     * - otherwise select the clicked element
     */
    function resolveSelection(
        clickedId: string,
        targetId: string,
        isDouble: boolean,
    ): string {
        if (isDouble) return targetId
        if (selectedId.value === clickedId) return targetId
        return clickedId
    }

    function onClick(clickedId: string, targetId: string, event: MouseEvent) {
        event.stopPropagation()
        const next = resolveSelection(clickedId, targetId, false)
        selectedId.value = next
        elementStore.setActiveElement(next)
    }

    function onDblClick(targetId: string, event: MouseEvent) {
        event.stopPropagation()
        selectedId.value = targetId
        elementStore.setActiveElement(targetId)
    }

    function clearSelection() {
        selectedId.value = null
        elementStore.setActiveElement(null)
    }

    return {
        hoveredId: readonly(hoveredId),
        selectedId: readonly(selectedId),
        onMouseEnter,
        onMouseLeave,
        onClick,
        onDblClick,
        clearSelection,
    }
}