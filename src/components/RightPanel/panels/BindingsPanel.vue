<template>
    <div class="panel-root px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">Bindings</h3>
            <span class="badge">Variables</span>
        </div>

        <p v-if="!hasVariables" class="empty-note">
            No variables defined yet — create one in the Variables tab first.
        </p>

        <template v-else>
            <!-- Repeat: a container renders one copy of its children per list item -->
            <div v-if="element?.kind === 'container'" class="repeat-block">
                <div class="group-head">
                    <span class="group-title">Repeat</span>
                </div>
                <p v-if="!listVariables.length" class="empty-note">
                    No list variables — create one to repeat this container's children per item.
                </p>
                <select
                    v-else
                    class="input"
                    :value="repeatVariable"
                    @change="setRepeat(($event.target as HTMLSelectElement).value)"
                >
                    <option value="">Don't repeat</option>
                    <option v-for="def in listVariables" :key="def.name" :value="def.name">
                        {{ def.name }} ({{ def.itemType ?? 'string' }} items{{ def.scope === 'page' ? ', local' : '' }})
                    </option>
                </select>
                <p v-if="repeatVariable" class="hint">
                    This container's children are a template, rendered once per item (in Preview).
                    Bind a child's fields to <span class="twoway-inline">Current item</span> below.
                </p>
            </div>

            <p v-if="!visibleGroups.length" class="empty-note">
                This element has no bindable fields yet.
            </p>

            <div v-else class="flex flex-col gap-4">
            <div v-for="group in visibleGroups" :key="group" class="group-block">
                <div class="group-head">
                    <span class="group-title">{{ groupLabels[group] }}</span>
                    <button
                        v-if="fieldsForGroup(group).length"
                        type="button"
                        class="add-btn"
                        @click="addingGroup === group ? cancelAdding() : startAdding(group)"
                    >{{ addingGroup === group ? 'Cancel' : '+ Add' }}</button>
                </div>

                <div v-for="row in rowsForGroup(group)" :key="row.path" class="row">
                    <span class="row-label">{{ row.label }}</span>
                    <select
                        class="input"
                        :value="pickerValue(row.binding)"
                        @change="changeVariable(row.path, ($event.target as HTMLSelectElement).value)"
                    >
                        <optgroup v-for="g in sourceGroups(row.targetType)" :key="g.label" :label="g.label">
                            <option v-for="opt in g.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </optgroup>
                    </select>
                    <label
                        v-if="row.twoWayCapable && !row.binding.item && !row.binding.prop"
                        class="twoway"
                        :class="{ 'twoway--on': !!row.binding.twoWay }"
                        title="Two-way: also write this control's value back into the variable"
                    >
                        <input
                            type="checkbox"
                            :checked="!!row.binding.twoWay"
                            @change="toggleTwoWay(row.path, row.targetType, row.binding.variable, ($event.target as HTMLInputElement).checked)"
                        />
                        ⇄
                    </label>
                    <button type="button" class="unbind-btn" title="Remove binding" @click="removeBinding(row.path)">✕</button>
                </div>

                <div v-if="addingGroup === group" class="row row--adding">
                    <select class="input" v-model="pendingPath">
                        <option value="" disabled>Choose a field…</option>
                        <option v-for="f in fieldsForGroup(group)" :key="f.path" :value="f.path">{{ f.label }}</option>
                    </select>
                    <select v-if="pendingField" class="input" @change="commitBinding(($event.target as HTMLSelectElement).value)">
                        <option value="" disabled selected>Choose a source…</option>
                        <optgroup v-for="g in sourceGroups(pendingField.targetType)" :key="g.label" :label="g.label">
                            <option v-for="opt in g.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </optgroup>
                    </select>
                </div>
            </div>
            </div>
        </template>

        <p class="hint mt-3">
            Bindings are one-way (variable → element) by default. For a control's Value/Checked
            field, toggle <span class="twoway-inline">⇄</span> to make it two-way — the control
            writes its value back into the variable as the user edits it (in Preview).
        </p>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed, ref } from 'vue'
