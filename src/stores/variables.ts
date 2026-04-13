/**
 * variables.ts
 * Pinia store — reactive variable state for both global and page-scoped variables.
 *
 * All variables are stored here regardless of scope.
 * Scope is enforced at read/write time.
 *
 * Responsibilities:
 *   - Initialize variables from project definitions
 *   - Provide reactive get/set used by proxy and bindings
 *   - Run reset hooks on page lifecycle events
 *   - Report errors to terminal store
 */

import { defineStore } from 'pinia'
import { reactive, readonly } from 'vue'
import type { VariableDef, VariableType } from '../types/variables'
import { useTerminalStore } from './terminal'
import { useNotificationStore } from './notification'

export const useVariableStore = defineStore('variables', () => {
    const terminal = useTerminalStore()
    const notifications = useNotificationStore()

    function rejectVariableAction(message: string) {
        terminal.error(message)
        notifications.addNotification(message, { type: 'error', ttl: 4500 })
    }

    // ── Definitions ───────────────────────────────────────────────────────────

    /** Authored variable definitions keyed by name */
    const definitions = reactive<Record<string, VariableDef>>({})

    // ── Storage ───────────────────────────────────────────────────────────────

    /**
     * Global variables — survive page navigation.
     * Keyed by variable name.
     */
    const globalVars = reactive<Record<string, unknown>>({})

    /**
     * Page variables — keyed by pageId then variable name.
     * Persisted by default, reset only on explicit hook.
     */
    const pageVars = reactive<Record<string, Record<string, unknown>>>({})

    // ── Init ──────────────────────────────────────────────────────────────────

    function initDefinitions(defs: Record<string, VariableDef>) {
        for (const def of Object.values(defs)) {
            definitions[def.name] = def

            // seed global vars with defaults if not yet present
            if (def.scope === 'global' && !(def.name in globalVars)) {
                globalVars[def.name] = def.defaultValue
            }
        }
    }

    function upsertVariable(def: VariableDef) {
        const existing = definitions[def.name]
        definitions[def.name] = def

        if (def.scope === 'global') {
            if (!(def.name in globalVars)) {
                globalVars[def.name] = def.defaultValue
            }
        } else if (existing?.scope === 'global' && def.scope === 'page') {
            delete globalVars[def.name]
        }

        for (const pageId of Object.keys(pageVars)) {
            if (!(def.name in pageVars[pageId])) {
                pageVars[pageId][def.name] = def.defaultValue
            }
        }
    }

    function createVariable(): VariableDef {
        const index = Object.keys(definitions).length + 1
        const def: VariableDef = {
            id: Math.random().toString(36).slice(2),
            name: `variable_${index}`,
            type: 'string',
            scope: 'global',
            defaultValue: '',
        }

        upsertVariable(def)
        return def
    }

    function updateVariable(name: string, patch: Partial<VariableDef>) {
        const existing = definitions[name]
        if (!existing) return

        const nextName = patch.name?.trim() || existing.name
        const next: VariableDef = {
            ...existing,
            ...patch,
            id: patch.id ?? existing.id,
            name: nextName,
        }

        if (nextName !== name) {
            delete definitions[name]
            delete globalVars[name]
            for (const pageId of Object.keys(pageVars)) {
                delete pageVars[pageId][name]
            }
        }

        definitions[nextName] = next
        if (next.scope === 'global') {
            globalVars[nextName] = globalVars[nextName] ?? next.defaultValue
        }

        for (const pageId of Object.keys(pageVars)) {
            if (!(nextName in pageVars[pageId])) {
                pageVars[pageId][nextName] = next.defaultValue
            }
        }
    }

    function deleteVariable(name: string) {
        delete definitions[name]
        delete globalVars[name]
        for (const pageId of Object.keys(pageVars)) {
            delete pageVars[pageId][name]
        }
    }

    function initPageVars(pageId: string) {
        if (!pageVars[pageId]) {
            pageVars[pageId] = reactive({})
        }
        // seed page vars with defaults if not yet set
        for (const def of Object.values(definitions)) {
            if (def.scope === 'page' && !(def.name in pageVars[pageId])) {
                pageVars[pageId][def.name] = def.defaultValue
            }
        }
    }

    // ── Reset hooks ───────────────────────────────────────────────────────────

    type ResetHook =
        | 'resetOnBeforeMount'
        | 'resetOnMount'
        | 'resetOnBeforeUnmount'

    function runResetHook(pageId: string, hook: ResetHook) {
        for (const def of Object.values(definitions)) {
            if (!def[hook]) continue
            if (def.scope === 'global') {
                globalVars[def.name] = def.defaultValue
            } else if (def.scope === 'page') {
                ensurePageVars(pageId)
                pageVars[pageId][def.name] = def.defaultValue
            }
        }
    }

    // ── Read / Write ──────────────────────────────────────────────────────────

    function getVar(name: string, pageId: string): unknown {
        const def = definitions[name]
        if (!def) {
            rejectVariableAction(`Variable "${name}" is not defined.`)
            return undefined
        }
        return def.scope === 'global'
            ? globalVars[name]
            : pageVars[pageId]?.[name]
    }

    function setVar(name: string, value: unknown, pageId: string): boolean {
        const def = definitions[name]
        if (!def) {
            rejectVariableAction(`Variable "${name}" is not defined.`)
            return false
        }

        // Type check
        if (!isCompatibleValue(value, def.type)) {
            rejectVariableAction(
                `Type mismatch: variable "${name}" expects ${def.type}, got ${typeof value}.`
            )
            return false
        }

        if (def.scope === 'global') {
            globalVars[name] = value
        } else {
            ensurePageVars(pageId)
            pageVars[pageId][name] = value
        }

        return true
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function ensurePageVars(pageId: string) {
        if (!pageVars[pageId]) pageVars[pageId] = reactive({})
    }

    function isCompatibleValue(value: unknown, type: VariableType): boolean {
        switch (type) {
            case 'string': return typeof value === 'string'
            case 'number': return typeof value === 'number'
            case 'boolean': return typeof value === 'boolean'
            case 'list': return Array.isArray(value)
            case 'object': return typeof value === 'object'
                && value !== null
                && !Array.isArray(value)
        }
    }

    return {
        definitions: readonly(definitions),
        globalVars: readonly(globalVars),
        pageVars: readonly(pageVars),
        initDefinitions,
        upsertVariable,
        createVariable,
        updateVariable,
        deleteVariable,
        initPageVars,
        runResetHook,
        getVar,
        setVar,
    }
})