<template>
    <div class="panel-root flex-1 min-h-0 relative overflow-y-auto thin-scroll overflow-x-hidden flex flex-col gap-4 pb-3">
        <div v-if="element" class="sticky top-0 z-50 bg-slate-900 border-b border-slate-300 dark:border-slate-600 mb-2 px-3">
            <UnifiedToolbar mode="multiselect" :singleStageAlign="true" placement="panel" />
        </div>
        <div v-if="element" class="element-header flex justify-between items-center px-3">
            <button ref="elementNameRef" aria-label="Edit element name" tabindex="0" aria-pressed="true"
                class="w-[60%] border-b border-dashed text-left">
                {{ element.name }}
            </button>
            <div class="flex gap-2">
                <svg v-if="element.layout.locked" role="button" tabindex="0" aria-label="Unlock element"
                    aria-pressed="true" class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
                    aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
                    viewBox="0 0 24 24">
                    <path fill-rule="evenodd"
                        d="M8 10V7a4 4 0 1 1 8 0v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2-3a2 2 0 1 1 4 0v3h-4V7Zm2 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
                        clip-rule="evenodd" />
                </svg>
                <svg v-else role="button" tabindex="0" aria-label="Unlock element" aria-pressed="true"
                    class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fill-rule="evenodd"
                        d="M15 7a2 2 0 1 1 4 0v4a1 1 0 1 0 2 0V7a4 4 0 0 0-8 0v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2V7Zm-5 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
                        clip-rule="evenodd" />
                </svg>

                <svg v-if="element.layout.visible" role="button" tabindex="0" aria-label="Unlock element"
                    aria-pressed="true" class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
                    aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                    viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-width="2"
                        d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z" />
                    <path stroke="currentColor" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <svg v-else role="button" tabindex="0" aria-label="Unlock element" aria-pressed="true"
                    class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3.933 13.909A4.357 4.357 0 0 1 3 12c0-1 4-6 9-6m7.6 3.8A5.068 5.068 0 0 1 21 12c0 1-3 6-9 6-.314 0-.62-.014-.918-.04M5 19 19 5m-4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
            </div>
        </div>

        <div v-if="!element" class="px-3 flex-1 min-h-0 h-full overflow-y-auto overflow-x-hidden">
            <label class="element-header" for="device-select">Device</label>
            <select id="device-select"
                class="w-full mb-3 bg-slate-900 border border-slate-600 text-slate-100 text-xs p-2 rounded">
                <!-- <option value="" :selected="!anyDeviceMatch">Custom size</option>
             <optgroup v-for="([cat, grp], idx) in profileEntries" :key="cat + idx" :label="grp.label">
             <option
                 v-for="it in grp.items"
                 :key="it.id"
                 :value="`${cat}:${it.id}`"
                 :selected="matches(it.w, it.h)"
             >
                 {{ `${it.label} — ${it.w}×${it.h}` }}
             </option>
             </optgroup> -->
            </select>

        </div>

        <template v-else>
            <!-- ── Always visible ── -->
            <LayoutPanel />

            <!-- ── Text elements only ── -->
            <TextPanel v-if="isText" />

            <!-- ── SVG / shapes only ── -->
            <FillStrokePanel v-if="isSvg || isContainer" />

            <!-- ── Image only ── -->
            <ImagePanel v-if="isImage" />

            <RadiusPanel v-if="isContainer || isSvg" />

            <!-- ── Container only ── -->
            <PaddingPanel v-if="isContainer || isSvg" />

            <!-- ── Transform & Effects ── Always appear -->
            <TransformPanel />
            <EffectsPanel />
        </template>

    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { usePagesStore } from '../../stores/pages';
    import { useElementStore } from '../../stores/element';

    import LayoutPanel from './panels/LayoutPanel.vue';
    import TransformPanel from './panels/TransformPanel.vue';
    import EffectsPanel from './panels/EffectsPanel.vue';
    import TextPanel from './panels/TextPanel.vue';
    import ImagePanel from './panels/ImagePanel.vue';
    import PaddingPanel from './panels/PaddingPanel.vue';
    import FillStrokePanel from './panels/FillStroke.vue';
    import RadiusPanel from './panels/RadiusPanel.vue';
    import UnifiedToolbar from './UnifiedToolbar.vue';

    const pages = usePagesStore();
    const elementStore = useElementStore();

    const element = computed(() =>
        pages.getElementById(elementStore.activeElementId ?? '')
    );

    const isText = computed(() => element.value?.type === 'text' || element.value?.type === 'button' || element.value?.type === 'label');
    const isImage = computed(() => element.value?.type === 'image');
    const isContainer = computed(() => element.value?.kind === 'container');
    const isSvg = computed(() => element.value?.kind === 'svg');

</script>

<style scoped>
    .panel-root {
        font-family: system-ui, sans-serif;
        font-size: 12px;
        color: #e2e8f0;
    }

    .element-header {
        font-weight: 600;
        font-size: 13px;
    }
</style>