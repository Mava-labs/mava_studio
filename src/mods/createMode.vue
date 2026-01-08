<template>
    <div class="h-full w-full overflow-auto bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div class="max-w-7xl mx-auto px-6 py-6 space-y-6">
            <header class="flex flex-wrap items-center gap-3 justify-between">
                <div class="space-y-1">
                    <p class="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Create Stage</p>
                    <h1 class="text-xl font-semibold flex items-center gap-2">
                        <span>{{ activePage?.metadata.title || 'Untitled page' }}</span>
                        <span class="text-sm font-normal text-slate-500 dark:text-slate-400">({{ stageSize.width }} × {{ stageSize.height }})</span>
                    </h1>
                </div>
                <div class="flex items-center gap-2">
                    <div class="text-xs text-slate-500 dark:text-slate-400">Viewport</div>
                    <div class="flex items-center gap-2 bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-full px-2 py-1 shadow-sm">
                        <button
                            v-for="vp in viewports"
                            :key="vp.id"
                            type="button"
                            class="px-3 py-1 rounded-full text-sm transition"
                            :class="selectedViewport === vp.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800'"
                            @click="selectedViewport = vp.id"
                        >
                            {{ vp.label }}
                        </button>
                    </div>
                </div>
            </header>

            <div class="grid gap-6 lg:grid-cols-[1fr_minmax(240px,320px)] items-start">
                <section class="relative min-h-[320px] border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-6 shadow-inner">
                    <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.05)_1px,_transparent_0)] bg-[size:16px_16px] dark:bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.05)_1px,_transparent_0)]" />
                    <div class="relative w-full h-full flex items-center justify-center">
                        <div
                            class="relative bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden transition-all"
                            :style="{ width: `${stageSize.width}px`, height: `${stageSize.height}px` }"
                        >
                            <div class="absolute top-2 right-2 text-[11px] px-2 py-1 rounded bg-slate-900/70 text-slate-100 shadow">{{ selectedViewportLabel }}</div>
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
                            <span class="font-medium">{{ activePage?.metadata.title || 'Untitled page' }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Layout</span>
                            <span class="font-medium capitalize">{{ selectedViewport }}</span>
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
                        The canvas dimensions follow the selected layout for the active page. Switch viewport presets to preview sizing for desktop, tablet, or mobile.
                    </p>
                </aside>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed, ref } from "vue";
import { useProjectStore } from "../stores/project";
import type { Page } from "../types/project";

type ViewportId = "desktop" | "tablet" | "mobile";

const viewports: Array<{ id: ViewportId; label: string }> = [
    { id: "desktop", label: "Desktop" },
    { id: "tablet", label: "Tablet" },
    { id: "mobile", label: "Mobile" },
];

const project = useProjectStore();
const selectedViewport = ref<ViewportId>("desktop");

const activePage = computed<Page | null>(() => {
    const data = project.project;
    const path = project.activePath;
    if (!data || !path) return null;
    return data.pagesById[path.pageId] || null;
});

const stageSize = computed(() => {
    const layout = activePage.value?.layouts?.[selectedViewport.value];
    return layout?.stageSize || { width: 1280, height: 720 };
});

const selectedViewportLabel = computed(() => {
    const vp = viewports.find((v) => v.id === selectedViewport.value);
    return vp?.label || selectedViewport.value;
});

const elementCount = computed(() => activePage.value?.elements?.length || 0);
</script>