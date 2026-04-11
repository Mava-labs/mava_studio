/**
 * useHoverRect.ts
 *
 * Tracks the bounding rect of the hovered element relative
 * to the canvas stage. Mirrors useSelectionRect but reacts
 * to hoveredId. Clears immediately on mouse leave.
 */

import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import type { SelectionRect } from './useSelectionRect'

export function useHoverRect(
    hoveredId: Ref<string | null>,
    stageRef:  Ref<HTMLElement | null>,
) {
    const rect = ref<SelectionRect | null>(null)

    function measure() {
        if (!hoveredId.value || !stageRef.value) {
            rect.value = null
            return
        }

        const node = stageRef.value.querySelector<HTMLElement>(
            `[data-eid="${hoveredId.value}"]`
        )
        if (!node) { rect.value = null; return }

        const nodeBox  = node.getBoundingClientRect()
        const stageBox = stageRef.value.getBoundingClientRect()

        rect.value = {
            top:    nodeBox.top    - stageBox.top,
            left:   nodeBox.left   - stageBox.left,
            width:  nodeBox.width,
            height: nodeBox.height,
        }
    }

    // Clear immediately when hover leaves, measure when it enters
    watch(hoveredId, (id) => {
        if (!id) { rect.value = null; return }
        requestAnimationFrame(measure)
    })

    const ro = new ResizeObserver(measure)

    onMounted(() => {
        window.addEventListener('scroll', measure, true)
        if (stageRef.value) ro.observe(stageRef.value)
    })

    onUnmounted(() => {
        window.removeEventListener('scroll', measure, true)
        ro.disconnect()
    })

    return { hoverRect: rect }
}