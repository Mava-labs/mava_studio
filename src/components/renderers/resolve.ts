/**
 * Resolver functions
 *
 * Pure functions that convert Element schema props into
 * CSS style objects and HTML attribute objects.
 * No DOM mutation — consumed by Vue renderer components.
 */
import type { CSSProperties } from 'vue'
import type {
    Layout,
    Effects,
    TextStyle,
    ImageStyle,
    MediaStyle,
    InputStyle,
    IconStyle,
    ContainerStyle,
    ContainerElement,
    FlatHtmlElement,
    SvgElement,
    BoxEdges,
    Size,
    Spacing,
    Element,
} from '../../types/element'

export interface ResolvedElement {
    tag: string
    style: CSSProperties
    attrs: Record<string, unknown>
}

export interface ResolvedFlatHtmlElement extends ResolvedElement {
    textContent: string | null
}

const CONTAINER_TAG_MAP: Record<ContainerElement['type'], string> = {
    div: 'div',
    section: 'section',
    article: 'article',
    header: 'header',
    footer: 'footer',
    nav: 'nav',
    list: 'ul',
    form: 'form',
    group: 'div',
}

const FLAT_HTML_TAG_MAP: Record<FlatHtmlElement['type'], string> = {
    text: 'p',
    image: 'img',
    video: 'video',
    audio: 'audio',
    button: 'button',
    input: 'input',
    textarea: 'textarea',
    label: 'label',
    icon: 'span',
}

export function resolveElement(el: Element, parent?: Element): ResolvedElement {
    switch (el.kind) {
        case 'container':
            return resolveContainerElement(el, parent)
        case 'flatHtml': {
            const { textContent: _textContent, ...resolved } = resolveFlatHtmlElement(el, parent)
            return resolved
        }
        case 'svg':
            return resolveSvgElement(el, parent)
        default:
            return {
                tag: resolveTag(el),
                style: resolveElementBaseStyle(el, parent),
                attrs: resolveAttrs(el),
            }
    }
}

export function resolveContainerElement(el: ContainerElement, parent?: Element): ResolvedElement {
    return {
        tag: CONTAINER_TAG_MAP[el.type] ?? 'div',
        style: {
            ...resolveElementBaseStyle(el, parent),
            ...resolveContainerStyle(el.style, el.display),
        },
        attrs: resolveAttrs(el),
    }
}

export function resolveFlatHtmlElement(el: FlatHtmlElement, parent?: Element): ResolvedFlatHtmlElement {
    const style = {
        ...resolveElementBaseStyle(el, parent),
        ...resolveFlatHtmlTypeStyle(el),
    }

    return {
        tag: FLAT_HTML_TAG_MAP[el.type] ?? 'span',
        style,
        attrs: {
            ...resolveAttrs(el),
            ...resolveFlatHtmlAttrs(el),
        },
        textContent: resolveFlatHtmlTextContent(el),
    }
}

export function resolveSvgElement(el: SvgElement, parent?: Element): ResolvedElement {
    return {
        tag: 'svg',
        style: {
            ...resolveElementBaseStyle(el, parent),
            overflow: 'visible',
        },
        attrs: resolveAttrs(el),
    }
}

function resolveTag(el: Element) {
    if (el.kind === 'flatHtml') return el.type
    if (el.kind === 'container') return el.type || 'div'
    return 'div'
}

function resolveElementBaseStyle(el: Element, parent?: Element): CSSProperties {
    const effectsStyle = el.kind === 'svg'
        ? resolveEffectsStyleSvg(el.effects)
        : resolveEffectsStyle(el.effects)

    return {
        ...resolveLayoutStyle(el.layout),
        ...resolveChildLayoutStyle(el, parent),
        ...effectsStyle,
    }
}

export function resolveLayoutStyle(layout: Layout): CSSProperties {
    const l = layout || ({ mode: 'flow' } as Layout)

    return {
        ...resolveDisplay(l),
        ...resolveSpacing(l),
        ...resolveSizing(l),
        ...resolveConstraints(l),
        ...resolvePosition(l),
    }
}

function resolveChildLayoutStyle(el: Element, parent?: Element): CSSProperties {
    if (!parent) return {}

    const p = parent.layout || ({ mode: 'flow' } as Layout)

    switch (p.mode) {
        case 'flex':
            return resolveFlexChild(el, p)
        case 'grid':
            return resolveGridChild()
        default:
            return {}
    }
}

function resolveAttrs(el: Element) {
    return el.attributes || {}
}

