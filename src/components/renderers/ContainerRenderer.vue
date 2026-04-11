<script setup lang="ts" vapor>
    import { computed, inject, ref, unref, type Ref, type ComputedRef } from 'vue'
    import type { ContainerElement, Element } from '../../types/element'
    import { resolveContainerElement } from './resolve'
    import { useElementTriggers } from '../../composables/useElementTriggers'
    import { useElementAnimations } from '../../composables/useElementAnimations'
    import CanvasNode from '../CanvasNode.vue'

    const props = defineProps<{ el: ContainerElement }>()

    const elRef = ref<HTMLElement | null>(null)

    type ElementMapSource = Record<string, Element> | Ref<Record<string, Element>> | ComputedRef<Record<string, Element>>

    const elementsSource = inject<ElementMapSource>('elements', {})
    const elements = computed(() => unref(elementsSource) ?? {})

    const parent = computed(() => {
        if (!props.el.parentId) return undefined
        return elements.value[props.el.parentId]
    })

    const resolved = computed(() => resolveContainerElement(props.el, parent.value))

    useElementTriggers(elRef, props.el.interaction.triggers, props.el.id)
    useElementAnimations(elRef, props.el.interaction.animations, props.el.interaction.triggers, props.el.id)
</script>

<template>
    <component :is="resolved.tag" ref="elRef" :data-eid="el.id" :style="resolved.style" v-bind="resolved.attrs">
        <CanvasNode v-for="childId in el.children" :key="childId" :id="childId" />
    </component>
</template>