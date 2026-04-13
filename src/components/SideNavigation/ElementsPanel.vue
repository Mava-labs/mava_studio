<template>
    <div class="h-full overflow-y-auto thin-scroll bg-slate-950/80 backdrop-blur-sm">
        <div class="flex flex-col gap-1 pb-2">
            <div
                v-for="(category, index) in categories"
                :key="index"
                class=" overflow-hidden"
            >
                <button
                    type="button"
                    class="w-full flex items-center border-b border-slate-800 justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-slate-900/70 bg-slate-950/90 transition-colors"
                    :class="isElementsLocked ? 'opacity-60 cursor-not-allowed' : ''"
                    @click="toggleCategory(category.name)"
                >
                    <span class="capitalize">{{ category.name }}</span>
                    <span class="w-4 h-4 flex items-center justify-center text-slate-500">
                        <svg v-if="isCategoryExpanded(category.name)" class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" />
                        </svg>
                        <svg v-else class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" />
                        </svg>
                    </span>
                </button>

                <ul v-if="isCategoryExpanded(category.name)" class="grid grid-cols-2 gap-2 p-2 pt-0">
                    <li
                        v-for="(element, idx) in category.elements"
                        :key="idx"
                        class="flex flex-col items-center gap-1 p-2 rounded cursor-pointer hover:bg-gray-800"
                        :class="isElementsLocked ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''"
                        @click="elementStore.addElement(element.type)"
                    >
                        <!--
                            visualSrc is kept as a string label for now.
                            Replace the inner div with an <img> or icon component when assets are ready.
                        -->
                        <div class="w-15 h-10 rounded flex items-center justify-center text-xs overflow-hidden">
                            <img :src="element.visualSrc" :alt="element.type" class="object-fill h-full w-full">
                        </div>
                       
                        <span class="capitalize text-xs font-bold text-gray-400">{{ element.type }}</span>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed, ref, watch } from 'vue';
import { useElementStore } from '../../stores/element';
import { useProjectMetadataStore } from '../../stores/projectMetadata';
import { useStageStore } from '../../stores/stage';
import type { InsertableType } from '../../stores/element';

const elementStore = useElementStore();
const project = useProjectMetadataStore();
const stage = useStageStore();

interface PanelElement {
    type: InsertableType;
    visualSrc: string;
}

interface Category {
    name: string;
    elements: PanelElement[];
}

const expandedCategories = ref(new Set<string>(['Shapes', 'Premitives', 'Containers']));
const isElementsLocked = computed(() => stage.currentStage === 'empty' || !project.isProjectOpen);

watch(
    isElementsLocked,
    (locked) => {
        if (locked) expandedCategories.value = new Set();
    },
    { immediate: true }
);

function isCategoryExpanded(name: string): boolean {
    return expandedCategories.value.has(name);
}

function toggleCategory(name: string): void {
    if (isElementsLocked.value) return;
    const next = new Set(expandedCategories.value);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    expandedCategories.value = next;
}

const categories: Category[] = [
    {
        name: 'Shapes',
        elements: [
            { type: 'line',      visualSrc: 'Line' },
            { type: 'rectangle', visualSrc: 'Rectangle' },
            { type: 'square',    visualSrc: 'Square' },
            { type: 'circle',    visualSrc: 'Circle' },
            { type: 'ellipse',   visualSrc: 'Ellipse' },
            { type: 'triangle',  visualSrc: 'Triangle' },
            { type: 'hexagon',   visualSrc: 'Hexagon' },
            { type: 'star',      visualSrc: 'Star' },
            { type: 'arrow',     visualSrc: 'Arrow' },
            { type: 'hotspot',   visualSrc: 'Hotspot' },
        ],
    },
    {
        name: 'Premitives',
        elements: [
            { type: 'text',     visualSrc: 'Text' },
            { type: 'image',    visualSrc: 'Image' },
            { type: 'video',    visualSrc: 'Video' },
            { type: 'audio',    visualSrc: 'Audio' },
            { type: 'iframe',   visualSrc: 'iFrame' },
            { type: 'button',   visualSrc: 'Button' },
            { type: 'input',    visualSrc: 'Input' },
            { type: 'select',   visualSrc: 'Select' },
            { type: 'checkbox', visualSrc: 'Checkbox' },
            { type: 'radio',    visualSrc: 'Radio' },
            { type: 'code',     visualSrc: 'Code' },
        ],
    },
    {
        name: 'Containers',
        elements: [
            { type: 'div',      visualSrc: 'Div' },
            { type: 'section',  visualSrc: 'Section' },
            { type: 'article',  visualSrc: 'Article' },
            { type: 'header',   visualSrc: 'Header' },
            { type: 'footer',   visualSrc: 'Footer' },
            { type: 'nav',      visualSrc: 'Nav' },
            { type: 'form',     visualSrc: 'Form' },
            { type: 'list',     visualSrc: 'List' },
            { type: 'table',    visualSrc: 'Table' },
        ],
    },
];
</script>