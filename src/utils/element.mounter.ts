/**
 * element.mounter.ts
 *
 * Builds, patches and tracks live DOM nodes from Element descriptors.
 * The apply-* functions are exported so the element store can call them
 * directly for surgical updates without a full remount.
 */

import type {
    Element, FlatHtmlElement, ContainerElement, SvgElement,
    TextStyle, ImageStyle, MediaStyle, InputStyle, IconStyle,
    ContainerStyle, SvgStyle, Layout, Effects, BoxEdges,
    ElementTrigger, ElementAnimation,
} from '../types/element';

import { dispatchActions, type ActionContext } from './element.actions';
import { autoplay, playAnimations, cancelAllAnimations } from './element.animations';

// ─── Internal registry ────────────────────────────────────────────────────────

export type ElementMap = Map<string, Element>;

/** Internal mount record — tracks what was last applied to a node. */
interface MountRecord {
    node: HTMLElement;
    /** Cleanup functions for all registered event listeners */
    cleanupListeners: Array<() => void>;
}

const mountRegistry = new Map<string, MountRecord>();

// ─── Tag map ─────────────────────────────────────────────────────────────────

const TAG_MAP: Record<string, string> = {
    text: 'p', image: 'img', video: 'video', audio: 'audio',
    button: 'button', input: 'input', textarea: 'textarea', label: 'label', icon: 'span',
    div: 'div', section: 'section', article: 'article', header: 'header',
    footer: 'footer', nav: 'nav', list: 'ul', form: 'form', group: 'div',
};

// ─── Exported apply functions (also used internally) ─────────────────────────

export function applyLayoutToNode(node: HTMLElement, layout: Layout): void {
    const s = node.style;
    const { size, positioning, transform, visible } = layout;

    s.width = size.width === 'full' ? '100%' : size.width === 'auto' ? 'auto' : `${size.width}px`;
    s.height = size.height === 'full' ? '100%' : size.height === 'auto' ? 'auto' : `${size.height}px`;

    if (positioning.mode === 'absolute') {
        s.position = 'absolute';
        s.left = `${positioning.x}px`;
        s.top = `${positioning.y}px`;
        s.zIndex = String(positioning.zIndex);
    } else {
        s.position = '';
        s.left = '';
        s.top = '';
        s.zIndex = '';
    }

    if (transform) {
        const parts: string[] = [];
        if (transform.rotation) parts.push(`rotate(${transform.rotation}deg)`);
        if (transform.scaleX) parts.push(`scaleX(${transform.scaleX})`);
        if (transform.scaleY) parts.push(`scaleY(${transform.scaleY})`);
        s.transform = parts.join(' ');
    } else {
        s.transform = '';
    }

    s.display = visible ? '' : 'none';
}

