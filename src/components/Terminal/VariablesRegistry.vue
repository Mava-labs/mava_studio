<script setup lang="ts" vapor>
    import { computed, ref, watch } from 'vue'
    import { useNotificationStore } from '../../stores/notification'
    import { usePagesStore } from '../../stores/pages'
    import { useProjectMetadataStore } from '../../stores/projectMetadata'
    import { useTerminalStore } from '../../stores/terminal'
    import { useVariableStore } from '../../stores/variables'
    import { parseLiteral } from '../../utils/literalParser'
    import { validateDslIdentifierName } from '../../utils/Trigger/identifierName'
    import type { VariableDef, VariableType, VariableScope, ListItemType, ListItemField } from '../../types/variables'

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

    // Only meaningful when editType === 'list' — see types/variables.ts's
    // ListItemType/ListItemField doc comments for why this stays flat
    // (no list-of-lists, no nested object fields).
    const editItemType = ref<ListItemType>('string')
    const editItemShape = ref<ListItemField[]>([])
    const itemFieldNameErrors = ref<Record<number, string | null>>({})

    /**
     * Default Value for a list-type variable, structured — replaces the raw
     * JS-literal-syntax textarea ("[1, 'two', true]") with a friendly
     * "+ Add item" editor once a list has a declared item shape (Phase
     * 3.62). Not a technical-syntax box: primitive items get one input per
     * item; object items get one labeled input per declared field.
     */
    const editListItems = ref<unknown[]>([])
    let listItemEditBefore: string | null = null

    function defaultValueForFieldType(type: ListItemField['type']): unknown {
        if (type === 'number') return 0
        if (type === 'boolean') return false
        return ''
    }

    function defaultValueForItemType(type: ListItemType): unknown {
        if (type === 'object') {
            const obj: Record<string, unknown> = {}
            for (const field of editItemShape.value) obj[field.name] = defaultValueForFieldType(field.type)
            return obj
        }
        return defaultValueForFieldType(type)
    }

    /** Reads a field's current value off an item, falling back to that field's type default if missing (e.g. the field was added after this item was created). */
    function itemFieldValue(item: unknown, field: ListItemField): unknown {
        const value = (item as Record<string, unknown> | null | undefined)?.[field.name]
        return value ?? defaultValueForFieldType(field.type)
    }

    function commitListItems(label: string, before: string) {
        if (!selectedName.value) return
        variableStore.updateVariable(selectedName.value, { defaultValue: editListItems.value })
        pushVariablesUndo(label, before)
    }

    function addListItem() {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        editListItems.value = [...editListItems.value, defaultValueForItemType(editItemType.value)]
        commitListItems(`Add item to ${selectedName.value}`, before)
    }

    function removeListItem(index: number) {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        editListItems.value = editListItems.value.filter((_, i) => i !== index)
        commitListItems(`Remove item from ${selectedName.value}`, before)
    }

    /** Immediate commit — for checkbox items/fields, a single discrete action, same as the rest of this panel's checkboxes. */
    function setListItemBoolean(index: number, value: boolean, fieldName?: string) {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        editListItems.value = editListItems.value.map((item, i) => {
            if (i !== index) return item
            if (fieldName) return { ...(item as Record<string, unknown>), [fieldName]: value }
            return value
        })
        commitListItems(`Edit item in ${selectedName.value}`, before)
    }

    /** Text/number items and fields: live-typing buffer, committed on blur (commitListItemEdit) — same focus-then-blur pattern as every other text field in this panel, to avoid one undo entry per keystroke. */
    function onListItemFocus() {
        if (listItemEditBefore === null) listItemEditBefore = snapshotVariables()
    }

    function setListItemValueLive(index: number, value: unknown, fieldName?: string) {
        if (listItemEditBefore === null) listItemEditBefore = snapshotVariables()
        editListItems.value = editListItems.value.map((item, i) => {
            if (i !== index) return item
            if (fieldName) return { ...(item as Record<string, unknown>), [fieldName]: value }
            return value
        })
    }

    function commitListItemEdit() {
        if (!selectedVariable.value || !selectedName.value) return
        if (listItemEditBefore === null) return
        commitListItems(`Edit item in ${selectedName.value}`, listItemEditBefore)
        listItemEditBefore = null
    }

    /**
     * Default Value for an object-type variable, structured — same friendly
     * replacement for raw JS-literal syntax ("{ count: 2, active: true }") as
     * lists got, per your ask. Unlike a list-of-objects (where the shape is
     * declared once and shared across many items), a single object needs no
     * separate shape step: there's only one instance, so key + type + value
     * live together on one row. The keys/types are stored implicitly in the
     * plain object itself (defaultValue); type is re-inferred from each
     * value's runtime type on load.
     */
    interface EditObjectProp { key: string; type: ListItemField['type']; value: unknown }
    const editObjectProps = ref<EditObjectProp[]>([])
    const objectKeyErrors = ref<Record<number, string | null>>({})
    let objectPropEditBefore: string | null = null

    function inferPrimitiveType(value: unknown): ListItemField['type'] {
        if (typeof value === 'number') return 'number'
        if (typeof value === 'boolean') return 'boolean'
        return 'string'
    }

    function objectFromProps(): Record<string, unknown> {
        const obj: Record<string, unknown> = {}
        for (const prop of editObjectProps.value) {
            const key = prop.key.trim()
            if (key) obj[key] = prop.value
        }
        return obj
    }

    function commitObjectProps(label: string, before: string) {
        if (!selectedName.value) return
        variableStore.updateVariable(selectedName.value, { defaultValue: objectFromProps() })
        pushVariablesUndo(label, before)
    }

    function addObjectProp() {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        const index = editObjectProps.value.length + 1
        editObjectProps.value = [...editObjectProps.value, { key: `property_${index}`, type: 'string', value: '' }]
        commitObjectProps(`Add property to ${selectedName.value}`, before)
    }

    function removeObjectProp(index: number) {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        editObjectProps.value = editObjectProps.value.filter((_, i) => i !== index)
        const { [index]: _removed, ...rest } = objectKeyErrors.value
        objectKeyErrors.value = rest
        commitObjectProps(`Remove property from ${selectedName.value}`, before)
    }

    function updateObjectKeyLive(index: number, value: string) {
        editObjectProps.value = editObjectProps.value.map((p, i) => i === index ? { ...p, key: value } : p)
    }

    function commitObjectKey(index: number) {
        if (!selectedVariable.value || !selectedName.value) return
        const prop = editObjectProps.value[index]
        if (!prop) return

        const trimmed = prop.key.trim()
        const shapeError = validateDslIdentifierName(trimmed)
        const duplicate = !shapeError && editObjectProps.value.some((p, i) => i !== index && p.key === trimmed)
        const error = shapeError ?? (duplicate ? `Property "${trimmed}" already exists.` : null)

        if (error) {
            objectKeyErrors.value = { ...objectKeyErrors.value, [index]: error }
            return
        }

        objectKeyErrors.value = { ...objectKeyErrors.value, [index]: null }
        const before = snapshotVariables()
        editObjectProps.value = editObjectProps.value.map((p, i) => i === index ? { ...p, key: trimmed } : p)
        commitObjectProps(`Rename property in ${selectedName.value}`, before)
    }

    function updateObjectPropType(index: number, type: ListItemField['type']) {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        // Changing type also resets the value to that type's default — a
        // string "abc" left sitting in a now-number property would be
        // meaningless, same "reset rather than coerce" call as elsewhere.
        editObjectProps.value = editObjectProps.value.map((p, i) =>
            i === index ? { ...p, type, value: defaultValueForFieldType(type) } : p)
        commitObjectProps(`Change property type in ${selectedName.value}`, before)
    }

    function setObjectPropBoolean(index: number, value: boolean) {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        editObjectProps.value = editObjectProps.value.map((p, i) => i === index ? { ...p, value } : p)
        commitObjectProps(`Edit property in ${selectedName.value}`, before)
    }

    function onObjectPropFocus() {
        if (objectPropEditBefore === null) objectPropEditBefore = snapshotVariables()
    }

    function setObjectPropValueLive(index: number, value: unknown) {
        if (objectPropEditBefore === null) objectPropEditBefore = snapshotVariables()
        editObjectProps.value = editObjectProps.value.map((p, i) => i === index ? { ...p, value } : p)
    }

    function commitObjectPropEdit() {
        if (!selectedVariable.value || !selectedName.value) return
        if (objectPropEditBefore === null) return
        commitObjectProps(`Edit property in ${selectedName.value}`, objectPropEditBefore)
        objectPropEditBefore = null
    }

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
            const value = parseLiteral(raw)
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

    /**
     * Undo/dirty-tracking for the variables scope. Variable edits used to be
     * invisible to autosave/undo entirely — only the manual Save button
     * persisted them. Text fields (name, default value) fire their live-apply
     * handler on every keystroke, so we don't push one undo entry per
     * keystroke: `beforeEditSnapshot` is captured once on focus and the entry
     * is only pushed on blur, diffed against the value at commit time.
     */
    function snapshotVariables(): string {
        return JSON.stringify(variableStore.definitions)
    }

    function pushVariablesUndo(label: string, before: string) {
        const after = snapshotVariables()
        if (before === after) return
        project.pushUndo({ label, scope: { kind: 'variables' }, before, after })
    }

    let nameEditBefore: string | null = null
    let defaultValueEditBefore: string | null = null

    function hydrateEditor(variable: VariableDef | null) {
        if (!variable) {
            editName.value = ''
            editType.value = 'string'
            editScope.value = 'global'
            editDefaultValue.value = ''
            editResetOnBeforeMount.value = false
            editResetOnMount.value = false
            editResetOnBeforeUnmount.value = false
            editItemType.value = 'string'
            editItemShape.value = []
            editListItems.value = []
            editObjectProps.value = []
            nameInputError.value = null
            valueInputError.value = null
            itemFieldNameErrors.value = {}
            objectKeyErrors.value = {}
            return
        }

        editName.value = variable.name
        editType.value = variable.type
        editScope.value = variable.scope
        editDefaultValue.value = toEditorString(variable.defaultValue, variable.type)
        editResetOnBeforeMount.value = !!variable.resetOnBeforeMount
        editResetOnMount.value = !!variable.resetOnMount
        editResetOnBeforeUnmount.value = !!variable.resetOnBeforeUnmount
        editItemType.value = variable.itemType ?? 'string'
        // Cloned, not aliased — edits happen in this local buffer and are
        // only pushed to the store on explicit commit (see
        // updateItemFieldNameLive/commitItemFieldName below), same reasoning
        // as name/default-value's focus-then-blur-commit pattern.
        editItemShape.value = (variable.itemShape ?? []).map(f => ({ ...f }))
        editListItems.value = variable.type === 'list' && Array.isArray(variable.defaultValue)
            ? (variable.defaultValue as unknown[]).map(item =>
                typeof item === 'object' && item !== null ? { ...(item as Record<string, unknown>) } : item)
            : []
        editObjectProps.value = variable.type === 'object'
            && typeof variable.defaultValue === 'object'
            && variable.defaultValue !== null
            && !Array.isArray(variable.defaultValue)
            ? Object.entries(variable.defaultValue as Record<string, unknown>).map(([key, value]) =>
                ({ key, type: inferPrimitiveType(value), value }))
            : []
        nameInputError.value = null
        valueInputError.value = null
        itemFieldNameErrors.value = {}
        objectKeyErrors.value = {}
    }

    /** Item-shape fields to persist alongside a `type` change — cleared entirely when leaving 'list', shape cleared (but item type kept) when leaving 'object' within a list. */
    function itemShapeFieldsFor(type: VariableType): Pick<VariableDef, 'itemType' | 'itemShape'> {
        if (type !== 'list') return { itemType: undefined, itemShape: undefined }
        return {
            itemType: editItemType.value,
            itemShape: editItemType.value === 'object' ? editItemShape.value : undefined,
        }
    }

    function onTypeChange() {
        if (!selectedVariable.value || !selectedName.value) return

        const before = snapshotVariables()
        const itemFields = itemShapeFieldsFor(editType.value)

        if (editType.value === 'list' || editType.value === 'object') {
            // Switching into list/object editing hands off from the raw-text
            // Default Value textarea to the structured editor below
            // (editListItems / editObjectProps) — start empty rather than
            // trying to reinterpret whatever text was in the textarea for
            // the previous type.
            editListItems.value = []
            editObjectProps.value = []
            valueInputError.value = null
            variableStore.updateVariable(selectedName.value, {
                type: editType.value,
                defaultValue: editType.value === 'list' ? [] : {},
                ...itemFields,
            })
            pushVariablesUndo(`Change type of ${selectedName.value}`, before)
            return
        }

        const parsed = parseByType(editDefaultValue.value, editType.value)
        if (!parsed.ok) {
            valueInputError.value = parsed.reason
            editDefaultValue.value = ''
            variableStore.updateVariable(selectedName.value, { type: editType.value, defaultValue: '', ...itemFields })
            pushVariablesUndo(`Change type of ${selectedName.value}`, before)
            return
        }

        valueInputError.value = null
        editDefaultValue.value = toEditorString(parsed.value, editType.value)
        variableStore.updateVariable(selectedName.value, { type: editType.value, defaultValue: parsed.value, ...itemFields })
        pushVariablesUndo(`Change type of ${selectedName.value}`, before)
    }

    function onItemTypeChange() {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        if (editItemType.value !== 'object') {
            editItemShape.value = []
            itemFieldNameErrors.value = {}
        }
        // Existing items were shaped for the previous item type (e.g.
        // strings, now switching to objects) — reset rather than trying to
        // coerce stale-shaped data silently.
        editListItems.value = []
        variableStore.updateVariable(selectedName.value, {
            ...itemShapeFieldsFor(editType.value),
            defaultValue: [],
        })
        pushVariablesUndo(`Change item type of ${selectedName.value}`, before)
    }

    function addItemShapeField() {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        const index = editItemShape.value.length + 1
        editItemShape.value = [...editItemShape.value, { name: `field_${index}`, type: 'string' }]
        variableStore.updateVariable(selectedName.value, { itemShape: editItemShape.value })
        pushVariablesUndo(`Add field to ${selectedName.value}`, before)
    }

    function removeItemShapeField(index: number) {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        editItemShape.value = editItemShape.value.filter((_, i) => i !== index)
        const { [index]: _removed, ...rest } = itemFieldNameErrors.value
        itemFieldNameErrors.value = rest
        variableStore.updateVariable(selectedName.value, { itemShape: editItemShape.value })
        pushVariablesUndo(`Remove field from ${selectedName.value}`, before)
    }

    function updateItemFieldNameLive(index: number, value: string) {
        const field = editItemShape.value[index]
        if (!field) return
        editItemShape.value = editItemShape.value.map((f, i) => i === index ? { ...f, name: value } : f)
    }

    function commitItemFieldName(index: number) {
        if (!selectedVariable.value || !selectedName.value) return
        const field = editItemShape.value[index]
        if (!field) return

        const trimmed = field.name.trim()
        const shapeError = validateDslIdentifierName(trimmed)
        const duplicate = !shapeError && editItemShape.value.some((f, i) => i !== index && f.name === trimmed)
        const error = shapeError ?? (duplicate ? `Field "${trimmed}" already exists.` : null)

        if (error) {
            itemFieldNameErrors.value = { ...itemFieldNameErrors.value, [index]: error }
            return
        }

        itemFieldNameErrors.value = { ...itemFieldNameErrors.value, [index]: null }
        const before = snapshotVariables()
        editItemShape.value = editItemShape.value.map((f, i) => i === index ? { ...f, name: trimmed } : f)
        variableStore.updateVariable(selectedName.value, { itemShape: editItemShape.value })
        pushVariablesUndo(`Rename field in ${selectedName.value}`, before)
    }

    function updateItemFieldType(index: number, type: ListItemField['type']) {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        editItemShape.value = editItemShape.value.map((f, i) => i === index ? { ...f, type } : f)
        variableStore.updateVariable(selectedName.value, { itemShape: editItemShape.value })
        pushVariablesUndo(`Change field type in ${selectedName.value}`, before)
    }

    function onNameFocus() {
        if (nameEditBefore === null) nameEditBefore = snapshotVariables()
    }

    function applyNameLive() {
        if (!selectedVariable.value || !selectedName.value) return
        if (nameEditBefore === null) nameEditBefore = snapshotVariables()

        const nextName = editName.value.trim()
        // Variables are referenced from DSL/script code as a bare
        // identifier (`attempts > 3`, `on variable.change attempts`) — the
        // name itself must already be shaped like one, not just non-empty.
        // See identifierName.ts's header comment for why this is enforced
        // here instead of resolved-around the way element/page names are.
        const shapeError = validateDslIdentifierName(nextName)
        if (shapeError) {
            nameInputError.value = shapeError
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
        } else {
            // Revert invalid input to current persisted live name.
            editName.value = selectedVariable.value.name
            nameInputError.value = null
        }

        if (nameEditBefore !== null) {
            pushVariablesUndo(`Rename variable`, nameEditBefore)
            nameEditBefore = null
        }
    }

    function applyScopeLive() {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        variableStore.updateVariable(selectedName.value, { scope: editScope.value })
        if (editScope.value === 'page' && pages.activePageId) {
            variableStore.initPageVars(pages.activePageId)
        }
        pushVariablesUndo(`Change scope of ${selectedName.value}`, before)
    }

    function applyResetFlagsLive() {
        if (!selectedVariable.value || !selectedName.value) return
        const before = snapshotVariables()
        variableStore.updateVariable(selectedName.value, {
            resetOnBeforeMount: editResetOnBeforeMount.value,
            resetOnMount: editResetOnMount.value,
            resetOnBeforeUnmount: editResetOnBeforeUnmount.value,
        })
        pushVariablesUndo(`Change reset hooks of ${selectedName.value}`, before)
    }

    function onDefaultValueFocus() {
        if (defaultValueEditBefore === null) defaultValueEditBefore = snapshotVariables()
    }

    function applyDefaultLive() {
        if (!selectedVariable.value || !selectedName.value) return
        if (defaultValueEditBefore === null) defaultValueEditBefore = snapshotVariables()

        const parsedDefault = parseByType(editDefaultValue.value, editType.value)
        if (!parsedDefault.ok) {
            valueInputError.value = parsedDefault.reason
            return
        }

        valueInputError.value = null
        variableStore.updateVariable(selectedName.value, { defaultValue: parsedDefault.value })
    }

    function onDefaultValueBlur() {
        if (defaultValueEditBefore !== null) {
            pushVariablesUndo(`Change default value of ${selectedName.value ?? 'variable'}`, defaultValueEditBefore)
            defaultValueEditBefore = null
        }
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
        const before = snapshotVariables()
        const created = variableStore.createVariable()
        selectedName.value = created.name
        pushVariablesUndo(`Create variable ${created.name}`, before)
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
                            @focus="onNameFocus"
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

                <div v-if="editType === 'list'" class="variables-details__itemtype">
                    <label class="variables-details__field">
                        <span>Item Type</span>
                        <select v-model="editItemType" class="variables-details__input" @change="onItemTypeChange">
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="object">Object</option>
                        </select>
                    </label>

                    <div v-if="editItemType === 'object'" class="variables-details__shape">
                        <div class="variables-details__shape-head">
                            <span>Item Fields</span>
                            <button type="button" class="variables-details__shape-add" @click="addItemShapeField">+ Add field</button>
                        </div>

                        <p v-if="!editItemShape.length" class="variables-details__shape-empty">
                            No fields yet — add one for each piece of data an item has (e.g. "title", "price").
                        </p>

                        <div v-for="(field, index) in editItemShape" :key="index" class="variables-details__shape-row">
                            <input
                                class="variables-details__input variables-details__shape-name"
                                :value="field.name"
                                type="text"
                                placeholder="field_name"
                                @input="updateItemFieldNameLive(index, ($event.target as HTMLInputElement).value)"
                                @blur="commitItemFieldName(index)"
                            />
                            <select
                                class="variables-details__input variables-details__shape-type"
                                :value="field.type"
                                @change="updateItemFieldType(index, ($event.target as HTMLSelectElement).value as 'string' | 'number' | 'boolean')"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                            </select>
                            <button type="button" class="variables-details__shape-remove" title="Remove field" @click="removeItemShapeField(index)">✕</button>
                            <span v-if="itemFieldNameErrors[index]" class="variables-details__error variables-details__shape-error">{{ itemFieldNameErrors[index] }}</span>
                        </div>
                    </div>
                </div>

                <div v-if="editType === 'list'" class="variables-details__field">
                    <span>Default Items</span>

                    <div class="variables-details__listitems">
                        <p v-if="!editListItems.length" class="variables-details__shape-empty">
                            No items yet.
                        </p>

                        <div v-for="(item, index) in editListItems" :key="index" class="variables-details__listitem">
                            <template v-if="editItemType !== 'object'">
                                <input
                                    v-if="editItemType === 'string'"
                                    class="variables-details__input variables-details__listitem-value"
                                    type="text"
                                    :value="item as string"
                                    @focus="onListItemFocus"
                                    @input="setListItemValueLive(index, ($event.target as HTMLInputElement).value)"
                                    @blur="commitListItemEdit"
                                />
                                <input
                                    v-else-if="editItemType === 'number'"
                                    class="variables-details__input variables-details__listitem-value"
                                    type="number"
                                    :value="item as number"
                                    @focus="onListItemFocus"
                                    @input="setListItemValueLive(index, Number(($event.target as HTMLInputElement).value) || 0)"
                                    @blur="commitListItemEdit"
                                />
                                <label v-else class="variables-details__check variables-details__listitem-value">
                                    <input
                                        type="checkbox"
                                        :checked="item as boolean"
                                        @change="setListItemBoolean(index, ($event.target as HTMLInputElement).checked)"
                                    /> {{ item ? 'true' : 'false' }}
                                </label>
                            </template>

                            <div v-else class="variables-details__listitem-fields">
                                <label v-for="field in editItemShape" :key="field.name" class="variables-details__listitem-field">
                                    <span>{{ field.name }}</span>
                                    <input
                                        v-if="field.type === 'string'"
                                        class="variables-details__input"
                                        type="text"
                                        :value="itemFieldValue(item, field) as string"
                                        @focus="onListItemFocus"
                                        @input="setListItemValueLive(index, ($event.target as HTMLInputElement).value, field.name)"
                                        @blur="commitListItemEdit"
                                    />
                                    <input
                                        v-else-if="field.type === 'number'"
                                        class="variables-details__input"
                                        type="number"
                                        :value="itemFieldValue(item, field) as number"
                                        @focus="onListItemFocus"
                                        @input="setListItemValueLive(index, Number(($event.target as HTMLInputElement).value) || 0, field.name)"
                                        @blur="commitListItemEdit"
                                    />
                                    <label v-else class="variables-details__check">
                                        <input
                                            type="checkbox"
                                            :checked="!!itemFieldValue(item, field)"
                                            @change="setListItemBoolean(index, ($event.target as HTMLInputElement).checked, field.name)"
                                        />
                                    </label>
                                </label>
                            </div>

                            <button type="button" class="variables-details__shape-remove" title="Remove item" @click="removeListItem(index)">✕</button>
                        </div>
                    </div>

                    <button type="button" class="variables-details__shape-add" @click="addListItem">+ Add item</button>
                </div>

                <div v-else-if="editType === 'object'" class="variables-details__field">
                    <span>Default Properties</span>

                    <div class="variables-details__listitems">
                        <p v-if="!editObjectProps.length" class="variables-details__shape-empty">
                            No properties yet — add a key/value pair for each piece of data (e.g. "count", "active").
                        </p>

                        <div v-for="(prop, index) in editObjectProps" :key="index" class="variables-details__objectprop">
                            <input
                                class="variables-details__input variables-details__shape-name"
                                :value="prop.key"
                                type="text"
                                placeholder="property_name"
                                @input="updateObjectKeyLive(index, ($event.target as HTMLInputElement).value)"
                                @blur="commitObjectKey(index)"
                            />
                            <select
                                class="variables-details__input variables-details__shape-type"
                                :value="prop.type"
                                @change="updateObjectPropType(index, ($event.target as HTMLSelectElement).value as 'string' | 'number' | 'boolean')"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                            </select>
                            <input
                                v-if="prop.type === 'string'"
                                class="variables-details__input variables-details__objectprop-value"
                                type="text"
                                placeholder="value"
                                :value="prop.value as string"
                                @focus="onObjectPropFocus"
                                @input="setObjectPropValueLive(index, ($event.target as HTMLInputElement).value)"
                                @blur="commitObjectPropEdit"
                            />
                            <input
                                v-else-if="prop.type === 'number'"
                                class="variables-details__input variables-details__objectprop-value"
                                type="number"
                                :value="prop.value as number"
                                @focus="onObjectPropFocus"
                                @input="setObjectPropValueLive(index, Number(($event.target as HTMLInputElement).value) || 0)"
                                @blur="commitObjectPropEdit"
                            />
                            <label v-else class="variables-details__check variables-details__objectprop-value">
                                <input
                                    type="checkbox"
                                    :checked="prop.value as boolean"
                                    @change="setObjectPropBoolean(index, ($event.target as HTMLInputElement).checked)"
                                /> {{ prop.value ? 'true' : 'false' }}
                            </label>
                            <button type="button" class="variables-details__shape-remove" title="Remove property" @click="removeObjectProp(index)">✕</button>
                            <span v-if="objectKeyErrors[index]" class="variables-details__error variables-details__shape-error">{{ objectKeyErrors[index] }}</span>
                        </div>
                    </div>

                    <button type="button" class="variables-details__shape-add" @click="addObjectProp">+ Add property</button>
                </div>

                <label v-else class="variables-details__field">
                    <span>Default Value</span>
                    <textarea
                        v-model="editDefaultValue"
                        class="variables-details__textarea"
                        :placeholder="defaultValuePlaceholder"
                        @focus="onDefaultValueFocus"
                        @input="applyDefaultLive"
                        @blur="onDefaultValueBlur"
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

            <div v-if="filteredVariables.length" class="variables-registry__items">
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

            <div v-else class="variables-registry__empty-panel">
                No variables yet.
            </div>
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
        /* Was a rigid 1fr/180px/160px — Type/Scope don't need that much room
           ("String"/"Global" are short), and fixed px columns don't shrink,
           so a narrower terminal panel pushed the row into overflow instead
           of adapting. auto-fit + minmax lets columns shrink down to their
           minimum, then wrap Type/Scope onto their own row below Name only
           once there's truly no room left — no horizontal overflow either
           way, and the parent (.variables-details-wrap) already scrolls
           vertically if that row-wrap makes the form taller. */
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

    .variables-details__itemtype {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid #1f2937;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.5);
    }

    .variables-details__shape {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .variables-details__shape-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #64748b;
    }

    .variables-details__shape-add {
        font-size: 11px;
        color: #38bdf8;
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 4px;
    }

    .variables-details__shape-add:hover {
        text-decoration: underline;
    }

    .variables-details__shape-empty {
        font-size: 12px;
        color: #64748b;
        margin: 0;
    }

    .variables-details__shape-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .variables-details__shape-name {
        flex: 1;
        min-width: 100px;
    }

    .variables-details__shape-type {
        flex: 0 0 110px;
    }

    .variables-details__shape-remove {
        flex-shrink: 0;
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        font-size: 12px;
        padding: 2px 6px;
    }

    .variables-details__shape-remove:hover {
        color: #f87171;
    }

    .variables-details__shape-error {
        flex-basis: 100%;
    }

    .variables-details__listitems {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .variables-details__listitem {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px;
        border: 1px solid #1f2937;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.4);
    }

    .variables-details__listitem-value {
        flex: 1;
        min-width: 0;
    }

    .variables-details__listitem-fields {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
    }

    .variables-details__listitem-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 11px;
        color: #94a3b8;
    }

    .variables-details__objectprop {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        padding: 8px;
        border: 1px solid #1f2937;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.4);
    }

    .variables-details__objectprop-value {
        flex: 1;
        min-width: 90px;
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