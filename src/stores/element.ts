import { defineStore } from "pinia";
import { ref } from "vue";
import { usePagesStore } from "./pages";

import type { Element, ContainerElement, SvgElement, FlatHtmlElement, ContainerStyle } from "../types/element";
import type { Page } from "../types/project";

import { mountElement, unmountElement, getMountedNode } from "../utils/element.mounter";
import {
    buildText, buildButton, buildImage, buildInput, buildTextarea, buildLabel,
    buildDiv, buildSection, buildArticle, buildHeader, buildFooter, buildNav, buildForm, buildList,
    buildRect, buildCircle, buildEllipse, buildLine, buildPath,
} from "../utils/element.builder";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Every type string the insert panel can emit.
 * Matches the 'type' fields in the panel's categories array exactly.
 */
export type InsertableType =
    // SVG / shapes
    | 'line' | 'rectangle' | 'square' | 'circle' | 'ellipse'
    | 'triangle' | 'hexagon' | 'star' | 'arrow' | 'hotspot' | 'path'
    // flatHtml
    | 'text' | 'image' | 'video' | 'audio' | 'iframe'
    | 'button' | 'input' | 'select' | 'checkbox' | 'radio'
    | 'textarea' | 'label' | 'code'
    // containers
    | 'form' | 'list' | 'table' | 'div'
    | 'section' | 'article' | 'header' | 'footer' | 'nav';

export type InsertPosition = 'before' | 'after';

export interface AddElementOptions {
    position?: InsertPosition;
}

// ─── Inline helpers for types not in element.builder.ts ──────────────────────

function uid(): string {
    return Math.random().toString(36).slice(2, 9);
}

const defaultLayout = () => ({
    positioning: { mode: 'flow' as const },
    size: { width: 'auto' as const, height: 'auto' as const },
    visible: true,
    locked: false,
});

const defaultEffects = () => ({ opacity: 1, blur: 0 });
const defaultInteraction = () => ({ triggers: [], animations: [] });

function buildFlatHtmlGeneric(type: FlatHtmlElement['type']): FlatHtmlElement {
    return {
        id: uid(),
        name: type.charAt(0).toUpperCase() + type.slice(1),
        kind: 'flatHtml',
        type,
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: { src: '', autoplay: false, loop: false, muted: false, controls: true },
    };
}

