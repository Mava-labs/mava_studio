import type {
    FlatHtmlElement,
    ContainerElement,
    SvgElement,
    Element,
    Layout,
    Effects,
    TextStyle,
    ImageStyle,
    InputStyle,
    ContainerStyle,
    SvgStyle,
} from '../types/element';

export type InsertableType =
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'iframe'
    | 'button'
    | 'input'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'form'
    | 'list'
    | 'table'
    | 'code'
    | 'div'
    | 'section'
    | 'article'
    | 'header'
    | 'footer'
    | 'nav'
    | 'rectangle'
    | 'square'
    | 'circle'
    | 'ellipse'
    | 'triangle'
    | 'hexagon'
    | 'star'
    | 'arrow'
    | 'hotspot'
    | 'line'
    | 'path';

// ─── Shared defaults ────────────────────────────────────────────────────────

const uid = (): string => Math.random().toString(36).slice(2, 9);

const defaultLayout = (width: Layout['width'] = 'auto', height: Layout['height'] = 'auto'): Layout => ({
    mode: 'flow',
    position: 'static',
    width,
    height,
    visible: true,
    locked: false,
});

const defaultEffects = (): Effects => ({
    opacity: 1,
    blur: 0,
});

const defaultInteraction = () => ({
    triggers: [],
    animations: [],
});

// ─── FlatHtml builders ───────────────────────────────────────────────────────

