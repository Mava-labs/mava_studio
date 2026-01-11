<template>
    <div class="h-full w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div class="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80">
            <div class="flex items-center gap-1 overflow-x-auto thin-scroll">
                <div class="flex items-center ">
                    <button
                        v-for="tab in openPageTabs"
                        :key="tab.id"
                        type="button"
                        class="group relative bg-slate-800 flex items-center gap-2 px-3 py-2.5 text-sm transition border-r border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
                        :class="tab.id === activePageId ? 'bg-transparent text-slate-900 dark:text-slate-50 shadow-inner' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'"
                        @click="activateTab(tab.id)"
                    >
                        <span class="truncate max-w-48">{{ tab.title }}</span>
                        <span v-if="tab.id === activePageId" class="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                    </button>
                    <div v-if="openPageTabs.length === 0" class="text-xs text-slate-500 dark:text-slate-400 px-2 py-1">No open pages.</div>
                </div>
            </div>
        </div>

        <div class="max-w-7xl mx-auto space-y-6">
            <div v-if="activePage" class="space-y-6">

                <div class="grid gap-6 lg:grid-cols-[1fr_minmax(240px,320px)] items-start">
                    <section class="relative min-h-80 border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-6 shadow-inner">
                        <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] bg-size-[16px_16px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)]" />
                        <div class="relative w-full h-full flex items-center justify-center">
                            <div
                                class="relative bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden transition-all"
                                :style="{ width: `${stageSize.width}px`, height: `${stageSize.height}px` }"
                            >
                                <div class="h-full w-full grid place-items-center text-slate-400 dark:text-slate-500 text-sm">
                                    Canvas placeholder – render elements here
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside class="space-y-3 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow">
                        <h2 class="text-sm font-semibold">Page details</h2>
                        <div class="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                            <div class="flex justify-between">
                                <span>Title</span>
                                <span class="font-medium">{{ activePage.metadata.title || 'Untitled page' }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Stage size</span>
                                <span class="font-medium">{{ stageSize.width }} × {{ stageSize.height }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Elements</span>
                                <span class="font-medium">{{ elementCount }}</span>
                            </div>
                        </div>
                        <p class="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            Canvas dimensions follow the active page layout (desktop). Future viewport controls will live in the Styles panel.
                        </p>
                    </aside>
                </div>
            </div>

            <div v-else class="text-sm text-slate-600 dark:text-slate-300">Select a page to start editing.</div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed } from "vue";
import { usePagesStore } from "../stores/pages";
import type { Page } from "../types/project";

const pages = usePagesStore();

const openPageTabs = computed(() =>
    Object.values(pages.pagesCache).map((page) => ({
        id: page.id,
        title: page.metadata.title || "Untitled page",
    }))
);

const activePageId = computed(() => pages.activePageId);

const activePage = computed<Page | null>(() => pages.getActivePageData());

const stageSize = computed(() => {
    const stage = activePage.value?.stage;
    return stage ? { width: stage.width, height: stage.height } : { width: 1280, height: 720 };
});

const elementCount = computed(() => activePage.value ? Object.keys(activePage.value.elements || {}).length : 0);

function activateTab(pageId: string) {
    pages.loadPage(pageId);
}
</script>