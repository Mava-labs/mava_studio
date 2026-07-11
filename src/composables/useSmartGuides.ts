/**
 * useSmartGuides.ts
 *
 * Shared "smart guides" overlay state — the pink distance-measurement lines
 * and coordinate/size readout badge used by drag, resize, and reorder alike
 * (Figma/Sketch-style spacing guides). Module-level state (same pattern as
 * useEditorSelection.ts's hoveredId/selectedIds) so useElementDragResize.ts
 * and useElementReorder.ts can both write into one set of guides without
 * plumbing refs through EditorOverlay.vue as props — only one drag gesture
 * is ever active at a time, so there's no cross-talk risk.
 */

import { ref, readonly } from 'vue'

export interface GuideLine {
    x1: number
    y1: number
    x2: number
    y2: number
    label: string
}

export interface Readout {
    x: number
    y: number
    text: string
}

const guides = ref<GuideLine[]>([])

function setGuides(next: GuideLine[]) {
    guides.value = next
}

/**
 * The readout badge is a raw DOM element pinned to the viewport via
 * `position: fixed`, not Vue-rendered — EditorOverlay.vue lives *inside* the
 * zoomed/panned stage, and `position: fixed` inside an ancestor with a CSS
 * transform (the stage's zoom) resolves against that ancestor instead of the
 * viewport, which would make the badge drift from the actual cursor as soon
 * as zoom !== 1. Appending straight to `document.body` sidesteps that,
 * matching how useElementReorder.ts's ghost element is created.
 */
let badgeEl: HTMLElement | null = null

function setReadout(next: Readout | null) {
    if (!next) {
        badgeEl?.remove()
        badgeEl = null
        return
    }
    if (!badgeEl) {
        badgeEl = document.createElement('div')
        Object.assign(badgeEl.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '10000',
            background: '#1d4ed8',
            color: '#fff',
            fontSize: '11px',
            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            transform: 'translate(-50%, 16px)',
        } satisfies Partial<CSSStyleDeclaration>)
        document.body.appendChild(badgeEl)
    }
    badgeEl.style.left = `${next.x}px`
    badgeEl.style.top = `${next.y}px`
    badgeEl.textContent = next.text
}

function clearGuides() {
    guides.value = []
    setReadout(null)
}

/**
 * Measures the gap from `rect`'s edges to its nearest neighbor (or the stage
 * boundary, if nothing's closer) in each of the four directions — the same
 * "distance to nearest thing" the reference recording's pink lines show.
 * Only elements vertically/horizontally overlapping `rect` count as a
 * horizontal/vertical neighbor respectively, matching how Figma's spacing
 * guides only measure along the axis two shapes actually face each other on.
 */
function measureGuides(rect: DOMRect, stageEl: HTMLElement, excludeIds: Set<string>): GuideLine[] {
    const stageBox = stageEl.getBoundingClientRect()
    const candidates = Array.from(stageEl.querySelectorAll<HTMLElement>('[data-eid]'))
        .filter(n => {
            const id = n.getAttribute('data-eid')
            return id && !excludeIds.has(id)
        })
        .map(n => n.getBoundingClientRect())

    const lines: GuideLine[] = []

    let leftGap: { dist: number; edge: number } | null = null
    let rightGap: { dist: number; edge: number } | null = null
    for (const c of candidates) {
        if (c.bottom <= rect.top || c.top >= rect.bottom) continue
        if (c.right <= rect.left) {
            const d = rect.left - c.right
            if (!leftGap || d < leftGap.dist) leftGap = { dist: d, edge: c.right }
        }
        if (c.left >= rect.right) {
            const d = c.left - rect.right
            if (!rightGap || d < rightGap.dist) rightGap = { dist: d, edge: c.left }
        }
    }
    const midY = rect.top + rect.height / 2 - stageBox.top
    if (leftGap && leftGap.dist > 0.5) {
        lines.push({ x1: leftGap.edge - stageBox.left, y1: midY, x2: rect.left - stageBox.left, y2: midY, label: `${Math.round(leftGap.dist)}` })
    }
    if (rightGap && rightGap.dist > 0.5) {
        lines.push({ x1: rect.right - stageBox.left, y1: midY, x2: rightGap.edge - stageBox.left, y2: midY, label: `${Math.round(rightGap.dist)}` })
    }

    let topGap: { dist: number; edge: number } | null = null
    let bottomGap: { dist: number; edge: number } | null = null
    for (const c of candidates) {
        if (c.right <= rect.left || c.left >= rect.right) continue
        if (c.bottom <= rect.top) {
            const d = rect.top - c.bottom
            if (!topGap || d < topGap.dist) topGap = { dist: d, edge: c.bottom }
        }
        if (c.top >= rect.bottom) {
            const d = c.top - rect.bottom
            if (!bottomGap || d < bottomGap.dist) bottomGap = { dist: d, edge: c.top }
        }
    }
    const midX = rect.left + rect.width / 2 - stageBox.left
    if (topGap && topGap.dist > 0.5) {
        lines.push({ x1: midX, y1: topGap.edge - stageBox.top, x2: midX, y2: rect.top - stageBox.top, label: `${Math.round(topGap.dist)}` })
    }
    if (bottomGap && bottomGap.dist > 0.5) {
        lines.push({ x1: midX, y1: rect.bottom - stageBox.top, x2: midX, y2: bottomGap.edge - stageBox.top, label: `${Math.round(bottomGap.dist)}` })
    }

    return lines
}

export function useSmartGuides() {
    return {
        guides: readonly(guides),
        setGuides,
        setReadout,
        clearGuides,
        measureGuides,
    }
}
