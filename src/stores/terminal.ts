
/**
 * terminal.ts
 * Pinia store — buffers log entries for the terminal UI.
 * UI reads from entries when ready.
 */

import { defineStore } from 'pinia'
import { useLayoutStore } from './layout'
import { Ref, ref } from 'vue'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
    id: string
    level: LogLevel
    message: string
    timestamp: number
}

export type TerminalTab = 'scripts' | 'triggers' | 'timeline' | 'output' | 'variables'

export const useTerminalStore = defineStore('terminal', () => {
    const layout = useLayoutStore()
    const entries = ref<LogEntry[]>([])
    const terminalTab: Ref<TerminalTab> = ref("scripts");
    const unreadCount = ref(0)
    const unreadLevel: Ref<LogLevel | null> = ref(null)
    const selectedScriptId: Ref<string | null> = ref(null)
    const selectedVariableName: Ref<string | null> = ref(null)
    const selectedTriggerId: Ref<string | null> = ref(null)

    const LEVEL_WEIGHT: Record<LogLevel, number> = {
        info: 1,
        warn: 2,
        error: 3,
    }

    function isOutputVisible() {
        return terminalTab.value === 'output' && layout.terminalState !== 'closed'
    }

    function markOutputRead() {
        unreadCount.value = 0
        unreadLevel.value = null
    }

    function setTerminalTab(tab: typeof terminalTab.value) {
        terminalTab.value = tab
        if (tab === 'output' && layout.terminalState !== 'closed') {
            markOutputRead()
        }
    }

    function openTerminalWithTab(tab: TerminalTab) {
        setTerminalTab(tab);
        layout.openTerminal();
        if (tab === 'output') {
            markOutputRead()
        }
    }

    function setSelectedScriptId(id: string | null) {
        if(selectedScriptId.value == id){
            selectedScriptId.value = null
            return
        }
        
        selectedScriptId.value = null
        setTimeout(() => {
            selectedScriptId.value = id
        }, 20)
    }

    function setSelectedVariableName(name: string | null) {
        selectedVariableName.value = name
    }

    function setSelectedTriggerId(id: string | null) {
        if(selectedTriggerId.value == id) {
            selectedTriggerId.value = null
            return
        }
        selectedScriptId.value = null
        setTimeout(() => {
            selectedTriggerId.value = id
        }, 20)
    }

    function log(level: LogLevel, message: string) {
        entries.value.push({
            id: Math.random().toString(36).slice(2),
            level,
            message,
            timestamp: Date.now(),
        })

        if (!isOutputVisible()) {
            unreadCount.value += 1
            if (!unreadLevel.value || LEVEL_WEIGHT[level] > LEVEL_WEIGHT[unreadLevel.value]) {
                unreadLevel.value = level
            }
        }

        // mirror to browser console during development
        if (import.meta.env.DEV) {
            level === 'error' ? console.error(message)
                : level === 'warn' ? console.warn(message)
                    : console.log(message)
        }
    }

    const info = (msg: string) => log('info', msg)
    const warn = (msg: string) => log('warn', msg)
    const error = (msg: string) => log('error', msg)
    const clear = () => {
        entries.value = []
        markOutputRead()
    }

    return {
        entries,
        unreadCount,
        unreadLevel,
        info,
        warn,
        error,
        clear,
        markOutputRead,
        openTerminalWithTab,
        terminalTab,
        setTerminalTab,
        selectedScriptId,
        selectedVariableName,
        selectedTriggerId,
        setSelectedScriptId,
        setSelectedVariableName,
        setSelectedTriggerId,
    }
})