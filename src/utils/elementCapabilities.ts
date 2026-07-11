/**
 * elementCapabilities.ts
 *
 * Whether a style panel applies to an element should be decided by the
 * element's TYPE (does its style shape declare this field per the type
 * system in types/element.ts), not by whether the field happens to already
 * exist on that specific element's saved data.
 *
 * The previous approach — checking `'radius' in style` etc. directly — broke
 * for any element created before a field was added to its style shape (old
 * buttons before ButtonStyle existed, and very plausibly old containers/divs
 * saved under an earlier project schema, before `radius`/`border`/`padding`
 * were part of what got written). Those elements structurally CAN have the
 * field (their type says so) but don't YET, and the panel's own update()
 * already adds it correctly via deepMerge on first edit — the gate just needs
 * to stop blocking on absence.
 *
 * Style-shape reference (types/element.ts):
 *   ContainerStyle  — background, padding, border, radius   (kind: 'container')
 *   InputStyle      — background, padding, border, radius   (textinput/textarea/select/checkbox/radio)
 *   ButtonStyle     — background, padding, border, radius   (button; extends TextStyle)
 *   SvgStyle        — fill, stroke, radius (rect only)       (kind: 'svg')
 *   TextStyle       — none of the above                      (text/label)
 */

import type { Element } from '../types/element';

const INPUT_TYPES = new Set(['textinput', 'textarea', 'select', 'checkbox', 'radio']);

/**
 * 'svg' → fill/stroke live at style.fill / style.stroke (SvgStyle).
 * 'box' → fill/stroke live at style.background / style.border (Container/Input/ButtonStyle).
 * null  → this element's style shape has neither concept (e.g. plain text/label).
 */
export function styleCapabilityMode(el: Element | null | undefined): 'svg' | 'box' | null {
    if (!el) return null;
    if (el.kind === 'svg') return 'svg';
    if (el.kind === 'container') return 'box';
    if (el.type === 'button') return 'box';
    if (INPUT_TYPES.has(el.type)) return 'box';
    return null;
}

/** ContainerStyle, InputStyle, ButtonStyle, and SvgStyle (rect) all declare `radius`. */
export function hasRadiusCapability(el: Element | null | undefined): boolean {
    return styleCapabilityMode(el) !== null;
}

/** Only the box-shaped styles have `padding` — SvgStyle doesn't. */
export function hasPaddingCapability(el: Element | null | undefined): boolean {
    return styleCapabilityMode(el) === 'box';
}
