/**
 * useElementDragResize.ts
 *
 * Free-move drag (x/y) and resize-handle logic for canvas elements.
 * Same "1:1 with pointer, commit once on release" shape as App.vue's
 * aside/terminal panel resize — direct DOM style mutation during the drag,
 * one `elementStore.updateElement()` call on release.
 *
 * `startDrag` (free x/y move) only ever applies to elements the author has
 * already switched off `layout.position: 'static'` — the app models flow
 * content (HTML's natural block/flex/grid layout), so dragging must never
 * silently promote a flow element to absolute positioning. Flow elements are
 * dragged via useElementReorder.ts instead, which reorders them within their
 * parent's children rather than moving x/y. EditorOverlay.vue is the one
 * place that decides which composable a given drag gesture calls into.
 *
 * `startResize` always just sets layout.width/height and never touches
 * position/x/y — resizing a flow element (width: auto/height: auto by
 * default, see element.ts's defaultLayout()) is the author explicitly
 * fixing its size, not repositioning it. Only 'e'/'s'/'se' handles are
 * offered for static elements (EditorOverlay.vue), since shrinking from the
 * top/left edge would require a position shift flow can't express.
 *
 * Both paths feed the shared smart-guides overlay (useSmartGuides.ts) — a
 * coordinate/size readout badge near the cursor and pink distance lines to
 * the nearest neighboring elements, matching the reference recording.
 */

import { useElementStore } from '../stores/element'
import { usePagesStore } from '../stores/pages'
import { useStageStore } from '../stores/stage'
import { useSmartGuides } from './useSmartGuides'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const DRAG_THRESHOLD_PX = 4

interface DragEntry {
    id: string
    node: HTMLElement
    startX: number
    startY: number
}