function buildContainerGeneric(type: ContainerElement['type'], name: string): ContainerElement {
    const style: ContainerStyle = { background: 'transparent', padding: 0 };
    return {
        id: uid(),
        name,
        kind: 'container',
        type,
        children: [],
        display: { mode: 'block' },
        layout: { ...defaultLayout(), size: { width: 'full', height: 'auto' } },
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

// ─── Builder dispatch ─────────────────────────────────────────────────────────

function buildElement(type: InsertableType): Element {
    switch (type) {
        // flatHtml
        case 'text': return buildText();
        case 'button': return buildButton();
        case 'image': return buildImage();
        case 'input': return buildInput();
        case 'textarea': return buildTextarea();
        case 'label': return buildLabel();
        case 'checkbox': return buildInput();
        case 'radio': return buildInput();
        case 'select': return buildInput();
        case 'video': return buildFlatHtmlGeneric('video');
        case 'audio': return buildFlatHtmlGeneric('audio');
        case 'iframe': return buildFlatHtmlGeneric('video');  // closest flatHtml type
        case 'code': return buildFlatHtmlGeneric('textarea');

        // containers
        case 'div': return buildDiv();
        case 'section': return buildSection();
        case 'article': return buildArticle();
        case 'header': return buildHeader();
        case 'footer': return buildFooter();
        case 'nav': return buildNav();
        case 'form': return buildForm();
        case 'list': return buildList();
        case 'table': return buildContainerGeneric('div', 'Table');

        // SVG — direct builders
        case 'line': return buildLine();
        case 'path': return buildPath();
        case 'circle': return buildCircle();
        case 'ellipse': return buildEllipse();
        case 'rectangle': return buildRect();

        // SVG — composed from existing builders
        case 'square': {
            const el = buildRect() as SvgElement;
            el.name = 'Square';
            el.geometry = { type: 'rect', width: 100, height: 100 };
            el.layout.size = { width: 100, height: 100 };
            return el;
        }

        case 'triangle': {
            const el = buildPath() as SvgElement;
            el.name = 'Triangle';
            el.type = 'polygon';
            el.geometry = { type: 'polygon', points: [{ x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
            el.layout.size = { width: 100, height: 100 };
            return el;
        }

        case 'hexagon': {
            const el = buildPath() as SvgElement;
            el.name = 'Hexagon';
            el.type = 'polygon';
            const r = 60, cx = 60, cy = 60;
            const points = Array.from({ length: 6 }, (_, i) => {
                const angle = (Math.PI / 180) * (60 * i);
                return { x: Math.round(cx + r * Math.cos(angle)), y: Math.round(cy + r * Math.sin(angle)) };
            });
            el.geometry = { type: 'polygon', points };
            el.layout.size = { width: 120, height: 120 };
            return el;
        }

        case 'star': {
            const el = buildPath() as SvgElement;
            el.name = 'Star';
            el.type = 'star';
            el.geometry = { type: 'star', points: 5, innerRadius: 20, outerRadius: 50 };
            el.layout.size = { width: 100, height: 100 };
            return el;
        }

        case 'arrow': {
            const el = buildPath() as SvgElement;
            el.name = 'Arrow';
            el.type = 'arrow';
            el.geometry = { type: 'arrow', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } };
            el.layout.size = { width: 100, height: 20 };
            return el;
        }

        case 'hotspot': {
            const el = buildRect() as SvgElement;
            el.name = 'Hotspot';
            el.type = 'hotspot';
            el.geometry = { type: 'hotspot', width: 100, height: 100 };
            el.layout.size = { width: 100, height: 100 };
            return el;
        }
    }
}

// ─── Insertion logic ──────────────────────────────────────────────────────────

type InsertionDescriptor =
    | { target: 'root' }
    | { target: 'rootSibling'; index: number }
    | { target: 'sibling'; parentId: string; index: number }
    | { target: 'child'; parentId: string };

function findParent(elements: Record<string, Element>, childId: string): ContainerElement | null {
    for (const el of Object.values(elements)) {
        if (el.kind === 'container' && (el as ContainerElement).children.includes(childId)) {
            return el as ContainerElement;
        }
    }
    return null;
}

function spliceIn(arr: string[], id: string, index: number): string[] {
    const copy = [...arr];
    copy.splice(index, 0, id);
    return copy;
}

function resolveInsertion(
    page: Page,
    activeElementId: string | null,
    position: InsertPosition,
): InsertionDescriptor {
    if (!activeElementId) return { target: 'root' };

    const selected = page.elements[activeElementId];
    if (!selected) return { target: 'root' };

    // Container selected + default 'after' = absorb as child
    if (selected.kind === 'container' && position === 'after') {
        return { target: 'child', parentId: selected.id };
    }

    // flatHtml / SVG / or forced 'before' on container = sibling
    const parent = findParent(page.elements, activeElementId);

    if (parent) {
        const idx = parent.children.indexOf(activeElementId);
        return { target: 'sibling', parentId: parent.id, index: position === 'before' ? idx : idx + 1 };
    }

    const rootIdx = page.rootIds.indexOf(activeElementId);
    return { target: 'rootSibling', index: position === 'before' ? rootIdx : rootIdx + 1 };
}

function applyInsertion(page: Page, descriptor: InsertionDescriptor, newElement: Element): Page {
    const elements = { ...page.elements, [newElement.id]: newElement };

    switch (descriptor.target) {
        case 'root':
            return { ...page, elements, rootIds: [...page.rootIds, newElement.id] };
        case 'rootSibling':
            return { ...page, elements, rootIds: spliceIn(page.rootIds, newElement.id, descriptor.index) };
        case 'child': {
            const parent = page.elements[descriptor.parentId] as ContainerElement;
            const updated = { ...parent, children: [...parent.children, newElement.id] };
            return { ...page, elements: { ...elements, [updated.id]: updated } };
        }
        case 'sibling': {
            const parent = page.elements[descriptor.parentId] as ContainerElement;
            const updated = { ...parent, children: spliceIn(parent.children, newElement.id, descriptor.index) };
            return { ...page, elements: { ...elements, [updated.id]: updated } };
        }
    }
}

/**
 * Mount the built node into the live DOM at the position described by the descriptor.
 * Uses the PRE-insertion page for sibling index lookups so index references are correct.
 */
function mountAtPosition(
    descriptor: InsertionDescriptor,
    newElement: Element,
    prePage: Page,        // page state BEFORE insertion (for sibling index lookups)
    stageNode: HTMLElement,
    elementMap: Map<string, Element>,
): HTMLElement {
    const node = mountElement(newElement, elementMap);

    switch (descriptor.target) {
        case 'root':
            stageNode.appendChild(node);
            break;

        case 'rootSibling': {
            const nextId = prePage.rootIds[descriptor.index];
            const nextNode = nextId ? stageNode.querySelector<HTMLElement>(`[data-eid="${nextId}"]`) : null;
            nextNode ? stageNode.insertBefore(node, nextNode) : stageNode.appendChild(node);
            break;
        }

        case 'child': {
            const parentNode = getMountedNode(descriptor.parentId);
            parentNode ? parentNode.appendChild(node) : stageNode.appendChild(node);
            break;
        }

        case 'sibling': {
            const parentNode = getMountedNode(descriptor.parentId);
            if (!parentNode) break;
            const parent = prePage.elements[descriptor.parentId] as ContainerElement;
            const nextId = parent.children[descriptor.index];
            const nextNode = nextId ? parentNode.querySelector<HTMLElement>(`[data-eid="${nextId}"]`) : null;
            nextNode ? parentNode.insertBefore(node, nextNode) : parentNode.appendChild(node);
            break;
        }
    }

    return node;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useElementStore = defineStore('element', () => {
    const pages = usePagesStore();

    const activeElementId = ref<string | null>(null);

    /**
     * The live stage DOM node. Set once by the Stage component via setStageNode().
     * Stored here so the insert panel and other consumers don't need to pass it around.
     */
    const stageNode = ref<HTMLElement | null>(null);

    /** Per-page lookup: pageId → { elementId → HTMLElement } */
    const nodeIndex = ref<Record<string, Record<string, HTMLElement>>>({});

    // ── Stage registration ────────────────────────────────────────────────────

    function setStageNode(node: HTMLElement): void {
        stageNode.value = node;
    }

    // ── Selection ─────────────────────────────────────────────────────────────

    function setActiveElement(elementId: string | null): void {
        activeElementId.value = elementId;
    }

    // ── Initial page render ───────────────────────────────────────────────────

    /**
     * Mount all elements of the active page into the stage.
     * Called by the Stage component after a page is loaded and the stage node is ready.
     */
    function mountPage(): void {
        const page = pages.getActivePageData();
        const stage = stageNode.value;
        if (!page || !stage) return;

        stage.innerHTML = '';
        nodeIndex.value[page.id] = {};

        const elementMap = new Map(Object.entries(page.elements));

        for (const rootId of page.rootIds) {
            const el = page.elements[rootId];
            if (!el) continue;
            const node = mountElement(el, elementMap, stage);
            nodeIndex.value[page.id][rootId] = node;
        }
    }

    // ── Add element ───────────────────────────────────────────────────────────

    /**
     * Build a new element, insert it into page data, mount it into the DOM, and select it.
     * The insert panel calls this with just the type — no stageNode arg needed.
     */
    function addElement(type: InsertableType, options: AddElementOptions = {}): Element | null {
        const page = pages.getActivePageData();
        const stage = stageNode.value;
        if (!page || !stage) return null;

        const position = options.position ?? 'after';
        const newElement = buildElement(type);
        const descriptor = resolveInsertion(page, activeElementId.value, position);
        const updatedPage = applyInsertion(page, descriptor, newElement);

        // Commit updated page into cache
        pages.pagesCache[page.id] = updatedPage;

        const elementMap = new Map(Object.entries(updatedPage.elements));

        // Mount — pass original `page` for sibling lookups, not updatedPage
        const node = mountAtPosition(descriptor, newElement, page, stage, elementMap);

        if (!nodeIndex.value[page.id]) nodeIndex.value[page.id] = {};
        nodeIndex.value[page.id][newElement.id] = node;

        setActiveElement(newElement.id);
        return newElement;
    }

    // ── Remove element ────────────────────────────────────────────────────────

    function removeElement(elementId: string): void {
        const page = pages.getActivePageData();
        if (!page) return;

        const toRemove = new Set<string>();
        const collect = (id: string) => {
            toRemove.add(id);
            const el = page.elements[id];
            if (el?.kind === 'container') {
                for (const childId of (el as ContainerElement).children) collect(childId);
            }
        };
        collect(elementId);

        for (const id of toRemove) {
            const node = getMountedNode(id);
            node?.parentElement?.removeChild(node);
            unmountElement(id);
            delete nodeIndex.value[page.id]?.[id];
        }

        const elements = { ...page.elements };
        for (const id of toRemove) delete elements[id];

        const rootIds = page.rootIds.filter((id) => !toRemove.has(id));

        for (const el of Object.values(elements)) {
            if (el.kind === 'container') {
                const c = el as ContainerElement;
                const filtered = c.children.filter((id) => !toRemove.has(id));
                if (filtered.length !== c.children.length) elements[el.id] = { ...c, children: filtered };
            }
        }

        pages.pagesCache[page.id] = { ...page, elements, rootIds };

        if (activeElementId.value && toRemove.has(activeElementId.value)) setActiveElement(null);
    }

    return {
        activeElementId,
        nodeIndex,
        setStageNode,
        setActiveElement,
        mountPage,
        addElement,
        removeElement,
    };
});