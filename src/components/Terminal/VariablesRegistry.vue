<script setup lang="ts" vapor>
    import { computed, ref, watch } from 'vue'
    import { useNotificationStore } from '../../stores/notification'
    import { usePagesStore } from '../../stores/pages'
    import { useProjectMetadataStore } from '../../stores/projectMetadata'
    import { useTerminalStore } from '../../stores/terminal'
    import { useVariableStore } from '../../stores/variables'
    import type { VariableDef, VariableType, VariableScope } from '../../types/variables'

    const variableStore = useVariableStore()
    const pages = usePagesStore()
    const project = useProjectMetadataStore()
    const terminal = useTerminalStore()
    const notifications = useNotificationStore()

    const variables = computed(() =>
        Object.values(variableStore.definitions ?? {}).sort((a, b) => a.name.localeCompare(b.name))
    )

    const activeFilter = ref<'all' | 'global' | 'local'>('all')
    const filteredVariables = computed(() => {
        if (activeFilter.value === 'global') return variables.value.filter(v => v.scope === 'global')
        if (activeFilter.value === 'local') return variables.value.filter(v => v.scope === 'page')
        return variables.value
    })

    const selectedName = ref<string | null>(variables.value[0]?.name ?? null)

    const selectedVariable = computed<VariableDef | null>(() =>
        selectedName.value ? (variableStore.definitions[selectedName.value] ?? null) : null
    )

    const editName = ref('')
    const editType = ref<VariableType>('string')
    const editScope = ref<VariableScope>('global')
    const editDefaultValue = ref('')
    const editResetOnBeforeMount = ref(false)
    const editResetOnMount = ref(false)
    const editResetOnBeforeUnmount = ref(false)
    const nameInputError = ref<string | null>(null)
    const valueInputError = ref<string | null>(null)

    const defaultValuePlaceholder = computed(() => {
        if (editType.value === 'list') return "Example: [1, 'two', true]"
        if (editType.value === 'object') return "Example: { count: 2, active: true }"
        return 'Enter value'
    })

    function toEditorString(value: unknown, type: VariableType): string {
        if (value === null || value === undefined) return ''
        if (type === 'list' || type === 'object') {
            try {
                return JSON.stringify(value, null, 2)
            } catch {
                return ''
            }
        }
        return String(value)
    }

    function parseJsExpression(raw: string): { ok: true; value: unknown } | { ok: false; reason: string } {
        try {
            // User-authored literals (e.g. { a: 1 }, ['x']) are supported intentionally.
            // eslint-disable-next-line no-new-func
            const value = Function(`"use strict"; return (${raw});`)()
            return { ok: true, value }
        } catch {
            return { ok: false, reason: 'Please use a valid value format.' }
        }
    }

    function parseByType(raw: string, type: VariableType): { ok: true; value: unknown } | { ok: false; reason: string } {
        const trimmed = raw.trim()

        if (type === 'string') {
            return { ok: true, value: raw }
        }

        if (type === 'number') {
            if (!trimmed.length) return { ok: false, reason: 'Number value is required.' }
            const n = Number(trimmed)
            if (!Number.isFinite(n)) return { ok: false, reason: 'Invalid number format.' }
            return { ok: true, value: n }
        }

        if (type === 'boolean') {
            const normalized = trimmed.toLowerCase()
            if (['true', '1', 'yes', 'on'].includes(normalized)) return { ok: true, value: true }
            if (['false', '0', 'no', 'off'].includes(normalized)) return { ok: true, value: false }
            return { ok: false, reason: 'Boolean must be true/false, yes/no, 1/0, or on/off.' }
        }

        if (type === 'list') {
            if (!trimmed.length) return { ok: true, value: [] }
            const parsed = parseJsExpression(trimmed)
            if (!parsed.ok) return { ok: false, reason: "List must be comma-separated values in square brackets, for example: ['red', 'green'] or [1, 2, 3]." }
            if (!Array.isArray(parsed.value)) return { ok: false, reason: "List must be comma-separated values in square brackets, for example: ['red', 'green'] or [1, 2, 3]." }
            return { ok: true, value: parsed.value }
        }

        if (!trimmed.length) return { ok: true, value: {} }
        const parsed = parseJsExpression(trimmed)
        if (!parsed.ok) return { ok: false, reason: "Object must be key/value pairs in curly braces, for example: { key: 'Value', published: true }." }
        if (typeof parsed.value !== 'object' || parsed.value === null || Array.isArray(parsed.value)) {
            return { ok: false, reason: "Object must be key/value pairs in curly braces, for example: { key: 'Value', published: true }." }
        }
        return { ok: true, value: parsed.value }
    }

    function hydrateEditor(variable: VariableDef | null) {
        if (!variable) {
            editName.value = ''
            editType.value = 'string'
            editScope.value = 'global'
            editDefaultValue.value = ''
            editResetOnBeforeMount.value = false
            editResetOnMount.value = false
            editResetOnBeforeUnmount.value = false
            nameInputError.value = null
            valueInputError.value = null
            return
        }

        editName.value = variable.name
        editType.value = variable.type
        editScope.value = variable.scope
        editDefaultValue.value = toEditorString(variable.defaultValue, variable.type)
        editResetOnBeforeMount.value = !!variable.resetOnBeforeMount
        editResetOnMount.value = !!variable.resetOnMount
        editResetOnBeforeUnmount.value = !!variable.resetOnBeforeUnmount
        nameInputError.value = null
        valueInputError.value = null
    }

    function onTypeChange() {
        if (!selectedVariable.value || !selectedName.value) return

        const parsed = parseByType(editDefaultValue.value, editType.value)
        if (!parsed.ok) {
            valueInputError.value = parsed.reason
            editDefaultValue.value = ''
            variableStore.updateVariable(selectedName.value, { type: editType.value, defaultValue: '' })
            return
        }

        valueInputError.value = null
        editDefaultValue.value = toEditorString(parsed.value, editType.value)
        variableStore.updateVariable(selectedName.value, { type: editType.value, defaultValue: parsed.value })
    }

    function applyNameLive() {
        if (!selectedVariable.value || !selectedName.value) return

        const nextName = editName.value.trim()
        if (!nextName.length) {
            nameInputError.value = 'Variable name cannot be empty.'
            return
        }
        if (nextName !== selectedName.value && variableStore.definitions[nextName]) {
            nameInputError.value = `Variable name "${nextName}" already exists.`
            return
        }

        nameInputError.value = null
        variableStore.updateVariable(selectedName.value, { name: nextName })
        selectedName.value = nextName
    }

    function normalizeNameOnBlur() {
        if (!selectedVariable.value) return
        if (!nameInputError.value) {
            editName.value = selectedVariable.value.name
            return
        }
        // Revert invalid input to current persisted live name.
        editName.value = selectedVariable.value.name
        nameInputError.value = null
    }

    function applyScopeLive() {
        if (!selectedVariable.value || !selectedName.value) return
        variableStore.updateVariable(selectedName.value, { scope: editScope.value })
        if (editScope.value === 'page' && pages.activePageId) {
            variableStore.initPageVars(pages.activePageId)
        }
    }

    function applyResetFlagsLive() {
        if (!selectedVariable.value || !selectedName.value) return
        variableStore.updateVariable(selectedName.value, {
            resetOnBeforeMount: editResetOnBeforeMount.value,
            resetOnMount: editResetOnMount.value,
            resetOnBeforeUnmount: editResetOnBeforeUnmount.value,
        })
    }

    function applyDefaultLive() {
        if (!selectedVariable.value || !selectedName.value) return

        const parsedDefault = parseByType(editDefaultValue.value, editType.value)
        if (!parsedDefault.ok) {
            valueInputError.value = parsedDefault.reason
            return
        }

        valueInputError.value = null
        variableStore.updateVariable(selectedName.value, { defaultValue: parsedDefault.value })
    }

    async function saveChanges() {
        if (!project.isProjectOpen) {
            const msg = 'Open a project before saving changes.'
            notifications.addNotification(msg, { type: 'warn', ttl: 3500 })
            terminal.warn(msg)
            return
        }

        if (nameInputError.value) {
            notifications.addNotification(nameInputError.value, { type: 'error', ttl: 4000 })
            terminal.error(nameInputError.value)
            return
        }

        if (valueInputError.value) {
            notifications.addNotification(valueInputError.value, { type: 'error', ttl: 4000 })
            terminal.error(valueInputError.value)
            return
        }

        try {
            await project.saveProject()
            notifications.addNotification('Changes saved to disk.', { type: 'info', ttl: 2600 })
            terminal.info('Variable changes saved to disk.')
        } catch (err: any) {
            const msg = `Failed to save changes: ${err?.message ?? err}`
            notifications.addNotification(msg, { type: 'error', ttl: 4500 })
            terminal.error(msg)
        }
    }

    function createVariable(): VariableDef {
        const created = variableStore.createVariable()
        selectedName.value = created.name
        return created
    }

    watch(
        variables,
        () => {
            if (selectedName.value === null) return
            if (selectedName.value && variableStore.definitions[selectedName.value]) return
            selectedName.value = variables.value[0]?.name ?? null
        },
        { immediate: true }
    )

    watch(
        selectedName,
        (name) => {
            terminal.setSelectedVariableName(name)
            hydrateEditor(name ? (variableStore.definitions[name] ?? null) : null)
        },
        { immediate: true }
    )

    defineExpose({ createVariable })
