/**
 * element.mounter.ts
 *
 * Client-side DOM mounter.
 * - Builds DOM nodes from Element descriptors via createElement.
 * - Patches existing nodes in-place (preserves event listeners, state).
 * - Reconciles children by index.
 * - Wires triggers as addEventListener calls.
 * - Fires autoplay animations on mount.
 * - Exposes playTriggerAnimations for the action dispatcher to call.
 */

import type {
    Element,
    FlatHtmlElement,
    ContainerElement,
    SvgElement,
    TextStyle,
    ImageStyle,
    MediaStyle,
    InputStyle,
    IconStyle,
    ContainerStyle,
    Layout,
    Effects,
    BoxEdges,
    ElementTrigger,
    ElementAnimation,
} from '../types/element';

import { dispatchActions, type ActionContext } from './element.actions';
import { autoplay, playAnimations, cancelAllAnimations } from './element.animations';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ElementMap = Map<string, Element>;

/** Internal mount record — tracks what was last applied to a node. */
interface MountRecord {
    node: HTMLElement | SVGSVGElement;
    /** Cleanup functions for all registered event listeners */
    cleanupListeners: Array<() => void>;
}

const mountRegistry = new Map<string, MountRecord>();

// ─── HTML tag map ─────────────────────────────────────────────────────────────

const TAG_MAP: Record<string, string> = {
    text: 'p',
    image: 'img',
    video: 'video',
    audio: 'audio',
    button: 'button',
    input: 'input',
    textarea: 'textarea',
    label: 'label',
    icon: 'span',
    div: 'div',
    section: 'section',
    article: 'article',
    header: 'header',
    footer: 'footer',
    nav: 'nav',
    list: 'ul',
    form: 'form',
    group: 'div',
};

// ─── Style helpers ────────────────────────────────────────────────────────────

function applyLayout(node: HTMLElement, layout: Layout): void {
    const s = node.style;
    const { size, positioning, transform, visible } = layout;

    s.width = size.width === 'full' ? '100%'
        : size.width === 'auto' ? 'auto'
            : `${size.width}px`;

    s.height = size.height === 'full' ? '100%'
        : size.height === 'auto' ? 'auto'
            : `${size.height}px`;

    if (positioning.mode === 'absolute') {
        s.position = 'absolute';
        s.left = `${positioning.x}px`;
        s.top = `${positioning.y}px`;
        s.zIndex = String(positioning.zIndex);
    } else {
        s.position = '';
    }

    if (transform) {
        const parts: string[] = [];
        if (transform.rotation) parts.push(`rotate(${transform.rotation}deg)`);
        if (transform.scaleX) parts.push(`scaleX(${transform.scaleX})`);
        if (transform.scaleY) parts.push(`scaleY(${transform.scaleY})`);
        s.transform = parts.join(' ');
    }

    s.display = visible ? '' : 'none';
}

function applyEffects(node: HTMLElement, effects: Effects): void {
    const s = node.style;

    s.opacity = effects.opacity !== 1 ? String(effects.opacity) : '';

    const filters: string[] = [];
    if (effects.blur > 0) filters.push(`blur(${effects.blur}px)`);
    s.filter = filters.join(' ');

    if (effects.shadow) {
        const sh = effects.shadow;
        s.boxShadow = `${sh.offsetX}px ${sh.offsetY}px ${sh.blur}px ${sh.color}`;
    } else {
        s.boxShadow = '';
    }
}

function applyTextStyle(node: HTMLElement, style: TextStyle): void {
    const s = node.style;
    s.fontFamily = style.font.family ?? '';
    s.fontSize = `${style.font.size}px`;
    s.fontWeight = String(style.font.weight ?? 'normal');
    s.fontStyle = style.font.style ?? 'normal';
    s.color = style.color;
    s.textAlign = style.align ?? 'left';
    s.textDecoration = style.decoration !== 'none' ? style.decoration : 'none';
    s.textTransform = style.transform ?? 'none';
    s.lineHeight = String(style.lineHeight ?? 1.5);
    s.letterSpacing = style.letterSpacing ? `${style.letterSpacing}px` : '';
    s.whiteSpace = style.whiteSpace ?? 'normal';
    node.textContent = style.content;
}

