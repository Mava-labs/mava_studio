<template>
    <div class="h-full w-full grid grid-rows-[min-content_1fr] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div class="border-b h-full border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80">
            <div class="flex items-center gap-1 overflow-x-auto thin-scroll">
                <div class="flex items-center ">
                    <button
                        v-for="tab in openPageTabs"
                        :key="tab.id"
                        type="button"
                        class="group relative bg-slate-800 flex items-center gap-2 px-3 py-2.5 text-sm transition border-r border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
                        :class="tab.id === activePageId ? 'bg-transparent text-slate-900 dark:text-slate-50 shadow-inner' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'"
                        @click="pages.loadPage(tab.id)"
                    >
                        <span class="truncate max-w-48">{{ tab.title }}</span>
                        <span v-if="tab.id === activePageId" class="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                    </button>
                    <div v-if="openPageTabs.length === 0" class="text-xs text-slate-500 dark:text-slate-400 px-2 py-1">No open pages.</div>
                </div>
            </div>
        </div>

        <div class="h-full w-full relative flex items-center justify-center overflow-auto">
            <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] bg-size-[16px_16px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)]" />
            <section ref="graph"  
                class="h-full w-full overflow-auto  border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-6 shadow-inner">
                <div
                    ref="root"
                    class="relative root shadow-xl border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden transition-all"
                    :style="{ width: `${ stageSize.width }px`, height: `${ stageSize.height }px`, background: activePage?.stage.background }"
                    @pointerdown="handlePointerDown"
                >
                    
                    
                </div>
                
            </section>
            <!-- <div v-if="activePage" class="space-y-6">

                <div class="grid gap-6 lg:grid-cols-[1fr] items-start">

                </div>
            </div> -->

            <!-- <div v-else class="text-sm text-slate-600 dark:text-slate-300">Select a page to start editing.</div> -->
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { usePagesStore } from "../stores/pages";
import { useElementStore } from "../stores/element";
import type { Page } from "../types/project";
import type { Element } from "../types/element";

const pages = usePagesStore();
const elements = useElementStore()

/** Stage root container that holds the rendered page DOM. */
const root = useTemplateRef<HTMLElement>('root')

/**
 * Drag/drop state used by the delegated stage listeners.
 * - draggingId: element currently being dragged
 * - dropTargetId: latest valid container under the pointer
 * - originParentId: parent before drag began (fallback if no valid drop)
 */
const draggingId = ref<string | null>(null);
const dropTargetId = ref<string | null>(null);
const originParentId = ref<string | null>(null);
const cleanupFns: Array<() => void> = [];
const highlightedId = ref<string | null>(null);

/** Tabs sourced from cached pages to render the open pages strip. */
const openPageTabs = computed(() =>
Object.values(pages.pagesCache).map((page) => ({
    id: page.id,
    title: page.metadata.title || "Untitled page",
}))
);

/** Currently active page id pulled from pages store. */
const activePageId = computed(() => pages.activePageId);

/** Live active page data used for stage sizing and hit-testing. */
const activePage = computed<Page | null>(() => pages.getActivePageData());

watch(activePageId, (pageId) => {
    const container = root.value;
    if (!container) return;

    // Detach previous page markup but keep cached nodes around.
    container.replaceChildren();

    if (!pageId) return;

    const nodes = elements.buildMarkup(pageId);
    if (nodes.length) {
        container.replaceChildren(...nodes);
    }
}, { immediate: true });

/** Size of the stage in px, defaulting when no page is active. */
const stageSize = computed(() => {
    const stage = activePage.value?.stage;
    return stage ? { width: stage.width, height: stage.height } : { width: 1280, height: 720 };
});

/** Return true if an element type can host children (drop target). */
const isContainerType = (el: Element | undefined | null) => {
    if (!el) return false;
    return el.type === 'collection' || el.type === 'container' || el.type === 'component';
};

/** Hit-test under the pointer to find a valid container element id. */
const resolveDropTarget = (clientX: number, clientY: number) => {
    const pointEl = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!pointEl) return null;
    const candidate = pointEl.closest('[data-element-id]') as HTMLElement | null;
    if (!candidate) return null;
    const id = candidate.dataset.elementId ?? null;
    if (!id) return null;

    const page = activePage.value;
    if (!page) return null;
    const el = page.elements[id];
    if (!isContainerType(el)) return null;
    if (draggingId.value && (id === draggingId.value)) return null;
    return id;
};

/** Toggle highlight class on the current candidate drop target. */
const updateDropHighlight = (nextId: string | null) => {
    if (!activePageId.value) return;

    const pageId = activePageId.value;

    if (highlightedId.value && highlightedId.value !== nextId) {
        const prevNode = elements.getNode(pageId, highlightedId.value);
        prevNode?.classList.remove('drop-target-highlight');
    }

    if (nextId && nextId !== highlightedId.value) {
        const nextNode = elements.getNode(pageId, nextId);
        nextNode?.classList.add('drop-target-highlight');
    }

    highlightedId.value = nextId;
};

/** Delegate pointerdown on stage to start drag tracking and eventual reparent. */
const handlePointerDown = (event: PointerEvent) => {
    if (!root.value || !activePageId.value) return;
    const target = (event.target as HTMLElement | null)?.closest('[data-element-id]') as HTMLElement | null;
    if (!target) return;

    const elementId = target.dataset.elementId;
    if (!elementId) return;

    draggingId.value = elementId;
    const page = pages.pagesCache[activePageId.value];
    originParentId.value = page?.elements[elementId]?.parentId ?? null;

    target.setPointerCapture(event.pointerId);
    target.style.opacity = '0.7';
    target.style.pointerEvents = 'none';

    const onMove = (e: PointerEvent) => {
        const candidate = resolveDropTarget(e.clientX, e.clientY);
        console.log('Target: ', candidate)
        dropTargetId.value = candidate;
        updateDropHighlight(candidate);
    };

    const onUp = (e: PointerEvent) => {
        const currentId = draggingId.value;
        draggingId.value = null;

        target.style.opacity = '';
        target.style.pointerEvents = '';

        target.releasePointerCapture(e.pointerId);

        const desiredParent = dropTargetId.value ?? originParentId.value;
        dropTargetId.value = null;
        originParentId.value = null;

        updateDropHighlight(null);

        if (currentId && root.value && activePageId.value !== null) {
            elements.moveElement(activePageId.value, currentId, desiredParent, root.value);
        }

        cleanupFns.splice(0).forEach((fn) => fn());
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { once: true });
    cleanupFns.push(() => window.removeEventListener('pointermove', onMove));
};

onBeforeUnmount(() => {
    cleanupFns.splice(0).forEach((fn) => fn());
});

</script>

<style scoped>
.drop-target-highlight {
    outline: 2px dashed #38bdf8;
    outline-offset: 2px;
}
</style>