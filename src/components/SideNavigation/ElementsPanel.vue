<template>
    <div class="p-3 space-y-3 text-sm text-slate-800 dark:text-slate-100">
        <div class="flex items-center justify-between">
            <h3 class="font-semibold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Add Elements</h3>
            <span class="text-[11px] text-slate-500 dark:text-slate-400" v-if="!pages.activePageId">Select a page</span>
            <span class="text-[11px] text-emerald-500" v-else>Ready</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
            <button
                v-for="el in shapes"
                :key="el.label"
                type="button"
                class="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-xs transition"
                :class="[!pages.activePageId || isWorking ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer shadow-sm hover:-translate-y-0.5']"
                :disabled="!pages.activePageId || isWorking"
                @click="() => addElement(el.type, el.subtype)"
            >
                <div class="flex flex-col gap-0.5">
                <span class="font-semibold">{{ el.label }}</span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400" v-if="el.hint">{{ el.hint }}</span>
                </div>
            </button>
        </div>

        <div class="grid grid-cols-2 gap-2">
            <button
                v-for="el in elements"
                :key="el.label"
                type="button"
                class="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-xs transition"
                :class="[!pages.activePageId || isWorking ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer shadow-sm hover:-translate-y-0.5']"
                :disabled="!pages.activePageId || isWorking"
                @click="() => addElement(el.type, el.subtype)"
            >
                <div class="flex flex-col gap-0.5">
                <span class="font-semibold">{{ el.label }}</span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400" v-if="el.hint">{{ el.hint }}</span>
                </div>
            </button>
        </div>

        <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Elements drop onto the center of the active page. You can reposition them afterwards.
        </p>
    </div>
</template>

<script setup lang="ts" vapor>
import { ref } from "vue";
import { usePagesStore } from "../../stores/pages";
import { useNotificationStore } from "../../stores/notification";
import { useElementStore } from "../../stores/element";
import { generateId } from "../../utils/id";
import type { Element, ElementType, ShapePreset } from "../../types/element";
import { ELEMENT_PROPERTY_SCHEMAS } from "../../types/elementPropertySchemas";

const pages = usePagesStore();
const notifications = useNotificationStore();
const elementsStore = useElementStore();
const isWorking = ref(false);

const shapes: { label: string; hint: string; type: ElementType; subtype?: string }[] = [
    { label: 'Rectangle', hint: 'Solid block', type: 'rectangle' },
    { label: 'Ellipse', hint: 'Soft shape', type: 'ellipse' },
    { label: 'Line', hint: 'Divider / stroke', type: 'line' },
    { label: 'Hotspot', hint: 'Invisible click area', type: 'hotspot' },
];

const elements: {label: string, hint: string, type: ElementType, subtype?: string, icon?: string}[] = [
    { label: 'Text', hint: 'Heading or body', type: 'text', subtype: 'text' },
    { label: 'Image', hint: 'Upload later', type: 'image', subtype: 'image' },
    { label: 'div', hint: 'An HTML div', type: 'container', subtype: 'div' },
    { label: 'section', hint: '', type: 'container', subtype: 'section' },
    { label: 'nav', hint: '', type: 'container', subtype: 'nav' },
    { label: 'list', hint: '', type: 'container', subtype: 'list' },
    { label: 'input', hint: '', type: 'container', subtype: 'input' },
    { label: 'form', hint: '', type: 'container', subtype: 'form' },
    { label: 'grid', hint: 'Layout grid', type: 'container', subtype: 'grid' },
    { label: 'flex', hint: 'Layout flex', type: 'container', subtype: 'flex' }
];

type BuiltElement = { element: Element; extras: Element[] };

