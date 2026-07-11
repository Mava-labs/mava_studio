/**
 * Resolver functions (refactored)
 *
 * Converts Element schema → Vue render-ready structure
 * Pure functions only. No DOM operations.
 */

import type { CSSProperties } from "vue"
import type {
    Layout,
    Effects,
    TextStyle,
    ButtonStyle,
    ImageStyle,
    IconStyle,
    InputStyle,
    ContainerStyle,
    ContainerElement,
    FlatHtmlElement,
    SvgElement,
    ComponentElement,
    Size,
    Element,
    BorderStyle
} from "../../types/element"
import { resolveBindings, type RenderScope } from "../../utils/bindings"
import { usePagesStore } from "../../stores/pages"

export interface ResolvedElement {
    tag: any // string | Vue component
    style: CSSProperties
    attrs: Record<string, unknown>
    props?: Record<string, unknown>
    slots?: Record<string, unknown>
    textContent?: string | null
    children?: ResolvedElement[]
    namespace?: 'html' | 'svg'
}

/* ============================================================
   ENTRY RESOLVER
   ============================================================ */

export function resolveElement(el: Element, parent?: Element, scope?: RenderScope): ResolvedElement {
    const bound = resolveElementBindings(el, scope)

    switch (bound.kind) {
        case "component":
            return resolveComponentElement(bound as ComponentElement, parent)

        case "container":
            return resolveContainerElement(bound as ContainerElement, parent)

        case "flatHtml":
            return resolveFlatHtmlElement(bound as FlatHtmlElement, parent)

        case "svg":
            return resolveSvgElement(bound as SvgElement, parent)

        default:
            return {
                tag: 'div',
                style: resolveBaseStyle(bound, parent),
                attrs: resolveAttrs(bound)
            }
    }
}

/**
 * Merges resolved variable-binding patches over the element before the rest
 * of resolution runs, so bound properties flow through the same type-specific
 * style resolvers as any literal value. `bindings` was, until now, a fully
 * built but unused engine (stores/variables.ts, utils/bindings.ts) — this is
 * the "plumbing, not architecture" step from CLEANUP_TODO.md Phase 3.10.
 *
 * Generic over section: `resolveBindings()` groups its patch by the path's
 * first segment (`'style.content'` → section `style`), so any section that's
 * actually a key on the element gets merged — `layout`/`style`/`effects`
 * (Phase 3.12), plus `attributes` and `props` (ComponentElement only, added
 * in Phase 3.14 when the Properties panel's binding picker started offering
 * native-prop and component-prop fields, not just style ones). A section
 * name that isn't a real key on this element (e.g. `props` on a non-component
 * element) is silently ignored rather than grafted on.
 *
 * Only single-level dot-paths ('style.content', 'layout.visible') are
 * supported, matching resolveBindings()'s own documented path shape — a
 * deeper path like 'style.font.size' resolves to a literal `"font.size"`
 * key, not a nested set, so bindings on nested style fields aren't
 * supported yet.
 *
 * Of resolveBindings()'s outputs, only `patch` (the variable → element read
 * direction) is consumed here:
 *   - `twoWayMap` (element → variable write-back) can't be handled in this
 *     pure/DOM-agnostic module — it needs the real DOM node and event
 *     listeners, so it's wired in render-bridge.ts's wireTwoWayBindings()
 *     (which reads `binding.twoWay` off the raw element directly).
 *   - the `children` repeat binding is likewise a render-time concern
 *     (render-bridge.ts reads it off the raw container to render per-item
 *     instances) — resolveBindings skips it, so it never lands in `patch`.
 *
 * `scope` carries the render-time context (repeat item, component instance
 * props) threaded down from render-bridge, so any `binding.item` / `binding.prop`
 * bindings resolve against it. undefined for a normal element on a page.
 */
function resolveElementBindings(el: Element, scope?: RenderScope): Element {
    if (!el.bindings || !Object.keys(el.bindings).length) return el

    const pageId = usePagesStore().activePageId ?? ''
    const { patch } = resolveBindings(el.bindings, pageId, scope)

    const bound: Record<string, unknown> = { ...el }
    for (const section of Object.keys(patch)) {
        if (!(section in bound)) continue
        bound[section] = { ...(bound[section] as Record<string, unknown> | undefined), ...patch[section] }
    }

    return bound as unknown as Element
}

/* ============================================================
   COMPONENTS
   ============================================================ */

