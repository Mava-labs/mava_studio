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
import { buildElement, buildComponentInstance, type InsertableType } from '../utils/element.builder'
import { deepClone, type Page } from '../types/project'
import deepMerge from '../utils/deepMerge'
import type { Element, Layout, Effects, ContainerElement } from '../types/element'
import type { VariableBinding } from '../types/variables'

export { type InsertableType }

export interface AddElementOptions {
    position?: 'inside' | 'before' | 'after' | 'root'
    parentId?: string
}

export interface ElementPatch {
    style?: Partial<Record<string, unknown>>
    effects?: Partial<Effects>
    layout?: Partial<Layout>
    attributes?: Partial<Record<string, unknown>>
    /** SVG shape geometry (SvgElement.geometry only). Shallow-merged — callers
     *  should pass any nested sub-objects (e.g. arrow's from/to) already merged. */
    geometry?: Partial<Record<string, unknown>>
    /** Human-readable element name (Structure panel, Trigger DSL refs). */
    name?: string
    /** ComponentElement.props only — the values a component instance overrides. */
    props?: Partial<Record<string, unknown>>
    /**
     * Variable bindings, keyed by dot-path (e.g. 'style.content'). A key set to
     * `undefined` removes that path's binding entirely rather than merging onto
     * it — plain deepMerge can't express deletion, so this is handled specially
     * in updateElement() instead of going through deepMerge like the other fields.
     */
    bindings?: Partial<Record<string, VariableBinding | undefined>>
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
        // Containers and component instances both carry `children` — nesting into
        // an instance populates its default slot (render-bridge slotContent).
        if ((parent?.kind === 'container' || parent?.kind === 'component')
            && position !== 'before' && position !== 'after') {
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
            updated.effects = deepMerge(updated.effects, patch.effects)
        }

        if (patch.style) {
            updated.style = deepMerge(updated.style, patch.style)
        }

        if (patch.attributes) {
            updated.attributes = deepMerge(updated.attributes ?? {}, patch.attributes as Record<string, unknown>)
        }

        if (patch.layout) {
            updated.layout = mergeLayout(updated.layout, patch.layout)
        }

        if (patch.geometry) {
            (updated as any).geometry = { ...(updated as any).geometry, ...patch.geometry }
        }

        if (patch.name !== undefined) {
            updated.name = patch.name
        }

        if (patch.props) {
            (updated as any).props = deepMerge((updated as any).props ?? {}, patch.props)
        }

        if (patch.bindings) {
            const mergedBindings: Record<string, VariableBinding> = { ...(updated.bindings ?? {}) }
            for (const [path, binding] of Object.entries(patch.bindings)) {
                if (binding === undefined) {
                    delete mergedBindings[path]
                } else {
                    mergedBindings[path] = { ...(mergedBindings[path] ?? {}), ...binding }
                }
            }
            updated.bindings = mergedBindings
        }

        console.log('[Update element: 3]', updated)

        const updatedPage = deepClone(page)
        updatedPage.elements[elementId] = updated
        pages.commitPageToCache(updatedPage)

        project.pushUndo({
            label: `Edit ${existing.name}`,
            scope: pages.activeSurfaceScope() ?? { kind: 'page', id: page.id },
            before,
            after: JSON.stringify(updatedPage),
        })

