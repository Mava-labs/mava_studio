<template>
    <div class="h-full w-full grid grid-rows-[min-content_1fr] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

        <!-- ── Page tabs (VS Code style) ───────────────────────────────────── -->
        <div class="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80">
            <div class="flex items-center gap-0 overflow-x-auto thin-scroll">
                <button
                    v-for="tab in openPageTabs"
                    :key="tab.id"
                    type="button"
                    class="group relative flex items-center gap-2 px-3 py-2.5 text-sm transition border-r border-slate-200 dark:border-slate-700 shrink-0"
                    :class="tab.id === activePageId
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-inner'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'"
                    @click="switchPage(tab.id)"
                >
                    <span class="truncate max-w-48">{{ tab.title }}</span>
                    <span
                        v-if="tab.id === activePageId"
                        class="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
                    />
                </button>
                <div
                    v-if="openPageTabs.length === 0"
                    class="text-xs text-slate-500 dark:text-slate-400 px-3 py-2.5"
                >
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
                [background-size:16px_16px]"
            />

            <!--
                Scrollable viewport. Rulers and stage all scroll together inside here.
                The corner block, H-ruler and V-ruler use sticky positioning to stay
                pinned while the stage content scrolls underneath.
            -->
            <section ref="graph" class="h-full w-full overflow-auto relative">

                <!-- ruler corner block — sticky top-left -->
                <div
                    class="sticky top-0 left-0 z-20 shrink-0 bg-slate-100 dark:bg-slate-950 border-r border-b border-slate-200 dark:border-slate-700"
                    :style="{ width: RULER_SIZE + 'px', height: RULER_SIZE + 'px' }"
                />

                <!-- horizontal ruler — sticky top, offset right by ruler width -->
                <div
                    class="sticky top-0 z-10 overflow-hidden pointer-events-none"
                    :style="{ height: RULER_SIZE + 'px', marginLeft: RULER_SIZE + 'px' }"
                >
                    <canvas ref="hRuler" />
                </div>

                <!-- row: vertical ruler + stage -->
                <div class="flex">
                    <!-- vertical ruler — sticky left -->
                    <div
                        class="sticky left-0 z-10 overflow-hidden pointer-events-none shrink-0"
                        :style="{ width: RULER_SIZE + 'px' }"
                    >
                        <canvas ref="vRuler" />
                    </div>

                    <!-- stage padding wrapper -->
                    <div class="p-6 flex items-start justify-start">
                        <!--
                            Stage root — element DOM nodes are appended here by the mounter.
                            Vue deliberately does NOT manage children of this div.
                        -->
                        <div
                            ref="root"
                            class="relative shadow-xl border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden shrink-0"
                            :style="{
                                width:      stageSize.width  + 'px',
                                height:     stageSize.height + 'px',
                                background: activePage?.stage.background ?? '#ffffff',
                            }"
                            @pointerdown="handlePointerDown"
                            @click.self="elementStore.setActiveElement(null)"
                        />
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import {
    computed, onBeforeUnmount, onMounted,
    ref, useTemplateRef, watch, nextTick,
} from 'vue';
import { usePagesStore }   from '../stores/pages';
import { useElementStore } from '../stores/element';
import type { Page }    from '../types/project';
import type { Element } from '../types/element';

// ─── Stores ───────────────────────────────────────────────────────────────────

const pages        = usePagesStore();
const elementStore = useElementStore();

// ─── Template refs ────────────────────────────────────────────────────────────

const root   = useTemplateRef<HTMLElement>('root');
const graph  = useTemplateRef<HTMLElement>('graph');
const hRuler = useTemplateRef<HTMLCanvasElement>('hRuler');
const vRuler = useTemplateRef<HTMLCanvasElement>('vRuler');

// ─── Ruler constants ──────────────────────────────────────────────────────────

const RULER_SIZE = 20;    // thickness of ruler bars in px
const TICK_MAJOR = 100;   // px between labelled ticks
const TICK_MINOR = 10;    // px between small ticks

// ─── Computed ─────────────────────────────────────────────────────────────────

const openPageTabs = computed(() =>
    Object.values(pages.pagesCache).map((page) => ({
        id:    page.id,
        title: page.metadata.title || 'Untitled page',
    }))
);

const activePageId = computed(() => pages.activePageId);

const activePage = computed<Page | null>(() => pages.getActivePageData());

const stageSize = computed(() => {
    const stage = activePage.value?.stage;
    return stage
        ? { width: stage.width, height: stage.height }
        : { width: 1280, height: 720 };
});

// ─── Rulers ───────────────────────────────────────────────────────────────────

