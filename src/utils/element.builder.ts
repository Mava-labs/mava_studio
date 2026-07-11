import type {
    FlatHtmlElement,
    ContainerElement,
    ComponentElement,
    SvgElement,
    Element,
    Layout,
    Effects,
    TextStyle,
    ButtonStyle,
    ImageStyle,
    InputStyle,
    ContainerStyle,
    SvgStyle,
    InputType,
} from '../types/element';

export type InsertableType =
    | 'text'
    | 'textarea'
    | 'label'
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
    | 'slot'
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

/** Build a fresh instance of a library component to place on a page. */
export function buildComponentInstance(componentId: string, name: string): ComponentElement {
    return {
        id: uid(),
        name,
        kind: 'component',
        type: 'component',
        componentId,
        children: [],
        props: {},
        slots: {},
        layout: defaultLayout(),
        effects: defaultEffects(),
        style: {},
        interaction: defaultInteraction(),
    };
}

// ─── FlatHtml builders ───────────────────────────────────────────────────────

export function buildText(): FlatHtmlElement {
    const style: TextStyle = {
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
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
        fit: 'cover',
        position: 'center',
        filters: {
            brightness: 0,
        },
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
        attributes: { src: '', alt: 'add image source' },
    };
}

export function buildButton(): FlatHtmlElement {
    const style: ButtonStyle = {
        content: 'Button',
        font: { size: 14, weight: 'bold' },
        color: '#ffffff',
        align: 'center',
        decoration: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        background: '#3b82f6',
        border: { color: '#3b82f6', width: 0, style: 'solid' },
        radius: 6,
        padding: { top: 8, right: 16, bottom: 8, left: 16, locked: false },
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
        attributes: { href: '', target: '_blank', role: 'button' },
    };
}

export function buildInput(type: InputType): FlatHtmlElement {
    const style: InputStyle = {
        ...buildText().style,
        background: '#ffffff',
        padding: 5,
        border: { color: '#cccccc', width: 1, style: 'solid' },
        radius: 0,
        placeholderColor: '#cccccc',
    };

    return {
        id: uid(),
        name: 'Input',
        kind: 'flatHtml',
        type: 'textinput',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
        attributes: type === 'checkbox' || type === 'radio'
            ? { type, checked: false }
            : { type, value: '', placeholder: 'Enter text', disabled: false, required: false },
    };
}

export function buildSelect(): FlatHtmlElement {
    const style: InputStyle = {
        ...buildText().style,
        background: '#ffffff',
        padding: 5,
        border: { color: '#cccccc', width: 1, style: 'solid' },
        radius: 0,
        placeholderColor: '#cccccc',
    };

    return {
        id: uid(),
        name: 'Select',
        kind: 'flatHtml',
        type: 'select',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
        attributes: { options: ['Option 1', 'Option 2', 'Option 3'], value: '', disabled: false, required: false },
    };
}

export function buildTextarea(): FlatHtmlElement {
    const style: InputStyle = {
        ...buildText().style,
        background: '#ffffff',
        padding: 5,
        border: { color: '#cccccc', width: 1, style: 'solid' },
        radius: 0,
        placeholderColor: '#cccccc',
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
        attributes: { rows: 4, cols: 50, placeholder: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', disabled: false, required: false },
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

export function buildCode(): FlatHtmlElement {
    const style: TextStyle = {
        content: 'let info =  "Lorem ipsum dolor sit amet"',
        decoration: 'none',
        lineHeight: 1.4,
        font: {
            family: undefined,
            size: 0,
            weight: undefined,
            style: undefined
        },
        color: ''
    }

    return {
        id: uid(),
        name: 'Code',
        kind: 'flatHtml',
        type: 'code',
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style
    }

}

function buildIIframe(): FlatHtmlElement {
    return {
        id: uid(),
        name: 'Iframe',
        kind: 'flatHtml',
        type: 'iframe',
        layout: defaultLayout('300px', '200px'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: { border: { color: '#cccccc', width: 1, style: 'solid' } },
        attributes: { src: '', title: 'add iframe source', allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowFullscreen: false },
    };
}

// ─── Container builders ──────────────────────────────────────────────────────

function buildContainer(
    type: ContainerElement['type'],
    name: string
): ContainerElement {
    const style: ContainerStyle = {
        background: '#0000ff',
        padding: 5,
        border: { color: '#ff0000', width: 2, style: 'solid' },
        radius: 5,
    };

    return {
        id: uid(),
        name,
        kind: 'container',
        type,
        children: [],
        display: { mode: 'block' },
        layout: defaultLayout('fill'),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style,
    };
}

function buildMediaGeneric(type: FlatHtmlElement['type']): FlatHtmlElement {
    return {
        id: uid(),
        name: type.charAt(0).toUpperCase() + type.slice(1),
        kind: 'flatHtml',
        type,
        layout: defaultLayout(),
        effects: defaultEffects(),
        interaction: defaultInteraction(),
        style: {},
        attributes: { src: '', autoplay: false, loop: false, muted: false, controls: true },
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
        style: { background: 'transparent', padding: 5 } as ContainerStyle,
    }
}


export function buildElement(type: InsertableType): Element {
    switch (type) {
        case 'text':
            // 'text' is a real paragraph — buildText(), type:'text', tag <p>
            // (see FLAT_HTML_TAG_MAP in resolver.ts). This used to call
            // buildTextarea() instead, so the "Text" button in the Elements
            // panel silently inserted a multi-line <textarea> input control
            // rather than a plain text block; buildText() existed the whole
            // time but was never actually reachable from the UI. The real
            // textarea is now its own separate 'textarea' insertable so
            // nothing is lost by fixing this.
            return buildText();
        case 'textarea':
            return buildTextarea();
        case 'label':
            return buildLabel();
        case 'image':
            return buildImage();
        case 'video':
            return buildMediaGeneric('video');
        case 'audio':
            return buildMediaGeneric('audio');
        case 'iframe':
            return buildIIframe();
        case 'button':
            return buildButton();
        case 'input':
            return buildInput('text');
        case 'checkbox':
            return buildInput('checkbox');
        case 'radio':
            return buildInput('radio');
        case 'select':
            return buildSelect();
        case 'form':
            return buildForm();
        case 'list':
            return buildList();
        case 'table':
            return buildContainerGeneric('div', 'Table');
        case 'code':
            return buildCode();
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
        case 'slot':
            return buildSlot();
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
            // A hotspot is an interactive region, not a shape — buildRect()'s
            // solid gray fill would make it look and behave like an actual
            // visible rectangle, defeating the point. Dashed outline, no
            // fill, so it's visible enough to select/edit in authoring
            // without visually competing with real shapes underneath it.
            el.style = { fill: 'none', stroke: { color: '#6366f1', width: 1, style: 'dashed' } };
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

/** A slot placeholder. Lives inside a component definition; at instance render
 *  time render-bridge swaps its contents for the instance's own children. Its
 *  own children act as fallback/placeholder content shown in the definition
 *  editor (and when an instance provides no children). */
export const buildSlot = (): ContainerElement => {
    const el = buildContainerGeneric('slot', 'Slot');
    el.layout = defaultLayout('fill', 'auto');
    el.style = {
        background: 'transparent',
        padding: 8,
        border: { color: '#0ea5e9', width: 1, style: 'dashed' },
        radius: 4,
    } as ContainerStyle;
    return el;
};

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