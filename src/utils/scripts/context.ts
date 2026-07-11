/**
 * context.ts
 * Builds the full script execution context.
 * Exposes: stage, project, element(), fetch
 * Everything goes through reactive stores — no direct DOM access.
 */

import { useVariableStore } from '../../stores/variables'
import { usePagesStore } from '../../stores/pages'
import { useElementStore } from '../../stores/element'
import { useTerminalStore } from '../../stores/terminal'
import { sanitizeId } from '../Trigger/registryResolve'
import { watch as vueWatch } from 'vue'
import {
    playAnimation,
    playAnimations,
    cancelAnimation,
    finishAllAnimations,
} from '../element.animations'

// ── Element proxy ─────────────────────────────────────────────────────────────

/**
 * Shared by Scripts (this file) and the Trigger DSL runtime
 * (utils/Trigger/context.ts) so `stage.activeElement`/`element(id)` in a
 * script and `__el(id)` in a compiled trigger behave identically.
 */
export function buildElementProxy(id: string): object {
    const elementStore = useElementStore()
    const pagesStore = usePagesStore()
    const terminal = useTerminalStore()

    return new Proxy({} as Record<string, unknown>, {

        get(_, key: string) {
            const page = pagesStore.getActivePageData()
            const el = page?.elements[id]
            if (!el) {
                terminal.error(`Element "${id}" not found.`)
                return undefined
            }

            switch (key) {
                case 'id': return el.id
                case 'name': return el.name
                case 'visible': return el.layout.visible
                case 'disabled': return !!el.attributes?.disabled
                case 'text': return (el.style as any).content ?? null
                case 'style': return el.style
                case 'layout': return el.layout

                // Trigger DSL's `run`/`finish` actions call these with no
                // animation id — they operate on every animation declared
                // on the element. Scripts may still pass a specific id.
                case 'play':
                    return (animationId?: string) => {
                        const node = document.querySelector<HTMLElement>(`[data-eid="${id}"]`)
                        if (!node) return

                        if (!animationId) {
                            playAnimations(node, el.interaction.animations, id)
                            return
                        }

                        const anim = el.interaction.animations.find(a => a.id === animationId)
                        if (!anim) {
                            terminal.error(`Animation "${animationId}" not found on element "${id}".`)
                            return
                        }
                        playAnimation(node, anim, id)
                    }

                case 'finish':
                    return () => finishAllAnimations(id)

                case 'stop':
                    return (animationId: string) => cancelAnimation(id, animationId)

                default:
                    return (el.style as any)[key]
            }
        },

        set(_, key: string, value: unknown) {
            switch (key) {
                case 'visible':
                    elementStore.updateElement(id, { layout: { visible: value as boolean } })
                    break
                case 'disabled':
                    elementStore.updateElement(id, { attributes: { disabled: value as boolean } })
                    break
                case 'text':
                    elementStore.updateElement(id, { style: { content: value as string } })
                    break
                case 'highlighted': {
                    // No data-model field for this — it's a transient visual
                    // affordance, not persisted state, so it's applied directly
                    // to the live DOM node rather than going through updateElement.
                    const node = document.querySelector<HTMLElement>(`[data-eid="${id}"]`)
                    if (node) node.style.outline = value ? '2px solid #38bdf8' : ''
                    break
                }
                default:
                    elementStore.updateElement(id, { style: { [key]: value } })
            }
            return true
        }
    })
}

// ── Variable proxy ────────────────────────────────────────────────────────────

/**
 * Shared by the Trigger DSL runtime (`__var`) — reads/writes go straight
 * through variableStore.getVar/setVar, which already enforce the type check
 * and undefined-variable error reporting, so this proxy has no logic of its
 * own beyond routing.
 */
export function buildVariableProxy(): object {
    const varStore = useVariableStore()
    const pagesStore = usePagesStore()

    return new Proxy({} as Record<string, unknown>, {
        get(_, key: string) {
            const pageId = pagesStore.activePageId ?? ''
            return varStore.getVar(key, pageId)
        },
        set(_, key: string, value: unknown) {
            const pageId = pagesStore.activePageId ?? ''
            return varStore.setVar(key, value, pageId)
        },
    })
}

// ── Stage proxy ───────────────────────────────────────────────────────────────

function buildStageProxy(): object {
    const elementStore = useElementStore()
    const pagesStore = usePagesStore()
    const terminal = useTerminalStore()

    return new Proxy({} as Record<string, unknown>, {

        get(_, key: string) {
            switch (key) {
                case 'activeElement':
                    return elementStore.activeElementId
                        ? buildElementProxy(elementStore.activeElementId)
                        : null

                case 'currentPage':
                    return pagesStore.getActivePageData()

                default: {
                    // treat as element name lookup
                    const page = pagesStore.getActivePageData()
                    if (!page) return undefined
                    const found = Object.values(page.elements)
                        .find(el => el.name === key)
                    if (!found) {
                        terminal.warn(`No element named "${key}" found on stage.`)
                        return undefined
                    }
                    return buildElementProxy(found.id)
                }
            }
        }
    })
}

// ── Project proxy ─────────────────────────────────────────────────────────────

