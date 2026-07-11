<!-- Terminal.vue -->
<script setup lang="ts" vapor>
    import { computed } from 'vue'
    import ScriptEditor from './ScriptEditor.vue'
    import TriggersEditor from './TriggersEditor.vue'
    import VariablesRegistry from './VariablesRegistry.vue'
    import OutputLog from './OutputLog.vue'
    import { TerminalTab, useTerminalStore } from '../../stores/terminal';
    import { useLayoutStore } from '../../stores/layout';
    import { useStageStore } from '../../stores/stage'
    import { useNotificationStore } from '../../stores/notification'
    import { useProjectMetadataStore } from '../../stores/projectMetadata'
    import { useVariableStore } from '../../stores/variables'
    import { usePagesStore } from '../../stores/pages'
    import type { DSLTriggerDocument, ScriptDef } from '../../types/project'

    const terminal = useTerminalStore()
    const layout = useLayoutStore()
    const stage = useStageStore()
    const notification = useNotificationStore()
    const project = useProjectMetadataStore()
    const variableStore = useVariableStore()
    const pages = usePagesStore()

    const isTerminalLocked = computed(() => stage.currentStage === 'empty' || !project.isProjectOpen)

    function notifyTerminalLocked() {
        notification.addNotification('Terminal is disabled until a project is open and not in empty mode.', {
            type: 'warn',
            ttl: 3000,
        })
    }

    const tabs: { id: TerminalTab; label: string }[] = [
        { id: 'scripts', label: 'Scripts' },
        { id: 'variables', label: 'Variables' },
        { id: 'triggers', label: 'Triggers' },
        { id: 'output', label: 'Output' },
    ]

    function selectTab(tab: TerminalTab) {
        terminal.setTerminalTab(tab)
        if (layout.terminalState === 'closed') {
            if (isTerminalLocked.value) {
                notifyTerminalLocked()
                return
            }
            layout.openTerminal()
        }
        if (tab === 'output') {
            terminal.markOutputRead()
        }
    }

    function isActiveTab(tabId: TerminalTab): boolean {
        return terminal.terminalTab === tabId
    }

    function tabClass(tabId: TerminalTab): string {
        return isActiveTab(tabId) ? 'terminal__tab terminal__tab--active' : 'terminal__tab'
    }

    function outputDotClass(): string {
        if (terminal.unreadLevel === 'error') return 'terminal__tab-dot terminal__tab-dot--error'
        if (terminal.unreadLevel === 'warn') return 'terminal__tab-dot terminal__tab-dot--warn'
        return 'terminal__tab-dot terminal__tab-dot--info'
    }

    const canCreateFromActiveTab = computed(() =>
        terminal.terminalTab === 'scripts' || terminal.terminalTab === 'variables' || terminal.terminalTab === 'triggers'
    )

    const createButtonLabel = computed(() => {
        if (terminal.terminalTab === 'variables') return 'New variable'
        if (terminal.terminalTab === 'triggers') return 'New trigger'
        return 'New script'
    })

    const canDeleteFromActiveTab = computed(() => {
        if (terminal.terminalTab === 'scripts') {
            const selected = terminal.selectedScriptId
            return !!selected && !!project.actionScripts[selected]
        }

        if (terminal.terminalTab === 'variables') {
            const selected = terminal.selectedVariableName
            return !!selected && !!variableStore.definitions[selected]
        }

        if (terminal.terminalTab === 'triggers') {
            const selected = terminal.selectedTriggerId
            return !!selected && !!project.dslTriggers[selected]
        }

        return false
    })

    function createFromActiveTab() {
        if (terminal.terminalTab === 'scripts') {
            const id = Math.random().toString(36).slice(2)
            const script: ScriptDef = {
                id,
                name: `Script_${Object.keys(project.actionScripts ?? {}).length + 1}`,
                scope: 'global',
                codeTs: [
                    '// Variables live on `mava` — read/write them like normal JS:',
                    '//   mava.score = 10',
                    '//   if (mava.username) { ... }',
                    '//   mava.watch("score", v => console.log("score:", v))',
                    '// Also available: stage, element(id), project, fetch.',
                    '',
                ].join('\n'),
            }

            project.upsertScript(script)
            terminal.setSelectedScriptId(script.id)
            return
        }

        if (terminal.terminalTab === 'variables') {
            variableStore.createVariable()
            if (layout.terminalState === 'closed') {
                if (isTerminalLocked.value) {
                    notifyTerminalLocked()
                    return
                }
                layout.openTerminal()
            }
            return
        }

        if (terminal.terminalTab === 'triggers') {
            const now = Date.now()
            const triggerId = Math.random().toString(36).slice(2)
            const trigger: DSLTriggerDocument = {
                id: triggerId,
                // Page-local by default — tied to whichever page is focused at
                // creation. It stays page-local unless the author turns it into
                // a named trigger (`trigger foo ... end`), at which point it's
                // treated as global (runner.ts's triggerAppliesToPage). scope
                // is kept for back-compat but no longer drives listing/activation.
                scope: 'page',
                pageId: pages.activePageId,
                dslSource: '// New trigger — say what it does\non click [element_name]\n  show [target_name]\nend\n',
                enabled: true,
                createdAt: now,
                updatedAt: now,
                lastError: null,
            }

            project.upsertDslTrigger(trigger)
            terminal.setSelectedTriggerId(trigger.id)
        }
    }

    function deleteFromActiveTab() {
        if (terminal.terminalTab === 'scripts') {
            const selected = terminal.selectedScriptId
            if (!selected || !project.actionScripts[selected]) return
            project.deleteScript(selected)
            return
        }

        if (terminal.terminalTab === 'variables') {
            const selected = terminal.selectedVariableName
            if (!selected || !variableStore.definitions[selected]) return
            variableStore.deleteVariable(selected)
            return
        }

        if (terminal.terminalTab === 'triggers') {
            const selected = terminal.selectedTriggerId
            if (!selected || !project.dslTriggers[selected]) return
            project.deleteDslTrigger(selected)
        }
    }

    function toggleTerminal() {
        if (layout.terminalState === 'closed') {
            if (isTerminalLocked.value) {
                notifyTerminalLocked()
                return
            }
            layout.openTerminal()
        }
        else layout.closeTerminal()
    }

    function toggleFullNormal() {
        if (isTerminalLocked.value) {
            notifyTerminalLocked()
            return
        }

        if (layout.terminalState === 'full') {
            layout.setTerminalState('normal')
            return
        }

        if (layout.terminalState === 'normal' || layout.terminalState === 'closed') {
            layout.setTerminalState('full')
        }
    }