export function buildText(): FlatHtmlElement {
    const style: TextStyle = {
        content: '',
        font: { size: 16, weight: 'normal', style: 'normal' },
        color: '#000000',
        align: 'left',
        decoration: 'none',
        lineHeight: 1.5,
        whiteSpace: 'normal',
    };

    return {
        id: uid(),
        name: 'Text',
        kind: 'flatHtml',
        type: 'text',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

export function buildImage(): FlatHtmlElement {
    const style: ImageStyle = {
        src: '',
        alt: '',
        fit: 'cover',
        position: 'center',
    };

    return {
        id: uid(),
        name: 'Image',
        kind: 'flatHtml',
        type: 'image',
        layout: {
            ...defaultLayout('300px', '200px'),
        },
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

export function buildButton(): FlatHtmlElement {
    const style: TextStyle = {
        content: 'Button',
        font: { size: 14, weight: 'bold' },
        color: '#ffffff',
        align: 'center',
        decoration: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
    };

    return {
        id: uid(),
        name: 'Button',
        kind: 'flatHtml',
        type: 'button',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

export function buildInput(): FlatHtmlElement {
    const style: InputStyle = {
        value: '',
        placeholder: '',
        disabled: false,
        required: false,
    };

    return {
        id: uid(),
        name: 'Input',
        kind: 'flatHtml',
        type: 'input',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

export function buildTextarea(): FlatHtmlElement {
    const style: InputStyle = {
        value: '',
        placeholder: '',
        disabled: false,
        required: false,
    };

    return {
        id: uid(),
        name: 'Textarea',
        kind: 'flatHtml',
        type: 'textarea',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

export function buildLabel(): FlatHtmlElement {
    const style: TextStyle = {
        content: 'Label',
        font: { size: 14, weight: 'normal' },
        color: '#000000',
        align: 'left',
        decoration: 'none',
        lineHeight: 1.4,
    };

    return {
        id: uid(),
        name: 'Label',
        kind: 'flatHtml',
        type: 'label',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

// ─── Container builders ──────────────────────────────────────────────────────

function buildContainer(
    type: ContainerElement['type'],
    name: string
): ContainerElement {
    const style: ContainerStyle = {
        background: '#0000ff',
        padding: 0,
        border: { color: '#000000', width: 1, style: 'solid' },
        radius: 0,
    };

    return {
        id: uid(),
        name,
        kind: 'container',
        type,
        children: [],
        display: { mode: 'block' },
        layout: defaultLayout('fill', '30px'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

function buildFlatHtmlGeneric(type: FlatHtmlElement['type']): FlatHtmlElement {
    return {
        id: uid(),
        name: type.charAt(0).toUpperCase() + type.slice(1),
        kind: 'flatHtml',
        type,
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: { src: '', autoplay: false, loop: false, muted: false, controls: true },
    }
}

function buildContainerGeneric(type: ContainerElement['type'], name: string): ContainerElement {
    return {
        id: uid(),
        name,
        kind: 'container',
        type,
        children: [],
        display: { mode: 'block' },
        layout: defaultLayout('fill', '30px'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: { background: 'transparent', padding: 0 } as ContainerStyle,
    }
}

export function buildElement(type: InsertableType): Element {
    switch (type) {
        case 'text':
            return buildText();
        case 'image':
            return buildImage();
        case 'video':
            return buildFlatHtmlGeneric('video');
        case 'audio':
            return buildFlatHtmlGeneric('audio');
        case 'iframe':
            return buildFlatHtmlGeneric('video');
        case 'button':
            return buildButton();
        case 'input':
        case 'select':
        case 'checkbox':
        case 'radio':
            return buildInput();
        case 'form':
            return buildForm();
        case 'list':
            return buildList();
        case 'table':
            return buildContainerGeneric('div', 'Table');
        case 'code':
            return buildFlatHtmlGeneric('textarea');
        case 'div':
            return buildDiv();
        case 'section':
            return buildSection();
        case 'article':
            return buildArticle();
        case 'header':
            return buildHeader();
        case 'footer':
            return buildFooter();
        case 'nav':
            return buildNav();
        case 'rectangle':
            return buildRect();
        case 'square': {
            const el = buildRect();
            el.name = 'Square';
            el.geometry = { type: 'rect', width: 100, height: 100 };
            el.layout = defaultLayout('100px', '100px');
            return el;
        }
        case 'circle':
            return buildCircle();
        case 'ellipse':
            return buildEllipse();
        case 'triangle': {
            const el = buildPath();
            el.name = 'Triangle';
            el.type = 'polygon';
            el.geometry = { type: 'polygon', points: [{ x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
            el.layout = defaultLayout('100px', '100px');
            return el;
        }
        case 'hexagon': {
            const el = buildPath();
            el.name = 'Hexagon';
            el.type = 'polygon';
            const r = 60, cx = 60, cy = 60;
            el.geometry = {
                type: 'polygon',
                points: Array.from({ length: 6 }, (_, i) => {
                    const a = (Math.PI / 180) * (60 * i);
                    return { x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)) };
                }),
            };
            el.layout = defaultLayout('120px', '120px');
            return el;
        }
        case 'star': {
            const el = buildPath();
            el.name = 'Star';
            el.type = 'star';
            el.geometry = { type: 'star', points: 5, innerRadius: 20, outerRadius: 50 };
            el.layout = defaultLayout('100px', '100px');
            return el;
        }
        case 'arrow': {
            const el = buildPath();
            el.name = 'Arrow';
            el.type = 'arrow';
            el.geometry = { type: 'arrow', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } };
            el.layout = defaultLayout('100px', '20px');
            return el;
        }
        case 'hotspot': {
            const el = buildRect();
            el.name = 'Hotspot';
            el.type = 'hotspot';
            el.geometry = { type: 'hotspot', width: 100, height: 100 };
            el.layout = defaultLayout('100px', '100px');
            return el;
        }
        case 'line':
            return buildLine();
        case 'path':
            return buildPath();
    }
}

export const buildDiv = (): ContainerElement => buildContainer('div', 'Div');
export const buildSection = (): ContainerElement => buildContainer('section', 'Section');
export const buildArticle = (): ContainerElement => buildContainer('article', 'Article');
export const buildHeader = (): ContainerElement => buildContainer('header', 'Header');
export const buildFooter = (): ContainerElement => buildContainer('footer', 'Footer');
export const buildNav = (): ContainerElement => buildContainer('nav', 'Nav');
export const buildForm = (): ContainerElement => buildContainer('form', 'Form');
export const buildList = (): ContainerElement => buildContainer('list', 'List');

// ─── SVG builders ────────────────────────────────────────────────────────────

const defaultSvgStyle = (): SvgStyle => ({
    fill: '#d4d4d4',
    stroke: { color: '#a3a3a3', width: 1, style: 'solid' },
});

export function buildRect(): SvgElement {
    return {
        id: uid(),
        name: 'Rectangle',
        kind: 'svg',
        type: 'rect',
        geometry: { type: 'rect', width: 200, height: 100 },
        layout: defaultLayout('200px', '100px'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: { ...defaultSvgStyle(), radius: 0 },
    };
}

export function buildCircle(): SvgElement {
    return {
        id: uid(),
        name: 'Circle',
        kind: 'svg',
        type: 'circle',
        geometry: { type: 'circle', r: 50 },
        layout: defaultLayout('100px', '100px'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: defaultSvgStyle(),
    };
}

export function buildEllipse(): SvgElement {
    return {
        id: uid(),
        name: 'Ellipse',
        kind: 'svg',
        type: 'ellipse',
        geometry: { type: 'ellipse', rx: 100, ry: 50 },
        layout: defaultLayout('200px', '100px'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: defaultSvgStyle(),
    };
}

export function buildLine(): SvgElement {
    return {
        id: uid(),
        name: 'Line',
        kind: 'svg',
        type: 'line',
        geometry: { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
        layout: defaultLayout('100px', '1px'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: {
            fill: 'none',
            stroke: { color: '#000000', width: 1, style: 'solid' },
        },
    };
}

export function buildPath(): SvgElement {
    return {
        id: uid(),
        name: 'Path',
        kind: 'svg',
        type: 'path',
        geometry: {
            type: 'path',
            commands: [
                { type: 'M', x: 0, y: 0 },
                { type: 'L', x: 100, y: 0 },
                { type: 'Z' },
            ],
        },
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: defaultSvgStyle(),
    };
}