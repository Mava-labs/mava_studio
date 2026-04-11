<script setup lang="ts" vapor>
    /**
     * EditorOverlay.vue
     *
     * Absolutely positioned layer that sits over the canvas stage.
     * Renders the selection ring and hover ring without touching
     * the canvas DOM — invisible to outerHTML export.
     */
    import { computed } from 'vue'
    import { useEditorSelection } from '../composables/useEditorSelection'
    import { useSelectionRect } from '../composables/useSelectionRect'

    const props = defineProps<{
        stageRef: HTMLElement | null
    }>()

    const stageRefRef = computed(() => props.stageRef)
    const { selectedId, hoveredId } = useEditorSelection()
    const { selectionRect } = useSelectionRect(selectedId, stageRefRef as any)
</script>

<template>
    <div class="editor-overlay">

        <!-- Hover ring -->
        <transition name="ring-fade">
            <div v-if="hoveredId && hoveredId !== selectedId" class="ring ring--hover"
                :style="{ /* positioned by HoverRing below */ }" />
        </transition>

        <!-- Selection ring -->
        <transition name="ring-fade">
            <div v-if="selectionRect" class="ring ring--selected" :style="{
                top: selectionRect.top + 'px',
                left: selectionRect.left + 'px',
                width: selectionRect.width + 'px',
                height: selectionRect.height + 'px',
            }" />
        </transition>

    </div>
</template>

<style scoped>
    .editor-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        /* overlay never blocks canvas interaction */
        z-index: 100;
    }

    .ring {
        position: absolute;
        pointer-events: none;
        box-sizing: border-box;
    }

    .ring--selected {
        outline: 2px solid #3b82f6;
        outline-offset: 1px;
    }

    .ring--hover {
        outline: 1px solid #93c5fd;
        outline-offset: 1px;
    }

    .ring-fade-enter-active,
    .ring-fade-leave-active {
        transition: opacity 0.1s ease;
    }

    .ring-fade-enter-from,
    .ring-fade-leave-to {
        opacity: 0;
    }
</style>