export function applyEffectsToNode(node: HTMLElement, effects: Effects): void {
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

export function applyTextStyleToNode(node: HTMLElement, style: TextStyle): void {
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

export function applyImageStyleToNode(node: HTMLElement, style: ImageStyle): void {
    const img = node as HTMLImageElement;
    img.src = style.src;
    img.alt = style.alt ?? '';
    node.style.objectFit = style.fit ?? 'cover';
    node.style.objectPosition = style.position ?? 'center';

    if (style.filters) {
        const f = style.filters;
        const parts: string[] = [];
        if (f.brightness !== undefined) parts.push(`brightness(${f.brightness})`);
        if (f.contrast !== undefined) parts.push(`contrast(${f.contrast})`);
        if (f.grayscale !== undefined) parts.push(`grayscale(${f.grayscale})`);
        if (f.blur !== undefined) parts.push(`blur(${f.blur}px)`);
        node.style.filter = parts.join(' ');
    }
}

export function applyContainerStyleToNode(
    node: HTMLElement,
    style: ContainerStyle,
    display: ContainerElement['display'],
): void {
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
    } else {
        s.border = '';
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

export function applySvgStyleToNode(wrapper: HTMLElement, style: SvgStyle): void {
    // The SVG wrapper div holds the <svg> as its first child
    const svg = wrapper.querySelector('svg');
    if (!svg) return;

    const fill = style.fill ?? 'none';
    const stroke = style.stroke?.color ?? 'none';
    const strokeWidth = style.stroke?.width ?? 0;
    const strokeStyle = style.stroke?.style ?? 'solid';
    const dashArray = strokeStyle === 'dashed' ? '6,3'
        : strokeStyle === 'dotted' ? '2,2'
            : '';

    // Apply to all shape children
    for (const shape of Array.from(svg.children) as SVGElement[]) {
        shape.setAttribute('fill', fill);
        shape.setAttribute('stroke', stroke);
        shape.setAttribute('stroke-width', String(strokeWidth));
        if (dashArray) shape.setAttribute('stroke-dasharray', dashArray);
        else shape.removeAttribute('stroke-dasharray');

        // Radius for rects
        if (shape.tagName === 'rect' && style.radius !== undefined) {
            const r = typeof style.radius === 'number' ? style.radius : style.radius.tl;
            shape.setAttribute('rx', String(r));
        }
    }
}

// ─── Trigger wiring ───────────────────────────────────────────────────────────

/**
 * Collect all animation ids that are referenced by at least one trigger action.
 * These are excluded from autoplay.
 */
function collectTriggerBoundAnimationIds(triggers: ElementTrigger[]): Set<string> {
    const ids = new Set<string>();
    for (const trigger of triggers)
        for (const action of trigger.actions)
            if (action.type === 'playAnimation' && action.params?.animationId)
                ids.add(action.params.animationId as string);
    return ids;
}

/**
 * Wire all triggers onto the node.
 * Returns cleanup functions (call them before patching to avoid duplicate listeners).
 */
function wireTriggers(node: HTMLElement, triggers: ElementTrigger[], elementId: string): Array<() => void> {
    return triggers.map((trigger) => {
        const handler = async (event: Event) => {
            await dispatchActions(trigger.actions, { sourceNode: node, sourceId: elementId, event } as ActionContext);
        };
        node.addEventListener(trigger.event, handler);
        return () => node.removeEventListener(trigger.event, handler);
    });
}

// ─── Node creation ────────────────────────────────────────────────────────────

function createFlatHtmlNode(el: FlatHtmlElement): HTMLElement {
    const tag = TAG_MAP[el.type] ?? 'span';
    const node = document.createElement(tag);
    node.dataset.eid = el.id;

    applyLayoutToNode(node, el.layout);
    applyEffectsToNode(node, el.effects);

    switch (el.type) {
        case 'text':
        case 'button':
        case 'label':
            applyTextStyleToNode(node, el.style as TextStyle);
            break;
        case 'image':
            applyImageStyleToNode(node, el.style as ImageStyle);
            break;
        case 'video':
        case 'audio': {
            const s = el.style as MediaStyle;
            const m = node as HTMLMediaElement;
            m.src = s.src; m.autoplay = s.autoplay ?? false;
            m.loop = s.loop ?? false; m.muted = s.muted ?? false; m.controls = s.controls ?? false;
            break;
        }
        case 'input': {
            const s = el.style as InputStyle;
            const i = node as HTMLInputElement;
            i.placeholder = s.placeholder ?? ''; i.disabled = s.disabled ?? false;
            i.required = s.required ?? false;
            if (s.value !== undefined) i.value = String(s.value);
            break;
        }
        case 'textarea': {
            const s = el.style as InputStyle;
            const t = node as HTMLTextAreaElement;
            t.placeholder = s.placeholder ?? ''; t.disabled = s.disabled ?? false;
            t.required = s.required ?? false;
            if (s.value !== undefined) t.value = String(s.value);
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

function createContainerNode(el: ContainerElement, elementMap: ElementMap): HTMLElement {
    const tag = TAG_MAP[el.type] ?? 'div';
    const node = document.createElement(tag);
    node.dataset.eid = el.id;

    applyLayoutToNode(node, el.layout);
    applyEffectsToNode(node, el.effects);
    applyContainerStyleToNode(node, el.style, el.display);

    for (const childId of el.children) {
        const child = elementMap.get(childId);
        if (child) node.appendChild(createNode(child, elementMap));
    }
    return node;
}

function createSvgNode(el: SvgElement): HTMLElement {
    // We wrap the SVG in a div so we have an HTMLElement to attach
    // layout, effects, triggers and animations to uniformly.
    const wrapper = document.createElement('div');
    wrapper.dataset.eid = el.id;
    applyLayoutToNode(wrapper, el.layout);
    applyEffectsToNode(wrapper, el.effects);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const { geometry, style } = el;

    const fill = style.fill ?? 'none';
    const stroke = style.stroke?.color ?? 'none';
    const strokeWidth = style.stroke?.width ?? 0;
    const strokeStyle = style.stroke?.style ?? 'solid';
    const dashArray = strokeStyle === 'dashed' ? '6,3' : strokeStyle === 'dotted' ? '2,2' : '';

    const applyAttrs = (shape: SVGElement) => {
        shape.setAttribute('fill', fill);
        shape.setAttribute('stroke', stroke);
        shape.setAttribute('stroke-width', String(strokeWidth));
        if (dashArray) shape.setAttribute('stroke-dasharray', dashArray);
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
            applyAttrs(rect); svg.appendChild(rect); break;
        }
        case 'circle': {
            const d = geometry.r * 2;
            svg.setAttribute('width', String(d)); svg.setAttribute('height', String(d));
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', String(geometry.r)); circle.setAttribute('cy', String(geometry.r));
            circle.setAttribute('r', String(geometry.r));
            applyAttrs(circle); svg.appendChild(circle); break;
        }
        case 'ellipse': {
            svg.setAttribute('width', String(geometry.rx * 2)); svg.setAttribute('height', String(geometry.ry * 2));
            const ellipse = document.createElementNS(svgNS, 'ellipse');
            ellipse.setAttribute('cx', String(geometry.rx)); ellipse.setAttribute('cy', String(geometry.ry));
            ellipse.setAttribute('rx', String(geometry.rx)); ellipse.setAttribute('ry', String(geometry.ry));
            applyAttrs(ellipse); svg.appendChild(ellipse); break;
        }
        case 'line': {
            const { x1, y1, x2, y2 } = geometry;
            svg.setAttribute('width', String(Math.abs(x2 - x1) || 1));
            svg.setAttribute('height', String(Math.abs(y2 - y1) || 1));
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
            line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
            applyAttrs(line); svg.appendChild(line); break;
        }
        case 'polygon': {

            interface Point {
                x: number;
                y: number;
            }

            const polygon = document.createElementNS(svgNS, 'polygon');
            polygon.setAttribute('points', geometry.points.map((p: Point) => `${p.x},${p.y}`).join(' '));
            applyAttrs(polygon); svg.appendChild(polygon); break;
        }
        case 'path': {

            interface PathCommand {
                type: 'M' | 'L' | 'C' | 'Q' | 'Z';
                x?: number; y?: number;
                x1?: number; y1?: number;
                x2?: number; y2?: number;
            }

            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', geometry.commands.map((cmd: PathCommand) => {
                switch (cmd.type) {
                    case 'M': return `M ${cmd.x} ${cmd.y}`;
                    case 'L': return `L ${cmd.x} ${cmd.y}`;
                    case 'C': return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
                    case 'Q': return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
                    case 'Z': return 'Z';
                }
            }).join(' '));
            applyAttrs(path); svg.appendChild(path); break;
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
            const ph = document.createElement('div');
            ph.dataset.eid = el.id; ph.dataset.component = el.componentId;
            return ph;
        }
        default:
            throw new Error(`Unknown element kind: ${(el as any).kind}`);
    }
}

// ─── Patch ────────────────────────────────────────────────────────────────────

/**
 * Patch an existing node in-place.
 * Re-applies styles and attributes without replacing the node itself,
 * so existing state (focus, scroll, non-wired listeners) is preserved.
 * Children are reconciled by index.
 */
function patchNode(existing: HTMLElement, el: Element, elementMap: ElementMap): void {
    applyLayoutToNode(existing, el.layout);
    applyEffectsToNode(existing, el.effects);

    if (el.kind === 'flatHtml') {
        switch (el.type) {
            case 'text':
            case 'button':
            case 'label': applyTextStyleToNode(existing, el.style as TextStyle); break;
            case 'image': applyImageStyleToNode(existing, el.style as ImageStyle); break;
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
        applyContainerStyleToNode(existing, el.style, el.display);

        const existingKids = Array.from(existing.children) as HTMLElement[];
        const newChildren = el.children as string[];

        // Reconcile children by index — if same id, patch; if different, replace; if new, append
        newChildren.forEach((childId, i) => {
            const childEl = elementMap.get(childId);
            if (!childEl) return;
            const existingChild = existingKids[i];
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
        for (let i = el.children.length; i < existingKids.length; i++) {
            unmountElement(existingKids[i].dataset.eid!);
            existing.removeChild(existingKids[i]);
        }
    }

    if (el.kind === 'svg') {
        applySvgStyleToNode(existing, el.style as SvgStyle);
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Mount an element into a parent DOM node.
 * If the element was previously mounted (same id already in DOM),
 * it patches the existing node instead of creating a new one.
 */
export function mountElement(el: Element, elementMap: ElementMap, parent?: HTMLElement): HTMLElement {
    const existing = mountRegistry.get(el.id);
    let node: HTMLElement;

    if (existing) {
        // If already mounted, patch the existing node and reuse it to preserve listeners and animation state.
        for (const cleanup of existing.cleanupListeners) cleanup();
        existing.cleanupListeners = [];

        patchNode(existing.node, el, elementMap);
        node = existing.node;
    } else {
        node = createNode(el, elementMap);
        if (parent) parent.appendChild(node);
    }

    // Trigger wiring and autoplay are done on every mount to ensure updates are applied even without a full remount.
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
 * Get the mounted DOM node for an element id, if it exists.
 */
export function getMountedNode(elementId: string): HTMLElement | undefined {
    return mountRegistry.get(elementId)?.node;
}

/**
 * Play a specific set of animations on an already-mounted element.
 * Called by trigger action handlers — e.g. registerAction('playAnimation', ...).
 */
export function playElementAnimations(
    elementId: string, animationIds: string[], allAnimations: ElementAnimation[],
): void {
    const record = mountRegistry.get(elementId);
    if (!record) return;
    playAnimations(record.node, allAnimations.filter((a) => animationIds.includes(a.id)), elementId);
}