/**
 * A component *instance* resolves to a plain wrapper box carrying its own
 * layout/style. Its content — the component definition's element tree, with the
 * instance's props substituted — is expanded by render-bridge.ts (which has the
 * component library and can recurse), not here. (Previously this returned
 * `tag: componentId`, which render-bridge then fed to `createElement()` → an
 * empty unknown element; components never actually rendered.)
 */
function resolveComponentElement(
    el: ComponentElement,
    parent?: Element
): ResolvedElement {
    return {
        tag: 'div',
        style: resolveBaseStyle(el, parent),
        attrs: resolveAttrs(el),
    }
}

/* ============================================================
   CONTAINERS
   ============================================================ */

function resolveContainerElement(
    el: ContainerElement,
    parent?: Element
): ResolvedElement {
    return {
        tag: CONTAINER_TAG_MAP[el.type] ?? "div",
        style: {
            ...resolveBaseStyle(el, parent),
            ...resolveContainerStyle(el.style)
        },
        attrs: resolveAttrs(el)
    }
}

/**
 * Display mode (block/flex/grid) is intentionally NOT decided here anymore.
 * It used to be — this function took `el.display` (ContainerElement.display,
 * a second, disconnected display model — see CLEANUP_TODO.md D1) and always
 * overrode `css.display` with it, running *after* resolveBaseStyle. That
 * unconditionally stomped whatever resolveLayout()/resolveDisplay() had just
 * set from `layout.mode` — meaning Layout.mode/direction/justify/align/wrap/gap
 * (what the Auto Layout panel actually edits) had zero visible effect on any
 * container, ever, because this always overwrote it back to `display.mode`
 * (frozen at 'block' since nothing else writes to it). `resolveLayout` is now
 * the sole authority on `display` for every element kind, containers included.
 */
function resolveContainerStyle(style: ContainerStyle): CSSProperties {
    const css: CSSProperties = {}

    if (style.background) css.background = style.background

    if (style.padding !== undefined) {
        const p = style.padding
        css.padding =
            typeof p === "number"
                ? `${p}px`
                : `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`
    }

    Object.assign(css, resolveBorder(style.border))

    if (style.radius !== undefined) {
        css.borderRadius =
            typeof style.radius === "number"
                ? `${style.radius}px`
                : `${style.radius.tl}px ${style.radius.tr}px ${style.radius.br}px ${style.radius.bl}px`
    }

    return css
  }

/* ============================================================
   FLAT HTML
   ============================================================ */

function resolveFlatHtmlElement(
    el: FlatHtmlElement,
    parent?: Element
): ResolvedElement {
    const style = {
        ...resolveBaseStyle(el, parent),
        ...resolveFlatHtmlTypeStyle(el)
    }

    // "Plain text" (type:'text') resolves to whichever tag layout.textTag
    // names (p/span/h1/h2/h3) — everything else keeps its fixed tag.
    const tag = el.type === "text" ? (el.layout.textTag ?? "p") : (FLAT_HTML_TAG_MAP[el.type] ?? "span")

    // A <span> is inline content, not a block box — forcing display:block
    // (resolveDisplay's default for mode:'flow') with an explicit width
    // carried over from when this was a <p> is exactly why toggling to
    // inline visibly did nothing to the width. Switching tag alone was
    // never enough; inline has to also mean "stop being a sized block."
    if (tag === "span") {
        style.display = "inline"
        style.width = "auto"
        style.height = "auto"
    }

    // Image/video/audio always render as their native tag, whether the
    // source is a locally-imported asset or a remote http(s) URL. This
    // used to auto-swap a remote-URL media element to an <iframe> — wrong:
    // <img>/<video>/<audio> are *designed* to load a remote URL directly
    // (same as any website does), no iframe needed, and iframe-wrapping
    // them meant the constraints an author sets (Fixed width/height, Fit)
    // landed on the iframe's own box while the real content — a nested
    // sub-document's <img>, entirely outside this app's DOM — ignored them.
    // A genuine embeddable page (YouTube, some other web widget) is a
    // different authoring need already served by its own distinct element
    // type — 'iframe' (element.builder.ts's buildIIframe(), reachable from
    // the Elements panel) — an author reaches for that directly rather than
    // this auto-detecting it from a media element's URL shape.
    const attrs = resolveFlatHtmlAttrs(el)

    return {
        tag,
        style,
        attrs,
        textContent: resolveFlatHtmlTextContent(el),
        children: resolveFlatHtmlChildrenForSelect(el)
    }
}

