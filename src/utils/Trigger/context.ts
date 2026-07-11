/**
 * context.ts (Trigger DSL)
 *
 * Builds the injected-global context that compiled trigger code (from
 * codegen.ts) runs against — the runtime counterpart to codegen.ts's own
 * documented context shape (see its file header). Mirrors utils/scripts/
 * context.ts's approach (reactive stores behind proxies, no direct DOM
 * access except where the DOM genuinely is the only source of truth, e.g.
 * media playback) and reuses its element/variable proxies directly so a
 * trigger's `__el`/`__var` behave identically to a script's `element()`/
 * `project`.
 */

import { watch as vueWatch } from 'vue'
import { usePagesStore } from '../../stores/pages'
import { useProjectMetadataStore } from '../../stores/projectMetadata'
import { useTerminalStore } from '../../stores/terminal'
import { dispatchActions, type ActionContext } from '../element.actions'
import { buildElementProxy, buildVariableProxy } from '../scripts/context'

// ── Page navigation ───────────────────────────────────────────────────────────

/**
 * next/prev are defined within the current page's lesson, ordered by
 * `pageMetaById[id].order` — there's no other ordering concept in the
 * project model. Falls through with a terminal warning at either end
 * rather than wrapping around, since silent wraparound during a lesson
 * would be a confusing authoring surprise.
 */
function buildPageContext() {
    const pages = usePagesStore()
    const project = useProjectMetadataStore()
    const terminal = useTerminalStore()

    function neighborPageId(direction: 1 | -1): string | null {
        const currentId = pages.activePageId
        if (!currentId) return null
        const meta = project.pageMetaById[currentId]
        if (!meta) return null

        const siblings = Object.values(project.pageMetaById)
            .filter(p => p.lessonId === meta.lessonId)
            .sort((a, b) => a.order - b.order)

        const index = siblings.findIndex(p => p.id === currentId)
        const neighbor = siblings[index + direction]
        return neighbor?.id ?? null
    }

    return {
        navigateNext: () => {
            const id = neighborPageId(1)
            if (!id) {
                terminal.warn('navigate next: already on the last page of this lesson.')
                return
            }
            void pages.loadPage(id)
        },
        navigatePrev: () => {
            const id = neighborPageId(-1)
            if (!id) {
                terminal.warn('navigate prev: already on the first page of this lesson.')
                return
            }
            void pages.loadPage(id)
        },
    }
}

// ── Wait helper ────────────────────────────────────────────────────────────────

function waitMs(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Public context builder ────────────────────────────────────────────────────

export type NamedTriggerRegistry = Map<string, () => Promise<void>>

export interface TriggerContext {
    __el: (id: string) => object
    __var: object
    __page: ReturnType<typeof buildPageContext>
    __dispatch: (actions: Array<{ type: string; params?: Record<string, unknown> }>, context: ActionContext) => Promise<void>
    __watch: typeof vueWatch
    __on: (event: string, target: EventTarget, handler: EventListener) => void
    __off: (event: string, target: EventTarget, handler: EventListener) => void
    __navigate: (id: string) => void
    __lock: (id: string) => void
    __unlock: (id: string) => void
    __waitMs: (ms: number) => Promise<void>
    __namedTriggers: NamedTriggerRegistry
}

/**
 * @param namedTriggerRegistry Shared across every document activated in the
 * same batch (built once by runner.ts's `activateDslTriggers`) — named
 * triggers are global per mava_syntax.md §7, but each document still
 * compiles into its own isolated Function() scope, so this is the only
 * thing letting a `trigger <name>` call in one document reach a
 * NamedTriggerDef declared in another. Passing a fresh Map here (the
 * default) is only correct for a single, self-contained document with no
 * cross-document trigger calls.
 */
export function buildTriggerContext(namedTriggerRegistry: NamedTriggerRegistry = new Map()): TriggerContext {
    const pages = usePagesStore()
    const terminal = useTerminalStore()

    let warnedNoLocking = false
    function warnLockingUnimplemented() {
        if (warnedNoLocking) return
        warnedNoLocking = true
        terminal.warn('Page/section locking is not implemented yet — lock/unlock actions are no-ops.')
    }

    return {
        __el: (id: string) => buildElementProxy(id),
        __var: buildVariableProxy(),
        __page: buildPageContext(),
        __dispatch: dispatchActions,
        __watch: vueWatch,
        __on: (event, target, handler) => target.addEventListener(event, handler),
        __off: (event, target, handler) => target.removeEventListener(event, handler),
        __navigate: (id: string) => { void pages.loadPage(id) },
        __lock: warnLockingUnimplemented,
        __unlock: warnLockingUnimplemented,
        __waitMs: waitMs,
        __namedTriggers: namedTriggerRegistry,
    }
}
