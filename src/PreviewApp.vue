<template>
    <div class="preview-root">
        <div class="preview-bar">
            <span class="preview-bar__label">Preview</span>
            <span class="preview-bar__title">{{ project.projectName || '' }}<span v-if="pageTitle"> — {{ pageTitle }}</span></span>
            <div class="preview-bar__actions">
                <span v-if="status === 'loading'" class="preview-bar__status">Loading…</span>
                <span v-else-if="status === 'error'" class="preview-bar__status preview-bar__status--error">{{ errorMessage }}</span>
                <button type="button" class="preview-bar__btn" title="Reload preview" @click="reload">Reload</button>
            </div>
        </div>

        <div class="preview-stage-wrap">
            <div v-if="status === 'loading'" class="preview-empty">Loading preview…</div>
            <div v-else-if="status === 'error'" class="preview-empty preview-empty--error">
                Failed to load preview: {{ errorMessage }}
            </div>
            <div v-else class="preview-stage" :style="stageStyle">
                <div ref="stageContentRef" style="display: contents" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed, nextTick, onUnmounted, provide, ref, useTemplateRef, watch, watchEffect, type CSSProperties } from 'vue'
import { usePagesStore } from './stores/pages'
import { useProjectMetadataStore } from './stores/projectMetadata'
import { useTerminalStore } from './stores/terminal'
import { mountElement } from './components/renderers/render-bridge'
import { registerScripts } from './utils/scripts/runner'
import { activateDslTriggers } from './utils/Trigger/runner'
import { emitPreviewLog, listenPreviewNavigate, listenPreviewSyncPage, type PreviewNavigatePayload } from './utils/previewBridge'

const pages = usePagesStore()
const project = useProjectMetadataStore()
const terminal = useTerminalStore()

provide('componentLibrary', computed(() => project.componentLibrary))
provide('isAuthoring', false)

const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')