/* ============================================================
   SVG
   ============================================================ */

function resolveSvgElement(
    el: SvgElement,
    parent?: Element
): ResolvedElement {
    const { width, height } = resolveSvgDimensions(el)

    return {
        tag: "svg",
        namespace: 'svg',
        style: {
            ...resolveBaseStyle(el, parent),
            overflow: "visible"
        },
        attrs: {
            ...resolveAttrs(el),
            xmlns: "http://www.w3.org/2000/svg",
            width,
            height,
            viewBox: `0 0 ${width} ${height}`
        },
        children: [resolveSvgShapeElement(el)]
    }
}

/* ============================================================
   BASE STYLE PIPELINE
   ============================================================ */

function resolveBaseStyle(el: Element, parent?: Element): CSSProperties {
    return {
        ...resolveLayout(el.layout),
        ...resolveTransform(el.layout?.transform),
        ...resolveEffects(el.effects),
        ...resolveParentContext(el, parent)
    }
}

/**
 * layout.transform (rotation/scaleX/scaleY) was modeled on the type but never
 * actually emitted as CSS — Rotate/Scale/Flip controls updated state with no
 * visible effect on canvas. Flip is implemented upstream as a negative scale
 * (scaleX(-1) etc.), which this renders like any other scale value.
 */
function resolveTransform(transform?: Layout['transform']): CSSProperties {
    if (!transform) return {}
    const { rotation, scaleX, scaleY } = transform
    const parts: string[] = []

    if (rotation) parts.push(`rotate(${rotation}deg)`)
    if ((scaleX !== undefined && scaleX !== 1) || (scaleY !== undefined && scaleY !== 1)) {
        parts.push(`scale(${scaleX ?? 1}, ${scaleY ?? 1})`)
    }

    return parts.length ? { transform: parts.join(' ') } : {}
}

/* ============================================================
   PARENT CONTEXT (IMPORTANT FIX)
   ============================================================ */

function resolveParentContext(
    el: Element,
    parent?: Element
): CSSProperties {
    if (parent) {
        const p = parent.layout

        if (p?.mode === "flex") return resolveFlexChild(el, p)
        if (p?.mode === "grid") return resolveGridChild(el)
        return {}
    }

    // Root-level element (no Element parent) — the page itself can be in
    // flex/grid mode (Page['stage'].display.layout, see PageSettingsPanel.vue
    // / CLEANUP_TODO.md Phase 3.30). Not an Element, so it doesn't flow
    // through the parent.layout branch above; order/span still apply so a
    // page-root flex/grid layout gets the same per-child controls an
    // element-container one does.
    if (el.parentId) return {}
    const pageLayout = usePagesStore().getActivePageData()?.stage.display?.layout
    if (pageLayout?.mode === "flex") {
        return resolveFlexChild(el, { mode: "flex", direction: pageLayout.direction } as Layout)
    }
    if (pageLayout?.mode === "grid") {
        return resolveGridChild(el)
    }
    return {}
}

/* ============================================================
   LAYOUT
   ============================================================ */

function resolveLayout(layout: Layout): CSSProperties {
    const l = layout || ({ mode: "flow" } as Layout)

    return {
        ...resolveDisplay(l),
        ...resolveSpacing(l),
        ...resolveSizing(l),
        ...resolvePosition(l),
        ...resolveOverflow(l)
    }
}

/**
 * layout.overflow existed on the type but was never actually resolved to
 * CSS anywhere — completely dead, no way to even set it despite a field for
 * it. Default behavior: a "constrained" element (an explicit size — a fixed
 * px/%/vh/rem value, or 'fill' — rather than content-driven 'auto'/'hug')
 * gets `overflow: auto` by default, since content that exceeds an
 * explicitly-bounded box should scroll rather than silently spill out or
 * get clipped. An unconstrained ('auto'/'hug', the content-fits-box case)
 * element has nothing to overflow in the dimension that matters, so it's
 * left alone. An explicit layout.overflow always wins over this default —
 * the author can still choose 'visible' or 'hidden' outright.
 */
function resolveOverflow(l: Layout): CSSProperties {
    if (l.overflow) return { overflow: l.overflow }

    const isConstrained = (v: Size | undefined) => v !== undefined && v !== "auto" && v !== "hug"
    if (isConstrained(l.width) || isConstrained(l.height)) return { overflow: "auto" }

    return {}
}

