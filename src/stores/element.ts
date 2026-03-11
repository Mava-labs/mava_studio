/**
 * element.ts
 * Pinia store — element tree mutations, DOM mounting, and selection.
 *
 * Changes from original:
 *   - pushUndo() called on addElement, updateElement, removeElement
 *   - restoreSnapshot() added — called by useUndoRedo dispatcher
 *   - commitPageToCache() replaces direct pagesCache mutation
 *     so dirty marking flows through pagesStore correctly
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { usePagesStore } from './pages';
import { useProjectMetadataStore } from './projectMetadata';
import type {
    Element, ContainerElement, SvgElement, FlatHtmlElement,
    ContainerStyle, Layout, Effects,
    TextStyle, ImageStyle, SvgStyle,
} from '../types/element';
import type { Page } from '../types/project';
import {
    mountElement, unmountElement, getMountedNode,
    applyLayoutToNode, applyEffectsToNode, applyTextStyleToNode,
    applyImageStyleToNode, applySvgStyleToNode, applyContainerStyleToNode,
} from '../utils/element.mounter';
import {
    buildText, buildButton, buildImage, buildInput, buildTextarea, buildLabel,
    buildDiv, buildSection, buildArticle, buildHeader, buildFooter, buildNav,
    buildForm, buildList, buildRect, buildCircle, buildEllipse, buildLine, buildPath,
} from '../utils/element.builder';

/* ============================================================
   TYPES (unchanged from original)
   ============================================================ */

export type InsertableType =
    | 'line' | 'rectangle' | 'square' | 'circle' | 'ellipse'
    | 'triangle' | 'hexagon' | 'star' | 'arrow' | 'hotspot' | 'path'
    | 'text' | 'image' | 'video' | 'audio' | 'iframe'
    | 'button' | 'input' | 'select' | 'checkbox' | 'radio'
    | 'textarea' | 'label' | 'code'
    | 'form' | 'list' | 'table' | 'div'
    | 'section' | 'article' | 'header' | 'footer' | 'nav';

export type InsertPosition = 'before' | 'after';

export interface AddElementOptions {
    position?: InsertPosition;
}

export interface ElementPatch {
    style?:    Partial<Record<string, unknown>>;
    effects?:  Partial<Effects>;
    layout?: {
        size?:         Partial<Layout['size']>;
        positioning?:  Partial<Layout['positioning']>;
        transform?:    Partial<NonNullable<Layout['transform']>>;
        visible?:      boolean;
        locked?:       boolean;
    };
}

/* ============================================================
   INLINE HELPERS (unchanged from original)
   ============================================================ */

function uid(): string { return Math.random().toString(36).slice(2, 9); }

const defaultLayout    = () => ({ positioning: { mode: 'flow' as const }, size: { width: 'auto' as const, height: 'auto' as const }, visible: true, locked: false });
const defaultEffects   = () => ({ opacity: 1, blur: 0 });
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