function drawHRuler(totalWidth: number) {
    const canvas = hRuler.value;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    canvas.width        = totalWidth * dpr;
    canvas.height       = RULER_SIZE * dpr;
    canvas.style.width  = `${totalWidth}px`;
    canvas.style.height = `${RULER_SIZE}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const dark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = dark ? '#0f172a' : '#f1f5f9';
    ctx.fillRect(0, 0, totalWidth, RULER_SIZE);

    ctx.strokeStyle = dark ? '#334155' : '#cbd5e1';
    ctx.fillStyle   = dark ? '#94a3b8' : '#64748b';
    ctx.font        = '9px system-ui, sans-serif';
    ctx.textAlign   = 'left';

    for (let x = 0; x <= totalWidth; x += TICK_MINOR) {
        const major = x % TICK_MAJOR === 0;
        const h     = major ? 10 : 5;
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

    canvas.width        = RULER_SIZE * dpr;
    canvas.height       = totalHeight * dpr;
    canvas.style.width  = `${RULER_SIZE}px`;
    canvas.style.height = `${totalHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const dark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = dark ? '#0f172a' : '#f1f5f9';
    ctx.fillRect(0, 0, RULER_SIZE, totalHeight);

    ctx.strokeStyle = dark ? '#334155' : '#cbd5e1';
    ctx.fillStyle   = dark ? '#94a3b8' : '#64748b';
    ctx.font        = '9px system-ui, sans-serif';

    for (let y = 0; y <= totalHeight; y += TICK_MINOR) {
        const major = y % TICK_MAJOR === 0;
        const w     = major ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE,     y + 0.5);
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
    const { width, height } = stageSize.value;
    // Add 96px padding so ticks extend past the stage edge
    drawHRuler(width  + 96);
    drawVRuler(height + 96);
}

// ─── Page switching ───────────────────────────────────────────────────────────

async function switchPage(pageId: string) {
    // pages.loadPage sets activePageId if successful, which triggers the watcher below
    await pages.loadPage(pageId);
}

// ─── Page rendering ───────────────────────────────────────────────────────────

/**
 * Register the stage root with the element store and render the active page.
 * The element store owns the mounter — we just hand it the container node.
 */
function renderActivePage() {
    const container = root.value;
    if (!container) return;

    // Always (re-)register in case the component remounted
    elementStore.setStageNode(container);

    if (pages.getActivePageData()) {
        // mountPage clears the container and rebuilds the full element tree
        elementStore.mountPage();
    } else {
        container.replaceChildren();
    }
}

// ─── Drag / reparent ─────────────────────────────────────────────────────────

const draggingId     = ref<string | null>(null);
const dropTargetId   = ref<string | null>(null);
const originParentId = ref<string | null>(null);
const highlightedId  = ref<string | null>(null);
const cleanupFns: Array<() => void> = [];

function isContainerKind(el: Element | undefined | null): boolean {
    return el?.kind === 'container';
}

function resolveDropTarget(clientX: number, clientY: number): string | null {
    const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!hit) return null;
    const candidate = hit.closest('[data-eid]') as HTMLElement | null;
    if (!candidate) return null;
    const id   = candidate.dataset.eid ?? null;
    if (!id) return null;
    const page = activePage.value;
    if (!page) return null;
    const el = page.elements[id];
    if (!isContainerKind(el))    return null;
    if (id === draggingId.value) return null;
    return id;
}

function updateDropHighlight(nextId: string | null) {
    if (highlightedId.value && highlightedId.value !== nextId) {
        root.value
            ?.querySelector<HTMLElement>(`[data-eid="${highlightedId.value}"]`)
            ?.classList.remove('drop-target-highlight');
    }
    if (nextId && nextId !== highlightedId.value) {
        root.value
            ?.querySelector<HTMLElement>(`[data-eid="${nextId}"]`)
            ?.classList.add('drop-target-highlight');
    }
    highlightedId.value = nextId;
}

function handlePointerDown(event: PointerEvent) {
    if (!root.value || !activePageId.value) return;

    const target = (event.target as HTMLElement | null)
        ?.closest('[data-eid]') as HTMLElement | null;
    if (!target) return;

    const elementId = target.dataset.eid;
    if (!elementId) return;

    // Select on press
    elementStore.setActiveElement(elementId);

    draggingId.value     = elementId;
    originParentId.value = pages.pagesCache[activePageId.value]
        ?.elements[elementId]?.parentId ?? null;

    target.setPointerCapture(event.pointerId);
    target.style.opacity       = '0.7';
    target.style.pointerEvents = 'none';

    const onMove = (e: PointerEvent) => {
        const candidate  = resolveDropTarget(e.clientX, e.clientY);
        dropTargetId.value = candidate;
        updateDropHighlight(candidate);
    };

    const onUp = (e: PointerEvent) => {
        const currentId  = draggingId.value;
        draggingId.value = null;

        target.style.opacity       = '';
        target.style.pointerEvents = '';
        target.releasePointerCapture(e.pointerId);

        const desiredParent  = dropTargetId.value ?? originParentId.value;
        dropTargetId.value   = null;
        originParentId.value = null;
        updateDropHighlight(null);

        if (currentId && root.value && activePageId.value !== null) {
            // Placeholder — wire once moveElement is added to elementStore
            console.log('[stage] drop', currentId, '→', desiredParent);
            // elementStore.moveElement(currentId, desiredParent);
        }

        cleanupFns.splice(0).forEach((fn) => fn());
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup',   onUp,   { once: true });
    cleanupFns.push(() => window.removeEventListener('pointermove', onMove));
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
    renderActivePage();
    redrawRulers();
});

onBeforeUnmount(() => {
    cleanupFns.splice(0).forEach((fn) => fn());
});

// Re-render on page switch
watch(activePageId, async () => {
    await nextTick();
    renderActivePage();
    redrawRulers();
});

// Redraw rulers when stage size changes (e.g. page settings panel update)
watch(stageSize, () => {
    redrawRulers();
});
</script>

<style scoped>
.drop-target-highlight {
    outline:        2px dashed #38bdf8;
    outline-offset: 2px;
}

section::-webkit-scrollbar        { height: 6px; width: 6px; }
section::-webkit-scrollbar-track  { background: transparent; }
section::-webkit-scrollbar-thumb  { background: #94a3b8; border-radius: 3px; }
</style>