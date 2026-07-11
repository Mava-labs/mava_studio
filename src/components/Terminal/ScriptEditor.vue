<script setup lang="ts" vapor>
    import { computed, ref, useTemplateRef, watch } from 'vue'
    import { useMonaco } from '../../composables/useMonaco'
    import { useProjectMetadataStore } from '../../stores/projectMetadata'
    import { useTerminalStore } from '../../stores/terminal'
    import { useVariableStore } from '../../stores/variables'
    import { compileAndStore } from '../../utils/scripts/compiler'
    import { reregisterScript } from '../../utils/scripts/runner'
    import { generateMavaTypeLib } from '../../utils/scripts/mavaTypes'
    import { validateDslIdentifierName } from '../../utils/Trigger/identifierName'
    import type { ScriptDef } from '../../types/project'

    const project = useProjectMetadataStore()
    const terminal = useTerminalStore()
    const variableStore = useVariableStore()

    const scripts = computed(() => Object.values(project.actionScripts ?? {}))
    const selectedId = computed(() => terminal.selectedScriptId)
    const selectedScript = computed<ScriptDef | null>(() =>
        selectedId.value ? project.actionScripts[selectedId.value] ?? null : null
    )

    const containerRef = useTemplateRef('containerRef')
    const isSaving = ref(false)
    const { isReady, getMonaco } = useMonaco(containerRef, selectedScript, {
        onChange(value) {
            if (!selectedScript.value) return
            project.upsertScript({
                ...selectedScript.value,
                codeTs: value,
            })
        },

        async onSave(value) {
            if (!selectedScript.value) return
            isSaving.value = true
            terminal.info(`Compiling "${selectedScript.value.name}"...`)

            const nextScript: ScriptDef = {
                ...selectedScript.value,
                codeTs: value,
            }

            const ok = await compileAndStore(nextScript)
            project.upsertScript(nextScript)

            if (ok) {
                reregisterScript(nextScript)
                terminal.info(`"${nextScript.name}" compiled successfully.`)
            }

            isSaving.value = false
        }
    })

    // Keep the `mava` variable types in sync with the project's variables, so
    // the editor autocompletes each author-defined variable by name and by its
    // real type (including list/object shapes). Re-injected on editor-ready and
    // whenever any definition changes.
    watch(
        [isReady, () => variableStore.definitions],
        () => {
            if (!isReady.value) return
            const monaco = getMonaco()
            if (!monaco) return
            monaco.typescript.typescriptDefaults.addExtraLib(
                generateMavaTypeLib(variableStore.definitions as Record<string, import('../../types/variables').VariableDef>),
                'file:///mava-vars.d.ts',
            )
        },
        { immediate: true, deep: true },
    )

    // ── Rename ────────────────────────────────────────────────────────────────
    // Scripts are referenced from cues as `execute <name>` (a bare identifier),
    // so a name is validated the same way variables are. Renaming re-registers
    // the run handler under the new name; any `execute <oldName>` cue is left
    // dangling and will surface as an E003 in that cue until updated.
    const editName = ref('')
    const nameError = ref<string | null>(null)

    watch(
        () => selectedScript.value?.id,
        () => {
            editName.value = selectedScript.value?.name ?? ''
            nameError.value = null
        },
        { immediate: true },
    )

    function applyScriptNameLive() {
        const s = selectedScript.value
        if (!s) return
        const next = editName.value.trim()

        const shapeErr = validateDslIdentifierName(next)
        if (shapeErr) { nameError.value = shapeErr; return }

        const dup = Object.values(project.actionScripts ?? {}).some(o => o.id !== s.id && o.name === next)
        if (dup) { nameError.value = `A script named "${next}" already exists.`; return }

        nameError.value = null
        if (next === s.name) return
        const renamed: ScriptDef = { ...s, name: next }
        project.upsertScript(renamed)
        reregisterScript(renamed)
    }

    function normalizeScriptNameOnBlur() {
        if (selectedScript.value && nameError.value) {
            editName.value = selectedScript.value.name
            nameError.value = null
        }
    }