function resolveDisplay(l: Layout): CSSProperties {
    if (l.visible === false) return { display: "none" }

    switch (l.mode) {
        case "flex":
            return {
                display: "flex",
                flexDirection: l.direction || "row",
                justifyContent: l.justify || "flex-start",
                alignItems: l.align || "stretch",
                flexWrap: l.wrap ? "wrap" : "nowrap",
                gap: l.gap || "0px"
            }

        case "grid":
            return {
                display: "grid",
                gridTemplateColumns: l.columns || "1fr",
                gridTemplateRows: l.rows || undefined,
                gap: l.gap || "0px"
            }

        default:
            return { display: "block" }
    }
}

function resolveSpacing(l: Layout): CSSProperties {
    return {
        padding: resolveBox(l.padding),
        margin: resolveBox(l.margin)
    }
}

/**
 * Per-side values come in two different shapes depending on caller: style.padding's
 * BoxEdges are bare numbers, layout.margin's Spacing per-side fields are already
 * unit-strings ("8px"). Blindly appending "px" to both (the old behaviour) produced
 * "8pxpx" for margin — invalid CSS, silently dropped by the browser, which is why
 * margin edits never visibly applied even once the value was stored correctly.
 */
function resolveBoxSide(v: number | string | undefined): string {
    if (v === undefined) return "0px"
    return typeof v === "number" ? `${v}px` : v
}

function resolveBox(value: unknown) {
    if (!value) return undefined
    if (typeof value === "number") return `${value}px`
    if (typeof value === "string") return value

    const box = value as { top?: number | string; right?: number | string; bottom?: number | string; left?: number | string }
    return `${resolveBoxSide(box.top)} ${resolveBoxSide(box.right)} ${resolveBoxSide(box.bottom)} ${resolveBoxSide(box.left)}`
}

function resolveCornerRadius(value: number | { tl: number; tr: number; br: number; bl: number } | undefined) {
    if (value === undefined) return undefined
    return typeof value === "number"
        ? `${value}px`
        : `${value.tl}px ${value.tr}px ${value.br}px ${value.bl}px`
}

/**
 * Uniform width uses the `border` shorthand as before. Per-side width can't
 * — `border: Npx solid red` only accepts one width for all four sides — so
 * it splits into the three longhands instead; `border-width` itself accepts
 * a 4-value shorthand in the exact top/right/bottom/left order BoxEdges
 * already stores, so no reordering needed.
 */
function resolveBorder(border: BorderStyle | undefined): CSSProperties {
    if (!border) return {}
    if (typeof border.width === "number") {
        return { border: `${border.width}px ${border.style} ${border.color}` }
    }
    const w = border.width
    return {
        borderWidth: `${w.top}px ${w.right}px ${w.bottom}px ${w.left}px`,
        borderStyle: border.style,
        borderColor: border.color,
    }
}

function resolveSizing(l?: Layout): CSSProperties {
    return {
        width: resolveSize(l?.width),
        height: resolveSize(l?.height)
    }
}

function resolveSize(value?: Size) {
    if (!value) return undefined

    switch (value) {
        case "auto":
            return "auto"
        case "hug":
            return "fit-content"
        case "fill":
            return "100%"
        default:
            return value
    }
}

function resolvePosition(l: Layout): CSSProperties {
    if (!l.position || l.position === "static") return {}

    return {
        position: l.position,
        top: l.y || "0px",
        left: l.x || "0px",
        zIndex: l.z ?? 1
    }
}

/* ============================================================
   CHILD LAYOUT RULES
   ============================================================ */

function resolveFlexChild(el: Element, parent: Layout): CSSProperties {
    const isRow = parent.direction !== "column"
    const css: CSSProperties = {}

    if (
        (isRow && el.layout?.width === "fill") ||
        (!isRow && el.layout?.height === "fill")
    ) {
        css.flexGrow = 1
    }

    if (el.layout?.order !== undefined) css.order = el.layout.order

    return css
}

/**
 * Used to unconditionally force width:100%/height:100% on every grid child
 * regardless of its own width/height setting — an 'auto' or 'hug' child
 * (deliberately content-sized) got stretched to fill its grid cell anyway,
 * the same "child's own sizing intent gets silently overridden" bug
 * resolveFlexChild never actually had (it only adds flexGrow, and only when
 * the child's own width/height is 'fill'). Matched to that existing,
 * correct behavior: only fill the cell when the child's own sizing says
 * 'fill', otherwise resolveSizing()'s already-computed width/height
 * (auto/hug/an explicit value) stands as-is.
 */
