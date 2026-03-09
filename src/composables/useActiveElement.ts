/**
 * useActiveElement.ts
 *
 * Shared composable for style panel sub-components.
 * Provides the active element and a typed update function so panels
 * never need to import both stores or remember the call signature.
 */

import { computed } from 'vue';
import { usePagesStore } from '../stores/pages';
import { useElementStore } from '../stores/element';
import type { ElementPatch } from '../stores/element';
import type { Element } from '../types/element';

export function useActiveElement() {
    const pages = usePagesStore();
    const elementStore = useElementStore();

    const element = computed<Element | null>(() =>
        pages.getElementById(elementStore.activeElementId ?? '')
    );

    /**
     * Apply a granular patch to the active element.
     * Merges data and synchronises the live DOM node immediately.
     */
    function update(patch: ElementPatch): void {
        const id = elementStore.activeElementId;
        if (!id) return;
        elementStore.updateElement(id, patch);
    }

    return { element, update };
}