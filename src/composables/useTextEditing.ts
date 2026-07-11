/**
 * useTextEditing.ts
 *
 * contentEditable-on-focus for text-bearing canvas elements — double-click a
 * text/label/button/code element and type directly into it, matching direct
 * manipulation in Figma/Framer/Webflow rather than requiring the Properties
 * panel for every content change (there wasn't even a panel field for it
 * before this — style.content was only reachable through the variable-
 * binding picker, never as a plain text edit).
 *
 * Module-level `editingId`, same pattern as useEditorSelection.ts's
 * hoveredId/selectedIds — only one element is ever being edited at a time,
 * and createMode.vue's pointerdown handler needs to read it synchronously to
 * decide whether to let a click fall through to native caret placement
 * inside the editing node instead of arming a drag.
 *
 * Content only ever writes back to the store on commit (blur/Enter/Escape),
 * not per keystroke — every store commit triggers a full canvas DOM rebuild
 * (see CLEANUP_TODO.md Phase 3.24), which would make every keystroke rebuild
 * the entire tree if this synced live. The live-typed text stays purely in
 * the DOM (the browser's own contentEditable state) until then.
 */

import { ref, readonly } from 'vue'
import { usePagesStore } from '../stores/pages'
import { useElementStore } from '../stores/element'
import type { Element } from '../types/element'

const editingId = ref<string | null>(null)

const EDITABLE_TYPES = new Set(['text', 'label', 'button', 'code'])

function isEditable(el: Element | null): el is Element & { kind: 'flatHtml' } {
    return !!el && el.kind === 'flatHtml' && EDITABLE_TYPES.has(el.type)
}

/**
 * Single-line elements commit and exit on Enter; block ones (plain
 * paragraph text, code) get a real newline instead. A heading or an inline
 * span (type:'text' with layout.textTag) reads as single-line too — headings
 * and inline runs are conventionally one line, same reasoning as a label.
 */
function isSingleLine(type: string, textTag?: string): boolean {
    if (type === 'button' || type === 'label') return true
    if (type === 'text') return textTag === 'span' || textTag === 'h1' || textTag === 'h2' || textTag === 'h3'
    return false
}

export function useTextEditing() {
    const pages = usePagesStore()
    const elementStore = useElementStore()

    function canEdit(id: string): boolean {
        return isEditable(pages.getElementById(id))
    }

    function startEditing(id: string, stageEl: HTMLElement) {
        const el = pages.getElementById(id)
        if (!isEditable(el)) return
        if (el.layout.locked) return

        const foundNode = stageEl.querySelector<HTMLElement>(`[data-eid="${id}"]`)
        if (!foundNode) return
        if (editingId.value === id) return // already editing this one
        const node = foundNode
        const elType = el.type
        const elTextTag = el.layout.textTag

        editingId.value = id
        node.contentEditable = 'true'
        node.spellcheck = false
        node.style.outline = '2px solid #3b82f6'
        node.style.outlineOffset = '1px'
        node.style.cursor = 'text'
        node.focus()

        // Place the caret at the end rather than leaving it wherever the
        // double-click happened to land — simplest predictable starting point.
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(false)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)

        function commit() {
            const text = node.innerText ?? node.textContent ?? ''
            elementStore.updateElement(id, { style: { content: text } })
            cleanup()
        }

        function onKeydown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                e.preventDefault()
                node.blur() // triggers commit via the blur listener below
            } else if (e.key === 'Enter' && isSingleLine(elType, elTextTag) && !e.shiftKey) {
                e.preventDefault()
                node.blur()
            }
        }

        function cleanup() {
            node.removeEventListener('blur', commit)
            node.removeEventListener('keydown', onKeydown)
            node.contentEditable = 'false'
            node.style.outline = ''
            node.style.outlineOffset = ''
            node.style.cursor = ''
            if (editingId.value === id) editingId.value = null
        }

        node.addEventListener('blur', commit, { once: true })
        node.addEventListener('keydown', onKeydown)
    }

    return {
        editingId: readonly(editingId),
        canEdit,
        startEditing,
    }
}
