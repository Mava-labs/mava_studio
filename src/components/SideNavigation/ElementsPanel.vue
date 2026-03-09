<template>
    <div class="h-full overflow-y-auto thin-scroll bg-slate-950/80 backdrop-blur-sm">
        <div class="flex flex-col gap-2 p-2">
            <div
                v-for="(category, index) in categories"
                :key="index"
            >
                <span class="capitalize text-sm font-medium text-gray-300">{{ category.name }}</span>
                <ul class="grid grid-cols-2 gap-2">
                    <li
                        v-for="(element, idx) in category.elements"
                        :key="idx"
                        class="flex flex-col items-center gap-1 p-2 rounded cursor-pointer hover:bg-gray-800"
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
import { useElementStore } from '../../stores/element';
import type { InsertableType } from '../../stores/element';

const elementStore = useElementStore();

interface PanelElement {
    type: InsertableType;
    visualSrc: string;
}

interface Category {
    name: string;
    elements: PanelElement[];
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
        name: 'HTML',
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
            { type: 'form',     visualSrc: 'Form' },
            { type: 'list',     visualSrc: 'List' },
            { type: 'table',    visualSrc: 'Table' },
            { type: 'code',     visualSrc: 'Code' },
            { type: 'div',      visualSrc: 'Div' },
        ],
    },
];
</script>