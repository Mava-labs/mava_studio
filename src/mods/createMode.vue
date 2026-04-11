<template>
    <div
        class="h-full w-full grid grid-rows-[min-content_1fr] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

        <!-- ── Page tabs (VS Code style) ───────────────────────────────────── -->
        <div class="border-b border-slate-200 overflow-hidden dark:border-slate-800 bg-white/90 dark:bg-slate-900/80">
            <div ref="tabsStrip" class="flex items-center gap-0 overflow-x-auto overflow-y-hidden thin-scroll">
                <div v-for="tab in openPageTabs" :key="tab.id"
                    :data-tab-id="tab.id"
                    class="group relative cursor-pointer flex items-center justify-between gap-2 pl-3 pr-1 py-2 text-sm transition border-r border-slate-200 dark:border-slate-700 shrink-0"
                    :class="tab.isActive
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 shadow-inner'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'"
                >
                    <button type="button" class="min-w-0 flex-1 text-left" @click="switchPage(tab.id)">
                        <span class="truncate max-w-48 block">{{ tab.title }}</span>
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
                            @click.self="clearSelection">
                            <CanvasNode v-for="rootId in rootIds" :key="rootId" :id="rootId" />

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
    } from 'vue';
    import { storeToRefs } from 'pinia';
    import { usePagesStore } from '../stores/pages';
    import { useProjectMetadataStore } from '../stores/projectMetadata';
    import CanvasNode from '../components/CanvasNode.vue';
    import EditorOverlay from '../components/EditorOverlay.vue';
    import { useStageStore } from '../stores/stage';
    import { useEditorSelection } from '../composables/useEditorSelection';

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

    const { clearSelection } = useEditorSelection()

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

        return {
            position: 'relative',
            width: `${s.width}px`,
            height: `${s.height}px`,
            background: s.background ?? '#fff',
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