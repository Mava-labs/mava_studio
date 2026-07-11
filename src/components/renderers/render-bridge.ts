import {
    setDynamicProps,
    setStyle,
    createComponentWithFallback
} from '@vue/runtime-vapor'
import { computed, effectScope, onScopeDispose, watchEffect } from 'vue'
import type { CSSProperties, EffectScope } from 'vue'
import { resolveElement } from './resolver'
import type { ComponentElement, ContainerElement, Element } from '../../types/element'
import type { ResolvedElement } from './resolver'
import { useVariableStore } from '../../stores/variables'
import { usePagesStore } from '../../stores/pages'
import { useProjectMetadataStore } from '../../stores/projectMetadata'
import { applyWriteTransform, type RenderScope } from '../../utils/bindings'
import { REPEAT_BINDING_PATH } from '../../types/variables'
import type { ComponentDefinition } from '../../types/project'

const SVG_NS = 'http://www.w3.org/2000/svg'

// ─── Reactivity model ─────────────────────────────────────────────────────────
//
// A single element node is built ONCE and then patched in place as reactive
// state changes — it is not torn down and rebuilt. This matters because the
// only reactive source that reaches this layer without going through a full
// canvas remount is the *variable store* (a bound variable changing, or a
// two-way input writing back to one). Everything structural — adding/removing
// elements, editing via the panels, a DSL trigger mutating an element via
// updateElement() — goes through commitPageToCache(), which replaces the page
// object and re-runs createMode.vue / PreviewApp.vue's root watchEffect,
// tearing down every mountElement() and rebuilding from scratch. So within a
// single mount the raw element object is effectively immutable; the ONLY thing
// that changes is bound variable *values*.
//
// Previously mountElement() wrapped resolve + DOM-build in one watchEffect, so
// any bound-variable read re-ran the whole thing and rebuilt the entire subtree
// on every change — which, for a two-way-bound <input>, meant the node (and its
// focus, caret, and selection) was destroyed and recreated on every keystroke,
// making write-back unusable. Now each node owns fine-grained effects that
// re-resolve and patch just text / attrs / style, leaving the DOM node itself
// (and its native input state) intact.
//
// Structural changes that a variable *could* drive — list-bound repeating
// children (bindings.ts's repeatList) — are deliberately NOT handled here yet;
// that feature has no per-item scope defined anywhere in the model. See
// CLEANUP_TODO.md.

type RenderNamespace = 'html' | 'svg'

/**
 * Authoring-only overrides layered on top of the resolver's output, right
 * before it's applied to the DOM — deliberately NOT in resolver.ts, which is
 * documented as pure/DOM-agnostic and shared with Preview (isAuthoring=false
 * there, see PreviewApp.vue) where these native behaviors are exactly what
 * should render for real. An authored form control shouldn't be typable, a
 * button shouldn't look clickable, an iframe shouldn't be interactive at all
 * (its content is a separate document — nothing inside it reaches this
 * app's click/drag handling, so it would otherwise let you click straight
 * through the editor into whatever's embedded) — none of that is a canvas
 * concept, it's an authoring-mode-only presentation choice.
 */
function applyAuthoringAttrOverrides(rawElement: Element, attrs: Record<string, unknown>): void {
    if (rawElement.kind !== 'flatHtml') return

    // <img> (and <a>, if ever rendered as a tag) are natively draggable in
    // browsers by default — unlike a div/button/span. The tiny pointer
    // jitter that happens during almost any real click is enough for the
    // browser to interpret it as the start of a native HTML5 image drag
    // instead of a click, and per spec a 'click' doesn't fire once a native
    // drag has started. That's a plausible, tag-specific explanation for
    // "the image isn't selectable by clicking it" while every other element
    // type (none of which are natively draggable) worked fine — our own
    // click-to-select and pointer-based reorder drag were both getting
    // preempted by the browser's own drag gesture before they ever saw it.
    attrs.draggable = false

    switch (rawElement.type) {
        case 'textinput':
        case 'textarea':
            // readOnly (not disabled) — still focusable/selectable/draggable,
            // just not typable. disabled form controls stop receiving
            // pointer events in most browsers, which would silently break
            // click-to-select and drag on every text input.
            attrs.readOnly = true
            break
        case 'video':
        case 'audio':
            attrs.controls = false
            break
    }
}