import { useActiveElement } from '../../../composables/useActiveElement'
import { useVariableStore } from '../../../stores/variables'
import { useProjectMetadataStore } from '../../../stores/projectMetadata'
import { usePagesStore } from '../../../stores/pages'
import { REPEAT_BINDING_PATH, type VariableType, type TransformFn, type VariableDef } from '../../../types/variables'
import type { ComponentElement } from '../../../types/element'

/**
 * Authoring UI for the binding engine wired into resolver.ts in Phase 3.12/3.14.
 * The field catalog below is gated on the selected element's actual kind/type/
 * component-prop-schema, rather than showing a fixed set of fields on every
 * element — a "+ Add" per group reveals only the fields that element actually
 * supports and aren't already bound. Three groups: Style (layout/style/effects
 * fields resolver.ts merges), Native Props (HTML attributes), and Component
 * Props (only for component instances, sourced from ComponentDefinition.props).
 */

const { element, update } = useActiveElement()
const variableStore = useVariableStore()
const project = useProjectMetadataStore()
const pages = usePagesStore()

// ── Repeat: bind a list variable to a container's children ────────────────────

const listVariables = computed(() => Object.values(variableStore.definitions).filter(d => d.type === 'list'))

const repeatVariable = computed(() =>
    element.value?.kind === 'container'
        ? (element.value.bindings?.[REPEAT_BINDING_PATH]?.variable ?? '')
        : ''
)

function setRepeat(variableName: string) {
    if (!variableName) {
        update({ bindings: { [REPEAT_BINDING_PATH]: undefined } })
        return
    }
    update({ bindings: { [REPEAT_BINDING_PATH]: { variable: variableName } } })
}

/**
 * The nearest ancestor container that repeats a list, if any — walked up the
 * parentId chain through the active page. When set, this element is inside a
 * repeat instance, so its bindings can reference the current item (and its
 * fields, for an object-item list) as a source.
 */
const repeatContext = computed<{ listDef: VariableDef } | null>(() => {
    let current = element.value
    // Guard against a malformed cycle rather than looping forever.
    for (let hops = 0; current?.parentId && hops < 100; hops++) {
        const parent = pages.getElementById(current.parentId)
        if (!parent) break
        if (parent.kind === 'container') {
            const listVar = parent.bindings?.[REPEAT_BINDING_PATH]?.variable
            const listDef = listVar ? variableStore.definitions[listVar] : undefined
            if (listDef && listDef.type === 'list') return { listDef }
        }
        current = parent
    }
    return null
})

/**
 * Item-source options for a field's picker, gated on the field's targetType
 * the same way real variables are. Value encoding: `__item__` for the whole
 * (primitive) item, `__item__.fieldName` for an object item's field —
 * decoded in applyBinding.
 */
function itemSourceOptions(targetType: TargetType): { value: string; label: string }[] {
    const ctx = repeatContext.value
    if (!ctx) return []
    const { itemType, itemShape } = ctx.listDef

    if (itemType === 'object') {
        return (itemShape ?? [])
            .filter(f => f.type === targetType || autoTransform(f.type, targetType) !== undefined)
            .map(f => ({ value: `__item__.${f.name}`, label: `Item · ${f.name}` }))
    }

    // Primitive item — the whole item value. Only offer it if its own type is
    // compatible with the field (undefined itemType → treat as string).
    const primitiveType = (itemType ?? 'string') as TargetType
    if (primitiveType === targetType || autoTransform(primitiveType, targetType) !== undefined) {
        return [{ value: '__item__', label: 'Current item' }]
    }
    return []
}

const ITEM_PREFIX = '__item__'
const PROP_PREFIX = '__prop__'

/** Props of the component currently being edited on the canvas — a definition element can bind a field to one. */
const componentProps = computed(() => {
    if (!pages.isComponentSurface(pages.activePageId)) return []
    const def = project.componentLibrary[pages.activePageId ?? '']
    return def?.props ?? []
})

