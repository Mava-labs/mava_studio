<script setup lang="ts" vapor>
    /**
     * EditorOverlay.vue
     *
     * Absolutely positioned layer that sits over the canvas stage. Renders
     * the selection ring(s), hover ring, resize handles, drop indicator, and
     * smart guides — purely presentational now, invisible to outerHTML export.
     *
     * Drag/reorder initiation deliberately does NOT live here anymore. It
     * used to: the selection ring was `pointer-events: auto` across its
     * whole rectangle and owned `@pointerdown` for dragging. But a ring
     * covers its *entire* element, including any nested children — so once
     * a container was selected, its ring silently intercepted every
     * pointerdown over that whole area, meaning a child nested inside it
     * could never be grabbed directly; you had to first select the child via
     * the three-tier click-drill (which itself takes two separate clicks)
     * just to get its own, smaller ring on top before a drag could ever
     * start on it. All drag initiation now flows through createMode.vue's
     * `handleStagePointerDown`, delegated on the stage root, which always
     * resolves to whatever's actually deepest under the pointer — so
     * grabbing a nested element and dragging it is one direct gesture, same
     * as grabbing the container's own empty background. The ring here is
     * `pointer-events: none` (pure visual) as a result; only the resize
     * handles (small, corner/edge-only) still own their own pointer events,
     * since they don't have this nested-content occlusion problem.
     */
    import { computed } from 'vue'
    import { useEditorSelection } from '../composables/useEditorSelection'
    import { useSelectionRects } from '../composables/useSelectionRect'
    import { useHoverRect } from '../composables/useHoverRect'
    import { useElementDragResize, type ResizeHandle } from '../composables/useElementDragResize'
    import { useElementReorder } from '../composables/useElementReorder'
    import { useSmartGuides } from '../composables/useSmartGuides'
    import { usePagesStore } from '../stores/pages'

    const props = defineProps<{
        stageRef: HTMLElement | null
    }>()

    const stageRefRef = computed(() => props.stageRef)
    const pages = usePagesStore()
    const { selectedIds, hoveredId } = useEditorSelection()
    const { selectionRects } = useSelectionRects(selectedIds, stageRefRef as any)
    const { hoverRect } = useHoverRect(hoveredId, stageRefRef as any)
    const { startResize } = useElementDragResize()
    const { dropIndicator } = useElementReorder()
    const { guides } = useSmartGuides()

    function guideStyle(g: { x1: number; y1: number; x2: number; y2: number }) {
        const isHorizontal = g.y1 === g.y2
        return isHorizontal
            ? { top: `${g.y1}px`, left: `${Math.min(g.x1, g.x2)}px`, width: `${Math.abs(g.x2 - g.x1)}px`, height: '1px' }
            : { top: `${Math.min(g.y1, g.y2)}px`, left: `${g.x1}px`, width: '1px', height: `${Math.abs(g.y2 - g.y1)}px` }
    }

    function guideLabelStyle(g: { x1: number; y1: number; x2: number; y2: number }) {
        return { top: `${(g.y1 + g.y2) / 2}px`, left: `${(g.x1 + g.x2) / 2}px` }
    }

    /** Only a lone selection gets resize handles — multi-select shows outlines only. */
    const primarySelectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
    const primaryRect = computed(() => primarySelectedId.value ? selectionRects.value.get(primarySelectedId.value) ?? null : null)

    /**
     * 8 handles for an element the author has already switched off `static`
     * positioning, 3 (bottom/right/bottom-right) for a flow element — not a
     * style choice, a functional one: `useElementDragResize.ts`'s
     * startResize only performs the north/west origin-shift for a
     * positioned element (a static element has no x/y to shift, so there's
     * nothing for those handles to do). Showing all 8 on a static element
     * would put 5 dead handles on screen, which is exactly what this
     * project's own stated principle says not to do — a real disabled state
     * with a tooltip beats a control that silently does nothing.
     */
    const isPositioned = computed(() => {
        const id = primarySelectedId.value
        if (!id) return false
        const el = pages.getElementById(id)
        return !!el?.layout.position && el.layout.position !== 'static'
    })

    const ALL_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    const STATIC_HANDLES: ResizeHandle[] = ['e', 's', 'se']
    const HANDLES = computed(() => isPositioned.value ? ALL_HANDLES : STATIC_HANDLES)

    function handleStyle(handle: ResizeHandle, rect: { top: number; left: number; width: number; height: number }) {
        const midX = rect.left + rect.width / 2
        const midY = rect.top + rect.height / 2
        const positions: Record<ResizeHandle, { top: number; left: number }> = {
            nw: { top: rect.top, left: rect.left },
            n: { top: rect.top, left: midX },
            ne: { top: rect.top, left: rect.left + rect.width },
            e: { top: midY, left: rect.left + rect.width },
            se: { top: rect.top + rect.height, left: rect.left + rect.width },
            s: { top: rect.top + rect.height, left: midX },
            sw: { top: rect.top + rect.height, left: rect.left },
            w: { top: midY, left: rect.left },
        }
        const pos = positions[handle]
        return { top: `${pos.top}px`, left: `${pos.left}px`, cursor: `${handle}-resize` }
    }

    function onResizeStart(event: PointerEvent, handle: ResizeHandle) {
        if (!props.stageRef || !primarySelectedId.value) return
        startResize(event, handle, primarySelectedId.value, props.stageRef)
    }