function applyAuthoringStyleOverrides(rawElement: Element, style: CSSProperties): void {
    if (rawElement.kind !== 'flatHtml') return
    if (rawElement.type === 'iframe') style.pointerEvents = 'none'
    if (rawElement.type === 'button') style.cursor = 'default'
}

// ─── Per-node builder (reactive, patch-in-place) ──────────────────────────────

/**
 * Builds one element node and wires the fine-grained reactive effects that keep
 * it in sync. Must be called inside an active effectScope (mountElement sets one
 * up) so every watchEffect / listener it creates is disposed together.
 *
 * `getRaw` is a live getter for the raw element (stable object within a mount —
 * see the reactivity-model note above), and `getParent` a live getter for its
 * parent, so resolveElement() re-reads current bound values on each effect run.
 */
function buildElementNode(
    getRaw: () => Element,
    getParent: (() => Element | undefined) | undefined,
    elements: Record<string, Element>,
    namespace: RenderNamespace,
    isAuthoring: boolean,
    // Render-time context (repeat item, component instance props). Threaded
    // down to descendants and into resolveElement so `binding.item` /
    // `binding.prop` resolve. undefined for a normal element on a page.
    scope?: RenderScope,
    // Called when a Vue-component node swaps itself. Only the mount root needs
    // it — a child's swap happens inside a parent element that gets removed
    // wholesale on cleanup, so its ancestors don't track it.
    onReplace?: (node: Node) => void,
): Node {
    const raw0 = getRaw()
    const resolved0 = resolveElement(raw0, getParent?.(), scope)

    // ── Vue-component branch ──────────────────────────────────────────────────
    // Only for a resolver output whose tag is an actual Vue component object
    // (not a string). Mava component *instances* no longer land here — they
    // resolve to a plain 'div' wrapper and are expanded from their definition
    // below. Kept for any future path that returns a real Vue component.
    if (typeof resolved0.tag !== 'string') {
        let compNode: Node | null = null
        watchEffect(() => {
            const r = resolveElement(getRaw(), getParent?.(), scope)
            const fresh = createComponentWithFallback(
                r.tag,
                { ...r.attrs, ...r.props } as any,
                r.slots as any,
            ) as unknown as Node
            if (compNode) {
                if (compNode.parentNode) compNode.parentNode.replaceChild(fresh, compNode)
                onReplace?.(fresh)
            }
            compNode = fresh
        })
        // watchEffect ran synchronously above, so compNode is set.
        return compNode as unknown as Node
    }

    const ns = resolved0.namespace ?? namespace
    const el = ns === 'svg'
        ? document.createElementNS(SVG_NS, resolved0.tag)
        : document.createElement(resolved0.tag)

    // Every DOM lookup keyed by element id — selection/hover rects
    // (useSelectionRect.ts, useHoverRect.ts), undo/redo's live-node animation
    // (stores/element.ts's getLiveNode), the Trigger DSL runtime's generated
    // `document.querySelector('[data-eid="..."]')` calls (codegen.ts), and
    // the Scripts element proxy (utils/scripts/context.ts) — all depend on
    // this attribute existing.
    el.setAttribute('data-eid', raw0.id)

    // One shared re-resolve, recomputed only when a dep it reads (a bound
    // variable, primarily) actually changes. Each patch effect below reads
    // `.value`, so all three re-run on a change but the element node is reused.
    const resolved = computed(() => resolveElement(getRaw(), getParent?.(), scope))

    // ── Text content ──────────────────────────────────────────────────────────
    watchEffect(() => {
        const r = resolved.value
        if (r.textContent != null) el.textContent = r.textContent
    })

    // ── Props / attributes ────────────────────────────────────────────────────
    watchEffect(() => {
        const r = resolved.value
        const merged = { ...r.attrs, ...r.props }
        if (isAuthoring) applyAuthoringAttrOverrides(raw0, merged)
        if (ns === 'svg') {
            patchSvgAttributes(el, merged)
        } else {
            setDynamicProps(el as HTMLElement, [merged])
        }
    })

    // ── Style ─────────────────────────────────────────────────────────────────
    watchEffect(() => {
        const r = resolved.value
        const merged = { ...r.style }
        if (isAuthoring) applyAuthoringStyleOverrides(raw0, merged)
        setStyle(el as HTMLElement, merged)
    })

    // ── Two-way bindings (input → variable) ───────────────────────────────────
    // Only meaningful in Preview (isAuthoring=false); in authoring mode text
    // inputs are readOnly and other controls are non-interactive, so nothing
    // fires. Attaching in both modes anyway is harmless and keeps the two paths
    // from diverging.
    if (el instanceof HTMLElement) wireTwoWayBindings(el, raw0)

    // ── Component instance → expand its definition tree ───────────────────────
    // A component instance renders the definition's element tree, with the
    // instance's props substituted (expand-from-definition). Its own children
    // (slots) are deferred to a later pass — props first.
    if (raw0.kind === 'component') {
        expandComponentInstance(el, getRaw, elements, isAuthoring, ns, scope)
        return el
    }

    // ── Repeat container (Preview only) ───────────────────────────────────────
    // A container with a `children` list binding renders one copy of its child
    // template per list item. Only in Preview — in authoring the same template
    // children render once (the else branch below) so the author edits one
    // editable template rather than N read-only copies (which would also all
    // share the template's data-eid, breaking selection).
    const repeatVar = raw0.kind === 'container'
        ? raw0.bindings?.[REPEAT_BINDING_PATH]?.variable
        : undefined

    if (!isAuthoring && repeatVar) {
        wireRepeat(el, raw0 as ContainerElement, repeatVar, getRaw, elements, ns, isAuthoring)
        return el
    }

    // ── Slot (component definition) ───────────────────────────────────────────
    // A `slot` container is a hole. While expanding a component definition (scope
    // carries slotContent), render the instance's own children here — falling
    // back to the slot's authored placeholder children when the instance provides
    // none. Outside a definition (definition editor), it falls through and shows
    // its placeholder children like any container.
    if (raw0.kind === 'container' && (raw0 as ContainerElement).type === 'slot' && scope?.slotContent) {
        const sc = scope.slotContent
        const useProvided = sc.childIds.length > 0
        const contentIds = useProvided ? sc.childIds : (raw0 as ContainerElement).children
        const contentEls = (useProvided ? sc.elements : elements) as Record<string, Element>
        const contentScope = useProvided ? sc.scope : scope
        for (const cid of contentIds) {
            if (!contentEls[cid]) continue
            el.appendChild(buildElementNode(
                () => contentEls[cid],
                () => getRaw(),
                contentEls,
                ns,
                isAuthoring,
                contentScope,
            ))
        }
        return el
    }

    // ── Children by id (container) ────────────────────────────────────────────
    const childIds: string[] =
        raw0.kind === 'container' ? (raw0 as ContainerElement).children : []

    for (const childId of childIds) {
        if (!elements[childId]) continue
        const childNode = buildElementNode(
            () => elements[childId],
            () => getRaw(),
            elements,
            ns,
            isAuthoring,
            scope,
        )
        el.appendChild(childNode)
    }

    // ── Resolver-generated children (e.g. <select> <option>s) ─────────────────
    // These are a static snapshot of the resolved output. They don't currently
    // react to variable changes — no authoring surface binds them (a <select>'s
    // options/value aren't bindable fields in BindingsPanel), and a two-way
    // <select> reflects the user's own choice via the DOM directly. If that
    // changes, this is the spot that would need its own effect.
    if (resolved0.children?.length) {
        for (const childResolved of resolved0.children) {
            el.appendChild(realizeResolvedTree(childResolved, childResolved.namespace ?? ns))
        }
    }

    return el
}

