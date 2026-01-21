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
import { computed, ref, useTemplateRef, watch } from "vue";
import { usePagesStore } from "../stores/pages";
import { useElementStore } from "../stores/element";
import type { Page } from "../types/project";

const pages = usePagesStore();
const elements = useElementStore()

const root = useTemplateRef<HTMLElement>('root')

const openPageTabs = computed(() =>
Object.values(pages.pagesCache).map((page) => ({
    id: page.id,
    title: page.metadata.title || "Untitled page",
}))
);

const activePageId = computed(() => pages.activePageId);

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

const stageSize = computed(() => {
    const stage = activePage.value?.stage;
    return stage ? { width: stage.width, height: stage.height } : { width: 1280, height: 720 };
});

</script>