function buildProjectProxy(): object {
    const varStore = useVariableStore()
    const pagesStore = usePagesStore()
    const terminal = useTerminalStore()

    const SYSTEM_KEYS = new Set([
        'currentPage',
        'currentPageId',
        'author',
        'watch',
    ])

    return new Proxy({} as Record<string, unknown>, {

        get(_, key: string) {
            switch (key) {
                case 'currentPage':
                    return pagesStore.getActivePageData()?.metadata.title
                case 'currentPageId':
                    return pagesStore.activePageId
                case 'author': {
                    const page = pagesStore.getActivePageData()
                    return page?.metadata.lastEditedBy.name
                }

                // project.watch('score', handler) — reactive variable watcher
                case 'watch':
                    return (varName: string, handler: (val: unknown) => void) => {
                        const pageId = pagesStore.activePageId ?? ''
                        const def = varStore.definitions[varName]
                        if (!def) {
                            terminal.error(`Cannot watch undefined variable "${varName}".`)
                            return () => { }
                        }
                        const source = def.scope === 'global'
                            ? () => varStore.globalVars[varName]
                            : () => varStore.pageVars[pageId]?.[varName]

                        return vueWatch(source, handler)
                    }
                default: {
                    const pageId = pagesStore.activePageId ?? ''
                    return varStore.getVar(key, pageId)
                }
            }
        },

        set(_, key: string, value: unknown) {
            if (SYSTEM_KEYS.has(key)) {
                terminal.error(`[project] "${key}" is read-only.`)
                return false
            }
            const pageId = pagesStore.activePageId ?? ''
            return varStore.setVar(key, value, pageId)
        }
    })
}

// ── Mava proxy (author/system variables) ───────────────────────────────────────

/**
 * `mava` is the variable namespace in scripts — read and write author-defined
 * (and future system) variables as normal JS properties:
 *
 *     mava.score = 23
 *     if (mava.username === "Ada") { ... }
 *     const stop = mava.watch("score", v => console.log("score is now", v))
 *
 * Reads go through varStore.getVar; writes through varStore.setVar — so a write
 * from a script propagates through the exact same reactive path as a write from
 * a trigger: bound element props re-resolve, `variable.change` cues fire, and
 * any mava.watch/project.watch subscribers run. (`mava.<name> = …` is why bare
 * `name = …` isn't offered — a bare assignment in a Function scope can't be
 * intercepted without `with`/AST rewriting, which breaks strict mode and the
 * editor's own type-checking.)
 *
 * `watch` is a reserved key on `mava`; a variable literally named "watch" is
 * still reachable via `mava["watch"]`... actually no — it would be shadowed.
 * Variable-name validation should keep authors away from it in practice.
 */
function buildMavaProxy(): object {
    const varStore = useVariableStore()
    const pagesStore = usePagesStore()
    const terminal = useTerminalStore()

    return new Proxy({} as Record<string, unknown>, {
        get(_, key: string) {
            if (typeof key !== 'string') return undefined
            if (key === 'watch') {
                return (varName: string, handler: (val: unknown) => void) => {
                    const pageId = pagesStore.activePageId ?? ''
                    const def = varStore.definitions[varName]
                    if (!def) {
                        terminal.error(`Cannot watch undefined variable "${varName}".`)
                        return () => {}
                    }
                    const source = def.scope === 'global'
                        ? () => varStore.globalVars[varName]
                        : () => varStore.pageVars[pageId]?.[varName]
                    return vueWatch(source, handler, { deep: true })
                }
            }
            const pageId = pagesStore.activePageId ?? ''
            return varStore.getVar(key, pageId)
        },
        set(_, key: string, value: unknown) {
            if (key === 'watch') {
                terminal.error(`[mava] "watch" is reserved and can't be assigned.`)
                return false
            }
            const pageId = pagesStore.activePageId ?? ''
            return varStore.setVar(key, value, pageId)
        },
        // Make Object.keys(mava) / `in` reflect the real variable set, so
        // introspection and devtools behave.
        has(_, key: string) {
            return key === 'watch' || key in varStore.definitions
        },
        ownKeys() {
            return [...Object.keys(varStore.definitions), 'watch']
        },
        getOwnPropertyDescriptor() {
            return { enumerable: true, configurable: true }
        },
    })
}

// ── Public context builder ────────────────────────────────────────────────────

export interface ScriptContext {
    mava: object
    stage: object
    project: object
    element: (id: string) => object
    fetch: (url: string, options?: RequestInit) => Promise<Response>
}

/**
 * Resolve an author-facing element *name* to its system id on the active page.
 * Authors never see element ids, so `element("Submit Button")` is the API —
 * matched by exact name first, then by sanitized name (so `element("Submit
 * Button")` and `element("Submit_Button")`, the cue form, both work). Returns
 * null if nothing matches, in which case the caller falls back to treating the
 * argument as an id (back-compat / robustness) and the element proxy surfaces a
 * "not found" error if that fails too.
 */
function resolveElementIdByName(nameOrId: string): string | null {
    const page = usePagesStore().getActivePageData()
    if (!page) return null
    const els = Object.values(page.elements ?? {})
    const exact = els.find(el => el.name === nameOrId)
    if (exact) return exact.id
    const bySanitized = els.find(el => sanitizeId(el.name) === sanitizeId(nameOrId))
    return bySanitized?.id ?? null
}

export function buildScriptContext(): ScriptContext {
    return {
        mava: buildMavaProxy(),
        stage: buildStageProxy(),
        project: buildProjectProxy(),
        element: (name: string) => buildElementProxy(resolveElementIdByName(name) ?? name),
        fetch: (url: string, options?: RequestInit) => window.fetch(url, options),
    }
}