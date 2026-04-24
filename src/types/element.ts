import { FlexDisplay, GridDisplay } from "./project";
import type { ElementCFProof } from "./cf-alignment.types";

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
    columns?: string
    x?: string
    y?: string
    z?: number
    overflow?: 'visible' | 'hidden' | 'auto'
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
    name: string;
    size?: number;
    color?: string;
}

export interface FlatHtmlElement extends BaseElement<TextStyle | ImageStyle | MediaStyle | InputStyle | IconStyle> {
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
