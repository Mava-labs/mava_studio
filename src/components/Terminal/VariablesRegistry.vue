<script setup lang="ts" vapor>
    import { computed, ref, watch } from 'vue'
    import { useVariableStore } from '../../stores/variables'
    import type { VariableDef } from '../../types/variables'

    const variableStore = useVariableStore()

    const variables = computed(() =>
        Object.values(variableStore.definitions ?? {}).sort((a, b) => a.name.localeCompare(b.name))
    )

    const selectedName = ref<string | null>(variables.value[0]?.name ?? null)

    const selectedVariable = computed<VariableDef | null>(() =>
        selectedName.value ? (variableStore.definitions[selectedName.value] ?? null) : null
    )

    function createVariable(): VariableDef {
        const created = variableStore.createVariable()
        selectedName.value = created.name
        return created
    }

    function removeVariable(name: string) {
        variableStore.deleteVariable(name)
        selectedName.value = variables.value.find(variable => variable.name !== name)?.name ?? null
    }

    watch(
        variables,
        () => {
            if (selectedName.value && variableStore.definitions[selectedName.value]) return
            selectedName.value = variables.value[0]?.name ?? null
        },
        { immediate: true }
    )

    defineExpose({ createVariable })
</script>

<template>
    <div class="variables-registry">
        <aside class="variables-registry__list">
            <div class="variables-registry__header">
                <span>Variables</span>
            </div>

            <div v-if="variables.length" class="variables-registry__items">
                <button
                    v-for="variable in variables"
                    :key="variable.id"
                    type="button"
                    class="variable-item group"
                    :class="{ 'variable-item--active': variable.name === selectedName }"
                    @click="selectedName = variable.name"
                >
                    <span class="variable-item__label">{{ variable.name }}</span>
                    <span class="variable-item__meta">{{ variable.type }} · {{ variable.scope }}</span>
                    <span
                        class="icon-btn icon-btn--danger variable-item__close"
                        :class="variable.name === selectedName ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                        role="button"
                        tabindex="0"
                        @click.stop="removeVariable(variable.name)"
                    >
                        ×
                    </span>
                </button>
            </div>

            <div v-else class="variables-registry__empty">
                No variables yet.
            </div>
        </aside>

        <section class="variables-registry__details">
            <div v-if="selectedVariable" class="variables-registry__card">
                <p class="variables-registry__title">{{ selectedVariable.name }}</p>
                <p class="variables-registry__text">Type: {{ selectedVariable.type }}</p>
                <p class="variables-registry__text">Scope: {{ selectedVariable.scope }}</p>
                <p class="variables-registry__text">Default: {{ String(selectedVariable.defaultValue ?? '') }}</p>
            </div>

            <div v-else class="variables-registry__empty-panel">
                Create a variable to start wiring bindings and scripts.
            </div>
        </section>
    </div>
</template>

<style scoped>
    .variables-registry {
        display: flex;
        height: 100%;
        overflow: hidden;
        color: #e2e8f0;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98));
    }

    .variables-registry__list {
        width: 240px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #1f2937;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
    }

    .variables-registry__header {
        padding: 8px 12px;
        border-bottom: 1px solid #1f2937;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #94a3b8;
    }

    .variables-registry__items {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 4px 0;
    }

    .variable-item {
        width: calc(100% - 8px);
        margin: 1px 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-start;
        padding: 8px 12px;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        background: transparent;
        color: inherit;
        text-align: left;
        transition: background-color 120ms ease, color 120ms ease;
    }

    .variable-item:hover {
        background: rgba(148, 163, 184, 0.12);
    }

    .variable-item--active {
        background: rgba(14, 165, 233, 0.18);
        color: #f8fafc;
    }

    .variable-item__label {
        font-size: 12px;
        font-weight: 600;
    }

    .variable-item__meta {
        font-size: 11px;
        color: #94a3b8;
    }

    .variable-item__close {
        margin-left: auto;
        align-self: flex-end;
    }

    .variables-registry__details {
        flex: 1;
        min-width: 0;
        position: relative;
        padding: 16px;
    }

    .variables-registry__card {
        max-width: 420px;
        padding: 16px;
        border: 1px solid rgba(51, 65, 85, 0.9);
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
    }

    .variables-registry__title {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 700;
        color: #f8fafc;
    }

    .variables-registry__text {
        margin: 4px 0;
        font-size: 13px;
        color: #cbd5e1;
    }

    .variables-registry__empty,
    .variables-registry__empty-panel {
        color: #64748b;
        font-size: 13px;
        padding: 12px;
    }

    .icon-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 14px;
        transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease;
    }

    .icon-btn:hover {
        background: rgba(148, 163, 184, 0.14);
    }

    .icon-btn--danger:hover {
        color: #f87171;
    }
</style>