import { FlexDisplay, GridDisplay } from "./project";

/**
 * Discriminated union of all element kinds that can appear on a page / inside a collection.
*
* NOTE: When adding a new type make sure to:
*  - Extend the `Element` union below with the appropriate style payload.
*  - Update any switch statements (renderers, class computation, creation helpers, history logic).
*  - Consider isolation / nesting semantics if it can contain children.
*/
export type ElementType =
| 'path'
| 'text'
| 'image'
| 'collection'
| 'component'
| 'container'
| ShapePreset;

export type Positioning =
  | { mode: 'flow' } // normal document flow (future-proof)
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
        width: number;
        height: number;
        locked?: boolean;
    };

    transform?: {
        rotation?: number;
        scaleX?: number;
        scaleY?: number;
    };

    visible?: boolean;
    locked?: boolean;
}


/** Named breakpoint ids for responsive overrides. */
export type BreakpointId = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type ResponsiveDelta<TStyle> = {
    breakpoint: BreakpointId;
    layout?: Partial<Layout>;
    style?: Partial<TStyle>;
};

export type ShapePreset = 
| 'line'
| 'rectangle'
| 'square'
| 'circle'
| 'ellipse'
| 'triangle'
| 'hexagon'
| 'star'
| 'arrow'
| 'hotspot'


/** Standard easing keywords for animation timelines. */
type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** DOM‑like events we surface for element trigger bindings. */
export type ElementEvent = 'click' | 'dblclick' | 'mouseenter' | 'mouseleave' | 'pointerdown' | 'pointerup' | 'keypress';

/**
 * A trigger binds an event to one or more actions (mini behaviour graph).
 * Actions are intentionally loose (type + params) so new behaviour can be added
 * without requiring a schema migration for existing documents.
*/
export type ElementTrigger = {
    /** Stable id (used by history + editing panels). */
    id: string;
    /** Event that fires this trigger. */
    event: ElementEvent;
    /** Ordered list of side‑effects (navigation, animation, property mutation, etc.). */
    actions: Array<{ type: string; params?: Record<string, unknown> }>; // e.g., navigate, playAnimation, setProp
};

/**
 * Lightweight keyframe animation descriptor.
 * Only simple numeric properties are supported for now (position, size, opacity, rotation).
*/
export type ElementAnimation = {
    id: string;
    /** Friendly name shown in timeline / inspector. */
    name?: string;
    /** Starting property overrides (falls back to current element state if omitted). */
    from?: Partial<{ x: number; y: number; width: number; height: number; opacity: number; rotation: number }>;
    /** Target property values (only specified keys animate). */
    to: Partial<{ x: number; y: number; width: number; height: number; opacity: number; rotation: number }>;
    /** Duration in milliseconds. */
    duration: number; // ms
    /** Optional initial delay before playing (ms). */
    delay?: number; // ms
    /** Easing function keyword. */
    easing?: Easing;
    /** If true the animation restarts automatically. */
    loop?: boolean;
};

export interface Effects {
    opacity?: number;
    blur?: number;
    shadow?: {
        color: string;
        offsetX: number;
        offsetY: number;
        blur: number;
    };
}


/**
 * Properties shared by every element variant.
 * Keep this intentionally compact – large optional branches should live in variant style objects.
 */
interface BaseElement<TStyle> {
    id: string;
    name: string;
    type: ElementType;

    parentId?: string;
    children?: string[];
    layout: Layout;
    effects: Effects;
    style: TStyle;

    responsive?: ResponsiveDelta<TStyle>[];

    interaction?: {
        triggers?: ElementTrigger[];
        animations?: ElementAnimation[];
    };
}


/** Styling for pure text elements. */
interface TextStyle {
    content: string;

    font: {
        family?: string;
        size: number;
        weight?: number | 'normal' | 'bold';
        style?: 'normal' | 'italic';
    };

    transform?: 'Normal' | 'uppercase' | 'lowercase' | 'capitalize';
    color: string;
    align?: 'left' | 'center' | 'right';
    lineHeight?: number;
    letterSpacing?: number;
    whiteSpace?: 'normal' | 'nowrap' | 'pre-wrap';

    decoration: 'underline' | 'line-through' | 'none';
}

/** Shared styling for simple shapes (rect, circle, hotspot, collection container). */
interface ShapeStyle {
    fill?: string;
    sides: number;

    textContent?: {
        text: TextStyle
        placementH: 'left' | 'center' | 'right';
        placementV: 'top' | 'center' | 'bottom';
    }

    isArrow?: {
        start?: 'none' | 'arrow' | 'circle' | 'square' | 'diamond' | 'tee' | 'vee';
        end?: 'none' | 'arrow' | 'circle' | 'square' | 'diamond' | 'tee' | 'vee';
    }

    stroke?: {
        color: string;
        width: number;
        style?: 'solid' | 'dashed' | 'dotted';
        sides: {
            top: boolean;
            right: boolean;
            bottom: boolean;
            left: boolean;
        }
    };

    radius?: number | {
        tl: number;
        tr: number;
        br: number;
        bl: number;
    };

    padding?: number | {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
}

interface ImageStyle {
    src: string;
    fit?: 'cover' | 'contain' | 'fill';
    filters?: {
        brightness?: number;
        contrast?: number;
        grayscale?: number;
        blur?: number;
    };
}

interface PathStyle {
    fill: string;
    stroke: {
        color: string;
        width: number;
        style?: 'solid' | 'dashed' | 'dotted';
    }
    closed: boolean;
    smooth: boolean;
}

/** Commands used to define the path of a free form element */
type PathCommand = 
    | { type: 'M'; x: number; y: number } // Move to
    | { type: 'L'; x: number; y: number } // Line to
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number } // Cubic Bezier
    | { type: 'Q'; x1: number; y1: number; x: number; y: number } // Quadratic Bezier
    | { type: 'Z' }; // Close path

/**
 * Final discriminated union tying each element `type` to its style payload.
 * Collections carry an additional `memberIds` list (composition) – their children
 * live as independent Element entries for simpler indexing / history, but inherit
 * relative positioning via `parentId`.
 */
export type Element =
    | (BaseElement<PathStyle> & { type: 'path'; commands: PathCommand[] })
    | (BaseElement<ShapeStyle> & { type: ShapePreset })
    | (BaseElement<ShapeStyle> & { type: 'collection'; memberIds: string[] })
    | (BaseElement<TextStyle> & { type: 'text' })
    | (BaseElement<ImageStyle> & { type: 'image' })
    | (BaseElement<{}> & { type: 'container' | 'component'; memberIds: string[], display: GridDisplay | FlexDisplay });