export function useElementDragResize() {
    const elementStore = useElementStore()
    const pages = usePagesStore()
    const stage = useStageStore()
    const { setGuides, setReadout, clearGuides, measureGuides } = useSmartGuides()

    /** Position (relative to offsetParent) a live DOM node is currently rendered at. */
    function currentRenderedPosition(node: HTMLElement): { x: number; y: number } {
        const nodeBox = node.getBoundingClientRect()
        const parent = (node.offsetParent as HTMLElement | null)
        const parentBox = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 }
        return { x: nodeBox.left - parentBox.left, y: nodeBox.top - parentBox.top }
    }

    /**
     * `onCommit`, if given, fires once the DRAG_THRESHOLD_PX is crossed —
     * see useElementReorder.ts's startReorder for why: this lets a raw stage
     * pointerdown (createMode.vue's direct-grab handler, for reaching an
     * element nested inside a container without a separate select-then-drag
     * step) defer applying its selection change until the gesture is
     * confirmed to actually be a drag, not a click.
     */
    function startDrag(event: PointerEvent, ids: string[], stageEl: HTMLElement, onCommit?: () => void) {
        if (event.button !== 0) return
        event.stopPropagation()

        const entries: DragEntry[] = []
        for (const id of ids) {
            const el = pages.getElementById(id)
            if (!el || el.layout.locked) continue
            // Free x/y drag only ever applies to elements already off 'static'
            // positioning — flow elements reorder instead (useElementReorder.ts).
            if (!el.layout.position || el.layout.position === 'static') continue
            const node = stageEl.querySelector<HTMLElement>(`[data-eid="${id}"]`)
            if (!node) continue
            const { x, y } = currentRenderedPosition(node)
            entries.push({ id, node, startX: x, startY: y })
        }
        if (!entries.length) return

        const startClientX = event.clientX
        const startClientY = event.clientY
        let armed = false

        function onArmedMove(e: PointerEvent) {
            if (armed) return
            if (Math.hypot(e.clientX - startClientX, e.clientY - startClientY) < DRAG_THRESHOLD_PX) return
            armed = true
            document.removeEventListener('pointermove', onArmedMove)
            document.removeEventListener('pointerup', onArmedUp)
            onCommit?.()
            beginFreeDrag()
        }

        function onArmedUp() {
            document.removeEventListener('pointermove', onArmedMove)
            document.removeEventListener('pointerup', onArmedUp)
        }

        document.addEventListener('pointermove', onArmedMove)
        document.addEventListener('pointerup', onArmedUp)

        function beginFreeDrag() {
        stage.setCanvasMode('resize') // no dedicated 'drag' mode — reuses the same "handle active" state

        function apply(e: PointerEvent): Map<string, { x: number; y: number }> {
            const dx = (e.clientX - startClientX) / stage.zoom
            const dy = (e.clientY - startClientY) / stage.zoom
            const final = new Map<string, { x: number; y: number }>()

            for (const entry of entries) {
                const x = Math.round(entry.startX + dx)
                const y = Math.round(entry.startY + dy)
                entry.node.style.position = 'absolute'
                entry.node.style.left = `${x}px`
                entry.node.style.top = `${y}px`
                final.set(entry.id, { x, y })
            }
            return final
        }

        const excludeIds = new Set(entries.map(e => e.id))

        function onMove(e: PointerEvent) {
            const final = apply(e)
            const primary = entries[0]
            const pos = final.get(primary.id)
            if (pos) {
                setReadout({ x: e.clientX, y: e.clientY, text: `${pos.x}:${pos.y}` })
                setGuides(measureGuides(primary.node.getBoundingClientRect(), stageEl, excludeIds))
            }
        }

        function onUp(e: PointerEvent) {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            stage.resetToSelect()
            clearGuides()

            const final = apply(e)
            for (const [id, pos] of final) {
                elementStore.updateElement(id, {
                    layout: { x: `${pos.x}px`, y: `${pos.y}px` },
                })
            }
        }

        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        }
    }

    function startResize(event: PointerEvent, handle: ResizeHandle, id: string, stageEl: HTMLElement) {
        if (event.button !== 0) return
        event.stopPropagation()
        event.preventDefault()

        const foundNode = stageEl.querySelector<HTMLElement>(`[data-eid="${id}"]`)
        const foundEl = pages.getElementById(id)
        if (!foundNode || !foundEl || foundEl.layout.locked) return
        const node = foundNode
        const el = foundEl

        const isPositioned = !!el.layout.position && el.layout.position !== 'static'
        const { x: startX, y: startY } = currentRenderedPosition(node)
        const startBox = node.getBoundingClientRect()
        const startW = startBox.width
        const startH = startBox.height
        const startClientX = event.clientX
        const startClientY = event.clientY
        const MIN_SIZE = 8

        stage.setCanvasMode('resize')

        function apply(e: PointerEvent) {
            const dx = (e.clientX - startClientX) / stage.zoom
            const dy = (e.clientY - startClientY) / stage.zoom

            let x = startX, y = startY, w = startW, h = startH

            if (handle.includes('e')) w = Math.max(MIN_SIZE, startW + dx)
            if (handle.includes('s')) h = Math.max(MIN_SIZE, startH + dy)
            // West/north-edge handles shift the origin, which only makes sense
            // for elements already taken out of flow — a static element can't
            // move its top/left edge without becoming positioned.
            if (isPositioned && handle.includes('w')) {
                w = Math.max(MIN_SIZE, startW - dx)
                x = startX + (startW - w)
            }
            if (isPositioned && handle.includes('n')) {
                h = Math.max(MIN_SIZE, startH - dy)
                y = startY + (startH - h)
            }

            x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)

            if (isPositioned) {
                node.style.left = `${x}px`
                node.style.top = `${y}px`
            }
            node.style.width = `${w}px`
            node.style.height = `${h}px`

            return { x, y, w, h }
        }

        const excludeIds = new Set([id])

        function onMove(e: PointerEvent) {
            apply(e)
            setReadout({ x: e.clientX, y: e.clientY, text: `${node.style.width || `${Math.round(startW)}px`} × ${node.style.height || `${Math.round(startH)}px`}` })
            setGuides(measureGuides(node.getBoundingClientRect(), stageEl, excludeIds))
        }

        function onUp(e: PointerEvent) {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            stage.resetToSelect()
            clearGuides()

            const final = apply(e)
            elementStore.updateElement(id, {
                layout: isPositioned
                    ? { x: `${final.x}px`, y: `${final.y}px`, width: `${final.w}px`, height: `${final.h}px` }
                    : { width: `${final.w}px`, height: `${final.h}px` },
            })
        }

        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
    }

    return { startDrag, startResize }
}
