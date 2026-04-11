<script setup lang="ts" vapor>
    /**
     * CanvasNode.vue
     *
     * Central dispatch component. Resolves an element by id from the
     * injected elements map and delegates to the correct renderer
     * based on kind.
     *
     * Expects:
     *   provide('elements', Record<string, Element>)
     *   provide('isAuthoring', boolean)
     */
    import { inject, computed, unref, type Ref, type ComputedRef } from 'vue'
    import type { Element } from '../types/element'

    import ContainerRenderer from './renderers/ContainerRenderer.vue'
    import FlatHtmlRenderer from './renderers/FlatHtmlRenderer.vue'
    import SvgRenderer from './renderers/SvgRenderer.vue'
    import ComponentRenderer from './renderers/ComponentRenderer.vue'

    const props = defineProps<{ id: string }>()

    type ElementMapSource = Record<string, Element> | Ref<Record<string, Element>> | ComputedRef<Record<string, Element>>

    const elementsSource = inject<ElementMapSource>('elements', {})
    const elements = computed(() => unref(elementsSource) ?? {})
    const el = computed(() => elements.value[props.id])
</script>

<template>
    <ContainerRenderer v-if="el?.kind === 'container'" :el="el" />
    <FlatHtmlRenderer v-else-if="el?.kind === 'flatHtml'" :el="el" />
    <SvgRenderer v-else-if="el?.kind === 'svg'" :el="el" />
    <ComponentRenderer v-else-if="el?.kind === 'component'" :el="el" />
    <div v-else :data-eid="props.id" data-unresolved="true" style="display:none" />
</template>