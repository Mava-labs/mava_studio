/**
 * element.ts
 * Pinia store for element selection and page-scoped element CRUD.
 *
 * The renderer path is now Vue/Vapor-driven through CanvasNode, so this
 * store only mutates page data (selection + CRUD + undo).
 */

import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'
import { usePagesStore } from './pages'
import { useProjectMetadataStore } from './projectMetadata'
import { buildElement, type InsertableType } from '../utils/element.builder'
import { deepClone, type Page } from '../types/project'
import type { Element, Layout, Effects, ContainerElement } from '../types/element'

export { type InsertableType }

export interface AddElementOptions {
    position?: 'inside' | 'before' | 'after' | 'root'
    parentId?: string
}

export interface ElementPatch {
    style?: Partial<Record<string, unknown>>
    effects?: Partial<Effects>
    layout?: Partial<Layout>
}

function defaultLayout(): Layout {
    return {
        mode: 'flow',
        position: 'static',
        width: 'auto',
        height: 'auto',
        visible: true,
        locked: false,
    }
}

function normalizeLayout(layout: Layout): Layout {
    const next: Layout = {
        ...defaultLayout(),
        ...layout,
    }

    next.position = layout.position ?? 'static'

    if (layout.transform) next.transform = { ...layout.transform }
    if (layout.visible === undefined) next.visible = true
    if (layout.locked === undefined) next.locked = false

    return next
}

function mergeLayout(current: Layout, patch: Partial<Layout>): Layout {
    return normalizeLayout({
        ...current,
        ...patch,
        transform: patch.transform ? { ...(current.transform ?? {}), ...patch.transform } : current.transform,
    })
}

function getLiveNode(stageNode: HTMLElement | null, elementId: string): HTMLElement | null {
    const stage = stageNode ?? document.querySelector<HTMLElement>('.canvas-stage')
    return stage?.querySelector<HTMLElement>(`[data-eid="${elementId}"]`) ?? null
}

async function animateNode(node: HTMLElement, mode: 'insert' | 'update' | 'delete'): Promise<void> {
    const keyframes =
        mode === 'delete'
            ? [
                { opacity: 1, transform: 'scale(1)' },
                { opacity: 0, transform: 'scale(0.96)' },
            ]
            : [
                { opacity: 0, transform: 'scale(0.985)' },
                { opacity: 1, transform: 'scale(1)' },
            ]

    const animation = node.animate(keyframes, {
        duration: mode === 'update' ? 120 : 180,
        easing: 'ease-out',
        fill: mode === 'delete' ? 'forwards' : 'both',
    })

    try {
        await animation.finished
    } catch {
        // ignore cancelled animations
    }
}

function appendElementToPage(page: Page, parentId: string | null, element: Element, position: AddElementOptions['position']): void {
    if (parentId) {
        const parent = page.elements[parentId]
        if (parent?.kind === 'container' && position !== 'before' && position !== 'after') {
            parent.children = [...parent.children, element.id]
            element.parentId = parent.id
            page.elements[parent.id] = parent
            return
        }

        const parentContainer = parent?.parentId ? page.elements[parent.parentId] : null
        const list = parentContainer?.kind === 'container'
            ? parentContainer.children
            : page.rootIds

        const targetIndex = list.indexOf(parentId)
        const insertAt = position === 'before' ? targetIndex : targetIndex + 1
        const nextList = [...list]
        nextList.splice(Math.max(0, insertAt), 0, element.id)

        if (parent?.parentId && page.elements[parent.parentId]?.kind === 'container') {
            page.elements[parent.parentId] = {
                ...(page.elements[parent.parentId] as ContainerElement),
                children: nextList,
            }
            element.parentId = parent.parentId
        } else {
            page.rootIds = nextList
            element.parentId = undefined
        }

        return
    }

    page.rootIds = [...page.rootIds, element.id]
    element.parentId = undefined
}

function collectRemovalIds(page: Page, elementId: string, acc = new Set<string>()): Set<string> {
    const el = page.elements[elementId]
    if (!el || acc.has(elementId)) return acc

    acc.add(elementId)
    if (el.kind === 'container') {
        for (const childId of el.children)
            collectRemovalIds(page, childId, acc)
    }

    return acc
}

