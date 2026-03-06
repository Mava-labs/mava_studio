import { Component } from "vue";
import { Element } from "./element";

export type InspectorGroupId =
  | 'layout'
  | 'transform' //size & postion
  | 'effects'
  | 'text'
  | 'shape' //fill & stroke
  | 'borderRadius' //Corners
  | 'padding'
  | 'shadow'
  | 'filters'
  | 'objectFit' /*image fit*/;

export type InspectorTarget = Element | 'stage' | null;

export interface InspectorGroup {
  id: InspectorGroupId;
  label: string;
  appliesTo: (el: Element | 'stage' | null) => boolean;
  component: Component;
}


const hasText = (element: Element) => element.type === 'text' || 'textContent' in element.style;
const hasStroke = (element: Element) => 'stroke' in element.style;
const hasFlow = (element: Element) => element.layout.positioning.mode === 'flow';
const hasRadius = (element: Element) => 'radius' in element.style;
const hasPadding = (element: Element) => 'padding' in element.style;
const hasShadow = (element: Element) => 'shadow' in element.style;
const hasFilters = (element: Element) => 'filters' in element.style;
const isImage = (element: Element) => element.type === 'image';

// export const INSPECTOR_GROUPS: InspectorGroup[] = [
//   {
//     id: 'layout',
//     label: 'Size & Position',
//     appliesTo: () => true,
//     component: LayoutPanel
//   },
//   {
//     id: 'transform',
//     label: 'Transform',
//     appliesTo: el => el !== 'stage',
//     component: TransformPanel
//   },
//   {
//     id: 'effects',
//     label: 'Effects',
//     appliesTo: el => el !== 'stage',
//     component: EffectsPanel
//   },
//   {
//     id: 'text',
//     label: 'Text',
//     appliesTo: el => hasText(el as Element),
//     component: TextPanel
//   },
//   {
//     id: 'shape',
//     label: 'Shape',
//     appliesTo: el => hasShapeStyle(el as Element),
//     component: ShapePanel
//   },
//   {
//     id: 'stroke',
//     label: 'Stroke',
//     appliesTo: el => hasStroke(el as Element),
//     component: StrokePanel
//   },
//   {
//     id: 'image',
//     label: 'Image',
//     appliesTo: el => hasImage(el as Element),
//     component: ImagePanel
//   },
//   {
//     id: 'path',
//     label: 'Path',
//     appliesTo: el => hasPath(el as Element),
//     component: PathPanel
//   }
// ];
