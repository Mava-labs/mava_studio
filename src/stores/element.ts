import { defineStore } from "pinia";
import { ref } from "vue";
import { usePagesStore } from "./pages";
import { BaseElement, Element, ImageElement, TextElement } from "../types/element";
import type { Page } from "../types/project";
import { generateId } from "../utils/id";

/**
 * Element runtime store.
 * - Builds DOM markup from normalized page data.
 * - Caches root nodes and a per-page node index for incremental updates.
 * - Supports in-place reparenting without full rebuilds.
 */
export const useElementStore = defineStore('element', () => {
    const pages = usePagesStore()
    /** Id of the element currently selected in the editor. */
    const activeElementId = ref<string | null>(null);
    /** Per-page cache of root DOM nodes, so we avoid rebuilding the whole tree after first render. */
    const markupCache = ref<Record<string, HTMLElement[]>>({});
    /** Per-page lookup from element id to its live HTMLElement for incremental updates and hit/highlight. */
    const nodeIndex = ref<Record<string, Record<string, HTMLElement>>>({});

    /** Track which element is selected in the editor. */
    function setActiveElement(elementId: string | null) {
        activeElementId.value = elementId;
    }

    /** Shape presets that share the same styling pipeline. */
    const SHAPE_TYPES = ['line', 'rectangle', 'square', 'circle', 'ellipse', 'triangle', 'hexagon', 'star', 'arrow', 'hotspot'] as const;

    function createBaseElement<TStyle>(params: {
        kind: BaseElement<TStyle>['kind'];
        type: string;
        style: TStyle;
        name?: string;
    }): BaseElement<TStyle> {
        return {
            id: generateId('el'),
            name: params.name ?? params.type,

            kind: params.kind,
            type: params.type,

            layout: {
                positioning: { mode: 'flow' },
                size: { width: 'full', height: 'full' },
                visible: true,
                locked: false,
            },

            effects: {
                opacity: 1,
                blur: 0,
            },

            style: params.style,
            responsive: [],

            interaction: {
                triggers: [],
                animations: [],
            },
        };
    }

    function createText(content = 'Text'): TextElement {
        return {
            ...createBaseElement('html', 'text', text),

            style: {
                content,
                font: { size: 16 },
                color: '#000',
                decoration: 'none',
            },
        };
    }

    function createImage(src = ''): ImageElement {
        return {
            ...createBaseElement('html', 'image'),

            style: {
                src,
                fit: 'contain',
            },
        };
    }


    return {
        activeElementId,
        setActiveElement,
        createBaseElement,
        createText,
        createImage,
    };
});