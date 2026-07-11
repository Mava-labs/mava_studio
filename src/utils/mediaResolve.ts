/**
 * mediaResolve.ts
 *
 * Turns a MediaAsset into an actual URL the webview can load. A library
 * entry's `url` is one of two shapes:
 *   - "mava-blob:<hash>" — content stored inside the project's own .mava
 *     file (db/migrations.rs's media_blobs table). Resolving this calls the
 *     Rust `extract_media_blob` command, which writes the blob out to a
 *     local cache file (if not already there) and returns that path, which
 *     then gets convertFileSrc()'d into something the webview can load.
 *   - a real http(s) URL — a remote resource the author linked to directly;
 *     used as-is, no extraction needed.
 *
 * Deliberately resolved at point-of-use (AssetsPanel.vue's Insert,
 * MediaPanel.vue's "choose from Assets"), not once at import time — the
 * extracted cache file path is a throwaway local artifact, not something
 * that should be baked into the project data itself.
 */

import { convertFileSrc } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import type { MediaAsset } from '../stores/projectMetadata'

const BLOB_PREFIX = 'mava-blob:'

export function isBlobRef(url: string): boolean {
    return url.startsWith(BLOB_PREFIX)
}

export async function resolveMediaSrc(asset: MediaAsset, projectId: string): Promise<string> {
    if (!isBlobRef(asset.url)) return asset.url

    const hash = asset.url.slice(BLOB_PREFIX.length)
    const path = await invoke<string>('extract_media_blob', { projectId, hash })
    return convertFileSrc(path)
}
