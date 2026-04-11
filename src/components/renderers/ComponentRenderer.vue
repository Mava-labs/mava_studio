<script setup lang="ts" vapor>
    /**
     * ComponentRenderer.vue
     *
     * Resolves a ComponentElement against the componentLibrary,
     * merges instance props into the definition, and renders it
     * through CanvasNode — no special runtime needed.
     */
    import { inject, computed, ref } from 'vue'
    import type { ComponentElement, Element } from '../../types/element'
    import { useElementTriggers } from '../../composables/useElementTriggers'
    import { useElementAnimations } from '../../composables/useElementAnimations'
    import CanvasNode from '../CanvasNode.vue'
    import ProvideElements from '../ProvideElements.vue'

    const props = defineProps<{ el: ComponentElement }>()

    const elRef = ref<HTMLElement | null>(null)

    const componentLibrary = inject<Record<string, Element>>('componentLibrary')!
    const elements = inject<Record<string, Element>>('elements')!

    // Resolve the definition from the library
    const definition = computed(() => componentLibrary[props.el.componentId] ?? null)

    // Merge instance props into the definition — never mutates the library
    const resolvedElements = computed(() => {
        if (!definition.value) return elements

        const merged: Element = {
            ...definition.value,
            // instance props overlay the definition's style
            style: { ...(definition.value.style as Record<string, unknown>), ...props.el.props },
            id: props.el.id,  // keep the instance id so CanvasNode resolves correctly
        }

        return { ...elements, [props.el.id]: merged }
    })

    useElementTriggers(elRef, props.el.interaction.triggers, props.el.id)
    useElementAnimations(elRef, props.el.interaction.animations, props.el.interaction.triggers, props.el.id)
</script>

<template>
    <!-- definition not found — render nothing in live, placeholder in authoring -->
    <div v-if="!definition" ref="elRef" :data-eid="el.id" data-component-missing="true"></div>

    <!--
        Provide the merged elements map scoped to this subtree.
        CanvasNode picks up the overridden map and renders the resolved definition.
    -->
    <div v-if="!definition" ref="elRef" :data-eid="el.id" data-component-missing="true"></div>
    <div v-else ref="elRef" :data-eid="el.id" style="display:contents">
        <ProvideElements :elements="resolvedElements">
            <CanvasNode :id="el.id" />
        </ProvideElements>
    </div>
</template>