function resolveDisplay(l: Layout): CSSProperties {
    if (l.visible === false) {
        return {
            display: 'none',
        }
    }

    switch (l.mode) {
        case 'flex':
            return {
                display: 'flex',
                flexDirection: l.direction || 'row',
                justifyContent: l.justify || 'flex-start',
                alignItems: l.align || 'stretch',
                flexWrap: l.wrap ? 'wrap' : 'nowrap',
                gap: l.gap || '0px',
            }

        case 'grid':
            return {
                display: 'grid',
                gridTemplateColumns: l.columns || '1fr',
                gap: l.gap || '0px',
            }

        default:
            return {
                display: 'block',
            }
    }
}

function resolveSpacing(l: Layout): CSSProperties {
    return {
        padding: resolveBox(l.padding),
        margin: resolveBox(l.margin),
    }
}

function resolveBox(value: Spacing | undefined) {
    if (!value) return undefined

    if (typeof value === 'string') return value

    return [
        value.top || '0',
        value.right || '0',
        value.bottom || '0',
        value.left || '0',
    ].join(' ')
}

function resolveSizing(l?: Layout): CSSProperties {
    return {
        width: resolveSize(l?.width, 'width'),
        height: resolveSize(l?.height, 'height'),
        minWidth: l?.minWidth,
        maxWidth: l?.maxWidth,
    }
}

function resolveSize(value: Size | undefined, axis: 'width' | 'height') {
    if (!value) return undefined

    switch (value) {
        case 'auto':
            return 'auto'

        case 'hug':
            return axis === 'width' ? 'fit-content' : 'auto'

        case 'fill':
            return '100%'

        default:
            return value
    }
}

function resolvePosition(l: Layout): CSSProperties {
    if (!l.position || l.position === 'static') return {}

    return {
        position: l.position,
        top: l.y || '0px',
        left: l.x || '0px',
        zIndex: l.z ?? 1,
    }
}

function resolveFlexChild(el: Element, parentLayout: Layout): CSSProperties {
    const isRow = parentLayout.direction !== 'column'

    const style: CSSProperties = {}

    if (isRow) {
        if (el.layout?.width === 'fill') {
            style.flexGrow = 1
        }
    } else {
        if (el.layout?.height === 'fill') {
            style.flexGrow = 1
        }
    }

    return style
}

function resolveGridChild(): CSSProperties {
    const style: CSSProperties = {
        width: '100%',
        height: '100%',
    }

    return style
}

function resolveConstraints(l: Layout): CSSProperties {
    return {
        minHeight: l.minHeight,
        maxHeight: l.maxHeight,
        overflow: l.overflow,
    }
}


// ─── Effects ─────────────────────────────────────────────────────────────────

export function resolveEffectsStyle(effects: Effects): CSSProperties {
    const style: CSSProperties = {}

    if (effects.opacity !== 1)
        style.opacity = effects.opacity

    const filters: string[] = []
    if (effects.blur > 0)
        filters.push(`blur(${effects.blur}px)`)

    if (effects.shadow) {
        const { offsetX, offsetY, blur, color } = effects.shadow
        style.boxShadow = `${offsetX}px ${offsetY}px ${blur}px ${color}`
    }

    if (filters.length) style.filter = filters.join(' ')

    return style
}

/**
 * SVG elements can't use box-shadow — use drop-shadow filter instead.
 * Merges blur filter and shadow into a single filter string.
 */
export function resolveEffectsStyleSvg(effects: Effects): CSSProperties {
    const style: CSSProperties = {}

    if (effects.opacity !== 1)
        style.opacity = effects.opacity

    const filters: string[] = []
    if (effects.blur > 0)
        filters.push(`blur(${effects.blur}px)`)

    if (effects.shadow) {
        const { offsetX, offsetY, blur, color } = effects.shadow
        filters.push(`drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${color})`)
    }

    if (filters.length) style.filter = filters.join(' ')

    return style
}

// ─── Text ─────────────────────────────────────────────────────────────────────

export function resolveTextStyle(style: TextStyle): CSSProperties {
    const resolved: CSSProperties = {
        fontFamily: style.font.family ?? '',
        fontSize: `${style.font.size}px`,
        fontWeight: style.font.weight ?? 'normal',
        fontStyle: style.font.style ?? 'normal',
        color: style.color,
        textAlign: style.align ?? 'left',
        textDecoration: style.decoration,
        textTransform: style.transform ?? 'none',
        lineHeight: style.lineHeight ?? 1.5,
        whiteSpace: style.whiteSpace ?? 'normal',
    }

    if (style.letterSpacing !== undefined)
        resolved.letterSpacing = `${style.letterSpacing}px`

    return resolved
}

