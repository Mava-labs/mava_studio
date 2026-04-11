<!-- Terminal.vue -->
<script setup lang="ts" vapor>
    import { computed } from 'vue'
    import ScriptEditor from './ScriptEditor.vue'
    import VariablesRegistry from './VariablesRegistry.vue'
    import OutputLog from './OutputLog.vue'
    import { TerminalTab, useTerminalStore } from '../../stores/terminal';
    import { useLayoutStore } from '../../stores/layout';
    import { useProjectMetadataStore } from '../../stores/projectMetadata'
    import { useVariableStore } from '../../stores/variables'
    import type { ScriptDef } from '../../types/project'

    const terminal = useTerminalStore()
    const layout = useLayoutStore()
    const project = useProjectMetadataStore()
    const variableStore = useVariableStore()

    const tabs: { id: TerminalTab; label: string }[] = [
        { id: 'scripts', label: 'Scripts' },
        { id: 'variables', label: 'Variables' },
        { id: 'triggers', label: 'Triggers' },
        { id: 'output', label: 'Output' },
    ]

    function selectTab(tab: TerminalTab) {
        terminal.setTerminalTab(tab)
        if (layout.terminalState === 'closed') layout.openTerminal()
    }

    function isActiveTab(tabId: TerminalTab): boolean {
        return terminal.terminalTab === tabId
    }

    function tabClass(tabId: TerminalTab): string {
        return isActiveTab(tabId) ? 'terminal__tab terminal__tab--active' : 'terminal__tab'
    }

    const canCreateFromActiveTab = computed(() =>
        terminal.terminalTab === 'scripts' || terminal.terminalTab === 'variables'
    )

    const createButtonLabel = computed(() =>
        terminal.terminalTab === 'variables' ? 'New variable' : 'New script'
    )

    function createFromActiveTab() {
        if (terminal.terminalTab === 'scripts') {
            const id = Math.random().toString(36).slice(2)
            const script: ScriptDef = {
                id,
                name: `Script ${Object.keys(project.actionScripts ?? {}).length + 1}`,
                scope: 'global',
                codeTs: '// Write your script here\n',
            }
            project.upsertScript(script)
            terminal.setTerminalTab('scripts')
            if (layout.terminalState === 'closed') layout.openTerminal()
            return
        }

        if (terminal.terminalTab === 'variables') {
            variableStore.createVariable()
            if (layout.terminalState === 'closed') layout.openTerminal()
            return
        }
    }

    function toggleTerminal() {
        if (layout.terminalState === 'closed') layout.openTerminal()
        else layout.closeTerminal()
    }
</script>

<template>
    <div class="terminal">

        <!-- Tab bar — always visible even when collapsed -->
        <div class="terminal__tabs">
            <button v-for="tab in tabs" :key="tab.id" :class="tabClass(tab.id)" @click="selectTab(tab.id)">
                {{ tab.label }}
            </button>

            <div class="terminal__tab-spacer"></div>

            <button
                v-if="canCreateFromActiveTab"
                class="terminal__action terminal__action--create"
                :title="createButtonLabel"
                @click="createFromActiveTab"
            >
                +
            </button>

            <!-- Toggle open/close -->
            <button class="terminal__action" @click="toggleTerminal">
                {{ layout.terminalState === 'closed' ? '▲' : '▼' }}
            </button>
        </div>

        <!-- Content — only rendered when open -->
        <div v-if="layout.terminalState !== 'closed'" class="terminal__content">
            <OutputLog v-if="terminal.terminalTab === 'output'" />
            <ScriptEditor v-if="terminal.terminalTab === 'scripts'" />
            <VariablesRegistry v-if="terminal.terminalTab === 'variables'" />
            <div v-if="terminal.terminalTab === 'triggers'"></div>
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