/**
 * Renders a repeat container's child template once per item of its bound list
 * variable, re-rendering when the list changes. Each item's instance is built
 * with that item as `itemContext`, so template descendants' `binding.item`
 * bindings resolve to it.
 *
 * Coarse-but-correct reactivity: the whole instance set is torn down and
 * rebuilt whenever the *list variable* changes (covers add/remove/reorder/
 * replace — the common `myList = [...]` update from a trigger/script). It does
 * NOT independently react to a single item field mutating in place without the
 * list reference changing; that's a refinement, and the usual variable-update
 * path (setVar) replaces the value rather than mutating it, so in practice the
 * rebuild fires. Known limitation: every instance's template shares the
 * template elements' `data-eid`, so DSL `querySelector('[data-eid]')` and
 * selection would only find the first instance — fine for display/binding,
 * flagged for anything that needs to address a specific instance.
 */
function wireRepeat(
    el: HTMLElement | SVGElement,
    container: ContainerElement,
    listVarName: string,
    getRaw: () => Element,
    elements: Record<string, Element>,
    ns: RenderNamespace,
    isAuthoring: boolean,
) {
    const varStore = useVariableStore()
    const pagesStore = usePagesStore()
    const templateIds = container.children
    // Detached scopes (effectScope(true)) — this function fully owns their
    // lifecycle via instanceScopes + the onScopeDispose below, rather than
    // leaking a growing list of stopped child scopes onto the parent scope
    // every time the list changes.
    let instanceScopes: EffectScope[] = []

    const disposeInstances = () => {
        instanceScopes.forEach(s => s.stop())
        instanceScopes = []
    }

    watchEffect(() => {
        const value = varStore.getVar(listVarName, pagesStore.activePageId ?? '')
        const items = Array.isArray(value) ? value : []

        disposeInstances()
        el.replaceChildren()

        for (const item of items) {
            const scope = effectScope(true)
            scope.run(() => {
                for (const childId of templateIds) {
                    if (!elements[childId]) continue
                    const node = buildElementNode(
                        () => elements[childId],
                        () => getRaw(),
                        elements,
                        ns,
                        isAuthoring,
                        { item },
                    )
                    el.appendChild(node)
                }
            })
            instanceScopes.push(scope)
        }
    })

    onScopeDispose(disposeInstances)
}

