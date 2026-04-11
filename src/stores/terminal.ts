
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

    function setTerminalTab(tab: typeof terminalTab.value) {
        terminalTab.value = tab
    }

    function openTerminalWithTab(tab: TerminalTab) {
        setTerminalTab(tab);
        layout.openTerminal();
    }

    function log(level: LogLevel, message: string) {
        entries.value.push({
            id: Math.random().toString(36).slice(2),
            level,
            message,
            timestamp: Date.now(),
        })
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
    const clear = () => { entries.value = [] }

    return { entries, info, warn, error, clear, openTerminalWithTab, terminalTab, setTerminalTab }
})