function propTargetType(t: string): TargetType {
    return t === 'number' ? 'number' : t === 'boolean' ? 'boolean' : 'string'
}

function propSourceOptions(targetType: TargetType): { value: string; label: string }[] {
    return componentProps.value
        .filter(p => {
            const pt = propTargetType(p.type)
            return pt === targetType || autoTransform(pt, targetType) !== undefined
        })
        .map(p => ({ value: `${PROP_PREFIX}.${p.key}`, label: `Prop · ${p.key}` }))
}

/** All binding sources for a field, grouped for the picker: repeat item, component prop, then variables. */
function sourceGroups(targetType: TargetType): { label: string; options: { value: string; label: string }[] }[] {
    const groups: { label: string; options: { value: string; label: string }[] }[] = []
    const items = itemSourceOptions(targetType)
    if (items.length) groups.push({ label: 'Repeat item', options: items })
    const props = propSourceOptions(targetType)
    if (props.length) groups.push({ label: 'Component prop', options: props })
    groups.push({
        label: 'Variables',
        options: compatibleVariables(targetType).map(d => ({
            value: d.name,
            label: `${d.name} (${d.type}${d.scope === 'page' ? ', local' : ''})`,
        })),
    })
    return groups
}

/** The picker's current value for a bound row — encodes item/prop bindings back into the same option-value space as variables. */
function pickerValue(binding: { variable: string; item?: boolean; itemField?: string; prop?: string }): string {
    if (binding.item) return binding.itemField ? `${ITEM_PREFIX}.${binding.itemField}` : ITEM_PREFIX
    if (binding.prop) return `${PROP_PREFIX}.${binding.prop}`
    return binding.variable
}

type TargetType = 'string' | 'number' | 'boolean'
type BindGroup = 'style' | 'attributes' | 'component'

interface BindableField {
    path: string
    label: string
    targetType: TargetType
    group: BindGroup
    /** The control's live value can be written back to the variable (input → variable). */
    twoWayCapable?: boolean
}

const groupLabels: Record<BindGroup, string> = {
    style: 'Style',
    attributes: 'Native Props',
    component: 'Component Props',
}

const componentDef = computed(() => {
    const el = element.value
    if (!el || el.kind !== 'component') return null
    return project.componentLibrary[(el as ComponentElement).componentId] ?? null
})

