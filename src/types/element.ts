import { FlexDisplay, GridDisplay } from "./project";
import type { ElementCFProof } from "./cf-alignment.types";
import type { BindingMap } from "./variables";

/* ============================================================
   CORE LAYOUT & RESPONSIVE
   ============================================================ */

export type LayoutTransform = {
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
};

export type Spacing =
    | string
    | { top?: string; right?: string; bottom?: string; left?: string }

export type Size =
    | 'auto'
    | 'hug'
    | 'fill'
    | string

export interface Layout {
    mode: 'flow' | 'flex' | 'grid',
    position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky',
    transform?: LayoutTransform;
    visible?: boolean;
    locked?: boolean;
    padding?: Spacing
    margin?: Spacing
    gap?: string
    width?: Size
    height?: Size
    minWidth?: string
    maxWidth?: string
    minHeight?: string
    maxHeight?: string
    direction?: 'row' | 'column'
    justify?: string
    align?: string
    wrap?: boolean
    /** grid-template-columns, e.g. "1fr 1fr" or "repeat(3, 1fr)" — this element's own grid, when mode:'grid'. */
    columns?: string
    /** grid-template-rows — same free-text convention as columns. */
    rows?: string
    x?: string
    y?: string
    z?: number
    overflow?: 'visible' | 'hidden' | 'auto'
    /**
     * type:'text' only — which HTML tag this "Plain text" element resolves
     * to. Defaults to 'p'. 'span' is the "inline" case (see resolver.ts's
     * resolveFlatHtmlElement — a plain tag swap isn't enough on its own,
     * inline also forces display:inline + width/height:auto, since a real
     * <span> ignores an explicit block-era width anyway and the whole point
     * of switching to inline is to stop taking a fixed width). 'h1'/'h2'/'h3'
     * are the same text element, just resolving to a heading tag instead —
     * one element covers block text, inline text, and headings rather than
     * needing separate element kinds for each.
     */
    textTag?: 'p' | 'span' | 'h1' | 'h2' | 'h3'

    /**
     * Item-level properties — apply when *this* element is a direct child of
     * a flex/grid container (or the page root in flex/grid mode, see
     * Page['stage'].display.layout in project.ts), not to its own layout.
     * Gated in the UI (LayoutPanel.vue's "Item" section) on whether the
     * parent context is actually flex/grid — order/span on a flow child
     * would be a dead control, same reasoning as the resize-handle gating.
     */
    order?: number
    /** grid-column: span N — grid parent only. */
    columnSpan?: number
    /** grid-row: span N — grid parent only. */
    rowSpan?: number
}

export type BreakpointId = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type ResponsiveDelta<TStyle> = {
    breakpoint: BreakpointId;
    layout?: Partial<Layout>;
    style?: Partial<TStyle>;
    effects?: Partial<Effects>;
};

/* ============================================================
   INTERACTION & EFFECTS
   ============================================================ */

export interface AnimatableLayoutProps {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
}

export interface AnimatableEffectProps {
    opacity: number;
    blur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
}

export type AnimatableProps =
    Partial<AnimatableLayoutProps & AnimatableEffectProps>;

type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export type ElementEvent =
    | 'click'
    | 'dblclick'
    | 'mouseenter'
    | 'mouseleave'
    | 'pointerdown'
    | 'pointerup'
    | 'keypress';

export type ElementTrigger = {
    id: string;
    event: ElementEvent;
    actions: Array<{ type: string; params?: Record<string, unknown> }>;
};

export type ElementAnimation = {
    id: string;
    name?: string;
    from?: Partial<AnimatableProps & AnimatableEffectProps>;
    to: Partial<AnimatableProps & AnimatableEffectProps>;
    duration: number;
    delay?: number;
    easing?: Easing;
    loop?: boolean;
};

export interface Effects {
    opacity: number;
    blur: number;
    shadow?: {
        color: string;
        offsetX: number;
        offsetY: number;
        blur: number;
    };
}

/* ============================================================
   BASE ELEMENT
   ============================================================ */

export interface BaseElement<TStyle> {
    id: string;
    name: string;
    attributes?: Record<string, unknown>;
    kind: 'flatHtml' | 'container' | 'component' | 'svg';
    type: string;
    parentId?: string;
    layout: Layout;
    effects: Effects;
    style: TStyle;
    responsive?: ResponsiveDelta<TStyle>[];
    /** Variable bindings, keyed by dot-path into this element (e.g. 'style.content', 'layout.visible'). */
    bindings?: BindingMap;
    interaction: {
        triggers: ElementTrigger[];
        animations: ElementAnimation[];
    };
}

/* ============================================================
   HTML ELEMENTS (LEAF NODES)
   ============================================================ */

export type FlatHtml =
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'button'
    | 'textinput'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'textarea'
    | 'label'
    | 'iframe'
    | 'code'
    | 'icon';

export interface TextStyle {
    content: string;
    font: {
        family?: string;
        size: number;
        weight?: number | 'normal' | 'bold';
        style?: 'normal' | 'italic';
    };
    transform?: 'normal' | 'uppercase' | 'lowercase' | 'capitalize';
    color: string;
    align?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
    letterSpacing?: number;
    whiteSpace?: 'normal' | 'nowrap' | 'pre-wrap';
    decoration: 'underline' | 'line-through' | 'none';
}

/**
 * Button used to be styled with plain TextStyle — no background/border/radius
 * fields exist on that type, so a button could never actually have a fill,
 * stroke, or rounded corners; the resolver hardcoded a flat border/transparent
 * background instead. ButtonStyle extends TextStyle (keeps `content`, the
 * button's label) and adds the same box-ish fields InputStyle already has, so
 * FillStroke/RadiusPanel/PaddingPanel's existing `'x' in style` gates just
 * start working for buttons with no gating changes needed.
 */
