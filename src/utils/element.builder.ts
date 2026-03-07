import type {
  FlatHtmlElement,
  ContainerElement,
  SvgElement,
  Layout,
  Effects,
  TextStyle,
  ImageStyle,
  InputStyle,
  ContainerStyle,
  SvgStyle,
} from '../types/element';

// ─── Shared defaults ────────────────────────────────────────────────────────

const uid = (): string => Math.random().toString(36).slice(2, 9);

const defaultLayout = (): Layout => ({
  positioning: { mode: 'flow' },
  size: { width: 'auto', height: 'auto' },
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
      ...defaultLayout(),
      size: { width: 300, height: 200 },
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
    background: 'transparent',
    padding: 0,
  };

  return {
    id: uid(),
    name,
    kind: 'container',
    type,
    children: [],
    display: { mode: 'block' },
    layout: {
      ...defaultLayout(),
      size: { width: 'full', height: 'auto' },
    },
    effects: defaultEffects(),
    interaction: defaultInteraction(),
    style,
  };
}

export const buildDiv     = (): ContainerElement => buildContainer('div',     'Div');
export const buildSection = (): ContainerElement => buildContainer('section', 'Section');
export const buildArticle = (): ContainerElement => buildContainer('article', 'Article');
export const buildHeader  = (): ContainerElement => buildContainer('header',  'Header');
export const buildFooter  = (): ContainerElement => buildContainer('footer',  'Footer');
export const buildNav     = (): ContainerElement => buildContainer('nav',     'Nav');
export const buildForm    = (): ContainerElement => buildContainer('form',    'Form');
export const buildList    = (): ContainerElement => buildContainer('list',    'List');

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
    layout: {
      ...defaultLayout(),
      size: { width: 200, height: 100 },
    },
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
    layout: {
      ...defaultLayout(),
      size: { width: 100, height: 100 },
    },
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
    layout: {
      ...defaultLayout(),
      size: { width: 200, height: 100 },
    },
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
    layout: {
      ...defaultLayout(),
      size: { width: 100, height: 1 },
    },
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