/** Only fields resolveElementBindings() (resolver.ts) actually consumes — layout/style/effects/attributes/props. */
const catalog = computed<BindableField[]>(() => {
    const el = element.value
    if (!el) return []

    const fields: BindableField[] = [
        { path: 'layout.visible', label: 'Visible', targetType: 'boolean', group: 'style' },
        { path: 'effects.opacity', label: 'Opacity', targetType: 'number', group: 'style' },
    ]

    if (el.kind === 'flatHtml' && (el.type === 'text' || el.type === 'label' || el.type === 'button')) {
        fields.push(
            { path: 'style.content', label: 'Text Content', targetType: 'string', group: 'style' },
            { path: 'style.color', label: 'Text Color', targetType: 'string', group: 'style' },
        )
    }
    if (el.kind === 'container' || el.type === 'button') {
        fields.push({ path: 'style.background', label: 'Background Color', targetType: 'string', group: 'style' })
    }
    if (el.kind === 'svg') {
        fields.push({ path: 'style.fill', label: 'Fill Color', targetType: 'string', group: 'style' })
    }

    if (el.kind === 'flatHtml' && el.type === 'image') {
        fields.push(
            { path: 'attributes.src', label: 'Source URL', targetType: 'string', group: 'attributes' },
            { path: 'attributes.alt', label: 'Alt Text', targetType: 'string', group: 'attributes' },
        )
    }
    if (el.kind === 'flatHtml' && (el.type === 'video' || el.type === 'audio')) {
        fields.push({ path: 'attributes.src', label: 'Source URL', targetType: 'string', group: 'attributes' })
    }
    if (el.kind === 'flatHtml' && (el.type === 'textinput' || el.type === 'textarea' || el.type === 'select')) {
        fields.push(
            { path: 'attributes.value', label: 'Value', targetType: 'string', group: 'attributes', twoWayCapable: true },
            { path: 'attributes.placeholder', label: 'Placeholder', targetType: 'string', group: 'attributes' },
            { path: 'attributes.disabled', label: 'Disabled', targetType: 'boolean', group: 'attributes' },
            { path: 'attributes.required', label: 'Required', targetType: 'boolean', group: 'attributes' },
        )
    }
    if (el.kind === 'flatHtml' && (el.type === 'checkbox' || el.type === 'radio')) {
        fields.push(
            { path: 'attributes.checked', label: 'Checked', targetType: 'boolean', group: 'attributes', twoWayCapable: true },
            { path: 'attributes.disabled', label: 'Disabled', targetType: 'boolean', group: 'attributes' },
            { path: 'attributes.required', label: 'Required', targetType: 'boolean', group: 'attributes' },
        )
    }

    if (componentDef.value) {
        for (const schema of componentDef.value.props) {
            const targetType: TargetType = schema.type === 'number' ? 'number' : schema.type === 'boolean' ? 'boolean' : 'string'
            fields.push({ path: `props.${schema.key}`, label: schema.key, targetType, group: 'component' })
        }
    }

    return fields
})

/** Derived directly from types/variables.ts's TRANSFORM_COMPATIBILITY matrix. */
function autoTransform(varType: VariableType, targetType: TargetType): TransformFn | undefined {
    if (varType === targetType) return undefined
    if (targetType === 'string' && (varType === 'number' || varType === 'boolean')) return 'toString'
    if (targetType === 'number' && varType === 'string') return 'toNumber'
    if (targetType === 'boolean' && (varType === 'string' || varType === 'number')) return 'toBoolean'
    return undefined
}

function compatibleVariables(targetType: TargetType) {
    return Object.values(variableStore.definitions).filter(
        def => def.type === targetType || autoTransform(def.type, targetType) !== undefined
    )
}

const hasVariables = computed(() => Object.keys(variableStore.definitions).length > 0)

function inferGroup(path: string): BindGroup {
    if (path.startsWith('attributes.')) return 'attributes'
    if (path.startsWith('props.')) return 'component'
    return 'style'
}

const boundRows = computed(() => {
    const bindings = element.value?.bindings ?? {}
    return Object.entries(bindings)
        // The repeat declaration is shown in the dedicated Repeat control
        // above, not as a property-binding row.
        .filter(([path]) => path !== REPEAT_BINDING_PATH)
        .map(([path, binding]) => {
            const catalogEntry = catalog.value.find(f => f.path === path)
            return {
                path,
                binding,
                label: catalogEntry?.label ?? path,
                targetType: catalogEntry?.targetType ?? ('string' as TargetType),
                group: catalogEntry?.group ?? inferGroup(path),
                twoWayCapable: catalogEntry?.twoWayCapable ?? false,
            }
        })
})

function rowsForGroup(group: BindGroup) {
    return boundRows.value.filter(r => r.group === group)
}

function fieldsForGroup(group: BindGroup) {
    const bound = new Set(Object.keys(element.value?.bindings ?? {}))
    return catalog.value.filter(f => f.group === group && !bound.has(f.path))
}

const visibleGroups = computed<BindGroup[]>(() =>
    (['style', 'attributes', 'component'] as BindGroup[]).filter(
        g => rowsForGroup(g).length || fieldsForGroup(g).length
    )
)

const addingGroup = ref<BindGroup | null>(null)
const pendingPath = ref('')

const pendingField = computed(() => catalog.value.find(f => f.path === pendingPath.value) ?? null)

