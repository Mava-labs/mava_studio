/**
 * useSelectionRect.ts
 *
 * Tracks the bounding rect of the selected element relative
 * to the canvas stage container.
 * Updates on selection change, scroll, and resize.
 */

import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'

export interface SelectionRect {
    top: number
    left: number
    width: number
    height: number
}

export function useSelectionRect(
    selectedId: Ref<string | null>,
    stageRef: Ref<HTMLElement | null>,
) {
    const rect = ref<SelectionRect | null>(null)

    function measure() {
        if (!selectedId.value || !stageRef.value) {
            rect.value = null
            return
        }

        const node = stageRef.value.querySelector<HTMLElement>(
            `[data-eid="${selectedId.value}"]`
        )
        if (!node) { rect.value = null; return }

        const nodeBox = node.getBoundingClientRect()
        const stageBox = stageRef.value.getBoundingClientRect()

        rect.value = {
            top: nodeBox.top - stageBox.top,
            left: nodeBox.left - stageBox.left,
            width: nodeBox.width,
            height: nodeBox.height,
        }
    }

    // Re-measure whenever selection changes
    watch(selectedId, () => requestAnimationFrame(measure))

    // Re-measure on scroll or resize — elements may shift
    const ro = new ResizeObserver(measure)

    onMounted(() => {
        window.addEventListener('scroll', measure, true)
        if (stageRef.value) ro.observe(stageRef.value)
    })

    onUnmounted(() => {
        window.removeEventListener('scroll', measure, true)
        ro.disconnect()
    })

    return { selectionRect: rect, measure }
}