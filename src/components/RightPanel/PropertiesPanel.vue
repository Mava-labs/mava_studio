<template>
    <div class="panel-root flex-1 min-h-0 relative overflow-y-auto thin-scroll overflow-x-hidden flex flex-col gap-4 pb-3">
        <div v-if="element" class="element-header px-3">
            <label class="clab">Name</label>
            <input
                class="w-full input"
                type="text"
                :value="element.name"
                @change="renameElement(($event.target as HTMLInputElement).value)"
            />
        </div>

        <div v-if="!element" class="empty-state">
            Select an element to edit its properties.
        </div>

        <template v-else>
            <ComponentPropsPanel v-if="showComponentProps" />
            <FormPanel v-if="showForm" />
            <MediaPanel v-if="showMedia" />
            <BindingsPanel />
        </template>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed } from 'vue';
    import { useActiveElement } from '../../composables/useActiveElement';

    import ComponentPropsPanel from './panels/ComponentPropsPanel.vue';
    import FormPanel from './panels/FormPanel.vue';
    import MediaPanel from './panels/MediaPanel.vue';
    import BindingsPanel from './panels/BindingsPanel.vue';

    const { element, update } = useActiveElement();

    const INPUT_TYPES = new Set(['textinput', 'textarea', 'select', 'checkbox', 'radio']);
    const MEDIA_TYPES = new Set(['video', 'audio', 'image']);

    const showComponentProps = computed(() => element.value?.kind === 'component');
    const showForm = computed(() => !!element.value && INPUT_TYPES.has(element.value.type));
    const showMedia = computed(() => !!element.value && MEDIA_TYPES.has(element.value.type));

    function renameElement(next: string) {
        const trimmed = next.trim();
        if (!trimmed.length) return;
        update({ name: trimmed });
    }
</script>

<style scoped>
    .panel-root {
        font-family: system-ui, sans-serif;
        font-size: 12px;
        color: #e2e8f0;
    }

    .element-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-bottom: 8px;
        border-bottom: 1px solid #1e293b;
    }

    .clab {
        font-size: 11px;
        color: #94a3b8;
    }

    .input {
        background: #0f172a;
        border: 1px solid #334155;
        color: #e2e8f0;
        padding: 6px 8px;
        border-radius: 6px;
    }

    .empty-state {
        padding: 0 12px;
        color: #64748b;
        font-size: 13px;
    }
</style>