        void nextTick().then(() => {
            const live = getLiveNode(null, elementId)
            if (live) void animateNode(live, 'update')
        })
    }

    function addElement(type: InsertableType, options: AddElementOptions = {}): Element | null {
        const newElement = buildElement(type)
        newElement.layout = normalizeLayout(newElement.layout)
        return _insertBuiltElement(newElement, options)
    }

    /** Place a fresh instance of a library component onto the active surface. */
    function addComponentInstance(componentId: string, name: string, options: AddElementOptions = {}): Element | null {
        return _insertBuiltElement(buildComponentInstance(componentId, name), options)
    }

    /** Every element id in a subtree (root + descendants), following container/component children. */
    function _collectSubtreeIds(page: Page, rootId: string): string[] {
        const ids: string[] = []
        const visit = (id: string) => {
            const el = page.elements[id]
            if (!el || ids.includes(id)) return
            ids.push(id)
            const childIds = el.kind === 'container'
                ? (el as ContainerElement).children
                : el.kind === 'component'
                    ? [...(el.children ?? []), ...Object.values(el.slots ?? {}).flat()]
                    : []
            for (const c of childIds) visit(c)
        }
        visit(rootId)
        return ids
    }

    /** Replace an element id with another in whatever holds it (page roots or a container's children). */
    function _replaceInParent(page: Page, oldId: string, newId: string) {
        const ri = page.rootIds.indexOf(oldId)
        if (ri !== -1) { page.rootIds[ri] = newId; return }
        for (const el of Object.values(page.elements)) {
            if (el.kind === 'container') {
                const ci = (el as ContainerElement).children.indexOf(oldId)
                if (ci !== -1) { (el as ContainerElement).children[ci] = newId; return }
            }
        }
    }

    /**
     * Convert an element (and its whole subtree) into a reusable component,
     * replacing it in place with an instance of the new component. Same pipeline
     * as authoring a component in its own tab — just extracted from the page.
     * Note: undo restores the page but leaves the created component in the
     * library (cross-scope undo isn't unified); it's deletable from the panel.
     */
    function convertToComponent(elementId: string): void {
        const page = pages.getActivePageData()
        if (!page) return
        const el = page.elements[elementId]
        if (!el) return

        const before = JSON.stringify(page)
        const subtreeIds = _collectSubtreeIds(page, elementId)
        const subtree: Record<string, Element> = {}
        for (const id of subtreeIds) subtree[id] = page.elements[id]

        const def = project.createComponentFromTree(el.name, [elementId], subtree)
        const instance = buildComponentInstance(def.id, el.name)
        instance.parentId = el.parentId

        const updatedPage = deepClone(page)
        for (const id of subtreeIds) delete updatedPage.elements[id]
        updatedPage.elements[instance.id] = instance
        _replaceInParent(updatedPage, elementId, instance.id)

        pages.commitPageToCache(updatedPage)
        project.pushUndo({
            label: `Make component "${def.name}"`,
            scope: pages.activeSurfaceScope() ?? { kind: 'page', id: page.id },
            before,
            after: JSON.stringify(updatedPage),
        })
        setActiveElement(instance.id)
    }

    /** Shared insertion machinery for addElement / addComponentInstance. */
    function _insertBuiltElement(newElement: Element, options: AddElementOptions): Element | null {
        const page = pages.getActivePageData()
        if (!page) return null

        const before = JSON.stringify(page)
        const updatedPage = deepClone(page)
        const targetId = options.parentId ?? activeElementId.value

        appendElementToPage(updatedPage, targetId, newElement, options.position)
        updatedPage.elements[newElement.id] = newElement

        pages.commitPageToCache(updatedPage)

        project.pushUndo({
            label: `Add ${newElement.name}`,
            scope: pages.activeSurfaceScope() ?? { kind: 'page', id: page.id },
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

    /**
     * Reorders/reparents an element within the page's flow — used by canvas
     * drag-to-reorder (useElementReorder.ts). Deliberately never touches
     * layout.position/x/y: moving an element in flow content changes its
     * place in rootIds/children, not its positioning mode. Only an element
     * an author has explicitly switched to non-static positioning keeps that
     * mode across the move (free-drag path in useElementDragResize.ts
     * handles that case separately and never calls this).
     */
    function moveElement(elementId: string, targetParentId: string | null, targetIndex: number): void {
        const page = pages.getActivePageData()
        if (!page) return

        const existing = page.elements[elementId]
        if (!existing) return

        const before = JSON.stringify(page)
        const updatedPage = deepClone(page)

        const oldParentId = updatedPage.elements[elementId]?.parentId ?? null
        if (oldParentId) {
            const oldParent = updatedPage.elements[oldParentId]
            if (oldParent?.kind === 'container' || oldParent?.kind === 'component') {
                oldParent.children = oldParent.children.filter(id => id !== elementId)
            }
        } else {
            updatedPage.rootIds = updatedPage.rootIds.filter(id => id !== elementId)
        }

        if (targetParentId) {
            const newParent = updatedPage.elements[targetParentId]
            if (newParent?.kind !== 'container' && newParent?.kind !== 'component') return
            const list = [...newParent.children]
            list.splice(Math.max(0, Math.min(targetIndex, list.length)), 0, elementId)
            newParent.children = list
            updatedPage.elements[elementId] = { ...updatedPage.elements[elementId], parentId: targetParentId }
        } else {
            const list = [...updatedPage.rootIds]
            list.splice(Math.max(0, Math.min(targetIndex, list.length)), 0, elementId)
            updatedPage.rootIds = list
            updatedPage.elements[elementId] = { ...updatedPage.elements[elementId], parentId: undefined }
        }

        pages.commitPageToCache(updatedPage)

        project.pushUndo({
            label: `Move ${existing.name}`,
            scope: pages.activeSurfaceScope() ?? { kind: 'page', id: page.id },
            before,
            after: JSON.stringify(updatedPage),
        })
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
            scope: pages.activeSurfaceScope() ?? { kind: 'page', id: page.id },
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
        addComponentInstance,
        convertToComponent,
        updateElement,
        moveElement,
        removeElement,
        restoreSnapshot,
    }
})