/**
 * Variable type system.
 * All variables live at project level — scope is a property, not a location.
 */

export type VariableType = 'string' | 'boolean' | 'number' | 'list' | 'object'

export type VariableScope = 'global' | 'page'

/**
 * Only meaningful when a VariableDef's own `type` is 'list' — the type of
 * each item. Excludes 'list' itself: no lists-of-lists, kept flat
 * deliberately so the shape editor stays a simple field list instead of a
 * recursive schema builder.
 */
export type ListItemType = Exclude<VariableType, 'list'>

/**
 * A single named field in an object-shaped list item (e.g. a "products"
 * list item might be `{ name: 'title', type: 'string' }`,
 * `{ name: 'price', type: 'number' }`). Deliberately flat — no 'list'/'object'
 * field types — same reasoning as ListItemType.
 */
export interface ListItemField {
    name: string
    type: 'string' | 'number' | 'boolean'
}

export interface VariableDef {
    id: string
    name: string
    type: VariableType
    scope: VariableScope
    defaultValue: unknown

    /** Only meaningful when type === 'list' — declares what each item is. */
    itemType?: ListItemType
    /**
     * Only meaningful when itemType === 'object' — the item's fields.
     * `readonly`: stores/variables.ts exposes `definitions` through Vue's
     * `readonly()`, which deep-freezes nested arrays too — a plain
     * `ListItemField[]` here would make every reader of the store's data
     * (not just this file) fail to type-check. Code that needs a mutable
     * working copy (VariablesRegistry.vue's `editItemShape`) clones it.
     */
    itemShape?: readonly ListItemField[]

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
    /**
     * Repeat item binding. When true, this binding resolves against the
     * *current repeat item* rather than a project variable (`variable` is
     * ignored — it's kept required only to avoid a wider type change).
     * Only meaningful on an element rendered inside a container that repeats
     * a list (a `bindings['children']` binding, see BindingMap note below).
     * `itemField` selects a field of an object-shaped item; omit it to bind
     * the whole item value (for a primitive-item list).
     */
    item?: boolean
    itemField?: string
    /**
     * Component prop binding. Names one of the enclosing component
     * definition's declared props; resolves against the *instance's* prop
     * value (its override, or the schema default) when the component is
     * rendered. Only meaningful on an element inside a ComponentDefinition's
     * tree. Same "context threading" mechanism as `item` — see render-bridge.
     */
    prop?: string
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
 * Key: dot-notation path e.g. 'style.content', 'layout.visible'.
 *
 * The reserved key 'children' is special: on a container, it turns that
 * container into a *repeat* — its `variable` names a list variable, and the
 * container renders one copy of its child template per list item (see
 * render-bridge.ts's repeat handling). It is NOT a scalar property patch and
 * is skipped by resolveBindings' patch loop.
 */
export type BindingMap = Record<string, VariableBinding>

/** Reserved BindingMap key that turns a container into a list repeater. */
export const REPEAT_BINDING_PATH = 'children'

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