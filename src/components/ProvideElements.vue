<script lang="ts">
    import { provide, PropType, defineVaporComponent } from 'vue'
    import type { Element } from '../types/element'

    export default defineVaporComponent({
        name: 'ProvideElements',
        props: {
            elements: {
                type: Object as PropType<Record<string, Element>>,
                required: true
            }
        },
        setup(props) {
            provide('elements', props.elements)
            // return state only — no render function
        }
    })
</script>

<template>
    <slot />
</template>