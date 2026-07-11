<template>
    <div
        class="h-full w-full grid grid-rows-[min-content_1fr] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

        <!-- ── Page tabs (VS Code style) ───────────────────────────────────── -->
        <div class="border-b border-slate-200 overflow-hidden dark:border-slate-800 bg-white/90 dark:bg-slate-900/80">
            <div ref="tabsStrip" class="flex items-center gap-0 overflow-x-auto overflow-y-hidden thin-scroll">
                <div v-for="tab in openPageTabs" :key="tab.id"
                    :data-tab-id="tab.id"
                    class="group relative cursor-pointer flex items-center justify-between gap-2 pl-3 pr-1 py-2 text-sm transition border-r border-slate-200 dark:border-slate-700 shrink-0"
                    :class="[
                        tab.isActive
                            ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 shadow-inner'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                        tab.isComponent ? 'border-t-2 border-t-sky-500' : ''
                    ]"
                >
                    <button type="button" class="min-w-0 flex-1 text-left" @click="switchPage(tab.id)">
                        <span class="truncate max-w-48 flex items-center gap-1.5">
                            <span v-if="tab.isComponent" class="text-sky-500 shrink-0" title="Component">◈</span>
                            <span class="truncate">{{ tab.title }}</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        class="ml-1 w-5 h-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/70 transition-opacity"
                        :class="tab.isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                        aria-label="Close page"
                        @click.stop="closeTab(tab.id)"
                    >
                        <svg class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18 17.94 6M18 18 6.06 6" />
                        </svg>
                    </button>
                    <span v-if="tab.isActive"
                        class="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full">
                    </span>
                </div>
                <div v-if="openPageTabs.length === 0" class="text-xs text-slate-700 dark:text-slate-400 px-3 py-2.5">
                    No open pages.
                </div>
            </div>
        </div>

        <!-- ── Canvas area ─────────────────────────────────────────────────── -->
        <div class="relative h-full w-full overflow-hidden">

            <!-- dot-grid background -->
            <div class="absolute inset-0 pointer-events-none
                bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.07)_1px,transparent_0)]
                dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)]
                bg-size-[16px_16px]" />

            <!--
                Scrollable viewport. Rulers and stage all scroll together inside here.
                The corner block, H-ruler and V-ruler use sticky positioning to stay
                pinned while the stage content scrolls underneath.
            -->
            <section ref="graph" class="h-full w-full overflow-auto relative">

                <!-- ruler corner block — sticky top-left -->
                <div class="absolute top-0 left-0 z-20 shrink-0 bg-slate-100 dark:bg-slate-950 border-r border-b border-slate-200 dark:border-slate-700"
                    :style="{ width: RULER_SIZE + 'px', height: RULER_SIZE + 'px' }" />

                <!-- horizontal ruler — sticky top, offset right by ruler width -->
                <div class="sticky top-0 z-10">
                    <div class="absolute top-0 z-10 overflow-hidden pointer-events-none"
                        :style="{ height: RULER_SIZE + 'px', marginLeft: RULER_SIZE + 'px' }">
                        <canvas ref="hRuler" />
                    </div>
                </div>

                <!-- row: vertical ruler + stage -->
                <div class="flex">
                    <!-- vertical ruler — sticky left -->
                    <div class="sticky left-0 z-10 text overflow-hidden pointer-events-none shrink-0"
                        :style="{ width: RULER_SIZE + 'px' }">
                        <canvas ref="vRuler" />
                    </div>

                    <!-- stage padding wrapper -->
                    <div class="px-6 py-12 flex items-start justify-start">
                        <!--
                            Stage root — element DOM nodes are appended and managed here by the vue.
                        -->
                        <div v-if="project.course" ref="stageRef" class="canvas-stage" :style="stageStyle"
                            @pointerdown="handleStagePointerDown"
                            @click="handleStageClick" @dblclick="handleStageDblClick"
                            @mousemove="handleStageMouseMove" @mouseleave="onMouseLeave">

                            <div ref="stageContentRef" style="display: contents" />
                            <!-- Overlay is sibling to canvas content, position: absolute over it -->
                            <EditorOverlay :stage-ref="stageRef" />
                        </div>
                        <div v-else class="flex items-center justify-center">
                            Project has no course
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import {
        computed, onMounted, provide,
        useTemplateRef, watch, nextTick,
        CSSProperties,
        onUnmounted,
        watchEffect,
    } from 'vue';
    import { storeToRefs } from 'pinia';
    import { usePagesStore } from '../stores/pages';
    import { useProjectMetadataStore } from '../stores/projectMetadata';
    import { mountElement } from '../components/renderers/render-bridge'
    import EditorOverlay from '../components/EditorOverlay.vue';
    import { useStageStore } from '../stores/stage';
    import { useEditorSelection } from '../composables/useEditorSelection';
    import { useElementDragResize } from '../composables/useElementDragResize';
    import { useElementReorder } from '../composables/useElementReorder';
    import { useTextEditing } from '../composables/useTextEditing';

    // ─── Stores ───────────────────────────────────────────────────────────────────

    const pages = usePagesStore();
    const project = useProjectMetadataStore()
    const stageStore = useStageStore()
    const { pagesCache, activePageId } = storeToRefs(pages)

    // ─── Template refs ────────────────────────────────────────────────────────────

    const hRuler = useTemplateRef<HTMLCanvasElement>('hRuler');
    const vRuler = useTemplateRef<HTMLCanvasElement>('vRuler');
    const tabsStrip = useTemplateRef<HTMLElement>('tabsStrip');

    // ─── Ruler constants ──────────────────────────────────────────────────────────

    const RULER_SIZE = 20;    // thickness of ruler bars in px
    const TICK_MAJOR = 100;   // px between labelled ticks
    const TICK_MINOR = 10;    // px between small ticks

    // ─── Computed ─────────────────────────────────────────────────────────────────

    const page = computed(() => pages.getActivePageData())
    const rootIds = computed(() => page.value?.rootIds ?? [])
    const stageRef = useTemplateRef('stageRef')

    const { clearSelection, onClick: onElementClick, onDblClick: onElementDblClick, onMouseEnter, onMouseLeave, selectOnly, selectedIds } = useEditorSelection()
    const { startDrag } = useElementDragResize()
    const { startReorder } = useElementReorder()
    const { editingId, canEdit, startEditing } = useTextEditing()

    /**
     * Delegated on the stage root rather than per-element — every rendered
     * node carries `data-eid` (render-bridge.ts), so a single listener here
     * covers the whole tree instead of attaching N listeners to N elements.
     * Walks from the click target up to the stage looking for `[data-eid]`
     * ancestors: `targetId` is the deepest one (what's actually under the
     * pointer), `rootId` is the outermost one (what a first click should
     * select — see useEditorSelection's three-tier resolution).
     */
    function resolveClickIds(target: HTMLElement): { rootId: string; targetId: string } | null {
        const stage = stageRef.value
        if (!stage) return null

        const targetEl = target.closest<HTMLElement>('[data-eid]')
        if (!targetEl || !stage.contains(targetEl)) return null

        const targetId = targetEl.getAttribute('data-eid')!
        let rootId = targetId
        let node: HTMLElement | null = targetEl
        while (node && node !== stage) {
            const eid = node.getAttribute('data-eid')
            if (eid) rootId = eid
            node = node.parentElement
        }

        return { rootId, targetId }
    }

    /**
     * A drag gesture started directly on any element under the pointer —
     * without this, reaching an element nested inside a container (a button
     * inside a div, say) took two separate interactions before you could even
     * begin dragging it: one click to select the container (three-tier
     * click resolution always lands on the root first), a second click to
     * drill into the child, and only then would its selection ring exist for
     * a third gesture to grab. That's not how direct manipulation is
     * supposed to feel — a press-and-drag conveys unambiguous intent about
     * *which* element you mean, so this bypasses the click-tiering rules
     * entirely and always targets whatever's literally under the pointer.
     *
     * Click-to-select's three-tier drill-down (see useEditorSelection.ts) is
     * untouched for plain clicks — only a gesture that actually crosses the
     * drag threshold (startDrag/startReorder's own arming) takes this path;
     * `suppressNextClick` stops the click handler below from then re-running
     * its own resolution against a selection this gesture already changed.
     */
    let suppressNextClick = false

    function handleStagePointerDown(event: PointerEvent) {
        if (event.button !== 0) return
        const stage = stageRef.value
        if (!stage) return

        // A double-click already put this element into contentEditable mode
        // (useTextEditing.ts) — let native caret placement/text selection
        // inside it work normally rather than treating this pointerdown as
        // the start of a drag. Without this, every click meant to reposition
        // the cursor while typing would instead arm a drag/reselect.
        if (editingId.value) {
            const editingNode = stage.querySelector<HTMLElement>(`[data-eid="${editingId.value}"]`)
            if (editingNode?.contains(event.target as Node)) return
        }

        const ids = resolveClickIds(event.target as HTMLElement)
        if (!ids) return

        /**
         * Native form controls (input/textarea/select/...) claim pointerdown
         * for their own interaction — focusing, placing a caret, and on
         * continued movement, a native text-selection drag — before our own
         * arming listeners ever get a say. That's why a text input couldn't
         * be dragged at all: the browser was treating the gesture as "select
         * this text," not "move this element." preventDefault() on the
         * pointerdown suppresses that default action (selection/focus)
         * without affecting the 'click'/'dblclick' events our own selection
         * logic relies on, so this is safe alongside handleStageClick.
         * Authoring mode isn't meant to expose native interactivity on
         * canvas elements at all (typing into a live input, following a
         * link, etc.) — this is also the first piece of that, ahead of the
         * broader pass to disable it consistently everywhere.
         */
        event.preventDefault()

        const targetId = ids.targetId
        const dragWholeSelection = selectedIds.value.size > 1 && selectedIds.value.has(targetId)
        const dragIds = dragWholeSelection ? [...selectedIds.value] : [targetId]

        function onCommit() {
            if (!dragWholeSelection) selectOnly(targetId)
            suppressNextClick = true
        }

        const el = pages.getElementById(targetId)
        const isPositioned = !!el?.layout.position && el.layout.position !== 'static'

        if (dragIds.length === 1 && isPositioned) {
            startDrag(event, dragIds, stage, onCommit)
        } else {
            startReorder(event, dragIds, stage, onCommit)
        }
    }

    function handleStageClick(event: MouseEvent) {
        // Clicking inside the actively-editing node is repositioning the
        // caret, not making a selection — don't re-run selection resolution
        // on top of it (matches the same bypass in handleStagePointerDown).
        if (editingId.value) {
            const editingNode = stageRef.value?.querySelector<HTMLElement>(`[data-eid="${editingId.value}"]`)
            if (editingNode?.contains(event.target as Node)) return
        }

        // Suppresses native click-triggered defaults — a button/link inside
        // the stage would otherwise navigate or submit a form, a checkbox
        // would toggle its own checked state on click. None of that is
        // authoring; the pointerdown-level preventDefault() above only
        // covers focus/caret/native-drag defaults, not these — click has its
        // own separate default action. Doesn't affect this handler itself or
        // onElementClick() below: preventDefault() never stops propagation
        // or other listeners from running, only the browser's built-in action.
        event.preventDefault()

        if (suppressNextClick) {
            suppressNextClick = false
            return
        }

        const ids = resolveClickIds(event.target as HTMLElement)
        if (!ids) {
            clearSelection()
            return
        }
        onElementClick(ids.rootId, ids.targetId, event)
    }

    function handleStageDblClick(event: MouseEvent) {
        const ids = resolveClickIds(event.target as HTMLElement)
        if (!ids) return
        onElementDblClick(ids.targetId, event)

        // Text/label/button/code elements enter contentEditable mode on the
        // same double-click that selects them — direct manipulation, same as
        // Figma/Framer, rather than routing every content edit through the
        // properties panel (which, before this, had no plain-text field for
        // it at all — style.content was only reachable via variable binding).
        if (canEdit(ids.targetId) && stageRef.value) {
            startEditing(ids.targetId, stageRef.value)
        }
    }

    function handleStageMouseMove(event: MouseEvent) {
        const targetEl = (event.target as HTMLElement).closest<HTMLElement>('[data-eid]')
        const id = targetEl?.getAttribute('data-eid') ?? null
        if (id) onMouseEnter(id)
        else onMouseLeave()
    }

    /**
     * `.canvas-stage`'s two DOM children are `stageContentRef` (root
     * elements, `display: contents` — transparent to layout, so its own
     * children become direct flex/grid items of the stage itself) and
     * `EditorOverlay` (`position: absolute`, so flex/grid ignores it
     * entirely, same as any out-of-flow element). That's what makes it safe
     * to put flex/grid display directly on the stage: only the real root
     * elements ever participate as items.
     */
    const stageStyle = computed<CSSProperties>(() => {
        const s = page.value?.stage

        if (!s) {
            return {
                position: 'relative',
                width: '1280px',
                height: '720px',
                background: '#fff',
            }
        }

        const d = s.display ?? {}
        const l = d.layout ?? { mode: 'block' as const }

        const layoutStyle: CSSProperties = l.mode === 'flex'
            ? {
                display: 'flex',
                flexDirection: l.direction || 'row',
                justifyContent: l.justify || 'flex-start',
                alignItems: l.align || 'stretch',
                gap: l.gap ? `${l.gap}px` : '0px',
            }
            : l.mode === 'grid'
                ? {
                    display: 'grid',
                    gridTemplateColumns: l.columns || '1fr',
                    gridTemplateRows: l.rows || undefined,
                    gap: l.gap ? `${l.gap}px` : '0px',
                }
                : { display: 'block' }

        return {
            position: 'relative',
            width: `${s.width}px`,
            height: `${s.height}px`,
            background: s.background ?? '#fff',
            padding: d.padding ? `${d.padding}px` : '0px',
            margin: d.margin ? `${d.margin}px` : '0px',
            overflow: d.overflow || 'auto',
            boxSizing: 'border-box',
            ...layoutStyle,
        }
  })
    const elements = computed(() => page.value?.elements ?? {})
    provide('elements', elements)
    provide('componentLibrary', computed(() => ({})))
    provide('isAuthoring', true)

    const pageOrderIndex = computed<Record<string, number>>(() => {
        const order: Record<string, number> = {};
        const course = project.course;
        if (!course) return order;

        let idx = 0;
        const moduleRefs = [...course.modules].sort((a, b) => a.order - b.order);
        for (const moduleRef of moduleRefs) {
            const mod = project.modulesById[moduleRef.id];
            if (!mod) continue;

            const lessonRefs = [...mod.lessons].sort((a, b) => a.order - b.order);
            for (const lessonRef of lessonRefs) {
                const lesson = project.lessonsById[lessonRef.id];
                if (!lesson) continue;

                const pageRefs = [...lesson.pages].sort((a, b) => a.order - b.order);
                for (const pageRef of pageRefs) {
                    order[pageRef.id] = idx++;
                }
            }
        }

        return order;
    });

    const openPageTabs = computed(() =>
        Object.values(pagesCache.value)
            .map((page) => ({
                id: page.id,
                title: page.metadata.title || 'Untitled page',
                isActive: page.id === activePageId.value,
                isComponent: pages.isComponentSurface(page.id),
            }))
            .sort((a, b) => {
                const ai = pageOrderIndex.value[a.id] ?? Number.MAX_SAFE_INTEGER;
                const bi = pageOrderIndex.value[b.id] ?? Number.MAX_SAFE_INTEGER;
                return ai - bi;
            })
    );


    // ─── Rulers ───────────────────────────────────────────────────────────────────

    function drawHRuler(totalWidth: number) {
        const canvas = hRuler.value;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = totalWidth * dpr;
        canvas.height = RULER_SIZE * dpr;
        canvas.style.width = `${totalWidth}px`;
        canvas.style.height = `${RULER_SIZE}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        const dark = document.documentElement.querySelector('#app')?.classList.contains('dark');
        ctx.fillStyle = dark ? '#0f172a' : '#f1f5f9';
        ctx.fillRect(0, 0, totalWidth, RULER_SIZE);

        ctx.strokeStyle = dark ? '#334155' : '#cbd5e1';
        ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'left';

        for (let x = 0; x <= totalWidth; x += TICK_MINOR) {
            const major = x % TICK_MAJOR === 0;
            const h = major ? 10 : 5;
            ctx.beginPath();
            ctx.moveTo(x + 0.5, RULER_SIZE);
            ctx.lineTo(x + 0.5, RULER_SIZE - h);
            ctx.stroke();
            if (major && x > 0) ctx.fillText(String(x), x + 2, RULER_SIZE - 11);
        }
    }

    function drawVRuler(totalHeight: number) {
        const canvas = vRuler.value;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = RULER_SIZE * dpr;
        canvas.height = totalHeight * dpr;
        canvas.style.width = `${RULER_SIZE}px`;
        canvas.style.height = `${totalHeight}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        const dark = document.documentElement.querySelector('#app')?.classList.contains('dark');
        ctx.fillStyle = dark ? '#0f172a' : '#f1f5f9';
        ctx.fillRect(0, 0, RULER_SIZE, totalHeight);

        ctx.strokeStyle = dark ? '#334155' : '#cbd5e1';
        ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
        ctx.font = '9px system-ui, sans-serif';

        for (let y = 0; y <= totalHeight; y += TICK_MINOR) {
            const major = y % TICK_MAJOR === 0;
            const w = major ? 10 : 5;
            ctx.beginPath();
            ctx.moveTo(RULER_SIZE, y + 0.5);
            ctx.lineTo(RULER_SIZE - w, y + 0.5);
            ctx.stroke();
            if (major && y > 0) {
                ctx.save();
                ctx.translate(RULER_SIZE - 11, y - 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(String(y), 0, 0);
                ctx.restore();
            }
        }
    }

    function redrawRulers() {
        const { width, height } = stageStyle.value;
        // Add 96px padding so ticks extend past the stage edge
        const w = typeof width === 'string' ? parseInt(width) : (width || 0);
        const h = typeof height === 'string' ? parseInt(height) : (height || 0);
        drawHRuler(w + 96);
        drawVRuler(h + 96);
    }

    // ─── Page switching ───────────────────────────────────────────────────────────

    async function switchPage(pageId: string) {
        // pages.loadPage sets activePageId if successful, which triggers the watcher below
        await pages.loadPage(pageId);
    }

    function closeTab(pageId: string) {
        pages.unloadPage(pageId);
        scheduleActiveTabScroll();
    }

    function scrollActiveTabIntoView(): boolean {
        const activeId = activePageId.value;
        if (!activeId) return false;

        const container = tabsStrip.value;
        if (!container) return false;

        const activeTab = container.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
        if (!activeTab) return false;

        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        return true;
    }

    function scheduleActiveTabScroll() {
        nextTick(() => {
            if (scrollActiveTabIntoView()) return;
            requestAnimationFrame(() => {
                scrollActiveTabIntoView();
            });
        });
    }

    const stageContentRef = useTemplateRef<HTMLElement>('stageContentRef')

    const cleanups: Array<() => void> = []

    watchEffect(() => {
        // clean up previous mounts whenever rootIds or elements change
        cleanups.forEach(fn => fn())
        cleanups.length = 0

        const container = stageContentRef.value
        if (!container) return

        const els = elements.value
        const ids = rootIds.value

        for (const id of ids) {
            const el = els[id]
            if (!el) continue

            const cleanup = mountElement(
                () => els[id],
                undefined,
                container,
                elements.value,
                true
            )
            cleanups.push(cleanup)
        }
    })

    onUnmounted(() => {
        cleanups.forEach(fn => fn())
    })

    // ─── Lifecycle ────────────────────────────────────────────────────────────────

    onMounted(() => {
        if (!project.projectId) {
            stageStore.setStage('empty')
            return
        }
        redrawRulers();
    });



    // Re-render on page switch
    watch(activePageId, async () => {
        await nextTick();
        redrawRulers();
        scheduleActiveTabScroll();
    });

    watch(openPageTabs, async () => {
        await nextTick();
        scheduleActiveTabScroll();
    });

    // Redraw rulers when stage size changes (e.g. page settings panel update)
    watch(stageStyle, () => {
        redrawRulers();
    });
</script>

<style scoped>
    .drop-target-highlight {
        outline: 2px dashed #38bdf8;
        outline-offset: 2px;
    }

    section::-webkit-scrollbar {
        height: 6px;
        width: 6px;
    }

    section::-webkit-scrollbar-track {
        background: transparent;
    }

    section::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 3px;
    }
</style>