</script>

<template>
    <div class="terminal">

        <!-- Tab bar — always visible even when collapsed -->
        <div class="terminal__tabs">
            <button class="uppercase" v-for="tab in tabs" :key="tab.id" :class="tabClass(tab.id)" @click="selectTab(tab.id)">
                <span class="terminal__tab-label">
                    {{ tab.label }}
                    <span
                        v-if="tab.id === 'output' && terminal.unreadCount > 0 && terminal.selectedTriggerId"
                        :class="outputDotClass()"
                    ></span>
                </span>
            </button>

            <div class="terminal__tab-spacer"></div>

            <!-- Create button -->
            <button
                v-if="canCreateFromActiveTab"
                class="terminal__action"
                :title="createButtonLabel"
                @click="createFromActiveTab"
            >
                <svg class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                    width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M5 12h14m-7 7V5" />
                </svg>
            </button>

            <!-- Delete button -->
            <button
                v-if="canDeleteFromActiveTab"
                class="terminal__action"
                :title="terminal.terminalTab === 'variables'
                    ? 'Delete variable'
                    : terminal.terminalTab === 'triggers'
                        ? 'Delete trigger'
                        : 'Delete script'"
                @click="deleteFromActiveTab"
            >
                <svg class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                    width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z" />
                </svg>
            </button>

            <!-- Toggle full/normal -->
            <button class="terminal__action" 
                :title="layout.terminalState === 'full' ? 'Exit full height' : 'Full height'"
                @click="toggleFullNormal">
                <!-- Maximize -->
                <svg v-if="layout.terminalState === 'normal'"
                    class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                    width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 4H4m0 0v4m0-4 5 5m7-5h4m0 0v4m0-4-5 5M8 20H4m0 0v-4m0 4 5-5m7 5h4m0 0v-4m0 4-5-5" />
                </svg>

                <!-- Minimize -->
                <svg v-else-if="layout.terminalState === 'full'"
                    class="w-5 h-5 text-gray-800 dark:text-white" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#e3e3e3">
                    <path d="M0 0h24v24H0V0z" fill="none" />
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
            </button>

            <!-- Toggle open/close -->
            <button class="terminal__action" 
                title="Close terminal"
                @click="toggleTerminal">
                <svg v-if="layout.terminalState !== 'closed'" class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                    width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M6 18 17.94 6M18 18 6.06 6" />
                </svg>
            </button>
        </div>

        <!-- Content — only rendered when open -->
        <div v-if="layout.terminalState !== 'closed'" class="terminal__content">
            <OutputLog v-if="terminal.terminalTab === 'output'" />
            <ScriptEditor v-if="terminal.terminalTab === 'scripts'" />
            <VariablesRegistry v-if="terminal.terminalTab === 'variables'" />
            <TriggersEditor v-if="terminal.terminalTab === 'triggers'" />
        </div>

    </div>
</template>

<style scoped>
    .terminal {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98));
        color: #e2e8f0;
    }

    .terminal__tabs {
        display: flex;
        align-items: center;
        height: 28px;
        flex-shrink: 0;
        padding: 0 4px;
        border-bottom: 1px solid #1f2937;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
    }

    .terminal__tab {
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: #94a3b8;
        font-size: 12px;
        padding: 0 12px;
        height: 100%;
        cursor: pointer;
        white-space: nowrap;
    }

    .terminal__tab:hover {
        color: #e2e8f0;
    }

    .terminal__tab--active {
        color: #f8fafc;
        border-bottom-color: #38bdf8;
    }

    .terminal__tab-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .terminal__tab-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        display: inline-block;
        box-shadow: 0 0 8px currentColor;
    }

    .terminal__tab-dot--info {
        color: #38bdf8;
        background: #38bdf8;
    }

    .terminal__tab-dot--warn {
        color: #f59e0b;
        background: #f59e0b;
    }

    .terminal__tab-dot--error {
        color: #ef4444;
        background: #ef4444;
    }

    .terminal__tab-spacer {
        flex: 1;
    }

    .terminal__action {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 11px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 3px;
    }

    .terminal__action:hover {
        color: #f8fafc;
        background: rgba(148, 163, 184, 0.14);
    }

    .terminal__action--create {
        font-size: 14px;
        width: 24px;
        height: 24px;
        line-height: 1;
        padding: 0;
        margin-right: 2px;
    }

    .terminal__content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }
</style>