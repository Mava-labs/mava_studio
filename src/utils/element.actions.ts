/**
 * element.actions.ts
 *
 * Open registry for trigger action handlers.
 * Register any action type with a handler function.
 * The dispatcher calls them in sequence (async) per trigger event.
 */

export type ActionHandler = (
  params: Record<string, unknown>,
  context: ActionContext
) => Promise<void> | void;

export interface ActionContext {
  /** The DOM node that fired the event */
  sourceNode: HTMLElement;
  /** The element id (data-eid) of the source */
  sourceId: string;
  /** The original DOM event */
  event: Event;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, ActionHandler>();

/**
 * Register a handler for an action type.
 * Calling this again with the same type overwrites the previous handler.
 *
 * @example
 * registerAction('navigate', async ({ url }) => {
 *   window.location.href = url as string;
 * });
 *
 * registerAction('toggleVisibility', (_, { sourceNode }) => {
 *   const targetId = params.targetId as string;
 *   const el = document.querySelector(`[data-eid="${targetId}"]`) as HTMLElement;
 *   if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
 * });
 */
export function registerAction(type: string, handler: ActionHandler): void {
  registry.set(type, handler);
}

export function unregisterAction(type: string): void {
  registry.delete(type);
}

export function hasAction(type: string): boolean {
  return registry.has(type);
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Dispatch a list of actions in sequence (async).
 * If a handler is not registered the action is skipped with a warning.
 * If a handler throws, the sequence stops and the error is rethrown.
 */
export async function dispatchActions(
  actions: Array<{ type: string; params?: Record<string, unknown> }>,
  context: ActionContext
): Promise<void> {
  for (const action of actions) {
    const handler = registry.get(action.type);

    if (!handler) {
      console.warn(`[actions] No handler registered for action type: "${action.type}"`);
      continue;
    }

    await handler(action.params ?? {}, context);
  }
}