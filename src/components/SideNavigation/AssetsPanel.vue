<!--
    AssetsPanel.vue — the Media Manager, accessed from the left sidebar's
    "Assets" nav item (previously a bare placeholder in NavAssociates.vue).

    Local media (image/video/audio) is imported from disk here via
    projectMetadata.ts's importMediaFromDevice() — a native file dialog,
    registered into the project's mediaLibrary. Inserting a library entry
    onto the canvas converts its local path to a loadable `asset://` URL via
    Tauri's convertFileSrc() at the point of insertion, not before — the
    library itself just records "what's on disk," nothing session-specific.

    Online URLs never go through this panel — an author sets a remote http(s)
    URL directly on an image/video/audio element's src field (MediaPanel.vue)
    and it renders natively there too (an <img>/<video>/<audio> tag loads a
    remote URL directly, same as any website — no iframe needed). Embedding
    a whole external page (YouTube, a web widget) is a different need,
    served by the separate 'iframe' element type in the Elements panel, not
    by anything in here.
-->
<template>
    <div class="h-full flex flex-col">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[11px] tracking-[0.18em] font-semibold uppercase text-slate-400">
            <span>Assets</span>
            <span v-if="assets.length" class="text-[10px] normal-case tracking-normal text-slate-500">{{ assets.length }} item{{ assets.length === 1 ? '' : 's' }}</span>
        </div>

        <div class="px-3 py-2 border-b border-slate-800">
            <button type="button" class="import-btn" :disabled="importing" @click="handleImport">
                {{ importing ? 'Importing…' : 'Import from device' }}
            </button>
            <p class="hint mt-2">Images, video, and audio only. For an online URL, set it directly on an element's Source field instead — it renders natively there too, no iframe involved.</p>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto thin-scroll">
            <div v-if="!assets.length" class="px-3 py-4 text-xs text-slate-500">
                No media imported yet.
            </div>
            <ul v-else class="flex flex-col">
                <li v-for="asset in assets" :key="asset.id" class="asset-row group">
                    <span class="kind-badge" :class="`kind-${kindOf(asset)}`">{{ kindOf(asset) }}</span>
                    <span class="asset-name" :title="asset.name">{{ asset.name }}</span>
                    <div class="asset-actions">
                        <button type="button" class="icon-btn" title="Insert onto page" @click="handleInsert(asset)">+</button>
                        <button type="button" class="icon-btn icon-btn--danger" title="Delete from library" @click="handleDelete(asset)">×</button>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { computed, ref } from 'vue';
    import { useProjectMetadataStore, type MediaAsset } from '../../stores/projectMetadata';
    import { useElementStore } from '../../stores/element';
    import { useNotificationStore } from '../../stores/notification';
    import { resolveMediaSrc } from '../../utils/mediaResolve';

    const project = useProjectMetadataStore();
    const elementStore = useElementStore();
    const notification = useNotificationStore();

    const assets = computed(() => Object.values(project.mediaLibrary).sort((a, b) => b.createdAt - a.createdAt));
    const importing = ref(false);

    function kindOf(asset: MediaAsset): 'image' | 'video' | 'audio' | 'file' {
        const kind = asset.type.split('/')[0];
        return kind === 'image' || kind === 'video' || kind === 'audio' ? kind : 'file';
    }

    async function handleImport() {
        importing.value = true;
        try {
            const imported = await project.importMediaFromDevice();
            if (imported.length) {
                notification.addNotification(`Imported ${imported.length} file${imported.length === 1 ? '' : 's'}`, { type: 'info' });
            }
        } catch (err) {
            notification.addNotification(`Import failed: ${String(err)}`, { type: 'error' });
        } finally {
            importing.value = false;
        }
    }

    async function handleInsert(asset: MediaAsset) {
        const kind = kindOf(asset);
        if (kind === 'file') {
            notification.addNotification('Only image/video/audio assets can be inserted directly.', { type: 'info' });
            return;
        }
        if (!project.projectId) return;
        const created = elementStore.addElement(kind);
        if (!created) return;
        try {
            const src = await resolveMediaSrc(asset, project.projectId);
            elementStore.updateElement(created.id, { attributes: { src } });
        } catch (err) {
            notification.addNotification(`Failed to load media: ${String(err)}`, { type: 'error' });
        }
    }

    function handleDelete(asset: MediaAsset) {
        project.deleteMedia(asset.id);
    }
</script>

<style scoped>
    .import-btn { width: 100%; background: #1d4ed8; border: none; color: #fff; font-size: 11px; font-weight: 600; padding: 7px 0; border-radius: 6px; cursor: pointer; }
    .import-btn:hover:not(:disabled) { background: #1e40af; }
    .import-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .hint { font-size: 10px; line-height: 1.5; color: #64748b; }

    .asset-row { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 1px solid #1e293b; }
    .asset-row:hover { background: rgba(148, 163, 184, 0.06); }

    .kind-badge { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 4px; background: #1e293b; color: #94a3b8; flex-shrink: 0; }
    .kind-image { color: #7dd3fc; }
    .kind-video { color: #c4b5fd; }
    .kind-audio { color: #fda4af; }

    .asset-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #e2e8f0; }

    .asset-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.1s ease; }
    .asset-row:hover .asset-actions { opacity: 1; }

    .icon-btn { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: #1e293b; border: none; border-radius: 4px; color: #cbd5e1; font-size: 13px; line-height: 1; cursor: pointer; }
    .icon-btn:hover { background: #334155; }
    .icon-btn--danger:hover { background: #7f1d1d; color: #fecaca; }
</style>
