/**
 * useElementReorder.ts
 *
 * Drag-to-reorder for flow-positioned elements (layout.position === 'static',
 * the default — see element.ts's defaultLayout()). This is deliberately NOT
 * a free-move-to-any-pixel drag: the app models flow content (block/flex/grid,
 * HTML's natural layout), not an absolute-position canvas, so dragging a
 * static element only ever changes *where it sits in its parent's children
 * order* (or moves it to a different container), never its positioning mode
 * or x/y. An element the author has explicitly switched to non-static
 * positioning is a different, deliberate case — see useElementDragResize.ts's
 * startDrag, which free-moves those instead and is the only path that ever
 * touches layout.x/y.
 *
 * Two correctness fixes on top of the original pass, both reported directly
 * against a reference recording:
 *
 *  1. **Drag-intent threshold.** `pointerdown` no longer immediately hides
 *     the node and reflows siblings — that fired on every grab, even ones
 *     that turned out to just be a click, so adjacent elements would visibly
 *     shift before the user had committed to dragging at all. Now the first
 *     ~4px of pointer movement is treated as "arming" the drag; only once
 *     that threshold is crossed does the actual drag begin, replayed from
 *     the arming pointerdown's captured node/ids so nothing about the
 *     gesture itself needs to restart.
 *
 *  2. **Object-anchored geometry, not cursor-anchored.** The old version fed
 *     the raw pointer clientX/clientY into computeDropTarget() — meaning the
 *     insertion line reacted to where the mouse literally was, not to where
 *     the thing being dragged actually visually sits, which is offset from
 *     the cursor by wherever within the element it was grabbed. Grab an
 *     element off-center and the two diverge, and the guide feels
 *     disconnected from the object you're moving. Every hit-test now uses
 *     the dragged visual's own current center point instead — the guide
 *     follows the dragged object, matching what the user is actually
 *     looking at.
 *
 * A third pass (see liftForDrag() below) replaced the cloned "ghost" that
 * used to represent the dragged element with the *real* live node for a
 * single-element drag — a clone can't carry a video's playback position, a
 * canvas's drawn pixels, or an input's current value, so what you were
 * looking at while dragging could visibly diverge from what actually lands.
 *
 * Also wires in the shared smart-guides overlay (useSmartGuides.ts): a
 * distance label showing the gap opening up on either side of the insertion
 * point, plus pink measurement lines to the nearest neighboring elements,
 * mirroring the reference recording's spacing guides.
 */

import { ref, readonly } from 'vue'
import { useElementStore } from '../stores/element'
import { usePagesStore } from '../stores/pages'
import { useSmartGuides } from './useSmartGuides'

export interface DropIndicator {
    top: number
    left: number
    width: number
    height: number
}

interface DropTarget {
    parentId: string | null
    index: number
    indicator: DropIndicator
}

const SETTLE_MS = 160
const SETTLE_EASE = 'cubic-bezier(0.2, 0, 0.2, 1)'
const DRAG_THRESHOLD_PX = 4

function parsePx(value: string | undefined): number {
    if (!value) return 0
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : 0
}

/** Module-level, same pattern as useEditorSelection.ts — one drag gesture at a time. */
const dropIndicator = ref<DropIndicator | null>(null)

