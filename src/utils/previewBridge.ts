/**
 * previewBridge.ts
 *
 * Preview opens in a genuinely separate OS window (Tauri WebviewWindow) —
 * a separate JS runtime with its own Pinia instance, so the preview
 * window's `useTerminalStore()` is independent from the main window's and
 * nothing written to it appears in the main window's Output tab on its own.
 * This bridges the gap using Tauri's cross-window event system, which is
 * the only channel two Tauri windows share by default.
 *
 * Preview window: emits every terminal log entry (and every console.*
 * call — see PreviewApp.vue's console patch) as a 'mava:preview-log' event.
 * Main window: listens and mirrors it into its own terminal store's Output
 * tab, prefixed so it's clear the message came from the preview run.
 *
 * Also carries 'mava:preview-navigate': the preview window has a single
 * fixed label ("preview"), so a second click on the Project dropdown's
 * Preview item reuses the existing window instead of opening another one
 * (see usePreview.ts) — this event is how the main window tells that
 * already-open window which project/page to show now.
 *
 * Also carries 'mava:preview-sync-page': live preview. The main window
 * broadcasts the active page's full data (debounced) on every edit; the
 * preview window applies it directly via `pages.commitPageToCache()` if
 * it's currently showing that same page — no disk round-trip, no reload.
 * One-directional (main → preview only) — the preview window never emits
 * this, so applying an incoming sync can't loop back out.
 */

import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { LogLevel } from '../stores/terminal'
import type { Page } from '../types/project'

const LOG_EVENT = 'mava:preview-log'
const NAVIGATE_EVENT = 'mava:preview-navigate'
const SYNC_PAGE_EVENT = 'mava:preview-sync-page'

export interface PreviewLogPayload {
    level: LogLevel
    message: string
}

export interface PreviewNavigatePayload {
    archivePath: string
    pageId: string
}

export function emitPreviewLog(level: LogLevel, message: string): void {
    void emit(LOG_EVENT, { level, message } satisfies PreviewLogPayload)
}

export function listenPreviewLog(handler: (payload: PreviewLogPayload) => void): Promise<UnlistenFn> {
    return listen<PreviewLogPayload>(LOG_EVENT, event => handler(event.payload))
}

export function emitPreviewNavigate(payload: PreviewNavigatePayload): void {
    void emit(NAVIGATE_EVENT, payload)
}

export function listenPreviewNavigate(handler: (payload: PreviewNavigatePayload) => void): Promise<UnlistenFn> {
    return listen<PreviewNavigatePayload>(NAVIGATE_EVENT, event => handler(event.payload))
}

export function emitPreviewSyncPage(page: Page): void {
    void emit(SYNC_PAGE_EVENT, page)
}

export function listenPreviewSyncPage(handler: (page: Page) => void): Promise<UnlistenFn> {
    return listen<Page>(SYNC_PAGE_EVENT, event => handler(event.payload))
}