</script>

<template>
    <div class="script-editor bg-slate-950">
        <div class="editor-area bg-slate-950">
            <div v-if="!selectedScript" class="editor-empty absolute top-0 left-0 right-0 bg-slate-950 z-30">
                No script selected. Create one to get started.
            </div>

            <div v-if="selectedScript" class="script-header">
                <input
                    v-model="editName"
                    class="script-name-input"
                    type="text"
                    spellcheck="false"
                    placeholder="script_name"
                    @input="applyScriptNameLive"
                    @blur="normalizeScriptNameOnBlur"
                />
                <span v-if="nameError" class="script-name-error">{{ nameError }}</span>
            </div>

            <div class="editor-shell">
                <div ref="containerRef" class="editor-mount" />

                <div v-if="!isReady" class="editor-loading">
                    <div class="editor-loading__card">
                        <div class="editor-loading__spinner" />
                        <p class="editor-loading__text">Preparing Editor...</p>
                    </div>
                </div>
            </div>

            <div v-if="isSaving" class="editor-status">
                Compiling...
            </div>
        </div>

        <aside class="script-list">
            <ul>
                <li
                    v-for="script in scripts"
                    :key="script.id"
                    class="script-item group"
                    :class="{ 'script-item--active': script.id === selectedId }"
                    @click="terminal.setSelectedScriptId(script.id)"
                >
                    <span class="script-item__label">{{ script.name }}</span>
                </li>
            </ul>
        </aside>
    </div>
</template>

<style scoped>
    .script-editor {
        display: flex;
        height: 100%;
        overflow: hidden;
        color: #e2e8f0;
    }

    .editor-area {
        flex: 1;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .editor-shell {
        position: relative;
        width: 100%;
        flex: 1;
        min-height: 0;
    }

    .script-header {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        border-bottom: 1px solid #1f2937;
        background: #0a1220;
    }

    .script-name-input {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid #334155;
        border-radius: 6px;
        color: #e2e8f0;
        padding: 4px 8px;
        font-size: 13px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        outline: none;
        min-width: 180px;
    }

    .script-name-input:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }

    .script-name-error {
        color: #f87171;
        font-size: 11px;
    }

    .editor-mount {
        width: 100%;
        height: 100%;
    }

    .editor-loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
        z-index: 10;
    }

    .editor-loading__card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
    }

    .editor-loading__spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(148, 163, 184, 0.25);
        border-top-color: #38bdf8;
        border-radius: 999px;
        animation: spin 0.85s linear infinite;
        flex-shrink: 0;
    }

    .editor-loading__title {
        margin: 0;
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 600;
    }

    .editor-loading__text {
        margin: 2px 0 0;
        color: #94a3b8;
        font-size: 15px;
    }

    .editor-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #64748b;
        font-size: 13px;
    }

    .editor-status {
        position: absolute;
        bottom: 8px;
        right: 12px;
        font-size: 11px;
        color: #94a3b8;
        background: rgba(2, 6, 23, 0.72);
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 999px;
        padding: 4px 10px;
    }

    .script-list {
        width: 220px;
        border-left: 1px solid #1f2937;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
    }

    .script-list__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #94a3b8;
        border-bottom: 1px solid #1f2937;
    }

    .script-list ul {
        list-style: none;
        margin: 0;
        /* padding: 4px 0; */
        overflow-y: auto;
        flex: 1;
    }

    .script-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        /* border-radius: 6px; */
        /* margin: 1px 4px; */
        transition: background-color 120ms ease, color 120ms ease, opacity 120ms ease;
    }

    .script-item:hover {
        background: rgba(148, 163, 184, 0.12);
    }

    .script-item--active {
        background: rgba(14, 165, 233, 0.18);
        color: #f8fafc;
    }

    .script-item__label {
        min-width: 0;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .script-item__close {
        flex-shrink: 0;
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

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>