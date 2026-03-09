import { defineStore } from "pinia";
import { ref } from "vue";
import { usePagesStore } from "./pages";

import type {
    Element, ContainerElement, SvgElement, FlatHtmlElement, ContainerStyle,
    Layout, Effects, TextStyle, ImageStyle, SvgStyle,
} from "../types/element";
import type { Page } from "../types/project";

import {
    mountElement, unmountElement, getMountedNode,
    applyLayoutToNode, applyEffectsToNode, applyTextStyleToNode,
    applyImageStyleToNode, applySvgStyleToNode, applyContainerStyleToNode,
} from "../utils/element.mounter";
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
    // SVG/shapes
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

/**
 * Granular patch passed to updateElement.
 * Each key is optional — only what you pass gets merged and synced.
 */
export interface ElementPatch {
    style?: Partial<Record<string, unknown>>;
    effects?: Partial<Effects>;
    layout?: {
        size?: Partial<Layout['size']>;
        positioning?: Partial<Layout['positioning']>;
        transform?: Partial<NonNullable<Layout['transform']>>;
        visible?: boolean;
        locked?: boolean;
    };
}

// ─── Inline helpers ───────────────────────────────────────────────────────────

function uid(): string { return Math.random().toString(36).slice(2, 9); }

const defaultLayout = () => ({
    positioning: { mode: 'flow' as const },
    size: { width: 'auto' as const, height: 'auto' as const },
    visible: true, locked: false,
});
const defaultEffects = () => ({ opacity: 1, blur: 0 });
const defaultInteraction = () => ({ triggers: [], animations: [] });

function buildFlatHtmlGeneric(type: FlatHtmlElement['type']): FlatHtmlElement {
    return {
        id: uid(), name: type.charAt(0).toUpperCase() + type.slice(1),
        kind: 'flatHtml', type,
        layout: defaultLayout(), effects: defaultEffects(), interaction: defaultInteraction(),
        style: { src: '', autoplay: false, loop: false, muted: false, controls: true },
    };
}

function buildContainerGeneric(type: ContainerElement['type'], name: string): ContainerElement {
    return {
        id: uid(), name, kind: 'container', type, children: [],
        display: { mode: 'block' },
        layout: { ...defaultLayout(), size: { width: 'full', height: 'auto' } },
        effects: defaultEffects(), interaction: defaultInteraction(),
        style: { background: 'transparent', padding: 0 } as ContainerStyle,
    };
}

// ─── Builder dispatch ─────────────────────────────────────────────────────────

function buildElement(type: InsertableType): Element {
    switch (type) {
        case 'text': return buildText();
        case 'button': return buildButton();
        case 'image': return buildImage();
        case 'input': return buildInput();
        case 'textarea': return buildTextarea();
        case 'label': return buildLabel();
        case 'checkbox':
        case 'radio':
        case 'select': return buildInput();
        case 'video': return buildFlatHtmlGeneric('video');
        case 'audio': return buildFlatHtmlGeneric('audio');
        case 'iframe': return buildFlatHtmlGeneric('video'); // closest flatHtml type
        case 'code': return buildFlatHtmlGeneric('textarea');
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
            el.name = 'Square'; el.geometry = { type: 'rect', width: 100, height: 100 };
            el.layout.size = { width: 100, height: 100 }; return el;
        }
        case 'triangle': {
            const el = buildPath() as SvgElement;
            el.name = 'Triangle'; el.type = 'polygon';
            el.geometry = { type: 'polygon', points: [{ x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
            el.layout.size = { width: 100, height: 100 }; return el;
        }
        case 'hexagon': {
            const el = buildPath() as SvgElement;
            el.name = 'Hexagon'; el.type = 'polygon';
            const r = 60, cx = 60, cy = 60;
            el.geometry = {
                type: 'polygon', points: Array.from({ length: 6 }, (_, i) => {
                    const a = (Math.PI / 180) * (60 * i);
                    return { x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)) };
                })
            };
            el.layout.size = { width: 120, height: 120 }; return el;
        }
        case 'star': {
            const el = buildPath() as SvgElement;
            el.name = 'Star'; el.type = 'star';
            el.geometry = { type: 'star', points: 5, innerRadius: 20, outerRadius: 50 };
            el.layout.size = { width: 100, height: 100 }; return el;
        }
        case 'arrow': {
            const el = buildPath() as SvgElement;
            el.name = 'Arrow'; el.type = 'arrow';
            el.geometry = { type: 'arrow', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } };
            el.layout.size = { width: 100, height: 20 }; return el;
        }
        case 'hotspot': {
            const el = buildRect() as SvgElement;
            el.name = 'Hotspot'; el.type = 'hotspot';
            el.geometry = { type: 'hotspot', width: 100, height: 100 };
            el.layout.size = { width: 100, height: 100 }; return el;
        }
    }
}

