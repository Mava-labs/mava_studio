<template>
    <div class="h-full w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div class="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80">
            <div class="flex items-center gap-1 px-3 py-2 overflow-x-auto thin-scroll">
                <div class="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 pr-2">Open Pages</div>
                <div class="flex items-center gap-1">
                    <button
                        v-for="tab in openPageTabs"
                        :key="tab.pageId"
                        type="button"
                        class="group relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition"
                        :class="tab.pageId === activePageId ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-inner' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'"
                        @click="activateTab(tab.pageId)"
                    >
                        <span class="truncate max-w-48">{{ tab.pageTitle || 'Untitled page' }}</span>
                        <span class="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-32">{{ tab.lessonTitle }}</span>
                        <span v-if="tab.pageId === activePageId" class="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
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
import { useProjectStore } from "../stores/project";
import type { Page, ProjectData } from "../types/project";

const project = useProjectStore();

const openPageTabs = computed(() => project.openPages || []);

const activePageId = computed(() => project.activePath?.pageId || null);

const activePage = computed<Page | null>(() => {
    const data = project.project;
    const path = project.activePath;
    if (!data || !path) return null;
    return data.pagesById[path.pageId] || null;
});

const stageSize = computed(() => {
    const layout = activePage.value?.layouts?.desktop;
    return layout?.stageSize || { width: 1280, height: 720 };
});

const elementCount = computed(() => activePage.value?.elements?.length || 0);

function activateTab(pageId: string) {
    const data = project.project;
    if (!data) return;
    const path = resolvePathForPage(data, pageId);
    if (path) project.activePath = path;
}

function resolvePathForPage(data: ProjectData, pageId: string) {
    let lessonId: string | null = null;
    for (const [id, lesson] of Object.entries(data.lessonsById)) {
        if (lesson.pages.some((p) => p.id === pageId)) {
            lessonId = id;
            break;
        }
    }
    if (!lessonId) return null;

    let moduleId: string | null = null;
    for (const [id, module] of Object.entries(data.modulesById)) {
        if (module.lessons.some((l) => l.id === lessonId)) {
            moduleId = id;
            break;
        }
    }
    if (!moduleId) return null;

    return { moduleId, lessonId, pageId };
}
</script>