function applyContainerStyle(node: HTMLElement, style: ContainerStyle, display: ContainerElement['display']): void {
    const s = node.style;

    s.background = style.background ?? '';

    if (style.padding !== undefined) {
        const p = style.padding;
        s.padding = typeof p === 'number'
            ? `${p}px`
            : `${(p as BoxEdges).top}px ${(p as BoxEdges).right}px ${(p as BoxEdges).bottom}px ${(p as BoxEdges).left}px`;
    }

    if (style.border) {
        s.border = `${style.border.width}px ${style.border.style} ${style.border.color}`;
    }

    if (display.mode === 'flex') {
        s.display = 'flex';
        s.flexDirection = display.config.direction;
        s.flexWrap = display.config.wrap ? 'wrap' : 'nowrap';
        s.gap = `${display.config.gap}px`;
        s.alignItems = display.config.alignItems;
        s.justifyContent = display.config.justifyContent;
    } else if (display.mode === 'grid') {
        s.display = 'grid';
        s.gridTemplateColumns = display.config.columns ?? '';
        s.gridTemplateRows = display.config.rows ?? '';
        s.gap = display.config.gap ? `${display.config.gap}px` : '';
    } else {
        s.display = 'block';
    }
}

// ─── Trigger wiring ───────────────────────────────────────────────────────────

/**
 * Collect all animation ids that are referenced by at least one trigger action.
 * These are excluded from autoplay.
 */
function collectTriggerBoundAnimationIds(triggers: ElementTrigger[]): Set<string> {
    const ids = new Set<string>();
    for (const trigger of triggers) {
        for (const action of trigger.actions) {
            if (action.type === 'playAnimation' && action.params?.animationId) {
                ids.add(action.params.animationId as string);
            }
        }
    }
    return ids;
}

/**
 * Wire all triggers onto the node.
 * Returns cleanup functions (call them before patching to avoid duplicate listeners).
 */
function wireTriggers(
    node: HTMLElement,
    triggers: ElementTrigger[],
    elementId: string,
): Array<() => void> {
    const cleanups: Array<() => void> = [];

    for (const trigger of triggers) {
        const handler = async (event: Event) => {
            const context: ActionContext = {
                sourceNode: node,
                sourceId: elementId,
                event,
            };
            await dispatchActions(trigger.actions, context);
        };

        node.addEventListener(trigger.event, handler);
        cleanups.push(() => node.removeEventListener(trigger.event, handler));
    }

    return cleanups;
}

// ─── Node creation ────────────────────────────────────────────────────────────

function createFlatHtmlNode(el: FlatHtmlElement): HTMLElement {
    const tag = TAG_MAP[el.type] ?? 'span';
    const node = document.createElement(tag);

    node.dataset.eid = el.id;

    applyLayout(node, el.layout);
    applyEffects(node, el.effects);

    switch (el.type) {
        case 'text':
        case 'button':
        case 'label':
            applyTextStyle(node, el.style as TextStyle);
            break;

        case 'image': {
            const s = el.style as ImageStyle;
            (node as HTMLImageElement).src = s.src;
            (node as HTMLImageElement).alt = s.alt ?? '';
            node.style.objectFit = s.fit ?? 'cover';
            node.style.objectPosition = s.position ?? 'center';
            break;
        }

        case 'video':
        case 'audio': {
            const s = el.style as MediaStyle;
            const media = node as HTMLMediaElement;
            media.src = s.src;
            media.autoplay = s.autoplay ?? false;
            media.loop = s.loop ?? false;
            media.muted = s.muted ?? false;
            media.controls = s.controls ?? false;
            break;
        }

        case 'input': {
            const s = el.style as InputStyle;
            const input = node as HTMLInputElement;
            input.placeholder = s.placeholder ?? '';
            input.disabled = s.disabled ?? false;
            input.required = s.required ?? false;
            if (s.value !== undefined) input.value = String(s.value);
            break;
        }

        case 'textarea': {
            const s = el.style as InputStyle;
            const ta = node as HTMLTextAreaElement;
            ta.placeholder = s.placeholder ?? '';
            ta.disabled = s.disabled ?? false;
            ta.required = s.required ?? false;
            if (s.value !== undefined) ta.value = String(s.value);
            break;
        }

        case 'icon': {
            const s = el.style as IconStyle;
            node.dataset.icon = s.name;
            if (s.size) node.style.fontSize = `${s.size}px`;
            if (s.color) node.style.color = s.color;
            break;
        }
    }

    return node;
}

function createContainerNode(
    el: ContainerElement,
    elementMap: ElementMap,
): HTMLElement {
    const tag = TAG_MAP[el.type] ?? 'div';
    const node = document.createElement(tag);

    node.dataset.eid = el.id;

    applyLayout(node, el.layout);
    applyEffects(node, el.effects);
    applyContainerStyle(node, el.style, el.display);

    for (const childId of el.children) {
        const childEl = elementMap.get(childId);
        if (childEl) {
            const childNode = createNode(childEl, elementMap);
            node.appendChild(childNode);
        }
    }

    return node;
}