function startAdding(group: BindGroup) {
    addingGroup.value = group
    pendingPath.value = ''
}

function cancelAdding() {
    addingGroup.value = null
    pendingPath.value = ''
}

function applyBinding(path: string, targetType: TargetType, source: string, twoWay = false) {
    // Repeat item source (`__item__` / `__item__.field`) — a read-only
    // binding against the current repeat item, never two-way (there's no
    // persistent target to write back to).
    if (source === ITEM_PREFIX || source.startsWith(`${ITEM_PREFIX}.`)) {
        const itemField = source.length > ITEM_PREFIX.length ? source.slice(ITEM_PREFIX.length + 1) : undefined
        update({ bindings: { [path]: { variable: '', item: true, itemField } } })
        return
    }

    // Component prop source (`__prop__.key`) — a read-only binding against the
    // enclosing component instance's prop value.
    if (source.startsWith(`${PROP_PREFIX}.`)) {
        update({ bindings: { [path]: { variable: '', prop: source.slice(PROP_PREFIX.length + 1) } } })
        return
    }

    const def = variableStore.definitions[source]
    if (!def) return
    const transform = autoTransform(def.type, targetType)
    update({
        bindings: {
            [path]: {
                variable: source,
                // Only stamp twoWay when on — leaving it undefined keeps
                // one-way bindings' shape unchanged. The write transform is
                // the same fn name as read; applyWriteTransform (bindings.ts)
                // inverts it by the variable's type at write time.
                twoWay: twoWay || undefined,
                transform: transform ? { read: transform, write: twoWay ? transform : undefined } : undefined,
            },
        },
    })
}

/** Flip an existing binding between one-way and two-way, preserving its variable + auto-transform. */
function toggleTwoWay(path: string, targetType: TargetType, variableName: string, on: boolean) {
    applyBinding(path, targetType, variableName, on)
}

function commitBinding(variableName: string) {
    if (!pendingField.value || !variableName) return
    applyBinding(pendingField.value.path, pendingField.value.targetType, variableName)
    cancelAdding()
}

function changeVariable(path: string, variableName: string) {
    if (!variableName) {
        update({ bindings: { [path]: undefined } })
        return
    }
    const entry = catalog.value.find(f => f.path === path)
    applyBinding(path, entry?.targetType ?? 'string', variableName)
}

function removeBinding(path: string) {
    update({ bindings: { [path]: undefined } })
}
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
.section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
.badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }
.group-block { display: flex; flex-direction: column; gap: 6px; }
.repeat-block { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #1e293b; }
.group-head { display: flex; align-items: center; justify-content: space-between; }
.group-title { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; }
.add-btn { font-size: 11px; color: #38bdf8; background: none; border: none; cursor: pointer; padding: 2px 4px; }
.add-btn:hover { text-decoration: underline; }
.row { display: flex; align-items: center; gap: 6px; }
.row--adding { padding-top: 2px; }
.row-label { font-size: 11px; color: #94a3b8; flex: 0 0 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* min-width: 0 is load-bearing here — a <select>'s content (e.g. a long
   "variable_name (string)" option) otherwise refuses to shrink below its own
   intrinsic width in a flex row, which pushed the two-way toggle and remove
   button completely out of the visible row in a narrow panel instead of just
   truncating the select's own text. */
.input { flex: 1; min-width: 0; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 8px; border-radius: 6px; text-overflow: ellipsis; }
.unbind-btn { flex-shrink: 0; background: none; border: none; color: #64748b; cursor: pointer; font-size: 12px; padding: 2px 6px; }
.unbind-btn:hover { color: #f87171; }
.twoway { flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px; font-size: 13px; color: #475569; cursor: pointer; user-select: none; }
.twoway input { margin: 0; }
.twoway--on { color: #38bdf8; }
.twoway-inline { color: #38bdf8; }
.empty-note { font-size: 12px; color: #64748b; }
.hint { font-size: 11px; color: #64748b; }
</style>
