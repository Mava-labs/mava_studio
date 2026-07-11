<script setup lang="ts" vapor>
    /**
     * ComponentSchemaPanel.vue — component-level prop *schema* editor, shown in
     * the right panel when a component is being edited on the canvas and nothing
     * is selected (the component-level analogue of Page Settings). Declares the
     * props a component exposes; a definition element then binds a field to a
     * prop (BindingsPanel's "Prop ·" source), and each instance overrides the
     * value (ComponentPropsPanel).
     */
    import { computed } from 'vue'
    import { usePagesStore } from '../../../stores/pages'
    import { useProjectMetadataStore } from '../../../stores/projectMetadata'
    import { validateDslIdentifierName } from '../../../utils/Trigger/identifierName'
    import type { ComponentPropSchema } from '../../../types/project'

    const pages = usePagesStore()
    const project = useProjectMetadataStore()

    const componentId = computed(() => pages.activePageId)
    const def = computed(() =>
        componentId.value ? project.componentLibrary[componentId.value] ?? null : null
    )
    const props = computed<ComponentPropSchema[]>(() => (def.value?.props ?? []) as ComponentPropSchema[])

    const PROP_TYPES: ComponentPropSchema['type'][] = ['string', 'number', 'boolean', 'color', 'image', 'any']

    function commit(next: ComponentPropSchema[]) {
        if (!componentId.value) return
        project.updateComponent(componentId.value, { props: next })
    }

    function addProp() {
        const index = props.value.length + 1
        commit([...props.value, { key: `prop_${index}`, type: 'string', defaultValue: '' }])
    }

    function removeProp(i: number) {
        commit(props.value.filter((_, idx) => idx !== i))
    }

    function renameProp(i: number, key: string) {
        const trimmed = key.trim()
        if (validateDslIdentifierName(trimmed)) return          // invalid identifier — ignore
        if (props.value.some((p, idx) => idx !== i && p.key === trimmed)) return // duplicate — ignore
        commit(props.value.map((p, idx) => idx === i ? { ...p, key: trimmed } : p))
    }

    function retypeProp(i: number, type: ComponentPropSchema['type']) {
        // Reset default to something sensible for the new type.
        const defaultValue = type === 'number' ? 0 : type === 'boolean' ? false : ''
        commit(props.value.map((p, idx) => idx === i ? { ...p, type, defaultValue } : p))
    }

    function setDefault(i: number, value: unknown) {
        commit(props.value.map((p, idx) => idx === i ? { ...p, defaultValue: value } : p))
    }

    function setRequired(i: number, required: boolean) {
        commit(props.value.map((p, idx) => idx === i ? { ...p, required } : p))
    }
</script>

<template>
    <div class="schema-panel px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">Component Props</h3>
            <span class="badge">{{ def?.name ?? 'Component' }}</span>
        </div>

        <p class="hint mb-3">
            Props are the knobs each instance can set. Declare one here, then bind a definition
            element's field to it (Bindings → "Prop ·") so it reads the instance's value.
        </p>

        <p v-if="!props.length" class="empty-note">No props yet.</p>

        <div v-else class="flex flex-col gap-3">
            <div v-for="(prop, i) in props" :key="i" class="prop-row">
                <div class="prop-row__top">
                    <input
                        class="input prop-row__key"
                        type="text"
                        :value="prop.key"
                        placeholder="prop_name"
                        @change="renameProp(i, ($event.target as HTMLInputElement).value)"
                    />
                    <select
                        class="input prop-row__type"
                        :value="prop.type"
                        @change="retypeProp(i, ($event.target as HTMLSelectElement).value as ComponentPropSchema['type'])"
                    >
                        <option v-for="t in PROP_TYPES" :key="t" :value="t">{{ t }}</option>
                    </select>
                    <button type="button" class="prop-row__remove" title="Remove prop" @click="removeProp(i)">✕</button>
                </div>

                <div class="prop-row__bottom">
                    <label class="prop-row__default">
                        <span>default</span>
                        <input
                            v-if="prop.type === 'number'"
                            class="input"
                            type="number"
                            :value="prop.defaultValue as number"
                            @change="setDefault(i, Number(($event.target as HTMLInputElement).value) || 0)"
                        />
                        <label v-else-if="prop.type === 'boolean'" class="prop-row__bool">
                            <input
                                type="checkbox"
                                :checked="!!prop.defaultValue"
                                @change="setDefault(i, ($event.target as HTMLInputElement).checked)"
                            /> {{ prop.defaultValue ? 'true' : 'false' }}
                        </label>
                        <input
                            v-else
                            class="input"
                            type="text"
                            :value="prop.defaultValue as string"
                            @change="setDefault(i, ($event.target as HTMLInputElement).value)"
                        />
                    </label>
                    <label class="prop-row__req">
                        <input
                            type="checkbox"
                            :checked="!!prop.required"
                            @change="setRequired(i, ($event.target as HTMLInputElement).checked)"
                        /> required
                    </label>
                </div>
            </div>
        </div>

        <button type="button" class="add-btn mt-2" @click="addProp">+ Add prop</button>
    </div>
</template>

<style scoped>
    .schema-panel { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
    .section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    .section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; }
    .hint { font-size: 11px; color: #64748b; line-height: 1.5; }
    .empty-note { font-size: 12px; color: #64748b; }
    .input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 8px; border-radius: 6px; min-width: 0; }
    .prop-row { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid #1f2937; border-radius: 8px; background: rgba(15, 23, 42, 0.4); }
    .prop-row__top { display: flex; align-items: center; gap: 6px; }
    .prop-row__key { flex: 1; }
    .prop-row__type { flex: 0 0 96px; }
    .prop-row__remove { flex-shrink: 0; background: none; border: none; color: #64748b; cursor: pointer; font-size: 12px; padding: 2px 6px; }
    .prop-row__remove:hover { color: #f87171; }
    .prop-row__bottom { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .prop-row__default { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #94a3b8; flex: 1; min-width: 120px; }
    .prop-row__default .input { flex: 1; }
    .prop-row__bool, .prop-row__req { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #cbd5e1; }
    .add-btn { font-size: 11px; color: #38bdf8; background: none; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
    .add-btn:hover { border-color: #38bdf8; }
</style>