// ─── Image ────────────────────────────────────────────────────────────────────

export function resolveImageStyle(style: ImageStyle): CSSProperties {
    const css: CSSProperties = {
        objectFit: style.fit ?? 'cover',
        objectPosition: style.position ?? 'center',
    }

    if (style.filters) {
        const { brightness, contrast, grayscale, blur } = style.filters
        const parts: string[] = []
        if (brightness !== undefined) parts.push(`brightness(${brightness})`)
        if (contrast !== undefined) parts.push(`contrast(${contrast})`)
        if (grayscale !== undefined) parts.push(`grayscale(${grayscale})`)
        if (blur !== undefined) parts.push(`blur(${blur}px)`)
        if (parts.length) css.filter = parts.join(' ')
    }

    return css
}

export function resolveImageAttrs(style: ImageStyle): Record<string, string> {
    return {
        src: style.src,
        alt: style.alt ?? '',
    }
}

// ─── Media ────────────────────────────────────────────────────────────────────

export function resolveMediaAttrs(style: MediaStyle): Record<string, unknown> {
    return {
        src: style.src,
        autoplay: style.autoplay ?? false,
        loop: style.loop ?? false,
        muted: style.muted ?? false,
        controls: style.controls ?? false,
    }
}

// ─── Input / Textarea ─────────────────────────────────────────────────────────

export function resolveInputAttrs(style: InputStyle): Record<string, unknown> {
    return {
        placeholder: style.placeholder ?? '',
        disabled: style.disabled ?? false,
        required: style.required ?? false,
        // value intentionally omitted — user input owns it at runtime
    }
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

export function resolveIconStyle(style: IconStyle): CSSProperties {
    const css: CSSProperties = {}
    if (style.size) css.fontSize = `${style.size}px`
    if (style.color) css.color = style.color
    return css
}

export function resolveIconAttrs(style: IconStyle): Record<string, string> {
    return { 'data-icon': style.name }
}

// ─── Container ────────────────────────────────────────────────────────────────

export function resolveContainerStyle(
    style: ContainerStyle,
    display: ContainerElement['display'],
): CSSProperties {
    const css: CSSProperties = {}

    if (style.background) css.background = style.background

    if (style.padding !== undefined) {
        const p = style.padding
        css.padding = typeof p === 'number'
            ? `${p}px`
            : `${(p as BoxEdges).top}px ${(p as BoxEdges).right}px ${(p as BoxEdges).bottom}px ${(p as BoxEdges).left}px`
    }

    if (style.border)
        css.border = `${style.border.width}px ${style.border.style} ${style.border.color}`

    if (style.radius !== undefined)
        css.borderRadius = typeof style.radius === 'number'
            ? `${style.radius}px`
            : `${style.radius.tl}px ${style.radius.tr}px ${style.radius.br}px ${style.radius.bl}px`

    if (display.mode === 'flex') {
        css.display = 'flex'
        css.flexDirection = display.config.direction
        css.flexWrap = display.config.wrap
        css.gap = display.config.gap
        css.alignItems = display.config.alignItems
        css.justifyContent = display.config.justifyContent
    } else if (display.mode === 'grid') {
        css.display = 'grid'
        css.gridTemplateColumns = display.config.columns ?? ''
        css.gridTemplateRows = display.config.rows ?? ''
        css.gap = display.config.gap ?? ''
    } else {
        css.display = 'block'
    }

    return css
}

function resolveFlatHtmlTypeStyle(el: FlatHtmlElement): CSSProperties {
    switch (el.type) {
        case 'text':
        case 'button':
        case 'label':
            return resolveTextStyle(el.style as TextStyle)
        case 'image':
            return resolveImageStyle(el.style as ImageStyle)
        case 'icon':
            return resolveIconStyle(el.style as IconStyle)
        default:
            return {}
    }
}

function resolveFlatHtmlAttrs(el: FlatHtmlElement): Record<string, unknown> {
    switch (el.type) {
        case 'image':
            return resolveImageAttrs(el.style as ImageStyle)
        case 'video':
        case 'audio':
            return resolveMediaAttrs(el.style as MediaStyle)
        case 'input':
        case 'textarea':
            return resolveInputAttrs(el.style as InputStyle)
        case 'icon':
            return resolveIconAttrs(el.style as IconStyle)
        default:
            return {}
    }
}

function resolveFlatHtmlTextContent(el: FlatHtmlElement): string | null {
    if (el.type === 'text' || el.type === 'button' || el.type === 'label') {
        return (el.style as TextStyle).content
    }

    return null
}