<template>
    <div class="panel-root px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">Component Props</h3>
            <span class="badge">{{ definition?.name ?? 'Unknown' }}</span>
        </div>

        <div v-if="!definition" class="empty-note">
            Component definition not found in the library — this instance may reference a
            deleted or unsynced component.
        </div>

        <div v-else-if="!definition.props.length" class="empty-note">
            This component declares no props to override.
        </div>

        <div v-else class="flex flex-col gap-3">
            <div v-for="schema in definition.props" :key="schema.key" class="section">
                <label class="clab">
                    {{ schema.key }}
                    <span v-if="schema.required" class="required">*</span>
                </label>
                <p v-if="schema.description" class="hint">{{ schema.description }}</p>

                <input
                    v-if="schema.type === 'string' || schema.type === 'image'"
                    type="text"
                    class="w-full input"
                    :placeholder="schema.type === 'image' ? 'Image URL' : String(schema.defaultValue ?? '')"
                    :value="stringValue(schema)"
                    @change="setValue(schema, ($event.target as HTMLInputElement).value)"
                />

                <input
                    v-else-if="schema.type === 'number'"
                    type="number"
                    class="w-full input"
                    :placeholder="String(schema.defaultValue ?? '')"
                    :value="numberValue(schema)"
                    @change="setValue(schema, Number(($event.target as HTMLInputElement).value))"
                />

                <label v-else-if="schema.type === 'boolean'" class="checkbox">
                    <input
                        type="checkbox"
                        :checked="booleanValue(schema)"
                        @change="setValue(schema, ($event.target as HTMLInputElement).checked)"
                    />
                    Enabled
                </label>

                <button
                    v-else-if="schema.type === 'color'"
                    type="button"
                    class="color-swatch"
                    :style="{ background: stringValue(schema) || '#000000' }"
                    @click="pickColor(stringValue(schema) || '#000000', (v) => setValue(schema, v))"
                />

                <input
                    v-else
                    type="text"
                    class="w-full input"
                    placeholder="Any value (JSON or plain text)"
                    :value="anyValue(schema)"
                    @change="setAnyValue(schema, ($event.target as HTMLInputElement).value)"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed } from 'vue'
import { useActiveElement } from '../../../composables/useActiveElement'
import { useProjectMetadataStore, type ComponentPropSchema } from '../../../stores/projectMetadata'
import { parseLiteral } from '../../../utils/literalParser'
import { useNativeColorPicker } from '../../../composables/useNativeColorPicker'
import type { ComponentElement } from '../../../types/element'

const { element, update } = useActiveElement()
const project = useProjectMetadataStore()
const { pickColor } = useNativeColorPicker()

const componentElement = computed(() => element.value as ComponentElement | null)

const definition = computed(() => {
    const id = componentElement.value?.componentId
    return id ? project.componentLibrary[id] ?? null : null
})

const props = computed(() => componentElement.value?.props ?? {})

function rawValue(schema: ComponentPropSchema): unknown {
    return props.value[schema.key] ?? schema.defaultValue
}

function stringValue(schema: ComponentPropSchema): string {
    const v = rawValue(schema)
    return v === undefined || v === null ? '' : String(v)
}

function numberValue(schema: ComponentPropSchema): number | string {
    const v = rawValue(schema)
    return typeof v === 'number' ? v : ''
}

function booleanValue(schema: ComponentPropSchema): boolean {
    return !!rawValue(schema)
}

function anyValue(schema: ComponentPropSchema): string {
    const v = rawValue(schema)
    if (v === undefined || v === null) return ''
    if (typeof v === 'string') return v
    try {
        return JSON.stringify(v)
    } catch {
        return String(v)
    }
}

function setValue(schema: ComponentPropSchema, value: unknown) {
    update({ props: { [schema.key]: value } })
}

function setAnyValue(schema: ComponentPropSchema, raw: string) {
    if (!raw.trim().length) {
        setValue(schema, undefined)
        return
    }
    try {
        setValue(schema, parseLiteral(raw))
    } catch {
        setValue(schema, raw)
    }
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
.section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
.badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }
.section { display: flex; flex-direction: column; gap: 4px; }
.clab { font-size: 11px; color: #94a3b8; display: flex; gap: 4px; }
.required { color: #f87171; }
.hint { font-size: 10px; color: #64748b; margin: 0; }
.input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 8px; border-radius: 6px }
.checkbox { font-size: 12px; color: #cbd5e1; display: inline-flex; align-items: center; gap: 6px; }
.color-swatch { width: 40px; height: 28px; padding: 0; border: 1px solid #334155; border-radius: 6px; background: none; }
.empty-note { font-size: 12px; color: #64748b; }
</style>