// ─── Insertion helpers ────────────────────────────────────────────────────────

type InsertionDescriptor =
    | { target: 'root' }
    | { target: 'rootSibling'; index: number }
    | { target: 'sibling'; parentId: string; index: number }
    | { target: 'child'; parentId: string };

function findParent(elements: Record<string, Element>, childId: string): ContainerElement | null {
    for (const el of Object.values(elements))
        if (el.kind === 'container' && (el as ContainerElement).children.includes(childId))
            return el as ContainerElement;
    return null;
}

function spliceIn(arr: string[], id: string, index: number): string[] {
    const copy = [...arr]; copy.splice(index, 0, id); return copy;
}

function resolveInsertion(page: Page, activeId: string | null, position: InsertPosition): InsertionDescriptor {
    if (!activeId) return { target: 'root' };
    const selected = page.elements[activeId];
    if (!selected) return { target: 'root' };

    // Container selected + default 'after' = absorb as child
    if (selected.kind === 'container' && position === 'after') return { target: 'child', parentId: selected.id };

    // flatHtml / SVG / or forced 'before' on container = sibling
    const parent = findParent(page.elements, activeId);

    if (parent) {
        const idx = parent.children.indexOf(activeId);
        return { target: 'sibling', parentId: parent.id, index: position === 'before' ? idx : idx + 1 };
    }

    const rootIdx = page.rootIds.indexOf(activeId);
    return { target: 'rootSibling', index: position === 'before' ? rootIdx : rootIdx + 1 };
}

