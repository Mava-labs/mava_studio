/**
 * usePreview.ts
 *
 * Opens the current page in a separate, genuinely interactive OS window —
 * a real runtime (element rendering + Trigger DSL + scripts + native DOM
 * interaction), not a rendering-only mockup. Distinct from "Publish"
 * (still a disabled stub) in that this never writes anywhere outside the
 * project's own save path — it saves the current project (so the preview
 * window, a separate process/session, has something correct to load) and
 * opens a window pointed at the same bundle with a `#preview` route.
 *
 * Singleton window: uses a fixed label ("preview") rather than one per
 * click, so a second "Preview" click reuses and refocuses the existing
 * window (retargeted to the current project/page via
 * emitPreviewNavigate) instead of piling up new windows.
 */

import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useProjectMetadataStore } from '../stores/projectMetadata'
import { usePagesStore } from '../stores/pages'
import { useProjectLifecycle } from './useProjectLifecycle'
import { useNotificationStore } from '../stores/notification'
import { emitPreviewNavigate } from '../utils/previewBridge'

const PREVIEW_WINDOW_LABEL = 'preview'

export function usePreview() {
    const project = useProjectMetadataStore()
    const pages = usePagesStore()
    const lifecycle = useProjectLifecycle()
    const notifications = useNotificationStore()

    async function openPreview(): Promise<void> {
        if (!project.isProjectOpen) {
            notifications.addNotification('Open a project before previewing.', { type: 'warn', ttl: 3500 })
            return
        }
        if (!pages.activePageId) {
            notifications.addNotification('No page selected to preview.', { type: 'warn', ttl: 3500 })
            return
        }
        if (!project.archivePath) {
            notifications.addNotification('Save the project before previewing.', { type: 'warn', ttl: 3500 })
            return
        }

        // The preview window loads the project fresh from disk (own process,
        // own store instances) — it needs the save to have actually happened,
        // not just be queued in the autosave debounce. Abort rather than open
        // (or refocus) a window that would just show stale content — saveNow()
        // already surfaced the error via notification.
        const saved = await lifecycle.saveNow()
        if (!saved) return

        const archivePath = project.archivePath
        const pageId = pages.activePageId

        const existing = await WebviewWindow.getByLabel(PREVIEW_WINDOW_LABEL)
        if (existing) {
            emitPreviewNavigate({ archivePath, pageId })
            await existing.setFocus()
            return
        }

        const params = new URLSearchParams({ archivePath, pageId })
        const win = new WebviewWindow(PREVIEW_WINDOW_LABEL, {
            url: `index.html#preview?${params.toString()}`,
            title: `Preview — ${project.projectName || 'Mava Studio'}`,
            width: 1200,
            height: 800,
            devtools: true,
        })

        win.once('tauri://error', (event) => {
            notifications.addNotification(
                `Failed to open preview window: ${JSON.stringify(event.payload)}`,
                { type: 'error', ttl: 6000 }
            )
        })
    }

    return { openPreview }
}