function buildElement(type: InsertableType): Element {
    switch (type) {
        case 'text':     return buildText();
        case 'button':   return buildButton();
        case 'image':    return buildImage();
        case 'input':    return buildInput();
        case 'textarea': return buildTextarea();
        case 'label':    return buildLabel();
        case 'checkbox':
        case 'radio':
        case 'select':   return buildInput();
        case 'video':    return buildFlatHtmlGeneric('video');
        case 'audio':    return buildFlatHtmlGeneric('audio');
        case 'iframe':   return buildFlatHtmlGeneric('video');
        case 'code':     return buildFlatHtmlGeneric('textarea');
        case 'div':      return buildDiv();
        case 'section':  return buildSection();
        case 'article':  return buildArticle();
        case 'header':   return buildHeader();
        case 'footer':   return buildFooter();
        case 'nav':      return buildNav();
        case 'form':     return buildForm();
        case 'list':     return buildList();
        case 'table':    return buildContainerGeneric('div', 'Table');
        case 'line':     return buildLine();
        case 'path':     return buildPath();
        case 'circle':   return buildCircle();
        case 'ellipse':  return buildEllipse();
        case 'rectangle': return buildRect();
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

/* ============================================================
   INSERTION HELPERS (unchanged from original)
   ============================================================ */

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
    if (selected.kind === 'container' && position === 'after') return { target: 'child', parentId: selected.id };
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
        case 'root':        return { ...page, elements, rootIds: [...page.rootIds, newElement.id] };
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

function mountAtPosition(
    descriptor: InsertionDescriptor, newElement: Element,
    prePage: Page, stageNode: HTMLElement, elementMap: Map<string, Element>,
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

/* ============================================================
   STORE
   ============================================================ */

export const useElementStore = defineStore('element', () => {

    const pages   = usePagesStore();
    const project = useProjectMetadataStore();

    const activeElementId = ref<string | null>(null);
    const stageNode       = ref<HTMLElement | null>(null);
    const nodeIndex       = ref<Record<string, Record<string, HTMLElement>>>({});

    /* ----------------------------------------------------------
       STAGE REGISTRATION
    ---------------------------------------------------------- */

    function setStageNode(node: HTMLElement): void { stageNode.value = node; }

    /* ----------------------------------------------------------
       SELECTION
    ---------------------------------------------------------- */

    function setActiveElement(id: string | null): void { activeElementId.value = id; }

    /* ----------------------------------------------------------
       MOUNT PAGE
    ---------------------------------------------------------- */

    function mountPage(): void {
        const page  = pages.getActivePageData();
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

    /* ----------------------------------------------------------
       SNAPSHOT RESTORE (called by useUndoRedo for page-scoped actions)
    ---------------------------------------------------------- */

    /**
     * Restore a page to a prior snapshot state.
     * Replaces the cache entry and remounts the stage to reflect the restored state.
     * Called by useUndoRedo when scope.kind === 'page'.
     */
    function restoreSnapshot(pageId: string, snapshot: Page): void {
        pages.restoreSnapshot(pageId, snapshot);
        // If this page is currently active, remount the stage
        if (pages.activePageId === pageId) {
            mountPage();
        }
    }

    /* ----------------------------------------------------------
       UPDATE ELEMENT
    ---------------------------------------------------------- */

    function updateElement(elementId: string, patch: ElementPatch): void {
        const page = pages.getActivePageData();
        if (!page) return;
        const el = page.elements[elementId];
        if (!el) return;

        // Capture before state for undo
        const before = JSON.stringify(page);

        // ── Merge data ────────────────────────────────────────
        let updated = { ...el };

        if (patch.effects) {
            updated = { ...updated, effects: { ...updated.effects, ...patch.effects } };
        }

        if (patch.style) {
            updated = { ...updated, style: { ...(updated.style as Record<string, unknown>), ...patch.style } };
        }

        if (patch.layout) {
            const cur = updated.layout;
            const lp  = patch.layout;
            const size = lp.size ? { ...cur.size, ...lp.size } : cur.size;
            const positioning: Layout['positioning'] = lp.positioning
                ? (lp.positioning.mode === 'flow'
                    ? { mode: 'flow' }
                    : { ...cur.positioning, ...lp.positioning } as Layout['positioning'])
                : cur.positioning;
            const transform = lp.transform ? { ...(cur.transform ?? {}), ...lp.transform } : cur.transform;
            updated = {
                ...updated,
                layout: {
                    ...cur,
                    ...(lp.visible !== undefined && { visible: lp.visible }),
                    ...(lp.locked  !== undefined && { locked:  lp.locked }),
                    size, positioning, transform,
                },
            };
        }

        // ── Commit to cache (marks dirty) ─────────────────────
        const updatedPage = { ...page, elements: { ...page.elements, [elementId]: updated } };
        pages.commitPageToCache(updatedPage);

        // ── Push undo ─────────────────────────────────────────
        project.pushUndo({
            label:  `Edit ${el.name}`,
            scope:  { kind: 'page', id: page.id },
            before,
            after:  JSON.stringify(updatedPage),
        });

        // ── Surgical DOM sync ─────────────────────────────────
        const node = getMountedNode(elementId);
        if (!node) return;
        if (patch.effects) applyEffectsToNode(node, updated.effects);
        if (patch.layout)  applyLayoutToNode(node, updated.layout);
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

    /* ----------------------------------------------------------
       ADD ELEMENT
    ---------------------------------------------------------- */

    function addElement(type: InsertableType, options: AddElementOptions = {}): Element | null {
        const page  = pages.getActivePageData();
        const stage = stageNode.value;
        if (!page || !stage) return null;

        // Capture before state for undo
        const before = JSON.stringify(page);

        const position   = options.position ?? 'after';
        const newElement = buildElement(type);
        const descriptor = resolveInsertion(page, activeElementId.value, position);
        const updatedPage = applyInsertion(page, descriptor, newElement);

        // Commit to cache (marks dirty)
        pages.commitPageToCache(updatedPage);

        // Mount DOM
        const elementMap = new Map(Object.entries(updatedPage.elements));
        const node = mountAtPosition(descriptor, newElement, page, stage, elementMap);
        if (!nodeIndex.value[page.id]) nodeIndex.value[page.id] = {};
        nodeIndex.value[page.id][newElement.id] = node;

        // Push undo
        project.pushUndo({
            label:  `Add ${newElement.name}`,
            scope:  { kind: 'page', id: page.id },
            before,
            after:  JSON.stringify(updatedPage),
        });

        setActiveElement(newElement.id);
        return newElement;
    }

    /* ----------------------------------------------------------
       REMOVE ELEMENT
    ---------------------------------------------------------- */

    function removeElement(elementId: string): void {
        const page = pages.getActivePageData();
        if (!page) return;

        // Capture before state for undo
        const before = JSON.stringify(page);
        const elementName = page.elements[elementId]?.name ?? 'Element';

        // Collect all ids to remove (element + descendants)
        const toRemove = new Set<string>();
        const collect = (id: string) => {
            toRemove.add(id);
            const el = page.elements[id];
            if (el?.kind === 'container')
                for (const c of (el as ContainerElement).children) collect(c);
        };
        collect(elementId);

        // Remove DOM nodes
        for (const id of toRemove) {
            const n = getMountedNode(id);
            n?.parentElement?.removeChild(n);
            unmountElement(id);
            delete nodeIndex.value[page.id]?.[id];
        }

        // Build updated page state
        const elements = { ...page.elements };
        for (const id of toRemove) delete elements[id];
        const rootIds = page.rootIds.filter(id => !toRemove.has(id));
        for (const el of Object.values(elements)) {
            if (el.kind === 'container') {
                const c = el as ContainerElement;
                const filtered = c.children.filter(id => !toRemove.has(id));
                if (filtered.length !== c.children.length)
                    elements[el.id] = { ...c, children: filtered };
            }
        }

        const updatedPage = { ...page, elements, rootIds };
        pages.commitPageToCache(updatedPage);

        // Push undo
        project.pushUndo({
            label:  `Delete ${elementName}`,
            scope:  { kind: 'page', id: page.id },
            before,
            after:  JSON.stringify(updatedPage),
        });

        if (activeElementId.value && toRemove.has(activeElementId.value))
            setActiveElement(null);
    }

    /* ----------------------------------------------------------
       PUBLIC API
    ---------------------------------------------------------- */

    return {
        activeElementId,
        nodeIndex,
        setStageNode,
        setActiveElement,
        mountPage,
        updateElement,
        addElement,
        removeElement,
        restoreSnapshot,
    };
});