function pruneReferences(page: Page, idsToRemove: Set<string>): void {
    page.rootIds = page.rootIds.filter(id => !idsToRemove.has(id))

    for (const element of Object.values(page.elements)) {
        if (element.kind === 'container') {
            element.children = element.children.filter(id => !idsToRemove.has(id))
        }
    }
}

export const useElementStore = defineStore('element', () => {
    const pages = usePagesStore()
    const project = useProjectMetadataStore()

    const activeElementId = ref<string | null>(null)
    function setActiveElement(id: string | null): void {
        activeElementId.value = id
        console.log('[Active element] ', id)
    }

    function restoreSnapshot(pageId: string, snapshot: Page): void {
        pages.restoreSnapshot(pageId, snapshot)
    }

    function updateElement(elementId: string, patch: ElementPatch): void {
        console.log('[Update element: 1]', elementId, patch)
        const page = pages.getActivePageData()
        if (!page) return

        console.log('[Update element: 2]', page.elements[elementId])
        const existing = page.elements[elementId]
        if (!existing) return

        const before = JSON.stringify(page)
        const updated: Element = deepClone(existing)

        if (patch.effects) {
            updated.effects = {
                ...updated.effects,
                ...patch.effects,
            }
        }

        if (patch.style) {
            updated.style = {
                ...(updated.style as Record<string, unknown>),
                ...patch.style,
            }
        }

        if (patch.layout) {
            updated.layout = mergeLayout(updated.layout, patch.layout)
        }

        console.log('[Update element: 3]', updated)

        const updatedPage = deepClone(page)
        updatedPage.elements[elementId] = updated
        pages.commitPageToCache(updatedPage)

        project.pushUndo({
            label: `Edit ${existing.name}`,
            scope: { kind: 'page', id: page.id },
            before,
            after: JSON.stringify(updatedPage),
        })

        void nextTick().then(() => {
            const live = getLiveNode(null, elementId)
            if (live) void animateNode(live, 'update')
        })
    }

    function addElement(type: InsertableType, options: AddElementOptions = {}): Element | null {
        console.log('[Add element] ', type, options)
        const page = pages.getActivePageData()
        if (!page) return null

        const before = JSON.stringify(page)
        const newElement = buildElement(type)

        newElement.layout = normalizeLayout(newElement.layout)

        console.log('[Add element] Built element: ', newElement)
        const updatedPage = deepClone(page)
        const targetId = options.parentId ?? activeElementId.value

        appendElementToPage(updatedPage, targetId, newElement, options.position)
        updatedPage.elements[newElement.id] = newElement

        console.log('[Add element] Updated page: ', updatedPage)

        pages.commitPageToCache(updatedPage)

        project.pushUndo({
            label: `Add ${newElement.name}`,
            scope: { kind: 'page', id: page.id },
            before,
            after: JSON.stringify(updatedPage),
        })

        setActiveElement(newElement.id)

        void nextTick().then(() => {
            const live = getLiveNode(null, newElement.id)
            if (live) void animateNode(live, 'insert')
        })

        return newElement
    }

    async function removeElement(elementId: string): Promise<void> {
        console.log('[Remove element] ', elementId)
        const page = pages.getActivePageData()
        if (!page) return

        const existing = page.elements[elementId]
        if (!existing) return

        const before = JSON.stringify(page)
        const removalIds = collectRemovalIds(page, elementId)
        const live = getLiveNode(null, elementId)

        if (live) {
            await animateNode(live, 'delete')
        }

        const updatedPage = deepClone(page)
        for (const id of removalIds) delete updatedPage.elements[id]
        pruneReferences(updatedPage, removalIds)

        pages.commitPageToCache(updatedPage)

        project.pushUndo({
            label: `Delete ${existing.name}`,
            scope: { kind: 'page', id: page.id },
            before,
            after: JSON.stringify(updatedPage),
        })

        if (activeElementId.value && removalIds.has(activeElementId.value)) {
            setActiveElement(null)
        }
    }

    return {
        activeElementId,
        setActiveElement,
        addElement,
        updateElement,
        removeElement,
        restoreSnapshot,
    }
})