/**
 * Expands a component instance into its definition's element tree, rendered
 * with the instance's props substituted (`binding.prop` resolves against them).
 *
 * Reactive to both sides: the instance's own props change via a page commit →
 * the whole node rebuilds; the *definition* changes via updateComponent →
 * `project.componentLibrary[componentId]` (read inside the watchEffect) fires
 * this re-expansion, so editing a component updates every instance live.
 *
 * Known v1 limitations (flagged, not blocking): instances of the same
 * component share the definition's element `data-eid`s, so selection / DSL
 * querySelector inside an instance is ambiguous (the instance is meant to be
 * selected/addressed as a whole). Default-slot children (instance.children) are
 * injected at the definition's `slot`; *named* slots (instance.slots map) are a
 * follow-up.
 */
function expandComponentInstance(
    el: HTMLElement | SVGElement,
    getRaw: () => Element,
    // The map the *instance* lives in (page/surface) — slot children are keyed
    // here, not in the definition's own element map.
    pageElements: Record<string, Element>,
    isAuthoring: boolean,
    ns: RenderNamespace,
    parentScope: RenderScope | undefined,
) {
    const project = useProjectMetadataStore()
    let treeScope: EffectScope | null = null

    watchEffect(() => {
        const instance = getRaw() as ComponentElement
        const def = project.componentLibrary[instance.componentId] as ComponentDefinition | undefined

        treeScope?.stop()
        treeScope = effectScope(true)
        el.replaceChildren()

        if (!def) {
            el.textContent = '⚠ Missing component'
            return
        }

        const scope: RenderScope = {
            ...parentScope,
            props: resolveInstanceProps(instance, def),
            // Default slot: the instance's own children render at the definition's
            // `slot`. They're page elements, so they resolve against parentScope.
            slotContent: {
                elements: pageElements,
                childIds: instance.children ?? [],
                scope: parentScope,
            },
        }
        // The definition owns its own element map, separate from the page's.
        const defElements = def.elementsById as unknown as Record<string, Element>

        treeScope.run(() => {
            for (const rootId of def.rootIds) {
                if (!defElements[rootId]) continue
                const node = buildElementNode(
                    () => defElements[rootId],
                    () => getRaw(),
                    defElements,
                    ns,
                    isAuthoring,
                    scope,
                )
                el.appendChild(node)
            }
        })
    })

    onScopeDispose(() => treeScope?.stop())
}

/** An instance's prop values merged over the definition's schema defaults. */
function resolveInstanceProps(
    instance: ComponentElement,
    def: ComponentDefinition,
): Record<string, unknown> {
    const props: Record<string, unknown> = {}
    for (const schema of def.props) {
        const override = instance.props?.[schema.key]
        props[schema.key] = override !== undefined ? override : schema.defaultValue
    }
    return props
}

/**
 * Renders a purely resolver-generated subtree (no backing raw Element, so no
 * bindings and nothing to keep reactive) — e.g. the <option> nodes a <select>
 * resolves into. Applied once; not wrapped in effects.
 */