</script>

<template>
    <div class="variables-registry bg-slate-950">
        <div class="variables-details-wrap flex-1 relative overflow-hidden overflow-y-auto thin-scroll bg-slate-950">
            <div v-if="selectedVariable" class="variables-details">
                <div class="variables-details__grid">
                    <label class="variables-details__field">
                        <span>Name</span>
                        <input
                            v-model="editName"
                            class="variables-details__input"
                            type="text"
                            placeholder="variable_name"
                            @input="applyNameLive"
                            @blur="normalizeNameOnBlur"
                        />
                        <span v-if="nameInputError" class="variables-details__error">{{ nameInputError }}</span>
                    </label>

                    <label class="variables-details__field">
                        <span>Type</span>
                        <select v-model="editType" class="variables-details__input" @change="onTypeChange">
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="list">List</option>
                            <option value="object">Object</option>
                        </select>
                    </label>

                    <label class="variables-details__field">
                        <span>Scope</span>
                        <select v-model="editScope" class="variables-details__input" @change="applyScopeLive">
                            <option value="global">Global</option>
                            <option value="page">Local</option>
                        </select>
                    </label>
                </div>

                <label class="variables-details__field">
                    <span>Default Value</span>
                    <textarea
                        v-model="editDefaultValue"
                        class="variables-details__textarea"
                        :placeholder="defaultValuePlaceholder"
                        @input="applyDefaultLive"
                    ></textarea>
                    <span v-if="valueInputError" class="variables-details__error">{{ valueInputError }}</span>
                </label>

                <div class="variables-details__flags">
                    <label class="variables-details__check"><input v-model="editResetOnBeforeMount" type="checkbox" @change="applyResetFlagsLive" /> Reset before mount</label>
                    <label class="variables-details__check"><input v-model="editResetOnMount" type="checkbox" @change="applyResetFlagsLive" /> Reset on mount</label>
                    <label class="variables-details__check"><input v-model="editResetOnBeforeUnmount" type="checkbox" @change="applyResetFlagsLive" /> Reset before unmount</label>
                </div>

                <div class="variables-details__actions">
                    <button class="variables-details__btn variables-details__btn--primary" @click="saveChanges">
                        Save Changes
                    </button>
                </div>
            </div>

            <span v-else class="text-[13px] text-[#64748b] flex flex-col items-center justify-center h-full w-full">
                Create a variable to start wiring bindings and scripts.
            </span>
        </div>

        <aside class="variables-registry__list bg-slate-950">
            <div class="variables-registry__chips">
                <button
                    type="button"
                    class="variables-registry__chip"
                    :class="activeFilter === 'all' ? 'variables-registry__chip--active' : ''"
                    @click="activeFilter = 'all'"
                >All</button>
                <button
                    type="button"
                    class="variables-registry__chip"
                    :class="activeFilter === 'global' ? 'variables-registry__chip--active' : ''"
                    @click="activeFilter = 'global'"
                >Global</button>
                <button
                    type="button"
                    class="variables-registry__chip"
                    :class="activeFilter === 'local' ? 'variables-registry__chip--active' : ''"
                    @click="activeFilter = 'local'"
                >Local</button>
            </div>

            <div v-if="filteredVariables.length" class="variables-registry__items variables-registry__items--segment">
                <button
                    v-for="variable in filteredVariables"
                    :key="variable.id"
                    type="button"
                    class="variable-item group"
                    :class="{ 'variable-item--active': variable.name === selectedName }"
                    @click="selectedName = selectedName === variable.name ? null : variable.name"
                >
                    <span class="variable-item__label">{{ variable.name }}</span>
                    <span class="variable-item__meta capitalize">{{ variable.type }} · {{ variable.scope === 'global' ? 'global' : 'local' }}</span>
                </button>
            </div>

            <div v-if="!filteredVariables.length" class="variables-registry__empty-panel">
                No variables yet.
            </div>

            <div v-else class="variables-registry__items"></div>
        </aside>
    </div>
