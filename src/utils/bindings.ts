/**
 * bindings.ts
 *
 * Resolves variable bindings into element property patches.
 * Handles simple types, list-driven repeat, and object spread.
 * Validates transform compatibility against variable type.
 */

import type { BindingMap, TransformFn, VariableType } from '../types/variables'
import { isTransformCompatible } from '../types/variables'
import { useVariableStore } from '../stores/variables'
import { useTerminalStore } from '../stores/terminal'

// ── Transform application ─────────────────────────────────────────────────────

export function applyTransform(
    value: unknown,
    transform: TransformFn,
    varName: string,
    varType: VariableType,
): unknown {
    if (!isTransformCompatible(varType, transform)) {
        useTerminalStore().error(
            `Transform "${transform}" is not compatible with variable ` +
            `"${varName}" of type "${varType}".`
        )
        return value
    }
    switch (transform) {
        case 'toString': return String(value)
        case 'toNumber': return Number(value)
        case 'toBoolean': return Boolean(value)
        case 'negate': return !value
    }
}

export function applyWriteTransform(
    value: unknown,
    transform: TransformFn,
    varName: string,
    varType: VariableType,
): unknown {
    // write transforms are the inverse of read transforms
    if (!isTransformCompatible(varType, transform)) {
        useTerminalStore().error(
            `Write transform "${transform}" is not compatible with ` +
            `variable "${varName}" of type "${varType}".`
        )
        return value
    }
    switch (transform) {
        case 'toString': return Number(value)     // inverse: back to number
        case 'toNumber': return String(value)     // inverse: back to string
        case 'toBoolean': return Boolean(value)
        case 'negate': return !value
    }
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolves all one-way and two-way bindings for an element.
 *
 * Returns:
 *   patch       — merged style/layout/effects overrides
 *   twoWayMap   — { elementProp: variableName } for renderer to wire handlers
 *   repeatList  — if a list variable is bound to 'children', the array value
 */
export interface ResolvedBindings {
    patch: Record<string, Record<string, unknown>>
    twoWayMap: Record<string, string>
    repeatList: unknown[] | null
}

export function resolveBindings(
    bindings: BindingMap,
    pageId: string,
): ResolvedBindings {
    const varStore = useVariableStore()
    const terminal = useTerminalStore()

    const patch: Record<string, Record<string, unknown>> = {}
    const twoWayMap: Record<string, string> = {}
    let repeatList: unknown[] | null = null

    for (const [path, binding] of Object.entries(bindings)) {
        const def = varStore.definitions[binding.variable]
        if (!def) {
            terminal.error(`Binding references undefined variable "${binding.variable}".`)
            continue
        }

        const raw = varStore.getVar(binding.variable, pageId)

        // ── List binding → repeat ─────────────────────────────────────────────
        if (def.type === 'list' && path === 'children') {
            if (!Array.isArray(raw)) {
                terminal.error(`Variable "${binding.variable}" is not a list.`)
                continue
            }
            repeatList = raw
            continue
        }

        // ── Object binding → spread into section ──────────────────────────────
        if (def.type === 'object' && typeof raw === 'object' && raw !== null) {
            const [section] = path.split('.')
            if (!patch[section]) patch[section] = {}
            Object.assign(patch[section], raw)
            continue
        }

        // ── Scalar binding ────────────────────────────────────────────────────
        const value = binding.transform?.read
            ? applyTransform(raw, binding.transform.read, binding.variable, def.type)
            : raw

        const [section, ...rest] = path.split('.')
        const key = rest.join('.')
        if (!patch[section]) patch[section] = {}
        patch[section][key] = value

        // ── Two-way registration ──────────────────────────────────────────────
        if (binding.twoWay) {
            if (def.type !== 'string' && def.type !== 'number' && def.type !== 'boolean') {
                terminal.error(
                    `Two-way binding on "${binding.variable}" is only supported ` +
                    `for string, number, and boolean variables.`
                )
                continue
            }
            twoWayMap[key] = binding.variable
        }
    }

    return { patch, twoWayMap, repeatList }
}