function resolveGridChild(el: Element): CSSProperties {
    const css: CSSProperties = {}

    if (el.layout?.width === "fill") css.width = "100%"
    if (el.layout?.height === "fill") css.height = "100%"
    if (el.layout?.order !== undefined) css.order = el.layout.order
    if (el.layout?.columnSpan) css.gridColumn = `span ${el.layout.columnSpan}`
    if (el.layout?.rowSpan) css.gridRow = `span ${el.layout.rowSpan}`

    return css
}

/* ============================================================
   EFFECTS
   ============================================================ */

function resolveEffects(effects: Effects): CSSProperties {
    const style: CSSProperties = {}

    if (effects.opacity !== 1) style.opacity = effects.opacity

    const filters: string[] = []

    if (effects.blur > 0) {
        filters.push(`blur(${effects.blur}px)`)
    }

    if (effects.shadow) {
        const { offsetX, offsetY, blur, color } = effects.shadow
        style.boxShadow = `${offsetX}px ${offsetY}px ${blur}px ${color}`
    }

    if (filters.length) style.filter = filters.join(" ")

    return style
}

/* ============================================================
   ATTRS
   ============================================================ */

function resolveAttrs(el: Element) {
    return el.attributes || {}
}


/* ============================================================
   MAPS
   ============================================================ */

const CONTAINER_TAG_MAP = {
    div: "div",
    section: "section",
    article: "article",
    header: "header",
    footer: "footer",
    nav: "nav",
    list: "ul",
    form: "form",
    group: "div",
    slot: "div"
} as const

const FLAT_HTML_TAG_MAP = {
    text: "p",
    image: "img",
    video: "video",
    audio: "audio",
    button: "button",
    textinput: "input",
    textarea: "textarea",
    select: 'select',
    checkbox: 'input',
    radio: 'input',
    iframe: 'iframe',
    code: 'code',
    label: "label",
    icon: "span"
} as const

/* ============================================================
   FLAT HTML HELPERS
   ============================================================ */

function resolveFlatHtmlTypeStyle(el: FlatHtmlElement): CSSProperties {
    switch (el.type) {
        case "text":
        case "label":
            return resolveTextStyle(el.style as TextStyle)
        case "button":
            return resolveButtonStyle(el.style as ButtonStyle)
        case "image":
            return resolveImageStyle(el.style as ImageStyle)
        case "textinput":
        case "select":
        case "checkbox":
        case "radio":
        case "textarea":
            return resolveInputStyle(el.style as InputStyle)
        case "code":
            return resolveCodeStyle(el.style as TextStyle)
        case "icon":
            return resolveIconStyle(el.style as IconStyle)
        default:
            return {}
    }
}

function resolveFlatHtmlAttrs(el: FlatHtmlElement) {
    const attrs = { ...resolveAttrs(el) }

    switch (el.type) {
        case "image": {
            const imageStyle = el.style as ImageStyle
            attrs.alt = attrs.alt ?? imageStyle.alt ?? ""
            break
        }

        case "video":
        case "audio": {
            attrs.controls = attrs.controls ?? true
            break
        }

        case "textinput": {
            attrs.type = attrs.type ?? "text"
            break
        }

        case "checkbox":
        case "radio": {
            attrs.type = el.type
            break
        }

        case "iframe": {
            attrs.title = attrs.title ?? "iframe"
            break
        }

        case "icon": {
            attrs["data-icon-name"] = attrs["data-icon-name"] ?? (el.style as IconStyle).name
            break
        }

        case "select": {
            delete attrs.options
            break
        }
    }

    return attrs
}

function resolveFlatHtmlChildrenForSelect(el: FlatHtmlElement): ResolvedElement[] | undefined {
    if (el.type !== "select") return undefined

    const attrs = resolveAttrs(el) as { options?: unknown; value?: unknown }
    const options = Array.isArray(attrs.options) && attrs.options.length ? attrs.options : ["Option 1", "Option 2", "Option 3"]
    const selectedValue = attrs.value

    return options.map((option, index) => {
        const label = String(option)
        return {
            tag: "option",
            style: {},
            attrs: {
                value: label,
                selected: selectedValue === undefined ? index === 0 : selectedValue === option
            },
            textContent: label
        }
    })
}

