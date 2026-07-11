<template>
    <div class="panel-root px-3">
        <div class="section-head mb-3">
            <h3 class="section-title">{{ isImage ? 'Image Source' : 'Media' }}</h3>
            <span class="badge">Source</span>
        </div>

        <div class="section mb-3">
            <label class="clab">Source URL</label>
            <input type="text" class="w-full input" :value="src" @change="setSrc(($event.target as HTMLInputElement).value)" />
            <p class="hint mt-1">A local file (via Assets, below) or a direct http(s) link both work here — either way this renders natively, respecting Fixed size and Fit. For embedding a whole external page (YouTube, a web widget), use an iframe element instead.</p>
        </div>

        <div v-if="libraryOptions.length" class="section mb-3">
            <label class="clab">Or choose from Assets</label>
            <select class="w-full input" :value="''" @change="pickFromLibrary(($event.target as HTMLSelectElement).value)">
                <option value="" disabled>Select an imported file…</option>
                <option v-for="opt in libraryOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
            </select>
        </div>

        <div v-if="isImage" class="section mb-3">
            <label class="clab">Alt Text</label>
            <input type="text" class="w-full input" :value="alt" @change="setAlt(($event.target as HTMLInputElement).value)" />
        </div>

        <div v-else class="flex gap-2">
            <label class="checkbox"><input type="checkbox" :checked="autoplay" @change="setFlag('autoplay', ($event.target as HTMLInputElement).checked)" /> Autoplay</label>
            <label class="checkbox"><input type="checkbox" :checked="loop" @change="setFlag('loop', ($event.target as HTMLInputElement).checked)" /> Loop</label>
            <label class="checkbox"><input type="checkbox" :checked="muted" @change="setFlag('muted', ($event.target as HTMLInputElement).checked)" /> Muted</label>
            <label class="checkbox"><input type="checkbox" :checked="controls" @change="setFlag('controls', ($event.target as HTMLInputElement).checked)" /> Controls</label>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { computed } from 'vue'
import { useActiveElement } from '../../../composables/useActiveElement'
import { useProjectMetadataStore } from '../../../stores/projectMetadata'
import { resolveMediaSrc } from '../../../utils/mediaResolve'
import type { FlatHtmlElement } from '../../../types/element'

const { element, update } = useActiveElement()
const project = useProjectMetadataStore()

const isImage = computed(() => (element.value as FlatHtmlElement | null)?.type === 'image')

/** Only assets whose kind matches this element's own type — an audio file
 *  isn't a valid pick for an <img>. */
const libraryOptions = computed(() => {
    const type = (element.value as FlatHtmlElement | null)?.type
    if (type !== 'image' && type !== 'video' && type !== 'audio') return []
    return Object.values(project.mediaLibrary).filter(a => a.type.split('/')[0] === type)
})

async function pickFromLibrary(id: string) {
    const asset = project.mediaLibrary[id]
    if (!asset || !project.projectId) return
    setSrc(await resolveMediaSrc(asset, project.projectId))
}

const attrs = computed(() => {
    const el = element.value as FlatHtmlElement | null
    if (!el) return {}
    return el.attributes ?? {}
})

const src = computed({ get: () => attrs.value.src ?? '', set: (v) => setAttr('src', v) })
const alt = computed({ get: () => attrs.value.alt ?? '', set: (v) => setAttr('alt', v) })
const autoplay = computed({ get: () => !!attrs.value.autoplay, set: (v: boolean) => setAttr('autoplay', v) })
const loop = computed({ get: () => !!attrs.value.loop, set: (v: boolean) => setAttr('loop', v) })
const muted = computed({ get: () => !!attrs.value.muted, set: (v: boolean) => setAttr('muted', v) })
const controls = computed({ get: () => attrs.value.controls !== false, set: (v: boolean) => setAttr('controls', v) })

function setAttr(key: string, value: unknown) {
    update({ attributes: { ...(attrs.value ?? {}), [key]: value } })
}

function setFlag(key: string, value: boolean) { setAttr(key, value) }

function setSrc(v: string) { setAttr('src', v) }
function setAlt(v: string) { setAttr('alt', v) }
</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; font-size: 12px; color: #e2e8f0; }
.section-title { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #cbd5e1; }
.badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: #0f172a; color: #94a3b8; text-transform: uppercase; }
.input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 8px; border-radius: 6px }
.clab { font-size: 11px; color: #94a3b8; display: block; margin-bottom: 6px }
.checkbox { font-size: 12px; color: #cbd5e1 }
.hint { font-size: 10px; line-height: 1.4; color: #64748b; }
</style>