function parseParams(): { archivePath: string; pageId: string } | null {
    // Format: #preview?archivePath=<encoded>&pageId=<encoded>
    const hash = location.hash.replace(/^#preview\??/, '')
    const params = new URLSearchParams(hash)
    const archivePath = params.get('archivePath')
    const pageId = params.get('pageId')
    if (!archivePath || !pageId) return null
    return { archivePath, pageId }
}

let dslCleanup: () => void = () => {}
let mountedPageId: string | null = null

/**
 * DSL mount/unmount/enter/leave triggers (codegen.ts's genLifecycleRegistration)
 * register `window` listeners for `mava:<event>` CustomEvents but nothing ever
 * dispatched them — this is the dispatch side. This app has no keep-alive or
 * page-stack concept (a page swap just re-renders this same window's stage),
 * so mount/enter and unmount/leave fire together at the same points; kept as
 * separate events for forward compatibility if that ever changes.
 */
function dispatchPageLifecycle(name: string, pageId: string) {
    window.dispatchEvent(new CustomEvent(`mava:${name}`, { detail: { pageId } }))
}

/**
 * (Re)bind every trigger's DOM-event listeners to the *current* stage nodes.
 * codegen emits `document.querySelector('[data-eid="…"]').addEventListener(…)`,
 * so this must run only when the nodes exist, and must re-run whenever they're
 * replaced (see the remount watch below). No lifecycle dispatch here — that's
 * a page-transition concern owned by activateTriggersForCurrentPage.
 */
function attachTriggerListeners() {
    dslCleanup()
    dslCleanup = activateDslTriggers(project.dslTriggers)
}

async function activateTriggersForCurrentPage() {
    const nextPageId = pages.activePageId

    if (mountedPageId && mountedPageId !== nextPageId) {
        dispatchPageLifecycle('before.unmount', mountedPageId)
        dispatchPageLifecycle('unmount', mountedPageId)
        dispatchPageLifecycle('leave', mountedPageId)
    }

    if (nextPageId) dispatchPageLifecycle('before.mount', nextPageId)

    // MUST wait for the stage watchEffect to mount this page's DOM before
    // activating triggers (querySelector needs the nodes to exist) — this was
    // the "trigger does nothing in Preview" bug.
    await nextTick()

    attachTriggerListeners()

    if (nextPageId) {
        dispatchPageLifecycle('mount', nextPageId)
        dispatchPageLifecycle('enter', nextPageId)
    }

    mountedPageId = nextPageId
}

async function boot(overrideParams?: PreviewNavigatePayload) {
    status.value = 'loading'
    errorMessage.value = ''

    const params = overrideParams ?? parseParams()
    if (!params) {
        status.value = 'error'
        errorMessage.value = 'Missing preview parameters.'
        return
    }

    try {
        // NOTE: variable *definitions* aren't part of ProjectData's persisted
        // schema at all (see CLEANUP_TODO.md Phase 3.16) — there is nothing
        // to load here. This preview window's variable store starts empty;
        // any trigger referencing a variable will visibly fail via the
        // terminal until that gap is fixed. Not attempted in this pass —
        // it needs a matching Rust-side schema change this sandbox can't
        // build/verify.
        await project.loadProject(params.archivePath)

        const pageResult = await pages.loadPage(params.pageId)
        if (pageResult === 'Error') {
            status.value = 'error'
            errorMessage.value = 'Could not load the requested page.'
            return
        }

        registerScripts(project.actionScripts)

        // Show the stage first so its DOM mounts, THEN activate triggers —
        // activateTriggersForCurrentPage() awaits a tick internally so its
        // querySelector-based listeners bind to real nodes. Activating before
        // status='ready' (the old order) meant binding to an empty stage.
        status.value = 'ready'
        await activateTriggersForCurrentPage()
    } catch (err) {
        status.value = 'error'
        errorMessage.value = err instanceof Error ? err.message : String(err)
        terminal.error(`Preview failed to boot: ${errorMessage.value}`)
    }
}

function reload() {
    void boot()
}

// Reused-window case: a second "Preview" click in the main window retargets
// this same window (see usePreview.ts) instead of opening a new one.
let unlistenNavigate: (() => void) | null = null
listenPreviewNavigate((payload) => { void boot(payload) }).then(unlisten => { unlistenNavigate = unlisten })

// Live preview: apply the main window's edits directly to this window's own
// pagesStore cache — no reload, no disk round-trip. Only when it's the same
// page currently being shown; a sync for a different page is silently
// ignored (this window keeps showing whatever Preview was last opened/
// retargeted to, it doesn't follow page switches in the authoring window).
let unlistenSyncPage: (() => void) | null = null
listenPreviewSyncPage((incomingPage) => {
    if (status.value !== 'ready') return
    if (incomingPage.id !== pages.activePageId) return
    pages.commitPageToCache(incomingPage)
}).then(unlisten => { unlistenSyncPage = unlisten })

// ── Stage rendering (mirrors mods/createMode.vue's mount loop, minus authoring chrome) ──

const page = computed(() => pages.getActivePageData())
const pageTitle = computed(() => page.value?.metadata.title ?? '')
const rootIds = computed(() => page.value?.rootIds ?? [])
const elements = computed(() => page.value?.elements ?? {})
provide('elements', elements)

/** Mirrors createMode.vue's stageStyle — same Stage.display shape, same
 *  layout/padding/margin behavior, so Preview matches what was authored. */
const stageStyle = computed<CSSProperties>(() => {
    const s = page.value?.stage
    if (!s) return { position: 'relative', width: '1280px', height: '720px', background: '#fff' }

    const d = s.display ?? {}
    const l = d.layout ?? { mode: 'block' as const }

    const layoutStyle: CSSProperties = l.mode === 'flex'
        ? {
            display: 'flex',
            flexDirection: l.direction || 'row',
            justifyContent: l.justify || 'flex-start',
            alignItems: l.align || 'stretch',
            gap: l.gap ? `${l.gap}px` : '0px',
        }
        : l.mode === 'grid'
            ? { display: 'grid', gridTemplateColumns: l.columns || '1fr', gridTemplateRows: l.rows || undefined, gap: l.gap ? `${l.gap}px` : '0px' }
            : { display: 'block' }

    return {
        position: 'relative',
        width: `${s.width}px`,
        height: `${s.height}px`,
        background: s.background ?? '#fff',
        padding: d.padding ? `${d.padding}px` : '0px',
        margin: d.margin ? `${d.margin}px` : '0px',
        overflow: d.overflow || 'auto',
        boxSizing: 'border-box',
        ...layoutStyle,
    }
})

const stageContentRef = useTemplateRef<HTMLElement>('stageContentRef')
const mountCleanups: Array<() => void> = []

watchEffect(() => {
    mountCleanups.forEach(fn => fn())
    mountCleanups.length = 0

    const container = stageContentRef.value
    if (!container || status.value !== 'ready') return

    const els = elements.value
    for (const id of rootIds.value) {
        if (!els[id]) continue
        mountCleanups.push(mountElement(() => els[id], undefined, container, els))
    }
})

// Page-scoped triggers depend on the active page — re-activate whenever it changes
// (e.g. a `navigate` action inside a trigger loads a new page in this same window).
watch(() => pages.activePageId, () => {
    if (status.value === 'ready') void activateTriggersForCurrentPage()
})

// Re-bind listeners after every stage remount. When a trigger mutates an
// element (show/hide/set → updateElement → commitPageToCache), the mount
// watchEffect above tears down and rebuilds the whole stage (the Phase 3.24
// full-rebuild-on-commit behavior), leaving the trigger listeners bound to the
// now-detached old nodes. Without this, the FIRST interaction works but the
// next one is dead. Watching elements.value identity (which changes on commit,
// same as the mount effect) and re-attaching on the next tick — after the new
// nodes exist — keeps triggers live. No lifecycle dispatch (attachTrigger
// listeners only), so mount/unmount don't re-fire on a same-page mutation.
watch(() => elements.value, () => {
    if (status.value !== 'ready') return
    void nextTick(attachTriggerListeners)
})

// ── Debug output bridge ───────────────────────────────────────────────────────
// Relays every terminal entry AND raw console.* calls (from user scripts) to the
// main window's Output tab — see utils/previewBridge.ts's file header for why
// this needs a Tauri event instead of shared store state.

watch(() => terminal.entries.length, (len, prevLen) => {
    if (len <= (prevLen ?? 0)) return
    const entry = terminal.entries[len - 1]
    emitPreviewLog(entry.level, entry.message)
})

const rawConsole = { log: console.log, warn: console.warn, error: console.error }
console.log = (...args: unknown[]) => { rawConsole.log(...args); emitPreviewLog('info', args.map(String).join(' ')) }
console.warn = (...args: unknown[]) => { rawConsole.warn(...args); emitPreviewLog('warn', args.map(String).join(' ')) }
console.error = (...args: unknown[]) => { rawConsole.error(...args); emitPreviewLog('error', args.map(String).join(' ')) }

onUnmounted(() => {
    if (mountedPageId) {
        dispatchPageLifecycle('before.unmount', mountedPageId)
        dispatchPageLifecycle('unmount', mountedPageId)
        dispatchPageLifecycle('leave', mountedPageId)
    }
    mountCleanups.forEach(fn => fn())
    dslCleanup()
    unlistenNavigate?.()
    unlistenSyncPage?.()
    console.log = rawConsole.log
    console.warn = rawConsole.warn
    console.error = rawConsole.error
})

void boot()
</script>

<style scoped>
.preview-root {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    background: #0f172a;
    color: #e2e8f0;
    font-family: system-ui, sans-serif;
    overflow: hidden;
}

.preview-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    font-size: 12px;
}

.preview-bar__label {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.15);
    padding: 2px 8px;
    border-radius: 999px;
}

.preview-bar__title {
    flex: 1;
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.preview-bar__actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.preview-bar__status {
    color: #94a3b8;
    font-size: 11px;
}

.preview-bar__status--error {
    color: #f87171;
}

.preview-bar__btn {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid #334155;
    color: #e2e8f0;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
}

.preview-bar__btn:hover {
    border-color: #38bdf8;
}

.preview-stage-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    align-items: flex-start;
    /* flex-start, not center: when the stage is wider/taller than the
       window, a centered flex item's default scroll position is the
       middle of the overflow — clipping the stage's own top-left corner
       (x=0,y=0, where most content starts) until the user scrolls left/up.
       createMode.vue's authoring canvas uses the equivalent of flex-start
       for the same reason. */
    justify-content: flex-start;
    padding: 24px;
}

.preview-stage {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
}

.preview-empty {
    color: #64748b;
    font-size: 13px;
    padding-top: 40px;
}

.preview-empty--error {
    color: #f87171;
}
</style>
