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
import { watch as vueWatch } from 'vue'
import {
    playAnimation,
    cancelAnimation,
} from '../element.animations'

// ── Element proxy ─────────────────────────────────────────────────────────────

function buildElementProxy(id: string): object {
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
                case 'text': return (el.style as any).content ?? null
                case 'style': return el.style
                case 'layout': return el.layout

                case 'play':
                    return (animationId: string) => {
                        const anim = el.interaction.animations.find(a => a.id === animationId)
                        if (!anim) {
                            terminal.error(`Animation "${animationId}" not found on element "${id}".`)
                            return
                        }
                        const node = document.querySelector<HTMLElement>(`[data-eid="${id}"]`)
                        if (node) playAnimation(node, anim, id)
                    }

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
                case 'text':
                    elementStore.updateElement(id, { style: { content: value as string } })
                    break
                default:
                    elementStore.updateElement(id, { style: { [key]: value } })
            }
            return true
        }
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

// ── Public context builder ────────────────────────────────────────────────────

export interface ScriptContext {
    stage: object
    project: object
    element: (id: string) => object
    fetch: (url: string, options?: RequestInit) => Promise<Response>
}

export function buildScriptContext(): ScriptContext {
    return {
        stage: buildStageProxy(),
        project: buildProjectProxy(),
        element: (id: string) => buildElementProxy(id),
        fetch: (url: string, options?: RequestInit) => window.fetch(url, options),
    }
}