function createSvgNode(el: SvgElement): HTMLElement {
    // We wrap the SVG in a div so we have an HTMLElement to attach
    // layout, effects, triggers and animations to uniformly.
    const wrapper = document.createElement('div');
    wrapper.dataset.eid = el.id;

    applyLayout(wrapper, el.layout);
    applyEffects(wrapper, el.effects);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');

    const { geometry, style } = el;
    const fill = style.fill ?? 'none';
    const stroke = style.stroke?.color ?? 'none';
    const strokeWidth = style.stroke?.width ?? 0;

    const applySharedAttrs = (shape: SVGElement) => {
        shape.setAttribute('fill', fill);
        shape.setAttribute('stroke', stroke);
        shape.setAttribute('stroke-width', String(strokeWidth));
        if (style.stroke?.style === 'dashed') shape.setAttribute('stroke-dasharray', '6,3');
        if (style.stroke?.style === 'dotted') shape.setAttribute('stroke-dasharray', '2,2');
    };

    switch (geometry.type) {
        case 'rect': {
            svg.setAttribute('width', String(geometry.width));
            svg.setAttribute('height', String(geometry.height));
            const r = typeof style.radius === 'number' ? style.radius : 0;
            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('width', String(geometry.width));
            rect.setAttribute('height', String(geometry.height));
            rect.setAttribute('rx', String(r));
            applySharedAttrs(rect);
            svg.appendChild(rect);
            break;
        }
        case 'circle': {
            const d = geometry.r * 2;
            svg.setAttribute('width', String(d));
            svg.setAttribute('height', String(d));
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', String(geometry.r));
            circle.setAttribute('cy', String(geometry.r));
            circle.setAttribute('r', String(geometry.r));
            applySharedAttrs(circle);
            svg.appendChild(circle);
            break;
        }
        case 'ellipse': {
            svg.setAttribute('width', String(geometry.rx * 2));
            svg.setAttribute('height', String(geometry.ry * 2));
            const ellipse = document.createElementNS(svgNS, 'ellipse');
            ellipse.setAttribute('cx', String(geometry.rx));
            ellipse.setAttribute('cy', String(geometry.ry));
            ellipse.setAttribute('rx', String(geometry.rx));
            ellipse.setAttribute('ry', String(geometry.ry));
            applySharedAttrs(ellipse);
            svg.appendChild(ellipse);
            break;
        }
        case 'line': {
            const { x1, y1, x2, y2 } = geometry;
            svg.setAttribute('width', String(Math.abs(x2 - x1) || 1));
            svg.setAttribute('height', String(Math.abs(y2 - y1) || 1));
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', String(x1));
            line.setAttribute('y1', String(y1));
            line.setAttribute('x2', String(x2));
            line.setAttribute('y2', String(y2));
            applySharedAttrs(line);
            svg.appendChild(line);
            break;
        }
        case 'polygon': {
            interface Point {
                x: number;
                y: number;
            }
            const pts = (geometry.points as Point[]).map((p: Point) => `${p.x},${p.y}`).join(' ');
            const polygon = document.createElementNS(svgNS, 'polygon');
            polygon.setAttribute('points', pts);
            applySharedAttrs(polygon);
            svg.appendChild(polygon);
            break;
        }
        case 'path': {
            interface PathCommand {
                type: 'M' | 'L' | 'C' | 'Q' | 'Z';
                x?: number;
                y?: number;
                x1?: number;
                y1?: number;
                x2?: number;
                y2?: number;
            }

            const d = (geometry.commands as PathCommand[]).map((cmd: PathCommand) => {
                switch (cmd.type) {
                    case 'M': return `M ${cmd.x} ${cmd.y}`;
                    case 'L': return `L ${cmd.x} ${cmd.y}`;
                    case 'C': return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
                    case 'Q': return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
                    case 'Z': return 'Z';
                }
            }).join(' ');
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', d);
            applySharedAttrs(path);
            svg.appendChild(path);
            break;
        }
    }

    wrapper.appendChild(svg);
    return wrapper;
}

function createNode(el: Element, elementMap: ElementMap): HTMLElement {
    switch (el.kind) {
        case 'flatHtml': return createFlatHtmlNode(el);
        case 'container': return createContainerNode(el, elementMap);
        case 'svg': return createSvgNode(el);
        case 'component': {
            const placeholder = document.createElement('div');
            placeholder.dataset.eid = el.id;
            placeholder.dataset.component = el.componentId;
            return placeholder;
        }
        default:
            throw new Error(`Unknown element kind: ${(el as any).kind}`);
    }
}

// ─── Patching ─────────────────────────────────────────────────────────────────

/**
 * Patch an existing node in-place.
 * Re-applies styles and attributes without replacing the node itself,
 * so existing state (focus, scroll, non-wired listeners) is preserved.
 * Children are reconciled by index.
 */
