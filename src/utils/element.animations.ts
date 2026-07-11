/**
 * element.animations.ts
 *
 * Drives ElementAnimation descriptors via the Web Animations API.
 * - Autoplay animations fire immediately on mount.
 * - Trigger-bound animations are played on demand by the mounter.
 * - Multiple animations on the same element run concurrently by default.
 */

import type { ElementAnimation, AnimatableProps, AnimatableEffectProps } from '../types/element';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Live handle returned when an animation is started. */
export interface AnimationHandle {
  id: string;
  animation: Animation;
}

/** Per-element store of running animations keyed by animation.id */
const runningAnimations = new Map<string, Map<string, AnimationHandle>>();

// ─── Easing map ──────────────────────────────────────────────────────────────

const EASING_MAP: Record<string, string> = {
  'linear':      'linear',
  'ease-in':     'ease-in',
  'ease-out':    'ease-out',
  'ease-in-out': 'ease-in-out',
};

// ─── Animatable prop → CSS property ──────────────────────────────────────────

/**
 * Maps ElementAnimation from/to keys to their CSS equivalents.
 * Layout props (x, y, width, height) are expressed as transforms/dimensions.
 * Effect props map directly to CSS.
 */
function toCSSKeyframe(props: Partial<AnimatableProps & AnimatableEffectProps>): Keyframe {
  const frame: Keyframe = {};

  if (props.x !== undefined || props.y !== undefined) {
    frame.transform = `translate(${props.x ?? 0}px, ${props.y ?? 0}px)`;
  }
  if (props.rotation !== undefined) {
    // Merge with existing transform if present
    const existing = (frame.transform as string) ?? '';
    frame.transform = `${existing} rotate(${props.rotation}deg)`.trim();
  }
  if (props.scaleX !== undefined || props.scaleY !== undefined) {
    const existing = (frame.transform as string) ?? '';
    frame.transform = `${existing} scale(${props.scaleX ?? 1}, ${props.scaleY ?? 1})`.trim();
  }
  if (props.width !== undefined)       frame.width   = `${props.width}px`;
  if (props.height !== undefined)      frame.height  = `${props.height}px`;
  if (props.opacity !== undefined)     frame.opacity = props.opacity;
  if (props.blur !== undefined)        frame.filter  = `blur(${props.blur}px)`;
  if (props.shadowOffsetX !== undefined || props.shadowOffsetY !== undefined || props.shadowBlur !== undefined) {
    frame.boxShadow = `${props.shadowOffsetX ?? 0}px ${props.shadowOffsetY ?? 0}px ${props.shadowBlur ?? 0}px currentColor`;
  }

  return frame;
}

// ─── Core play function ───────────────────────────────────────────────────────

/**
 * Play a single ElementAnimation on a DOM node.
 * Returns an AnimationHandle so the caller can cancel or await it.
 */
export function playAnimation(
  node: HTMLElement,
  descriptor: ElementAnimation,
  elementId: string,
): AnimationHandle {
  const keyframes: Keyframe[] = [];

  if (descriptor.from) {
    keyframes.push(toCSSKeyframe(descriptor.from));
  }

  keyframes.push(toCSSKeyframe(descriptor.to));

  const options: KeyframeAnimationOptions = {
    duration:   descriptor.duration,
    delay:      descriptor.delay ?? 0,
    easing:     EASING_MAP[descriptor.easing ?? 'linear'] ?? 'linear',
    iterations: descriptor.loop ? Infinity : 1,
    fill:       'forwards', // hold end state after finishing
  };

  const animation = node.animate(keyframes, options);

  const handle: AnimationHandle = { id: descriptor.id, animation };

  // Track running animations per element
  if (!runningAnimations.has(elementId)) {
    runningAnimations.set(elementId, new Map());
  }
  runningAnimations.get(elementId)!.set(descriptor.id, handle);

  // Clean up from registry when done (unless looping)
  if (!descriptor.loop) {
    animation.finished
      .then(() => runningAnimations.get(elementId)?.delete(descriptor.id))
      .catch(() => {}); // cancelled — ignore
  }

  return handle;
}

/**
 * Play all provided animations on a node concurrently.
 * This is the default behaviour — all start at the same time.
 */
export function playAnimations(
  node: HTMLElement,
  descriptors: ElementAnimation[],
  elementId: string,
): AnimationHandle[] {
  return descriptors.map((d) => playAnimation(node, d, elementId));
}

// ─── Cancel helpers ───────────────────────────────────────────────────────────

/** Cancel a specific animation on an element by animation id. */
export function cancelAnimation(elementId: string, animationId: string): void {
  const handle = runningAnimations.get(elementId)?.get(animationId);
  if (handle) {
    handle.animation.cancel();
    runningAnimations.get(elementId)?.delete(animationId);
  }
}

/** Cancel all running animations on an element. */
export function cancelAllAnimations(elementId: string): void {
  const handles = runningAnimations.get(elementId);
  if (!handles) return;
  for (const handle of handles.values()) {
    handle.animation.cancel();
  }
  runningAnimations.delete(elementId);
}

/**
 * Jump all of an element's running animations to their end frame and hold
 * (relies on `fill: 'forwards'`, already set in playAnimation's options).
 * Used by the Trigger DSL's `finish` action.
 */
export function finishAllAnimations(elementId: string): void {
  const handles = runningAnimations.get(elementId);
  if (!handles) return;
  for (const handle of handles.values()) {
    handle.animation.finish();
  }
}

// ─── Autoplay ─────────────────────────────────────────────────────────────────

/**
 * Given an element's full animation list, fire all that are not
 * trigger-bound (i.e. not referenced by any trigger action).
 * Call this from the mounter right after the node is inserted.
 */
export function autoplay(
  node: HTMLElement,
  animations: ElementAnimation[],
  triggerBoundIds: Set<string>,
  elementId: string,
): AnimationHandle[] {
  const autoAnimations = animations.filter((a) => !triggerBoundIds.has(a.id));
  return playAnimations(node, autoAnimations, elementId);
}