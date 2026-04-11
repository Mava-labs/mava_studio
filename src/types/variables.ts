/**
 * Variable type system.
 * All variables live at project level — scope is a property, not a location.
 */

export type VariableType = 'string' | 'boolean' | 'number' | 'list' | 'object'

export type VariableScope = 'global' | 'page'

export interface VariableDef {
    id: string
    name: string
    type: VariableType
    scope: VariableScope
    defaultValue: unknown

    // Reset hooks — user declares these explicitly
    resetOnBeforeMount?: boolean
    resetOnMount?: boolean
    resetOnBeforeUnmount?: boolean
}

/**
 * A binding declaration on an element property.
 * path is dot-notation into the element — 'style.content', 'layout.visible' etc.
 */
export interface VariableBinding {
    variable: string        // variable name as declared in VariableDef
    twoWay?: boolean       // only valid on input-like element properties
    transform?: VariableTransform
}

export interface VariableTransform {
    // what to apply when reading variable → element
    read?: TransformFn
    // what to apply when writing element → variable (two-way only)
    write?: TransformFn
}

export type TransformFn =
    | 'toString'
    | 'toNumber'
    | 'toBoolean'
    | 'negate'

/**
 * Map of element property paths to bindings.
 * Key: dot-notation path e.g. 'style.content', 'layout.visible'
 */
export type BindingMap = Record<string, VariableBinding>

/**
 * Type compatibility matrix.
 * Defines which transforms are valid for each variable type.
 */
export const TRANSFORM_COMPATIBILITY: Record<VariableType, TransformFn[]> = {
    string: ['toNumber', 'toBoolean'],
    number: ['toString', 'toBoolean'],
    boolean: ['toString', 'negate'],
    list: [],
    object: [],
}

/**
 * Check whether a transform is compatible with a variable type.
 */
export function isTransformCompatible(
    type: VariableType,
    transform: TransformFn,
): boolean {
    return TRANSFORM_COMPATIBILITY[type].includes(transform)
}