function patchNode(
    existing: HTMLElement,
    el: Element,
    elementMap: ElementMap,
): void {
    applyLayout(existing, el.layout);
    applyEffects(existing, el.effects);

    if (el.kind === 'flatHtml') {
        switch (el.type) {
            case 'text':
            case 'button':
            case 'label':
                applyTextStyle(existing, el.style as TextStyle);
                break;
            case 'image': {
                const s = el.style as ImageStyle;
                (existing as HTMLImageElement).src = s.src;
                (existing as HTMLImageElement).alt = s.alt ?? '';
                existing.style.objectFit = s.fit ?? 'cover';
                existing.style.objectPosition = s.position ?? 'center';
                break;
            }
            case 'input': {
                const s = el.style as InputStyle;
                const input = existing as HTMLInputElement;
                input.placeholder = s.placeholder ?? '';
                input.disabled = s.disabled ?? false;
                input.required = s.required ?? false;
                // Do NOT overwrite .value — user may have typed into it
                break;
            }
            case 'textarea': {
                const s = el.style as InputStyle;
                const ta = existing as HTMLTextAreaElement;
                ta.placeholder = s.placeholder ?? '';
                ta.disabled = s.disabled ?? false;
                ta.required = s.required ?? false;
                break;
            }
        }
    }

    if (el.kind === 'container') {
        applyContainerStyle(existing, el.style, el.display);

        const existingChildren = Array.from(existing.children) as HTMLElement[];
        const newChildren = el.children as string[];

        // Reconcile by index
        newChildren.forEach((childId, i) => {
            const childEl = elementMap.get(childId);
            if (!childEl) return;

            const existingChild = existingChildren[i] as HTMLElement | undefined;

            if (!existingChild) {
                // New child at this index — append
                existing.appendChild(mountElement(childEl, elementMap));
            } else if (existingChild.dataset.eid === childId) {
                // Same element at this index — patch recursively
                patchNode(existingChild, childEl, elementMap);
            } else {
                // Different element at this index — replace
                unmountElement(existingChild.dataset.eid!);
                existing.replaceChild(mountElement(childEl, elementMap), existingChild);
            }
        });

        // Remove surplus children beyond the new child count
        for (let i = newChildren.length; i < existingChildren.length; i++) {
            const surplus = existingChildren[i];
            unmountElement(surplus.dataset.eid!);
            existing.removeChild(surplus);
        }
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Mount an element into a parent DOM node.
 * If the element was previously mounted (same id already in DOM),
 * it patches the existing node instead of creating a new one.
 */
export function mountElement(
    el: Element,
    elementMap: ElementMap,
    parent?: HTMLElement,
): HTMLElement {
    const existing = mountRegistry.get(el.id);

    let node: HTMLElement;

    if (existing) {
        // Clean up old listeners before re-wiring
        for (const cleanup of existing.cleanupListeners) cleanup();
        existing.cleanupListeners = [];

        patchNode(existing.node as HTMLElement, el, elementMap);
        node = existing.node as HTMLElement;
    } else {
        node = createNode(el, elementMap);
        if (parent) parent.appendChild(node);
    }

    // Wire triggers
    const triggerBoundIds = collectTriggerBoundAnimationIds(el.interaction.triggers);
    const cleanupListeners = wireTriggers(node, el.interaction.triggers, el.id);

    mountRegistry.set(el.id, { node, cleanupListeners });

    // Autoplay animations (those not bound to any trigger)
    autoplay(node, el.interaction.animations, triggerBoundIds, el.id);

    return node;
}

/**
 * Unmount an element — cancels animations, removes listeners, removes from registry.
 * Does NOT remove the node from the DOM (caller decides).
 */
export function unmountElement(elementId: string): void {
    const record = mountRegistry.get(elementId);
    if (!record) return;

    for (const cleanup of record.cleanupListeners) cleanup();
    cancelAllAnimations(elementId);
    mountRegistry.delete(elementId);
}

/**
 * Play a specific set of animations on an already-mounted element.
 * Called by trigger action handlers — e.g. registerAction('playAnimation', ...).
 */
export function playElementAnimations(
    elementId: string,
    animationIds: string[],
    allAnimations: ElementAnimation[],
): void {
    const record = mountRegistry.get(elementId);
    if (!record) return;

    const toPlay = allAnimations.filter((a) => animationIds.includes(a.id));
    playAnimations(record.node as HTMLElement, toPlay, elementId);
}

/**
 * Get the mounted DOM node for an element id, if it exists.
 */
export function getMountedNode(elementId: string): HTMLElement | undefined {
    return mountRegistry.get(elementId)?.node as HTMLElement | undefined;
}