/**
 * useSelectionRect.ts
 *
 * Tracks the bounding rect of the selected element relative
 * to the canvas stage container.
 * Updates on selection change, scroll, resize, and any store commit.
 *
 * That last one matters more than it sounds: createMode.vue's root
 * watchEffect depends on `elements.value`/`rootIds.value`, and every single
 * store commit (`pages.commitPageToCache()`) replaces the whole page object
 * via `deepClone()` — so those refs change identity on *every* edit, not
 * just structural ones, and the entire canvas DOM gets torn down and
 * rebuilt from scratch each time (see CLEANUP_TODO.md Phase 3.24). Without
 * this, changing a selected element's position/size via the properties
 * panel (e.g. flipping Pos from absolute back to static) left the
 * selection ring and resize handles pointing at the element's *previous*
 * on-screen box — a stale-rect bug, not a rendering bug: the DOM was
 * correct, this composable's cached rect just never got told to re-measure.
 */

import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import { usePagesStore } from '../stores/pages'

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

    // Re-measure whenever the page data commits (the DOM gets rebuilt on
    // every commit — see file header) — catches any property edit that
    // moves/resizes the selected element without changing the selection itself.
    const pages = usePagesStore()
    watch(() => pages.getActivePageData(), () => requestAnimationFrame(measure))

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

/**
 * Multi-select variant of the above — one rect per id in a Set, keyed by
 * element id. Used by EditorOverlay.vue to draw an outline per selected
 * element when more than one is selected (resize handles only ever show
 * for a lone selection — see EditorOverlay.vue).
 */
export function useSelectionRects(
    selectedIds: Ref<ReadonlySet<string>>,
    stageRef: Ref<HTMLElement | null>,
) {
    const rects = ref<Map<string, SelectionRect>>(new Map())

    function measure() {
        const stage = stageRef.value
        if (!stage || selectedIds.value.size === 0) {
            rects.value = new Map()
            return
        }

        const stageBox = stage.getBoundingClientRect()
        const next = new Map<string, SelectionRect>()

        for (const id of selectedIds.value) {
            const node = stage.querySelector<HTMLElement>(`[data-eid="${id}"]`)
            if (!node) continue
            const nodeBox = node.getBoundingClientRect()
            next.set(id, {
                top: nodeBox.top - stageBox.top,
                left: nodeBox.left - stageBox.left,
                width: nodeBox.width,
                height: nodeBox.height,
            })
        }

        rects.value = next
    }

    watch(selectedIds, () => requestAnimationFrame(measure), { deep: true })

    const pages = usePagesStore()
    watch(() => pages.getActivePageData(), () => requestAnimationFrame(measure))

    const ro = new ResizeObserver(measure)

    onMounted(() => {
        window.addEventListener('scroll', measure, true)
        if (stageRef.value) ro.observe(stageRef.value)
    })

    onUnmounted(() => {
        window.removeEventListener('scroll', measure, true)
        ro.disconnect()
    })

    return { selectionRects: rects, measure }
}