export interface ButtonStyle extends TextStyle {
    background?: string;
    border?: BorderStyle;
    radius?: number | {
        tl: number;
        tr: number;
        br: number;
        bl: number;
    };
    padding?: number | BoxEdges;
}

export interface ImageStyle {
    alt?: string;
    fit?: 'cover' | 'contain' | 'fill' | 'none';
    position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
    filters?: {
        brightness?: number;
        contrast?: number;
        grayscale?: number;
        blur?: number;
    };
}

export interface MediaStyle {
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
}

export type InputType =
    | 'text'
    | 'password'
    | 'email'
    | 'number'
    | 'checkbox'
    | 'radio'
    | 'search'
    | 'tel'
    | 'url'
    | 'file'
    | 'range'
    | 'date';

export interface InputStyle {
    background?: string;
    padding?: number | BoxEdges;
    border?: BorderStyle;
    radius?: number | {
        tl: number;
        tr: number;
        br: number;
        bl: number;
    };
    placeholderColor?: string;
    textStyle?: Omit<TextStyle, 'content'>;
}

export interface IconStyle {
    name: string;
    size?: number;
    color?: string;
}

export interface FlatHtmlElement extends BaseElement<TextStyle | ButtonStyle | ImageStyle | MediaStyle | InputStyle | IconStyle> {
    kind: 'flatHtml';
    type: FlatHtml;
}

/* ============================================================
   CONTAINERS
   ============================================================ */

export type ContainerType =
    | 'div'
    | 'section'
    | 'article'
    | 'header'
    | 'footer'
    | 'nav'
    | 'list'
    | 'form'
    | 'group'
    /** A hole in a component definition; a component instance's children render
     *  here (render-bridge). In the definition editor it shows a placeholder. */
    | 'slot';

export interface ContainerStyle {
    background?: string;
    padding?: number | BoxEdges;
    border?: BorderStyle;
    radius?: number | {
        tl: number;
        tr: number;
        br: number;
        bl: number;
    };
}

export interface ContainerElement extends BaseElement<ContainerStyle> {
    kind: 'container';
    type: ContainerType;
    children: string[];
    display:
    | { mode: 'block' }
    | { mode: 'flex'; config: FlexDisplay }
    | { mode: 'grid'; config: GridDisplay };
    role?: 'list' | 'form' | 'navigation' | 'section';
}

/* ============================================================
   COMPONENT ELEMENTS
   ============================================================ */

export interface ComponentElement extends BaseElement<Record<string, unknown>> {
    kind: 'component';
    type: 'component';
    componentId: string;
    children: string[];
    props: Record<string, unknown>;
    slots?: Record<string, string[]>;

    /**
     * CF evidence proof — present only on components that constitute
     * a CF evidence demand (quiz, video demo, file upload, etc.).
     *
     * Only ComponentElements whose componentId appears in
     * EVIDENCE_COMPONENT_MAP may carry this field.
     *
     * The Inspector uses this to establish the PROVEN status of an
     * evidence demand. Without this, the demand is CLAIMED at best.
     *
     * Validated by: validateElementCFProof(componentId, cf_proof)
     * from cf-alignment.types.ts
     */
    cf_proof?: ElementCFProof;
}

/* ============================================================
   SVG / SHAPE ELEMENTS
   ============================================================ */

export type SvgShapeType =
    | 'rect'
    | 'circle'
    | 'ellipse'
    | 'line'
    | 'polygon'
    | 'star'
    | 'arrow'
    | 'path'
    | 'hotspot';

export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'Z' };

export interface SvgStyle {
    fill?: string;
    stroke?: {
        color: string;
        width: number;
        style?: 'solid' | 'dashed' | 'dotted';
    };
    opacity?: number;
    radius?: number | {
        tl: number;
        tr: number;
        br: number;
        bl: number;
    };
    arrow?: {
        start?: 'none' | 'arrow' | 'circle' | 'square' | 'diamond' | 'tee' | 'vee';
        end?: 'none' | 'arrow' | 'circle' | 'square' | 'diamond' | 'tee' | 'vee';
    };
    textContent?: {
        text: TextStyle;
        placementH: 'left' | 'center' | 'right';
        placementV: 'top' | 'center' | 'bottom';
        padding?: number;
    };
}

export interface SvgElement extends BaseElement<SvgStyle> {
    kind: 'svg';
    type: SvgShapeType;
    geometry:
    | { type: 'rect'; width: number; height: number }
    | { type: 'circle'; r: number }
    | { type: 'ellipse'; rx: number; ry: number }
    | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
    | { type: 'polygon'; points: Array<{ x: number; y: number }> }
    | { type: 'star'; points: number; innerRadius: number; outerRadius: number }
    | { type: 'arrow'; from: { x: number; y: number }; to: { x: number; y: number } }
    | { type: 'path'; commands: PathCommand[] }
    | { type: 'hotspot'; width: number; height: number };
}

/* ============================================================
   SHARED UTILS
   ============================================================ */

export interface BoxEdges {
    top: number;
    right: number;
    bottom: number;
    left: number;
    locked: boolean;
}

export interface BorderStyle {
    color: string;
    /** Uniform width, or per-side — same number|BoxEdges convention style.padding/radius already use. */
    width: number | BoxEdges;
    style: 'solid' | 'dashed' | 'dotted';
}

/* ============================================================
   FINAL ELEMENT UNION
   ============================================================ */

export type Element =
    | FlatHtmlElement
    | ContainerElement
    | ComponentElement
    | SvgElement;