function resolveInputStyle(style: InputStyle): CSSProperties {
    return {
        background: style.background,
        padding: resolveBox(style.padding),
        ...resolveBorder(style.border),
        borderRadius: resolveCornerRadius(style.radius),
        color: style.textStyle?.color,
        fontSize: style.textStyle?.font?.size ? `${style.textStyle.font.size}px` : undefined,
        fontFamily: style.textStyle?.font?.family,
        fontWeight: style.textStyle?.font?.weight,
        fontStyle: style.textStyle?.font?.style,
        textAlign: style.textStyle?.align,
        lineHeight: style.textStyle?.lineHeight ? String(style.textStyle.lineHeight) : undefined,
        letterSpacing: style.textStyle?.letterSpacing ? `${style.textStyle.letterSpacing}px` : undefined,
        whiteSpace: style.textStyle?.whiteSpace,
        caretColor: style.placeholderColor
    }
}

function resolveCodeStyle(style: TextStyle): CSSProperties {
    return {
        ...resolveTextStyle(style),
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        whiteSpace: "pre-wrap",
        background: "#f5f5f5",
        padding: "8px 10px",
        borderRadius: "4px"
    }
}

function resolveSvgDimensions(el: SvgElement): { width: string; height: string } {
    const geometry = el.geometry

    switch (geometry.type) {
        case 'rect':
        case 'hotspot':
            return { width: `${geometry.width}`, height: `${geometry.height}` }
        case 'circle':
            return { width: `${geometry.r * 2}`, height: `${geometry.r * 2}` }
        case 'ellipse':
            return { width: `${geometry.rx * 2}`, height: `${geometry.ry * 2}` }
        case 'line':
            return { width: `${Math.abs(geometry.x2 - geometry.x1) || 1}`, height: `${Math.abs(geometry.y2 - geometry.y1) || 1}` }
        case 'polygon':
        case 'star':
        case 'arrow':
        case 'path':
            return {
                width: `${typeof el.layout.width === 'number' ? el.layout.width : 120}`,
                height: `${typeof el.layout.height === 'number' ? el.layout.height : 120}`
            }
    }
}

function resolveSvgShapeElement(el: SvgElement): ResolvedElement {
    const baseAttrs = resolveSvgShapeAttrs(el)

    const shapeNode: ResolvedElement = {
        tag: resolveSvgShapeTag(el),
        namespace: 'svg',
        style: {},
        attrs: baseAttrs
    }

    const textNode = el.style.textContent
        ? {
            tag: 'text',
            namespace: 'svg' as const,
            style: {},
            attrs: {
                x: el.style.textContent.placementH === 'left' ? '0%'
                    : el.style.textContent.placementH === 'right' ? '100%' : '50%',
                y: el.style.textContent.placementV === 'top' ? '0%'
                    : el.style.textContent.placementV === 'bottom' ? '100%' : '50%',
                'dominant-baseline': el.style.textContent.placementV === 'center' ? 'middle' : 'auto',
                'text-anchor': el.style.textContent.placementH === 'center' ? 'middle'
                    : el.style.textContent.placementH === 'right' ? 'end' : 'start',
                fill: el.style.textContent.text.color,
                'font-size': el.style.textContent.text.font.size,
                'font-family': el.style.textContent.text.font.family,
            },
            textContent: el.style.textContent.text.content
        }
        : null

    return textNode ? { ...shapeNode, children: [textNode] } : shapeNode
}

function resolveSvgShapeTag(el: SvgElement): string {
    switch (el.geometry.type) {
        case 'rect':
        case 'hotspot':
            return 'rect'
        case 'circle':
            return 'circle'
        case 'ellipse':
            return 'ellipse'
        case 'line':
            return 'line'
        case 'polygon':
        case 'star':
            return 'polygon'
        case 'arrow':
            return 'line'
        case 'path':
            return 'path'
    }
}

