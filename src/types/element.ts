import { FlexDisplay, GridDisplay } from "./project";

/* ============================================================
   CORE LAYOUT & RESPONSIVE
   ============================================================ */

export type Positioning =
    | { mode: 'flow' }
    | {
        mode: 'absolute';
        anchor: 'parent' | 'page';
        x: number;
        y: number;
        zIndex: number;
    };

export interface Layout {
    positioning: Positioning;

    size: {
        width: number | 'full' | 'auto';
        height: number | 'full' | 'auto';
    };

    transform?: {
        rotation?: number;
        scaleX?: number;
        scaleY?: number;
    };

    visible: boolean;
    locked: boolean;
}

/** Named breakpoint ids for responsive overrides. */
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

/** Layout-derived animatable properties */
export interface AnimatableLayoutProps {
    x: number;
    y: number;
    width: number;
    height: number;

    rotation: number;
    scaleX: number;
    scaleY: number;
}

/** Effects-derived animatable properties */
export interface AnimatableEffectProps {
    opacity: number;
    blur: number;

    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
}

export type AnimatableProps =
    Partial<AnimatableLayoutProps & AnimatableEffectProps>;


/** Standard easing keywords for animation timelines. */
type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** DOM‑like events we surface for element trigger bindings. */
export type ElementEvent =
    | 'click'
    | 'dblclick'
    | 'mouseenter'
    | 'mouseleave'
    | 'pointerdown'
    | 'pointerup'
    | 'keypress';

/**
 * A trigger binds an event to one or more actions (mini behaviour graph).
 * Actions are intentionally loose (type + params) so new behaviour can be added
 * without requiring a schema migration for existing documents.
*/
export type ElementTrigger = {
    id: string;
    event: ElementEvent;
    /** Ordered list of side‑effects (navigation, animation, property mutation, etc.). */
    actions: Array<{ type: string; params?: Record<string, unknown> }>;
};

/**
 * Lightweight keyframe animation descriptor.
 * Only simple numeric properties are supported for now (position, size, opacity, rotation).
*/
export type ElementAnimation = {
    id: string;
    name?: string;
    /** Starting property overrides (falls back to current element state if omitted). */
    from?: Partial<AnimatableProps & AnimatableEffectProps>;
    /** Target property values (only specified keys animate). */
    to: Partial<AnimatableProps & AnimatableEffectProps>;
    duration: number;
    /** Optional initial delay before playing (ms). */
    delay?: number;
    easing?: Easing;
    /** If true the animation restarts automatically. */
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
/**
 * Properties shared by every element variant.
 * Keep this intentionally compact – large optional branches should live in variant style objects.
 */
export interface BaseElement<TStyle> {
    id: string;
    name: string;

    /** Structural family */
    kind: 'flatHtml' | 'container' | 'component' | 'svg';

    /** Concrete tag / role */
    type: string;

    parentId?: string;

    layout: Layout;
    effects: Effects;

    style: TStyle;
    responsive?: ResponsiveDelta<TStyle>[];

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
    | 'input'
    | 'textarea'
    | 'label'
    | 'icon';


/** Text style reused by HTML + SVG text overlays */
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

export interface ImageStyle {
    src: string;
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
    src: string;
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
    | 'date';

export interface InputStyle {
    value?: string | number | boolean;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
}

export interface IconStyle {
    name: string;        // icon id
    size?: number;
    color?: string;
}

export interface FlatHtmlElement extends BaseElement<TextStyle | ImageStyle | MediaStyle | InputStyle | IconStyle> {
    kind: 'flatHtml';
    type: FlatHtml;
};

/* ============================================================
   CONTAINERS (FLOW / LAYOUT BACKBONE)
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
    | 'group';

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

    /** Display & layout rules */
    display:
    | { mode: 'block' }
    | { mode: 'flex'; config: FlexDisplay }
    | { mode: 'grid'; config: GridDisplay };

    /** Optional semantic metadata */
    role?: 'list' | 'form' | 'navigation' | 'section';
}

/* ============================================================
   COMPONENT ELEMENTS (VUE-LIKE NODES)
   ============================================================ */

export interface ComponentElement extends BaseElement<Record<string, unknown>> {
    kind: 'component';
    type: 'component';

    componentId: string;

    /** External children (slots) */
    children: string[];

    /** Props passed to component */
    props: Record<string, unknown>;

    /** Slot mapping */
    slots?: Record<string, string[]>;
}

/* ============================================================
   SVG / SHAPE ELEMENTS (FREEFORM LAYER)
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

    /** Optional embedded text */
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

    /** Geometry payload */
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
    width: number;
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