function realizeResolvedTree(
    resolved: ResolvedElement,
    namespace: RenderNamespace = resolved.namespace ?? 'html'
): Node {
    const { tag, style, attrs, props, slots, textContent } = resolved

    if (typeof tag !== 'string') {
        const componentProps = { ...attrs, ...props }
        return createComponentWithFallback(tag, componentProps as any, slots as any) as unknown as Node
    }

    const el = namespace === 'svg'
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag)

    if (textContent != null) el.textContent = textContent

    const merged = { ...attrs, ...props }
    if (namespace === 'svg') {
        patchSvgAttributes(el, merged)
    } else {
        setDynamicProps(el as HTMLElement, [merged])
    }
    setStyle(el as HTMLElement, style)

    if (resolved.children?.length) {
        for (const childResolved of resolved.children) {
            el.appendChild(realizeResolvedTree(childResolved, childResolved.namespace ?? namespace))
        }
    }

    return el
}

function patchSvgAttributes(el: HTMLElement | SVGElement, attrs: Record<string, unknown>) {
    const svgEl = el as SVGElement

    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) {
            svgEl.removeAttribute(key)
            continue
        }

        svgEl.setAttribute(key, value === true ? '' : String(value))
    }
}

// ─── Two-way binding write-back ───────────────────────────────────────────────

/**
 * Attaches input/change listeners that push a control's live value back into
 * its bound variable — the write half of a two-way binding. The read half
 * (variable → element) flows through the normal resolve/patch path above, since
 * a two-way binding is just a one-way binding with `twoWay: true` plus this.
 *
 * Lives here rather than in resolver.ts because it needs the real DOM node to
 * read the control's value and listen for events — resolver.ts is pure and
 * DOM-agnostic, which is also why resolveBindings()'s twoWayMap is computed but
 * not consumed there.
 *
 * Listener cleanup is registered via onScopeDispose, so it's torn down with the
 * mountElement effectScope this runs inside.
 */
function wireTwoWayBindings(el: HTMLElement, rawElement: Element) {
    const bindings = rawElement.bindings
    if (!bindings) return

    const varStore = useVariableStore()
    const pagesStore = usePagesStore()

    for (const [, binding] of Object.entries(bindings)) {
        if (!binding.twoWay) continue
        const def = varStore.definitions[binding.variable]
        if (!def) continue

        const handler = () => {
            const pageId = pagesStore.activePageId ?? ''
            let value = coerceToVariableType(readControlValue(el), def.type)
            if (binding.transform?.write) {
                value = applyWriteTransform(value, binding.transform.write, binding.variable, def.type)
            }
            // setVar type-checks and reports mismatches to the terminal itself.
            varStore.setVar(binding.variable, value, pageId)
        }

        // 'input' for live text typing, 'change' for select/checkbox/radio and
        // commit-on-blur controls — a control fires only the ones that apply to
        // it, and setVar setting the same value again is a cheap no-op.
        el.addEventListener('input', handler)
        el.addEventListener('change', handler)
        onScopeDispose(() => {
            el.removeEventListener('input', handler)
            el.removeEventListener('change', handler)
        })
    }
}

function readControlValue(el: HTMLElement): unknown {
    const input = el as HTMLInputElement
    const type = input.type
    if (type === 'checkbox' || type === 'radio') return input.checked
    if (type === 'number' || type === 'range') {
        return input.value === '' ? '' : Number(input.value)
    }
    return (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function coerceToVariableType(raw: unknown, type: string): unknown {
    switch (type) {
        case 'number': return typeof raw === 'number' ? raw : Number(raw)
        case 'boolean': return typeof raw === 'boolean' ? raw : (raw === 'true' || raw === true)
        case 'string': return typeof raw === 'string' ? raw : String(raw ?? '')
        default: return raw
    }
}

// ─── Public mount ─────────────────────────────────────────────────────────────

export function mountElement(
    getElement: () => Element,
    getParent: (() => Element | undefined) | undefined,
    container: HTMLElement,
    elements: Record<string, Element>,
    isAuthoring = false
): () => void {
    // One scope owns every effect and listener the whole subtree creates, so a
    // single scope.stop() in the returned cleanup disposes all of them — no
    // manual cleanups array threaded through the recursion.
    const scope = effectScope()
    let node: Node | null = null

    scope.run(() => {
        // onReplace keeps `node` pointing at the live root even if it's a
        // component that re-creates itself on a bound-prop change.
        node = buildElementNode(getElement, getParent, elements, 'html', isAuthoring, undefined, (fresh) => { node = fresh })
    })

    if (node) container.appendChild(node)

    return () => {
        scope.stop()
        if (node && (node as Node).parentNode === container) {
            container.removeChild(node)
        }
    }
}