</script>

<template>
    <div class="editor-overlay">

        <!-- Hover ring -->
        <transition name="ring-fade">
            <div v-if="hoverRect && hoveredId !== (primarySelectedId ?? undefined) && !selectedIds.has(hoveredId ?? '')"
                class="ring ring--hover" :style="{
                    top: hoverRect.top + 'px',
                    left: hoverRect.left + 'px',
                    width: hoverRect.width + 'px',
                    height: hoverRect.height + 'px',
                }" />
        </transition>

        <!-- Multi-select outlines (visual only — dragging starts from createMode.vue's stage handler) -->
        <template v-if="selectedIds.size > 1">
            <div v-for="[id, rect] in selectionRects" :key="id" class="ring ring--selected" :style="{
                top: rect.top + 'px',
                left: rect.left + 'px',
                width: rect.width + 'px',
                height: rect.height + 'px',
            }" />
        </template>

        <!-- Single selection: ring (visual only) + resize handles -->
        <template v-else-if="primaryRect">
            <div class="ring ring--selected" :style="{
                top: primaryRect.top + 'px',
                left: primaryRect.left + 'px',
                width: primaryRect.width + 'px',
                height: primaryRect.height + 'px',
            }" />

            <div v-for="handle in HANDLES" :key="handle" class="resize-handle"
                :style="handleStyle(handle, primaryRect)"
                @pointerdown="(e: PointerEvent) => onResizeStart(e, handle)" />
        </template>

        <!-- Drop-position guide, shown while reordering a flow element -->
        <div v-if="dropIndicator" class="drop-indicator" :style="{
            top: dropIndicator.top + 'px',
            left: dropIndicator.left + 'px',
            width: dropIndicator.width + 'px',
            height: dropIndicator.height + 'px',
        }" />

        <!-- Smart-guide spacing lines (drag/resize/reorder) -->
        <template v-for="(g, i) in guides" :key="i">
            <div class="smart-guide" :style="guideStyle(g)" />
            <div class="smart-guide-label" :style="guideLabelStyle(g)">{{ g.label }}</div>
        </template>

    </div>
</template>

<style scoped>
    .editor-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        /* overlay never blocks canvas interaction by default — individual
           rings/handles opt back in with pointer-events: auto below */
        z-index: 100;
    }

    .ring {
        position: absolute;
        pointer-events: none;
        box-sizing: border-box;
    }

    .ring--selected {
        outline: 2px solid #3b82f6;
        outline-offset: 1px;
    }

    .ring--hover {
        outline: 1px solid #93c5fd;
        outline-offset: 1px;
    }

    .drop-indicator {
        position: absolute;
        background: #3b82f6;
        border-radius: 1px;
        pointer-events: none;
        z-index: 102;
        transition: top 0.1s cubic-bezier(0.2, 0, 0.2, 1), left 0.1s cubic-bezier(0.2, 0, 0.2, 1),
            width 0.1s cubic-bezier(0.2, 0, 0.2, 1), height 0.1s cubic-bezier(0.2, 0, 0.2, 1);
    }

    .smart-guide {
        position: absolute;
        background: #ec4899;
        pointer-events: none;
        z-index: 103;
    }

    .smart-guide-label {
        position: absolute;
        transform: translate(-50%, -50%);
        background: #ec4899;
        color: #fff;
        font-size: 10px;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        padding: 1px 4px;
        border-radius: 3px;
        pointer-events: none;
        z-index: 104;
        white-space: nowrap;
    }

    .resize-handle {
        position: absolute;
        width: 8px;
        height: 8px;
        margin: -4px 0 0 -4px;
        background: #fff;
        border: 1.5px solid #3b82f6;
        border-radius: 2px;
        pointer-events: auto;
        z-index: 101;
    }

    .ring-fade-enter-active,
    .ring-fade-leave-active {
        transition: opacity 0.1s ease;
    }

    .ring-fade-enter-from,
    .ring-fade-leave-to {
        opacity: 0;
    }
</style>