</template>

<style scoped>
    .variables-registry {
        display: flex;
        height: 100%;
        overflow: hidden;
        color: #e2e8f0;
    }

    .variables-registry__list {
        width: 240px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-left: 1px solid #1f2937;
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

    .variables-registry__items--segment {
        flex: 0 0 auto;
        max-height: 40%;
    }

    .variables-registry__chips {
        display: flex;
        gap: 6px;
        padding: 8px;
        border-bottom: 1px solid #1f2937;
    }

    .variables-registry__chip {
        border: 1px solid #334155;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.75);
        color: #cbd5e1;
        font-size: 11px;
        padding: 3px 10px;
        cursor: pointer;
    }

    .variables-registry__chip:hover {
        border-color: #38bdf8;
    }

    .variables-registry__chip--active {
        color: #f8fafc;
        border-color: #0ea5e9;
        background: rgba(14, 165, 233, 0.2);
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
        font-size: 13px;
        font-weight: 600;
    }

    .variable-item__meta {
        font-size: 12px;
        color: #94a3b8;
    }

    .variable-item__close {
        margin-left: auto;
        align-self: flex-end;
    }

    .variables-registry__details {
        flex: 1;
        overflow: hidden;
        position: relative;
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
        padding: 10px 12px;
    }

    .variables-details {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        max-width: 760px;
        padding: 16px;
        margin: 0 auto;
    }

    .variables-details__grid {
        display: grid;
        grid-template-columns: 1fr 180px 160px;
        gap: 10px;
    }

    .variables-details__field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: #94a3b8;
    }

    .variables-details__input,
    .variables-details__textarea {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid #334155;
        border-radius: 8px;
        color: #e2e8f0;
        padding: 8px 10px;
        font-size: 13px;
        outline: none;
    }

    .variables-details__input:focus,
    .variables-details__textarea:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }

    .variables-details__textarea {
        min-height: 88px;
        resize: vertical;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }

    .variables-details__flags {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 13px;
        color: #cbd5e1;
    }

    .variables-details__check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .variables-details__divider {
        height: 1px;
        background: #1f2937;
        margin: 2px 0;
    }

    .variables-details__hint {
        color: #94a3b8;
        font-size: 12px;
        margin: 0;
    }

    .variables-details__error {
        color: #f87171;
        font-size: 11px;
    }

    .variables-details__actions {
        display: flex;
        gap: 8px;
    }

    .variables-details__btn {
        border: 1px solid #334155;
        background: rgba(15, 23, 42, 0.85);
        color: #e2e8f0;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
    }

    .variables-details__btn:hover {
        border-color: #38bdf8;
        background: rgba(56, 189, 248, 0.15);
    }

    .variables-details__btn--primary {
        border-color: #0284c7;
        background: rgba(2, 132, 199, 0.2);
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