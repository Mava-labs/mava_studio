/**
 * bindings.ts
 *
 * Resolves variable bindings into element property patches.
 * Handles simple types, list-driven repeat, and object spread.
 * Validates transform compatibility against variable type.
 */

import type { BindingMap, TransformFn, VariableType } from '../types/variables'
import { isTransformCompatible, REPEAT_BINDING_PATH } from '../types/variables'
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
        case 'toString':
            // toString read-transform is used on number or boolean vars —
            // invert back toward whichever one this variable actually is.
            if (varType === 'number') return Number(value)
            if (varType === 'boolean') return value === true || value === 'true'
            return value
        case 'toNumber':
            // toNumber is only compatible with string vars.
            return String(value)
        case 'toBoolean':
            // toBoolean read-transform is used on string or number vars —
            // invert back toward whichever one this variable actually is.
            if (varType === 'number') return Number(value)
            if (varType === 'string') return String(value)
            return value
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
 *
 * The `children` repeat binding is skipped here entirely — it's a container's
 * repeat declaration, not a scalar patch on this element; render-bridge.ts
 * reads it directly off the raw element.
 *
 * @param itemContext  the current repeat item, when this element is being
 *   resolved inside a repeat instance — supplies the value for any
 *   `binding.item` bindings. undefined outside a repeat (the common case).
 */
export interface ResolvedBindings {
    patch: Record<string, Record<string, unknown>>
    /** Keyed by full dot-path (e.g. 'style.value'), not leaf property name. */
    twoWayMap: Record<string, string>
}

/**
 * The render-time context an element is being resolved inside. Threaded from
 * render-bridge through resolveElement → resolveBindings so contextual bindings
 * (`binding.item`, `binding.prop`) resolve. Both fields are undefined in the
 * common case (an element on a normal page, not inside a repeat or component).
 */
export interface RenderScope {
    /** Current repeat item — supplies `binding.item` values. */
    item?: unknown
    /** Current component instance's resolved props — supplies `binding.prop` values. */
    props?: Record<string, unknown>
    /**
     * Set while expanding a component definition tree. When the tree reaches a
     * `slot` element, render-bridge renders these instance-provided children in
     * its place (default slot). `scope` is the context the *instance* itself
     * was rendered in — slot children are page content and resolve against it,
     * not the component's props.
     */
    slotContent?: {
        elements: Record<string, unknown>
        childIds: string[]
        scope?: RenderScope
    }
}

export function resolveBindings(
    bindings: BindingMap,
    pageId: string,
    scope?: RenderScope,
): ResolvedBindings {
    const varStore = useVariableStore()
    const terminal = useTerminalStore()

    const patch: Record<string, Record<string, unknown>> = {}
    const twoWayMap: Record<string, string> = {}

    const assignPatch = (path: string, value: unknown) => {
        const [section, ...rest] = path.split('.')
        if (!patch[section]) patch[section] = {}
        patch[section][rest.join('.')] = value
    }

    for (const [path, binding] of Object.entries(bindings)) {
        // The container-repeat declaration, not a property patch — handled in
        // render-bridge.ts, ignored here.
        if (path === REPEAT_BINDING_PATH) continue

        // ── Repeat item binding ───────────────────────────────────────────────
        // Resolves against the current item rather than a project variable.
        if (binding.item) {
            const item = scope?.item
            const value = binding.itemField != null
                ? (item as Record<string, unknown> | null | undefined)?.[binding.itemField]
                : item
            assignPatch(path, value)
            continue
        }

        // ── Component prop binding ────────────────────────────────────────────
        // Resolves against the enclosing component instance's props.
        if (binding.prop) {
            assignPatch(path, scope?.props?.[binding.prop])
            continue
        }

        const def = varStore.definitions[binding.variable]
        if (!def) {
            terminal.error(`Binding references undefined variable "${binding.variable}".`)
            continue
        }

        const raw = varStore.getVar(binding.variable, pageId)

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
            twoWayMap[path] = binding.variable
        }
    }

    return { patch, twoWayMap }
}