export function useElementReorder() {
    const elementStore = useElementStore()
    const pages = usePagesStore()
    const { setGuides, setReadout, clearGuides, measureGuides } = useSmartGuides()

    function siblingListFor(parentId: string | null): string[] {
        if (!parentId) return pages.getActivePageData()?.rootIds ?? []
        const parent = pages.getElementById(parentId)
        // A component instance carries `children` too (its default slot) — see
        // element.ts's appendElementToPage/moveElement, widened the same way.
        return parent?.kind === 'container' || parent?.kind === 'component' ? parent.children : []
    }

    function orientationFor(parentId: string | null): 'row' | 'column' {
        if (!parentId) return 'column'
        const parent = pages.getElementById(parentId)
        if (parent?.layout?.mode === 'flex' && parent.layout.direction === 'row') return 'row'
        if (parent?.layout?.mode === 'grid') return 'row'
        return 'column'
    }

    /** Deepest data-eid element at a point, excluding the dragged set. */
    function elementAtPoint(x: number, y: number, excludeIds: Set<string>): HTMLElement | null {
        const stack = document.elementsFromPoint(x, y) as HTMLElement[]
        for (const node of stack) {
            const host = node.closest<HTMLElement>('[data-eid]')
            if (!host) continue
            const id = host.getAttribute('data-eid')
            if (id && !excludeIds.has(id)) return host
        }
        return null
    }

    const EDGE_ZONE_FRACTION = 0.2
    const EDGE_ZONE_MIN_PX = 8

    /**
     * True when (x, y) is in the outer strip of a container's box, on the
     * axis its own parent lays siblings out along. Without this, hovering a
     * container — anywhere in its box, edge included — always resolved to
     * "drop inside it" (parentId = the container), with no path back out to
     * "drop next to it" in the container's own parent. That made it
     * impossible to reorder a container relative to its siblings, or place
     * a flat element adjacent to one, since any hover over the container's
     * area (which is most of what you'd naturally point at) only ever
     * offered "become a child." The outer ~20% of the box (min 8px) on the
     * relevant axis now reads as "insert as a sibling of this container"
     * instead — same split VS Code's file-tree drag and Notion's block drag
     * use for "drop into this folder/block" vs "drop next to it."
     */
    function isNearContainerEdge(
        rect: DOMRect,
        containerEl: import('../types/element').ContainerElement | import('../types/element').ComponentElement,
        x: number,
        y: number,
    ): boolean {
        const orientation = orientationFor(containerEl.parentId ?? null)
        if (orientation === 'row') {
            const edge = Math.max(EDGE_ZONE_MIN_PX, rect.width * EDGE_ZONE_FRACTION)
            return x < rect.left + edge || x > rect.right - edge
        }
        const edge = Math.max(EDGE_ZONE_MIN_PX, rect.height * EDGE_ZONE_FRACTION)
        return y < rect.top + edge || y > rect.bottom - edge
    }

    /** `x`/`y` here is the dragged object's own center — see file header point 2. */
    function computeDropTarget(
        x: number,
        y: number,
        stageEl: HTMLElement,
        excludeIds: Set<string>,
    ): DropTarget | null {
        const hovered = elementAtPoint(x, y, excludeIds)
        if (!hovered) return null

        const hoveredId = hovered.getAttribute('data-eid')!
        const hoveredEl = pages.getElementById(hoveredId)
        if (!hoveredEl) return null

        let parentId: string | null
        let referenceId: string | null

        // A component instance is a container for drop purposes too — its
        // `children` is the default slot (render-bridge's slotContent).
        const isContainerLike = hoveredEl.kind === 'container' || hoveredEl.kind === 'component'

        if (isContainerLike && isNearContainerEdge(hovered.getBoundingClientRect(), hoveredEl, x, y)) {
            // Adjacent to the container, in ITS parent — not inside it.
            parentId = hoveredEl.parentId ?? null
            referenceId = hoveredId
        } else if (isContainerLike && hoveredEl.children.length === 0) {
            parentId = hoveredId
            referenceId = null
        } else if (isContainerLike) {
            parentId = hoveredId
            referenceId = hoveredEl.children[hoveredEl.children.length - 1] ?? null
        } else {
            parentId = hoveredEl.parentId ?? null
            referenceId = hoveredId
        }
        if (excludeIds.has(parentId ?? '')) return null

        const list = siblingListFor(parentId)
        const orientation = orientationFor(parentId)
        const stageBox = stageEl.getBoundingClientRect()

        if (!referenceId) {
            const containerBox = hovered.getBoundingClientRect()
            return {
                parentId,
                index: 0,
                indicator: orientation === 'row'
                    ? { top: containerBox.top - stageBox.top, left: containerBox.left - stageBox.left, width: 2, height: containerBox.height }
                    : { top: containerBox.top - stageBox.top, left: containerBox.left - stageBox.left, width: containerBox.width, height: 2 },
            }
        }

        const refNode = stageEl.querySelector<HTMLElement>(`[data-eid="${referenceId}"]`)
        if (!refNode) return null
        const refBox = refNode.getBoundingClientRect()
        const refIndex = list.indexOf(referenceId)

        const before = orientation === 'row'
            ? x < refBox.left + refBox.width / 2
            : y < refBox.top + refBox.height / 2

        const index = before ? refIndex : refIndex + 1
        const indicator: DropIndicator = orientation === 'row'
            ? {
                top: refBox.top - stageBox.top,
                left: (before ? refBox.left : refBox.right) - stageBox.left,
                width: 2,
                height: refBox.height,
            }
            : {
                top: (before ? refBox.top : refBox.bottom) - stageBox.top,
                left: refBox.left - stageBox.left,
                width: refBox.width,
                height: 2,
            }

        return { parentId, index, indicator }
    }

    interface DragVisual {
        /** The node whose position tracks the cursor — the real live element for a single drag. */
        el: HTMLElement
        offsetX: number
        offsetY: number
        /** Puts the DOM back exactly as it was — used on cancel, where no store commit follows to rebuild it. */
        restore: () => void
    }

    /**
     * Single-element drag moves the *real* live node, not a clone — a clone
     * can't carry live state (a video's playback position, a canvas's drawn
     * pixels, an input's current typed value all only exist on the actual
     * node), so the thing you were looking at while dragging would visibly
     * diverge from the thing that lands. Lifted out of its parent and
     * reparented onto `document.body` so `position: fixed` resolves against
     * the real viewport rather than the zoomed/panned stage (an ancestor
     * with a CSS transform becomes the containing block for `fixed`
     * descendants — see useSmartGuides.ts's readout badge for the same
     * constraint) — everything about its current rendered box (size,
     * on-screen position) is frozen inline so nothing jumps or reflows the
     * instant it leaves flow.
     *
     * Multi-select still shows a small "N elements" pill rather than N real
     * nodes — dragging several live elements with correct relative offsets
     * is a meaningfully bigger problem (each has its own size, and "the
     * cursor" can only anchor one of them), and the group-drag case doesn't
     * have the single-element case's live-state-divergence problem to begin
     * with. Deliberate scope line, not a shortcut: revisit if multi-select
     * drag turns out to need the same treatment.
     */
    function liftForDrag(nodes: HTMLElement[], startEvent: PointerEvent): DragVisual {
        if (nodes.length === 1) {
            const node = nodes[0]
            const rect = node.getBoundingClientRect()
            const parent = node.parentElement
            const nextSibling = node.nextSibling
            const previousStyleCssText = node.style.cssText

            Object.assign(node.style, {
                position: 'fixed',
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                margin: '0',
                zIndex: '9999',
                pointerEvents: 'none',
                opacity: '0.92',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                willChange: 'transform',
                transition: 'none',
            } satisfies Partial<CSSStyleDeclaration>)
            document.body.appendChild(node)

            return {
                el: node,
                offsetX: startEvent.clientX - rect.left,
                offsetY: startEvent.clientY - rect.top,
                restore: () => {
                    node.style.cssText = previousStyleCssText
                    if (!parent) return
                    if (nextSibling && nextSibling.parentElement === parent) parent.insertBefore(node, nextSibling)
                    else parent.appendChild(node)
                },
            }
        }

        const pill = document.createElement('div')
        pill.textContent = `${nodes.length} elements`
        Object.assign(pill.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '9999',
            left: '0px',
            top: '0px',
            padding: '6px 12px',
            background: '#3b82f6',
            color: '#fff',
            fontSize: '12px',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            willChange: 'transform',
        } satisfies Partial<CSSStyleDeclaration>)
        document.body.appendChild(pill)

        return {
            el: pill,
            offsetX: 12,
            offsetY: 12,
            restore: () => pill.remove(),
        }
    }

    /** Generic over `mutate`'s return so a caller can thread a value (e.g. the lifted drag visual) out through the FLIP measurement. */
    function flip<T>(container: HTMLElement, mutate: () => T): T {
        const children = Array.from(container.querySelectorAll<HTMLElement>(':scope > [data-eid]'))
        const before = new Map(children.map(el => [el, el.getBoundingClientRect()]))

        const result = mutate()

        for (const el of children) {
            const prev = before.get(el)
            if (!prev) continue
            const next = el.getBoundingClientRect()
            const dx = prev.left - next.left
            const dy = prev.top - next.top
            if (!dx && !dy) continue
            el.animate(
                [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
                { duration: SETTLE_MS, easing: SETTLE_EASE },
            )
        }

        return result
    }

    /** The real drag — only entered once the arming threshold is crossed. */
    function beginDrag(startEvent: PointerEvent, movable: string[], nodes: HTMLElement[], stageEl: HTMLElement) {
        const excludeIds = new Set(movable)
        for (const node of nodes) {
            node.querySelectorAll<HTMLElement>('[data-eid]').forEach(n => {
                const id = n.getAttribute('data-eid')
                if (id) excludeIds.add(id)
            })
        }

        const originalParents = new Set(nodes.map(n => n.parentElement).filter((p): p is HTMLElement => !!p))
        const previousDisplay = new Map<HTMLElement, string>()

        let visual: DragVisual
        if (nodes.length === 1) {
            // Single drag: the lift-to-body mutation IS the flow-removal —
            // one FLIP pass covers both "siblings close the gap" and
            // "produce the thing that visually follows the cursor."
            const parent = nodes[0].parentElement
            visual = parent ? flip(parent, () => liftForDrag(nodes, startEvent)) : liftForDrag(nodes, startEvent)
        } else {
            // Multi-select: each dragged node still needs to leave flow (so
            // its siblings close the gap), but the visual is a separate
            // synthetic pill, not any one of the real nodes — see liftForDrag's
            // doc comment for why multi-select doesn't get the real-node treatment.
            for (const parent of originalParents) {
                flip(parent, () => {
                    for (const node of nodes) {
                        if (node.parentElement === parent) {
                            previousDisplay.set(node, node.style.display)
                            node.style.display = 'none'
                        }
                    }
                })
            }
            visual = liftForDrag(nodes, startEvent)
        }

        const dragEl = visual.el
        const { offsetX, offsetY } = visual

        let pending: DropTarget | null = null
        let shiftedContainer: HTMLElement | null = null
        let shiftedSiblings: HTMLElement[] = []
        let rafHandle = 0
        let latestEvent = startEvent

        function clearShift() {
            for (const el of shiftedSiblings) {
                el.style.transition = `transform ${SETTLE_MS}ms ${SETTLE_EASE}`
                el.style.transform = ''
            }
            shiftedSiblings = []
            shiftedContainer = null
        }

        function applyShift(target: DropTarget, stageEl: HTMLElement) {
            const container = target.parentId
                ? stageEl.querySelector<HTMLElement>(`[data-eid="${target.parentId}"]`)
                : stageEl

            if (container !== shiftedContainer) clearShift()
            if (!container) return
            shiftedContainer = container

            const list = siblingListFor(target.parentId).filter(id => !excludeIds.has(id))
            const orientation = orientationFor(target.parentId)
            const draggedRect = dragEl.getBoundingClientRect()
            const parentEl = target.parentId ? pages.getElementById(target.parentId) : null
            const gap = parentEl?.layout?.gap ? parsePx(parentEl.layout.gap) : 0
            const shiftAmount = (orientation === 'row' ? draggedRect.width : draggedRect.height) + gap

            const next: HTMLElement[] = []
            list.forEach((id, i) => {
                const node = stageEl.querySelector<HTMLElement>(`[data-eid="${id}"]`)
                if (!node) return
                const push = i >= target.index
                node.style.transition = `transform ${SETTLE_MS}ms ${SETTLE_EASE}`
                node.style.transform = push
                    ? (orientation === 'row' ? `translateX(${shiftAmount}px)` : `translateY(${shiftAmount}px)`)
                    : ''
                next.push(node)
            })
            shiftedSiblings = next

            setReadout({
                x: latestEvent.clientX,
                y: latestEvent.clientY,
                text: `${Math.round(shiftAmount)}px gap · position ${target.index + 1} of ${list.length + 1}`,
            })
            setGuides(measureGuides(draggedRect, stageEl, excludeIds))
        }

        function runPointerWork() {
            rafHandle = 0
            const dragRect = dragEl.getBoundingClientRect()
            const objX = dragRect.left + dragRect.width / 2
            const objY = dragRect.top + dragRect.height / 2

            pending = computeDropTarget(objX, objY, stageEl, excludeIds)
            dropIndicator.value = pending?.indicator ?? null
            if (pending) applyShift(pending, stageEl)
            else {
                clearShift()
                clearGuides()
            }
        }

        function onMove(e: PointerEvent) {
            latestEvent = e
            dragEl.style.left = `${e.clientX - offsetX}px`
            dragEl.style.top = `${e.clientY - offsetY}px`
            if (!rafHandle) rafHandle = requestAnimationFrame(runPointerWork)
        }

        function cleanup() {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('pointercancel', onCancel)
            if (rafHandle) cancelAnimationFrame(rafHandle)
            clearShift()
            dropIndicator.value = null
            clearGuides()
        }

        function onUp() {
            cleanup()

            if (pending) {
                // A resolved drop always ends in elementStore.moveElement(),
                // which (per createMode.vue's watchEffect) tears down and
                // rebuilds the whole canvas DOM from the store — so the
                // lifted node/pill and any display:none siblings don't need
                // restoring, just discarding; the rebuild replaces all of it.
                dragEl.remove()
                for (const id of movable) {
                    elementStore.moveElement(id, pending.parentId, pending.index)
                }
            } else {
                // Released somewhere that never resolved to a valid drop
                // target (outside any container, past the stage edge, etc.)
                // — no store commit is coming, so no rebuild will replace
                // this element. Discarding unconditionally here used to
                // delete the live node from the DOM with nothing to bring it
                // back: the data still said the element existed, but its
                // real DOM node was gone until some unrelated edit forced a
                // full rebuild — which is exactly what "elements disappear"
                // looked like. Treat an unresolved drop like a cancel instead.
                visual.restore()
                for (const [node, display] of previousDisplay) node.style.display = display
            }
            pending = null
        }

        function onCancel() {
            cleanup()
            // No store commit follows a cancel, so the DOM has to go back to
            // exactly how it was — unlike onUp, nothing will rebuild it for us.
            visual.restore()
            for (const [node, display] of previousDisplay) node.style.display = display
            pending = null
        }

        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('pointercancel', onCancel)

        // Feed this same pointerdown's position into the real drag so the
        // dragged element/indicator appear at the correct spot immediately,
        // without waiting for the next pointermove.
        onMove(startEvent)
    }

    /**
     * `onCommit`, if given, fires once — exactly when the drag threshold is
     * crossed and the gesture is now definitely a drag, not a click. Lets a
     * caller that starts this from a raw stage pointerdown (rather than an
     * already-selected element's ring — see createMode.vue's direct-grab
     * handler, added so elements nested inside a container aren't a two-step
     * "select the parent, then select again to reach the child" dance to
     * even begin dragging) apply the resulting selection change and suppress
     * the click-selection handler that would otherwise also fire on pointerup.
     */
    function startReorder(event: PointerEvent, ids: string[], stageEl: HTMLElement, onCommit?: () => void) {
        if (event.button !== 0) return
        event.stopPropagation()

        const movable = ids.filter(id => {
            const el = pages.getElementById(id)
            return el && !el.layout.locked
        })
        if (!movable.length) return

        const nodes = movable
            .map(id => stageEl.querySelector<HTMLElement>(`[data-eid="${id}"]`))
            .filter((n): n is HTMLElement => !!n)
        if (!nodes.length) return

        const startX = event.clientX
        const startY = event.clientY
        let armed = false

        function onArmedMove(e: PointerEvent) {
            if (armed) return
            const dx = e.clientX - startX
            const dy = e.clientY - startY
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

            armed = true
            document.removeEventListener('pointermove', onArmedMove)
            document.removeEventListener('pointerup', onArmedUp)
            e.preventDefault()
            onCommit?.()
            beginDrag(e, movable, nodes, stageEl)
        }

        function onArmedUp() {
            // Never crossed the threshold — this was just a click, not a drag.
            document.removeEventListener('pointermove', onArmedMove)
            document.removeEventListener('pointerup', onArmedUp)
        }

        document.addEventListener('pointermove', onArmedMove)
        document.addEventListener('pointerup', onArmedUp)
    }

    return {
        dropIndicator: readonly(dropIndicator),
        startReorder,
    }
}
