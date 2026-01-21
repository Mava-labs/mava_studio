import { defineStore } from "pinia";
import { ref } from "vue";
import { usePagesStore } from "./pages";
import { Element } from "../types/element";
import type { Page } from "../types/project";

export const useElementStore = defineStore('element', () => {
    const pages = usePagesStore()
    const activeElementId = ref<string | null>(null);
    const markupCache = ref<Record<string, HTMLElement[]>>({});

    function setActiveElement(elementId: string | null) {
        activeElementId.value = elementId;
    }

    //  const shapeSizes: Partial<Record<ShapePreset, { width: number; height: number }>> = {
    //     rectangle: { width: 320, height: 180 },
    //     square: { width: 200, height: 200 },
    //     circle: { width: 180, height: 180 },
    //     ellipse: { width: 240, height: 160 },
    //     triangle: { width: 240, height: 180 },
    //     hexagon: { width: 260, height: 220 },
    //     star: { width: 260, height: 220 },
    //     arrow: { width: 260, height: 90 },
    //     line: { width: 320, height: 6 },
    //     hotspot: { width: 220, height: 140 },
    // };

    // const shapeSides: Partial<Record<ShapePreset, number>> = {
    //     line: 2,
    //     rectangle: 4,
    //     square: 4,
    //     circle: 0,
    //     ellipse: 0,
    //     triangle: 3,
    //     hexagon: 6,
    //     star: 5,
    //     arrow: 2,
    //     hotspot: 4,
    // };

    // const shapeRadius: Partial<Record<ShapePreset, number>> = {
    //     circle: 9999,
    //     ellipse: 9999,
    //     rectangle: 8,
    //     square: 6,
    //     hotspot: 4,
    // };

    // const shapeFill: Partial<Record<ShapePreset, string>> = {
    //     hotspot: "transparent",
    // };

    // const buildShapeElement = (kind: ShapePreset, page: Page): Element => {
    //     const stage = normalizeStage(page.stage);
    //     const size = shapeSizes[kind] ?? { width: 240, height: 160 };
    //     const elementId = generateId("el");
    //     return {
    //         id: elementId,
    //         name: kind.charAt(0).toUpperCase() + kind.slice(1),
    //         type: kind,
    //         layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
    //         effects: baseEffects,
    //         style: {
    //             fill: shapeFill[kind] ?? "#0ea5e9",
    //             sides: shapeSides[kind] ?? 4,
    //             stroke: { ...baseStroke, width: kind === "line" ? 2 : baseStroke.width },
    //             radius: shapeRadius[kind],
    //         },
    //     };
    // };

    // const buildCollectionElement = (page: Page): Element => {
    //     const stage = normalizeStage(page.stage);
    //     const size = { width: 520, height: 320 };
    //     const elementId = generateId("el");
    //     return {
    //         id: elementId,
    //         name: "Collection",
    //         type: "collection",
    //         layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
    //         effects: baseEffects,
    //         style: {
    //             fill: "rgba(14,165,233,0.06)",
    //             sides: 4,
    //             stroke: { ...baseStroke, style: "dashed", width: 1.5 },
    //             padding: 16,
    //             radius: 10,
    //         },
    //         memberIds: [],
    //     } as Element;
    // };

    // const buildComponentElement = (kind: "component" | "container", page: Page): Element => {
    //     const stage = normalizeStage(page.stage);
    //     const size = { width: 520, height: 320 };
    //     const elementId = generateId("el");
    //     return {
    //         id: elementId,
    //         name: kind === "component" ? "Component" : "Container",
    //         type: kind,
    //         layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
    //         effects: baseEffects,
    //         style: {},
    //         memberIds: [],
    //     } as Element;
    // };

    // const buildTextElement = (el: Element): HTMLParagraphElement => {
    //     const element = new HTMLParagraphElement
    //     return element
    // };

    // const buildImageElement = (page: Page): Element => {
    //     const stage = normalizeStage(page.stage);
    //     const size = { width: 320, height: 200 };
    //     const elementId = generateId("el");
    //     return {
    //         id: elementId,
    //         name: "Image",
    //         type: "image",
    //         layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
    //         effects: baseEffects,
    //         style: {
    //             src: "",
    //             fit: "cover",
    //         },
    //     } as Element;
    // };

    // const buildPathElement = (page: Page): Element => {
    //     const stage = normalizeStage(page.stage);
    //     const size = { width: 260, height: 160 };
    //     const elementId = generateId("el");
    //     return {
    //         id: elementId,
    //         name: "Path",
    //         type: "path",
    //         layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
    //         effects: baseEffects,
    //         style: {
    //             fill: "#c084fc",
    //             stroke: { color: "#6366f1", width: 2, style: "solid" },
    //             closed: false,
    //             smooth: false,
    //         },
    //         commands: [
    //             { type: "M", x: 0, y: size.height / 2 },
    //             { type: "L", x: size.width, y: size.height / 2 },
    //         ],
    //     } as Element;
    // };

    const SHAPE_TYPES = ['line','rectangle','square','circle','ellipse','triangle','hexagon','star','arrow','hotspot'] as const;

    const buildMarkup = (pageId: string | null): HTMLElement[] => {
        if (!pageId) return [];

        if (markupCache.value[pageId]) {
            return markupCache.value[pageId];
        }

        const page = pages.pagesCache[pageId] as Page | undefined;
        if (!page) {
            console.warn('[elements] no page found when building markup for', pageId);
            return [];
        }

        const { elements, roots = [] } = page;
        console.debug('[elements] roots', roots, 'elements keys', Object.keys(elements ?? {}));

        const buildTree = (elementId: string): HTMLElement | null => {
            const definition = elements[elementId];
            if (!definition) {
                console.warn('[elements] missing element definition for', elementId);
                return null;
            }

            const node = buildElement(definition);
            const childIds = definition.children ?? [];
            console.debug('[elements] building children for', elementId, childIds);
            for (const childId of childIds) {
                const child = buildTree(childId);
                if (child) node.appendChild(child);
            }

            return node;
        };

        const rootNodes: HTMLElement[] = [];
        for (const rootId of roots) {
            const node = buildTree(rootId);
            if (node) rootNodes.push(node);
        }

        console.debug('[elements] built root nodes', rootNodes.length, rootNodes);
        markupCache.value[pageId] = rootNodes;
        return rootNodes;
    };

    const clearPageMarkup = (pageId: string) => {
        delete markupCache.value[pageId];
    };

    function buildElement(el: Element): HTMLElement {
        let element: HTMLElement;
        switch (el.type) {
            case 'text':
                element = document.createElement('p');
                applyTextStyles(element as HTMLParagraphElement, el.style);
                break;
            case 'image':
                element = document.createElement('img');
                applyImageStyles(element as HTMLImageElement, el);
                break;
            case 'collection':
            case 'component':
            case 'container':
                element = document.createElement('div');
                applyShapeStyles(element, el);
                break;
            case 'path':
                element = document.createElement('div');
                element.dataset.type = 'path';
                break;
            default:
                element = document.createElement('div');
                if ((SHAPE_TYPES as readonly string[]).includes(el.type)) {
                    applyShapeStyles(element, el);
                }
                break;
        }

        applyLayoutAndEffects(element, el);
        element.dataset.elementId = el.id;
        element.dataset.elementType = el.type;
        console.debug('[elements] built element node', element);
        return element;
    }

    const applyLayoutAndEffects = (element: HTMLElement, el: Element) => {
        const { layout, effects } = el;
        const { positioning, size, transform, visible = true } = layout;

        if (!visible) element.style.display = 'none';

        if (positioning.mode === 'absolute') {
            element.style.position = 'absolute';
            element.style.left = `${positioning.x}px`;
            element.style.top = `${positioning.y}px`;
            if (positioning.zIndex !== undefined) element.style.zIndex = `${positioning.zIndex}`;
        } else {
            element.style.position = 'relative';
        }

        element.style.width = `${size.width}px`;
        element.style.height = `${size.height}px`;

        const transforms: string[] = [];
        if (transform?.rotation !== undefined) transforms.push(`rotate(${transform.rotation}deg)`);
        if (transform?.scaleX !== undefined || transform?.scaleY !== undefined) {
            const sx = transform.scaleX ?? 1;
            const sy = transform.scaleY ?? 1;
            transforms.push(`scale(${sx}, ${sy})`);
        }
        if (transforms.length) element.style.transform = transforms.join(' ');

        if (effects?.opacity !== undefined) element.style.opacity = `${effects.opacity}`;
        if (effects?.blur !== undefined) element.style.filter = `blur(${effects.blur}px)`;
        if (effects?.shadow) {
            const { color, offsetX, offsetY, blur } = effects.shadow;
            element.style.boxShadow = `${offsetX}px ${offsetY}px ${blur}px ${color}`;
        }
    };

    const applyTextStyles = (element: HTMLElement, style: any) => {
        if (!style) return;
        element.textContent = style.content ?? '';
        if (style.color) element.style.color = style.color;
        element.style.textDecoration = style.decoration ?? 'none';
        if (style.font?.family) element.style.fontFamily = style.font.family;
        if (style.font?.size !== undefined) element.style.fontSize = `${style.font.size}px`;
        if (style.font?.weight) element.style.fontWeight = String(style.font.weight);
        if (style.font?.style) element.style.fontStyle = style.font.style;
        if (style.align) element.style.textAlign = style.align;
        if (style.lineHeight !== undefined) element.style.lineHeight = `${style.lineHeight}px`;
        if (style.letterSpacing !== undefined) element.style.letterSpacing = `${style.letterSpacing}px`;
        if (style.whiteSpace) element.style.whiteSpace = style.whiteSpace;
        if (style.transform) element.style.textTransform = style.transform;
    };

    const applyShapeStyles = (element: HTMLElement, el: Extract<Element, { type: string }>) => {
        const style: any = (el as any).style ?? {};
        if (style.fill) element.style.background = style.fill;

        if (style.stroke) {
            const { color, width, style: borderStyle, sides } = style.stroke;
            element.style.borderStyle = borderStyle ?? 'solid';
            element.style.borderColor = color;
            element.style.borderWidth = `${width}px`;
            if (sides && (sides.top === false || sides.right === false || sides.bottom === false || sides.left === false)) {
                element.style.borderTopWidth = sides.top ? `${width}px` : '0';
                element.style.borderRightWidth = sides.right ? `${width}px` : '0';
                element.style.borderBottomWidth = sides.bottom ? `${width}px` : '0';
                element.style.borderLeftWidth = sides.left ? `${width}px` : '0';
            }
        }

        if (style.radius !== undefined) {
            if (typeof style.radius === 'number') {
                element.style.borderRadius = `${style.radius}px`;
            } else {
                const { tl, tr, br, bl } = style.radius;
                element.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
            }
        }

        if (style.padding !== undefined) {
            if (typeof style.padding === 'number') {
                element.style.padding = `${style.padding}px`;
            } else {
                const { top, right, bottom, left } = style.padding;
                element.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
            }
        }

        if (style.textContent?.text) {
            const label = document.createElement('span');
            applyTextStyles(label, style.textContent.text);
            label.style.display = 'block';
            element.appendChild(label);
        }
    };

    const applyImageStyles = (element: HTMLImageElement, el: Extract<Element, { type: 'image' }>) => {
        const { style } = el;
        element.src = style.src;
        if (style.fit) element.style.objectFit = style.fit;
        element.style.width = '100%';
        element.style.height = '100%';
        const filters: string[] = [];
        if (style.filters?.brightness !== undefined) filters.push(`brightness(${style.filters.brightness})`);
        if (style.filters?.contrast !== undefined) filters.push(`contrast(${style.filters.contrast})`);
        if (style.filters?.grayscale !== undefined) filters.push(`grayscale(${style.filters.grayscale})`);
        if (style.filters?.blur !== undefined) filters.push(`blur(${style.filters.blur}px)`);
        if (filters.length) element.style.filter = filters.join(' ');
    };
    
    return {
        activeElementId,
        setActiveElement,
        buildMarkup,
        clearPageMarkup
    };
});