function applyInsertion(page: Page, descriptor: InsertionDescriptor, newElement: Element): Page {
    const elements = { ...page.elements, [newElement.id]: newElement };
    switch (descriptor.target) {
        case 'root': return { ...page, elements, rootIds: [...page.rootIds, newElement.id] };
        case 'rootSibling': return { ...page, elements, rootIds: spliceIn(page.rootIds, newElement.id, descriptor.index) };
        case 'child': {
            const p = page.elements[descriptor.parentId] as ContainerElement;
            return { ...page, elements: { ...elements, [p.id]: { ...p, children: [...p.children, newElement.id] } } };
        }
        case 'sibling': {
            const p = page.elements[descriptor.parentId] as ContainerElement;
            return { ...page, elements: { ...elements, [p.id]: { ...p, children: spliceIn(p.children, newElement.id, descriptor.index) } } };
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
    prePage: Page, // page state BEFORE insertion (for sibling index lookups)
    stageNode: HTMLElement, elementMap: Map<string, Element>,
): HTMLElement {
    const node = mountElement(newElement, elementMap);
    switch (descriptor.target) {
        case 'root': stageNode.appendChild(node); break;
        case 'rootSibling': {
            const nextNode = prePage.rootIds[descriptor.index]
                ? stageNode.querySelector<HTMLElement>(`[data-eid="${prePage.rootIds[descriptor.index]}"]`)
                : null;
            nextNode ? stageNode.insertBefore(node, nextNode) : stageNode.appendChild(node);
            break;
        }
        case 'child': {
            (getMountedNode(descriptor.parentId) ?? stageNode).appendChild(node); break;
        }
        case 'sibling': {
            const parentNode = getMountedNode(descriptor.parentId);
            if (!parentNode) break;
            const nextId = (prePage.elements[descriptor.parentId] as ContainerElement).children[descriptor.index];
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

    function setStageNode(node: HTMLElement): void { stageNode.value = node; }

    // ── Selection ─────────────────────────────────────────────────────────────

    function setActiveElement(id: string | null): void { activeElementId.value = id; }

    // ── Mount page ────────────────────────────────────────────────────────────
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
            nodeIndex.value[page.id][rootId] = mountElement(el, elementMap, stage);
        }
    }

    // ── updateElement ─────────────────────────────────────────────────────────

    /**
     * Merge a partial patch into the element data and immediately apply
     * the changed properties to the live DOM node — no remount needed.
     *
     * Called by every style panel sub-component instead of direct mutation.
     *
     * @example
     * elementStore.updateElement(id, { effects: { opacity: 0.5 } })
     * elementStore.updateElement(id, { style: { color: '#ff0000' } })
     * elementStore.updateElement(id, { layout: { size: { width: 300 } } })
     */
    function updateElement(elementId: string, patch: ElementPatch): void {
        const page = pages.getActivePageData();
        if (!page) return;
        const el = page.elements[elementId];
        if (!el) return;

        // ── Merge data ────────────────────────────────────────────────────────

        let updated = { ...el };

        if (patch.effects) {
            updated = { ...updated, effects: { ...updated.effects, ...patch.effects } };
        }

        if (patch.style) {
            updated = {
                ...updated,
                style: { ...(updated.style as Record<string, unknown>), ...patch.style },
            };
        }

        if (patch.layout) {
            const cur = updated.layout;
            const lp = patch.layout;

            const size = lp.size
                ? { ...cur.size, ...lp.size }
                : cur.size;

            const positioning: Layout['positioning'] = lp.positioning
                ? (lp.positioning.mode === 'flow'
                    ? { mode: 'flow' }
                    : { ...cur.positioning, ...lp.positioning } as Layout['positioning'])
                : cur.positioning;

            const transform = lp.transform
                ? { ...(cur.transform ?? {}), ...lp.transform }
                : cur.transform;

            updated = {
                ...updated,
                layout: {
                    ...cur,
                    ...(lp.visible !== undefined && { visible: lp.visible }),
                    ...(lp.locked !== undefined && { locked: lp.locked }),
                    size, positioning, transform,
                },
            };
        }

        // ── Write to cache ────────────────────────────────────────────────────

        pages.pagesCache[page.id] = {
            ...page,
            elements: { ...page.elements, [elementId]: updated },
        };

        // ── Surgical DOM sync ─────────────────────────────────────────────────

        const node = getMountedNode(elementId);
        if (!node) return;

        if (patch.effects) applyEffectsToNode(node, updated.effects);
        if (patch.layout) applyLayoutToNode(node, updated.layout);

        if (patch.style) {
            switch (updated.kind) {
                case 'flatHtml': {
                    const t = (updated as FlatHtmlElement).type;
                    if (t === 'text' || t === 'button' || t === 'label')
                        applyTextStyleToNode(node, updated.style as TextStyle);
                    else if (t === 'image')
                        applyImageStyleToNode(node, updated.style as ImageStyle);
                    break;
                }
                case 'container':
                    applyContainerStyleToNode(node, updated.style as ContainerStyle, (updated as ContainerElement).display);
                    break;
                case 'svg':
                    applySvgStyleToNode(node, updated.style as SvgStyle);
                    break;
            }
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
            if (el?.kind === 'container')
                for (const c of (el as ContainerElement).children) collect(c);
        };
        collect(elementId);

        for (const id of toRemove) {
            const n = getMountedNode(id);
            n?.parentElement?.removeChild(n);
            unmountElement(id);
            delete nodeIndex.value[page.id]?.[id];
        }

        const elements = { ...page.elements };
        for (const id of toRemove) delete elements[id];
        const rootIds = page.rootIds.filter((id) => !toRemove.has(id));
        for (const el of Object.values(elements)) {
            if (el.kind === 'container') {
                const c = el as ContainerElement;
                const f = c.children.filter((id) => !toRemove.has(id));
                if (f.length !== c.children.length) elements[el.id] = { ...c, children: f };
            }
        }

        pages.pagesCache[page.id] = { ...page, elements, rootIds };
        if (activeElementId.value && toRemove.has(activeElementId.value)) setActiveElement(null);
    }

    return {
        activeElementId, nodeIndex,
        setStageNode, setActiveElement,
        mountPage, updateElement,
        addElement, removeElement,
    };
});