function resolveSvgShapeAttrs(el: SvgElement): Record<string, unknown> {
    const attrs: Record<string, unknown> = {
        fill: el.style.fill ?? 'none',
        stroke: el.style.stroke?.color ?? 'none',
        'stroke-width': String(el.style.stroke?.width ?? 0)
    }

    const strokeStyle = el.style.stroke?.style ?? 'solid'
    if (strokeStyle === 'dashed') attrs['stroke-dasharray'] = '6,3'
    else if (strokeStyle === 'dotted') attrs['stroke-dasharray'] = '2,2'

    switch (el.geometry.type) {
        case 'rect':
        case 'hotspot':
            attrs.width = el.geometry.width
            attrs.height = el.geometry.height
            if (el.style.radius !== undefined) {
                attrs.rx = typeof el.style.radius === 'number' ? el.style.radius : el.style.radius.tl
            }
            break
        case 'circle':
            attrs.cx = el.geometry.r
            attrs.cy = el.geometry.r
            attrs.r = el.geometry.r
            break
        case 'ellipse':
            attrs.cx = el.geometry.rx
            attrs.cy = el.geometry.ry
            attrs.rx = el.geometry.rx
            attrs.ry = el.geometry.ry
            break
        case 'line':
            attrs.x1 = el.geometry.x1
            attrs.y1 = el.geometry.y1
            attrs.x2 = el.geometry.x2
            attrs.y2 = el.geometry.y2
            break
        case 'polygon':
            attrs.points = el.geometry.points.map(point => `${point.x},${point.y}`).join(' ')
            break
        case 'star': {
            const starGeometry = el.geometry
            const points = Array.from({ length: starGeometry.points * 2 }, (_, index) => {
                const angle = (Math.PI / starGeometry.points) * index - Math.PI / 2
                const radius = index % 2 === 0 ? starGeometry.outerRadius : starGeometry.innerRadius
                const center = starGeometry.outerRadius
                return `${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)}`
            }).join(' ')
            attrs.points = points
            break
        }
        case 'arrow':
            attrs.x1 = el.geometry.from.x
            attrs.y1 = el.geometry.from.y
            attrs.x2 = el.geometry.to.x
            attrs.y2 = el.geometry.to.y
            break
        case 'path':
            attrs.d = el.geometry.commands.map(command => {
                switch (command.type) {
                    case 'M': return `M ${command.x} ${command.y}`
                    case 'L': return `L ${command.x} ${command.y}`
                    case 'C': return `C ${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`
                    case 'Q': return `Q ${command.x1} ${command.y1} ${command.x} ${command.y}`
                    case 'Z': return 'Z'
                }
            }).join(' ')
            break
    }

    return attrs
}


function resolveFlatHtmlTextContent(el: FlatHtmlElement) {
    // 'code' was missing here — buildCode() (element.builder.ts) sets
    // style.content same as text/button/label, but a code element's typed
    // content never actually rendered to the DOM until now; resolveCodeStyle
    // only ever produced CSS, this is what actually shows the text.
    if (["text", "button", "label", "code"].includes(el.type)) {
        return (el.style as TextStyle).content
    }
    return null
}

/* ============================================================
   TEXT / IMAGE / ICON (unchanged core logic)
   ============================================================ */

function resolveTextStyle(style: TextStyle): CSSProperties {
    return {
        fontSize: `${style.font.size}px`,
        fontWeight: style.font.weight ?? "normal",
        fontFamily: style.font.family || undefined,
        fontStyle: style.font.style ?? "normal",
        color: style.color,
        textAlign: style.align ?? "left",
        textTransform: style.transform && style.transform !== "normal" ? style.transform : undefined,
        textDecoration: style.decoration && style.decoration !== "none" ? style.decoration : undefined,
        lineHeight: style.lineHeight !== undefined ? String(style.lineHeight) : undefined,
        letterSpacing: style.letterSpacing !== undefined ? `${style.letterSpacing}px` : undefined,
        whiteSpace: style.whiteSpace ?? undefined
    }
}

function resolveButtonStyle(style: ButtonStyle): CSSProperties {
    return {
        ...resolveTextStyle(style),
        cursor: "pointer",
        background: style.background ?? "transparent",
        ...(style.border ? resolveBorder(style.border) : { border: "1px solid #ccc" }),
        borderRadius: resolveCornerRadius(style.radius),
        padding: style.padding !== undefined ? resolveBox(style.padding) : "4px 8px"
    }
}

function resolveImageStyle(style: ImageStyle): CSSProperties {
    return {
        objectFit: style.fit ?? "cover"
    }
}

function resolveIconStyle(style: IconStyle): CSSProperties {
    return {
        fontSize: style.size ? `${style.size}px` : undefined,
        color: style.color
    }
}