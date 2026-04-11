<script setup lang="ts" vapor>
    import { computed, inject, ref, unref, type Ref, type ComputedRef } from 'vue'
    import type { FlatHtmlElement, Element } from '../../types/element'
    import { resolveFlatHtmlElement } from './resolve'
    import { useElementTriggers } from '../../composables/useElementTriggers'
    import { useElementAnimations } from '../../composables/useElementAnimations'

    const props = defineProps<{ el: FlatHtmlElement }>()

    const elRef = ref<HTMLElement | null>(null)

    type ElementMapSource = Record<string, Element> | Ref<Record<string, Element>> | ComputedRef<Record<string, Element>>

    const elementsSource = inject<ElementMapSource>('elements', {})
    const elements = computed(() => unref(elementsSource) ?? {})

    const parent = computed(() => {
        if (!props.el.parentId) return undefined
        return elements.value[props.el.parentId]
    })

    const resolved = computed(() => resolveFlatHtmlElement(props.el, parent.value))

    // ─── Behaviours ───────────────────────────────────────────────────────────────

    useElementTriggers(elRef, props.el.interaction.triggers, props.el.id)
    useElementAnimations(elRef, props.el.interaction.animations, props.el.interaction.triggers, props.el.id)
</script>

<template>
    <component :is="resolved.tag" ref="elRef" :data-eid="el.id" :style="resolved.style" v-bind="resolved.attrs">{{ resolved.textContent }}
    </component>
</template>