function buildDefaultElement(type: ElementType, subtype: string | undefined, id: string): BuiltElement {
    const styleFromSchema = (key: string | undefined) => {
        if (!key) return {} as Record<string, unknown>;
        const s = ELEMENT_PROPERTY_SCHEMAS[key];
        return s?.defaultStyle ? JSON.parse(JSON.stringify(s.defaultStyle)) : {};
    };

    const baseLayout = {
        positioning: { mode: 'flow' as const },
        size: { width: 200, height: 120 },
        visible: true,
        locked: false
    };

    const baseEffects = { opacity: 1, blur: 0 } as const;

    if (type === 'text') {
        const element: Element = {
            id,
            name: 'Text',
            type: 'text',
            subtype,
            parentId: undefined,
            children: [],
            layout: { ...baseLayout, size: { width: 220, height: 48 } },
            effects: { ...baseEffects },
            style: styleFromSchema(subtype ?? 'text')
        };
        return { element, extras: [] };
    }

    if (type === 'image') {
        const element: Element = {
            id,
            name: 'Image',
            type: 'image',
            subtype,
            parentId: undefined,
            children: [],
            layout: { ...baseLayout, size: { width: 240, height: 160 } },
            effects: { ...baseEffects },
            style: styleFromSchema(subtype ?? 'image')
        };
        return { element, extras: [] };
    }

    if (type === 'component' || type === 'container' || subtype === 'list' || subtype === 'form' || subtype === 'div' || subtype === 'section' || subtype === 'nav' || subtype === 'input') {
        const name = subtype ? subtype.charAt(0).toUpperCase() + subtype.slice(1) : 'Container';
        const baseStyle = styleFromSchema(subtype ?? 'container');

        const element: Element = {
            id,
            name,
            type,
            subtype,
            parentId: undefined,
            children: [],
            layout: { ...baseLayout, size: { width: 260, height: 180 } },
            effects: { ...baseEffects },
            style: baseStyle,
            memberIds: [],
            display: 'block' as any
        } as Element;

        const extras: Element[] = [];

        if (subtype === 'list') {
            // Seed list items as children
            const itemCount = 3;
            for (let i = 0; i < itemCount; i++) {
                const childId = generateId('li');
                const childStyle = styleFromSchema('list-item');
                const child: Element = {
                    id: childId,
                    name: `List item ${i + 1}`,
                    type: 'container',
                    subtype: 'list-item',
                    parentId: id,
                    children: [],
                    layout: { ...baseLayout, size: { width: 220, height: 32 } },
                    effects: { ...baseEffects },
                    style: childStyle,
                    memberIds: [],
                    display: 'block' as any
                } as Element;
                extras.push(child);
                element.children?.push(childId);
            }
        }

        if (subtype === 'form') {
            // Seed two inputs inside the form
            const inputTypes = ['text', 'email'];
            for (let i = 0; i < inputTypes.length; i++) {
                const childId = generateId('input');
                const childStyle = styleFromSchema('input');
                const child: Element = {
                    id: childId,
                    name: `Input ${i + 1}`,
                    type: 'container',
                    subtype: 'input',
                    parentId: id,
                    children: [],
                    layout: { ...baseLayout, size: { width: 240, height: 40 } },
                    effects: { ...baseEffects },
                    style: { ...childStyle, inputType: inputTypes[i] },
                    memberIds: [],
                    display: 'block' as any
                } as Element;
                extras.push(child);
                element.children?.push(childId);
            }
        }

        return { element, extras };
    }

    // Shapes and paths fallback
    const shapeName = subtype ?? type;
    const defaultSize = (type === 'line') ? { width: 200, height: 2 } : { width: 160, height: 120 };
    const element: Element = {
        id,
        name: shapeName,
        type: type as ShapePreset,
        subtype,
        parentId: undefined,
        children: [],
        layout: { ...baseLayout, size: defaultSize },
        effects: { ...baseEffects },
        style: styleFromSchema(subtype ?? type) as any
    } as Element;
    return { element, extras: [] };
}

async function addElement(type: ElementType, subtype?: string) {
    if (isWorking.value) return;
    if (!pages.activePageId) {
        notifications.addNotification('Pick a page first, then add elements.', { type: 'warn', ttl: 3500 });
        return;
    }

    const page = pages.getActivePageData();
    if (!page) {
        notifications.addNotification('Could not locate active page data.', { type: 'error', ttl: 4000 });
        return;
    }

    isWorking.value = true;
    try {
        const id = generateId('el');
        const { element, extras } = buildDefaultElement(type, subtype, id);

        const additions: Record<string, Element> = { [id]: element };
        for (const extra of extras) additions[extra.id] = extra;

        page.elements = { ...(page.elements ?? {}), ...additions };
        page.roots = [...(page.roots ?? []), id];

        elementsStore.setActiveElement(id);
        elementsStore.clearPageMarkup(page.id);
        await pages.savePage(page);
    } catch (error) {
        console.error(error);
        notifications.addNotification('Could not add the element.', { type: 'error', ttl: 5000 });
    } finally {
        isWorking.value = false;
    }
}
</script>
