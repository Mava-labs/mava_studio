/**
 * mavaTypes.ts
 *
 * Generates a TypeScript declaration for the `mava` variable namespace from the
 * live variable definitions, so the script editor autocompletes every
 * author-defined variable *by name and by its real type* — including the
 * element/field types of list and object variables (declared via the Variables
 * panel's shape editor, Phase 3.62–3.64).
 *
 * The result is injected into Monaco as an extra lib and re-injected whenever
 * the definitions change (see ScriptEditor.vue), so the types track edits live.
 */

import type { VariableDef, ListItemField } from '../../types/variables'

const IDENTIFIER = /^[a-zA-Z_$][\w$]*$/

/** A key for a TS object member — bare if it's a valid identifier, quoted otherwise. */
function memberKey(name: string): string {
    return IDENTIFIER.test(name) ? name : JSON.stringify(name)
}

function fieldType(kind: ListItemField['type']): string {
    return kind // 'string' | 'number' | 'boolean' are already valid TS types
}

/** TS type for the *items* of a list variable. */
function listItemType(def: VariableDef): string {
    if (def.itemType === 'object') {
        const fields = (def.itemShape ?? [])
            .map(f => `${memberKey(f.name)}: ${fieldType(f.type)}`)
            .join('; ')
        return fields ? `{ ${fields} }` : 'Record<string, unknown>'
    }
    // primitive item type, or undeclared → widest safe fallback
    return def.itemType ?? 'unknown'
}

/** TS type for an object variable, inferred from its default value's shape. */
function objectType(defaultValue: unknown): string {
    if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
        const entries = Object.entries(defaultValue as Record<string, unknown>).map(
            ([k, v]) => `${memberKey(k)}: ${primitiveTypeof(v)}`,
        )
        if (entries.length) return `{ ${entries.join('; ')} }`
    }
    return 'Record<string, unknown>'
}

function primitiveTypeof(value: unknown): string {
    switch (typeof value) {
        case 'string': return 'string'
        case 'number': return 'number'
        case 'boolean': return 'boolean'
        default: return 'unknown'
    }
}

/** TS type for a whole variable. */
function variableType(def: VariableDef): string {
    switch (def.type) {
        case 'string': return 'string'
        case 'number': return 'number'
        case 'boolean': return 'boolean'
        case 'list': return `${listItemType(def)}[]`
        case 'object': return objectType(def.defaultValue)
    }
}

/**
 * Build the `declare const mava` lib. Always includes `watch` and a string
 * index signature (so `mava["anything"]` stays legal as `unknown`), plus one
 * typed member per author variable with a valid-identifier name.
 */
export function generateMavaTypeLib(definitions: Record<string, VariableDef>): string {
    const members = Object.values(definitions)
        // A non-identifier name can't be a bare member; it's still reachable
        // via the index signature as `mava["odd name"]`.
        .filter(def => IDENTIFIER.test(def.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(def => {
            const scope = def.scope === 'page' ? 'local (per-page)' : 'global'
            return `    /** ${scope} · ${def.type} */\n    ${def.name}: ${variableType(def)};`
        })

    return `// Auto-generated from the project's variables — do not edit.
interface MavaVars {
${members.join('\n')}
    /** Subscribe to a variable's changes; returns an unsubscribe function. */
    watch(variable: string, handler: (value: unknown) => void): () => void;
    [variable: string]: unknown;
}
declare const mava: MavaVars;
`
}
