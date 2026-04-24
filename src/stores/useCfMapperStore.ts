// mava-studio/stores/useCfMapperStore.ts
//
// Mapper panel state: marketplace browsing, search, install flow.
//
// Registry is stubbed with local data for now.
// When the CF Builder registry is live, swap registrySearch() to a real API call.
// The rest of the store is registry-agnostic.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'

import { useCfStore } from './useCfStore'

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY TYPES
// These mirror what a real CF registry API would return.
// The stub returns these same shapes so the Vue components are registry-ready.
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistryCFCard {
    framework_id: string
    title: string
    description: string
    version: string
    publisher: string
    institution?: string
    domain_count: number
    competency_count: number
    bloom_range: { min: string; max: string }
    tags: string[]
    downloads: number
    updated_at: string         // ISO 8601
    bundle_url?: string        // populated when registry is live
    /** Present if this CF is already installed in the current project */
    installed_version?: string
}

export interface RegistryCFDetail extends RegistryCFCard {
    domains: { id: string; name: string; competency_count: number }[]
    required_evidence_types: string[]
    requires_offline: boolean
    changelog?: string
    license?: string
    locale?: string
}

export type MapperPanelView =
    | 'browse'       // marketplace grid — no CFs installed
    | 'detail'       // CF detail page (from browse or installed list click)
    | 'installed'    // installed CF reference view (brief loaded)

// ─────────────────────────────────────────────────────────────────────────────
// STUB REGISTRY DATA
// Replace registrySearch() below with a real API call when registry is live.
// ─────────────────────────────────────────────────────────────────────────────

const STUB_REGISTRY: RegistryCFCard[] = [
    {
        framework_id: 'cf_digital_literacy_ug_v1',
        title: 'Digital Literacy Essentials',
        description: 'Foundational framework for core digital skills in low-resource computing environments.',
        version: '1.0.0',
        publisher: 'BitCraft / BitPulse',
        institution: 'BitPulse Uganda',
        domain_count: 3,
        competency_count: 12,
        bloom_range: { min: 'Apply', max: 'Create' },
        tags: ['digital skills', 'foundational', 'offline-ready', 'Uganda'],
        downloads: 142,
        updated_at: '2026-04-01T00:00:00Z',
    },
    {
        framework_id: 'cf_web_dev_intro_v1',
        title: 'Introductory Web Development',
        description: 'HTML, CSS and JavaScript fundamentals for beginner developers.',
        version: '1.2.0',
        publisher: 'BitCraft / BitPulse',
        institution: 'BitPulse Uganda',
        domain_count: 4,
        competency_count: 18,
        bloom_range: { min: 'Understand', max: 'Create' },
        tags: ['web development', 'HTML', 'CSS', 'JavaScript', 'beginner'],
        downloads: 89,
        updated_at: '2026-03-15T00:00:00Z',
    },
    {
        framework_id: 'cf_agribusiness_ug_v1',
        title: 'Agribusiness Essentials',
        description: 'Practical competencies for smallholder agribusiness in East Africa.',
        version: '1.0.1',
        publisher: 'External Publisher',
        institution: 'BitPulse Uganda',
        domain_count: 2,
        competency_count: 8,
        bloom_range: { min: 'Apply', max: 'Evaluate' },
        tags: ['agribusiness', 'Uganda', 'East Africa', 'agriculture'],
        downloads: 34,
        updated_at: '2026-02-20T00:00:00Z',
    },
]

const STUB_DETAILS: Record<string, RegistryCFDetail> = {
    'cf_digital_literacy_ug_v1': {
        ...STUB_REGISTRY[0],
        domains: [
            { id: 'domain_01', name: 'Basic Computer Skills', competency_count: 4 },
            { id: 'domain_02', name: 'Internet & Communication', competency_count: 4 },
            { id: 'domain_03', name: 'Digital Safety', competency_count: 4 },
        ],
        required_evidence_types: ['quiz', 'video_demo', 'project_submission'],
        requires_offline: true,
        license: 'CC-BY-4.0',
        locale: 'en-UG',
        changelog: 'v1.0.0 — Initial release',
    },
    'cf_web_dev_intro_v1': {
        ...STUB_REGISTRY[1],
        domains: [
            { id: 'domain_01', name: 'HTML Fundamentals', competency_count: 5 },
            { id: 'domain_02', name: 'CSS Styling', competency_count: 4 },
            { id: 'domain_03', name: 'JavaScript Basics', competency_count: 5 },
            { id: 'domain_04', name: 'Project Workflow', competency_count: 4 },
        ],
        required_evidence_types: ['quiz', 'project_submission', 'video_demo'],
        requires_offline: true,
        license: 'CC-BY-4.0',
        locale: 'en-UG',
    },
    'cf_agribusiness_ug_v1': {
        ...STUB_REGISTRY[2],
        domains: [
            { id: 'domain_01', name: 'Market Fundamentals', competency_count: 4 },
            { id: 'domain_02', name: 'Record Keeping', competency_count: 4 },
        ],
        required_evidence_types: ['quiz', 'reflection', 'project_submission'],
        requires_offline: false,
        license: 'CC-BY-SA-4.0',
        locale: 'en-UG',
    },
}

async function registrySearch(query: string): Promise<RegistryCFCard[]> {
    // STUB: filter local data
    // When registry is live, replace with:
    //   const res = await fetch(`https://registry.bitpulse.ug/cf?q=${encodeURIComponent(query)}`)
    //   return res.json()
    await new Promise(r => setTimeout(r, 300)) // simulate network latency
    const q = query.toLowerCase()
    if (!q) return STUB_REGISTRY
    return STUB_REGISTRY.filter(cf =>
        cf.title.toLowerCase().includes(q) ||
        cf.description.toLowerCase().includes(q) ||
        cf.tags.some(t => t.toLowerCase().includes(q)) ||
        cf.publisher.toLowerCase().includes(q)
    )
}

async function registryGetDetail(frameworkId: string): Promise<RegistryCFDetail | null> {
    // STUB: return local detail
    // When registry is live, replace with:
    //   const res = await fetch(`https://registry.bitpulse.ug/cf/${frameworkId}`)
    //   return res.json()
    await new Promise(r => setTimeout(r, 150))
    return STUB_DETAILS[frameworkId] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useCfMapperStore = defineStore('cf-mapper', () => {
    const cfStore = useCfStore()

    // ── Panel navigation ───────────────────────────────────────────────────
    const currentView = ref<MapperPanelView>('browse')
    const selectedFrameworkId = ref<string | null>(null)

    // ── Browse / search ────────────────────────────────────────────────────
    const searchQuery = ref('')
    const searchResults = ref<RegistryCFCard[]>([])
    const isSearching = ref(false)
    const searchError = ref<string | null>(null)

    // ── Detail page ────────────────────────────────────────────────────────
    const detailCard = ref<RegistryCFDetail | null>(null)
    const isLoadingDetail = ref(false)
    const isInstalling = ref(false)
    const installError = ref<string | null>(null)

    // ── Installed view ─────────────────────────────────────────────────────
    // (brief data comes from cfStore.activeBrief)

    // ── Computed ───────────────────────────────────────────────────────────

    /** Cards enriched with installed_version if present in cfStore */
    const enrichedResults = computed(() =>
        searchResults.value.map(card => ({
            ...card,
            installed_version:
                cfStore.frameworks[card.framework_id]?.alignment.framework_version,
        }))
    )

    const hasInstalledFrameworks = computed(() =>
        Object.keys(cfStore.frameworks).length > 0
    )

    const installedFrameworks = computed(() =>
        cfStore.frameworkList.map(entry => ({
            framework_id: entry.alignment.framework_id,
            title: entry.alignment.framework_title,
            version: entry.alignment.framework_version,
            brief: entry.brief,
            briefState: entry.briefState,
        }))
    )

    // ── Actions ────────────────────────────────────────────────────────────

    async function search(query: string = '') {
        searchQuery.value = query
        isSearching.value = true
        searchError.value = null
        try {
            searchResults.value = await registrySearch(query)
        } catch (e) {
            searchError.value = String(e)
            searchResults.value = []
        } finally {
            isSearching.value = false
        }
    }

    async function openDetail(frameworkId: string) {
        selectedFrameworkId.value = frameworkId
        currentView.value = 'detail'
        isLoadingDetail.value = true
        detailCard.value = null

        try {
            detailCard.value = await registryGetDetail(frameworkId)
        } catch (e) {
            // detail unavailable — show what we have from the card
        } finally {
            isLoadingDetail.value = false
        }
    }

    /**
     * Install a CF from the registry.
     * In stub mode: we don't have a real bundle_url, so we show a
     * "Load from disk" fallback for stubs without a URL.
     * When registry is live this will fetch the bundle from bundle_url.
     */
    async function installFromRegistry(frameworkId: string): Promise<boolean> {
        const detail = STUB_DETAILS[frameworkId]
        if (!detail?.bundle_url) {
            // No bundle URL yet — registry not live. Prompt load from disk instead.
            return loadFromDisk()
        }

        isInstalling.value = true
        installError.value = null
        try {
            const res = await fetch(detail.bundle_url)
            const bundleJson = await res.text()
            const alignment = await cfStore.importFramework(bundleJson)
            if (alignment) {
                currentView.value = 'installed'
                cfStore.setActiveFramework(alignment.framework_id)
                return true
            }
            installError.value = cfStore.importError ?? 'Import failed'
            return false
        } catch (e) {
            installError.value = String(e)
            return false
        } finally {
            isInstalling.value = false
        }
    }

    /**
     * Load a CF bundle from a local file.
     * Opens the Tauri file dialog, reads the JSON, imports via cfStore.
     */
    async function loadFromDisk(): Promise<boolean> {
        isInstalling.value = true
        installError.value = null

        try {
            const selected = await open({
                title: 'Select Competence Framework bundle',
                filters: [{ name: 'CF Bundle', extensions: ['json'] }],
                multiple: false,
            })

            if (!selected || Array.isArray(selected)) {
                isInstalling.value = false
                return false
            }

            const bundleJson = await readTextFile(selected)
            const alignment = await cfStore.importFramework(bundleJson)

            if (alignment) {
                currentView.value = 'installed'
                cfStore.setActiveFramework(alignment.framework_id)
                return true
            }

            installError.value = cfStore.importError ?? 'Import failed'
            return false
        } catch (e) {
            installError.value = String(e)
            return false
        } finally {
            isInstalling.value = false
        }
    }

    function openInstalledView(frameworkId: string) {
        selectedFrameworkId.value = frameworkId
        cfStore.setActiveFramework(frameworkId)
        currentView.value = 'installed'
    }

    function goToBrowse() {
        currentView.value = 'browse'
        selectedFrameworkId.value = null
        detailCard.value = null
    }

    function disableFramework(frameworkId: string) {
        cfStore.removeFramework(frameworkId)
        if (cfStore.frameworkList.length > 0) {
            currentView.value = 'installed'
        } else {
            currentView.value = 'browse'
        }
    }

    // Initialise with a search on first load
    async function init() {
        await search('')
        // If frameworks are already installed, show installed view
        if (hasInstalledFrameworks.value) {
            currentView.value = 'installed'
        }
    }

    return {
        // State
        currentView,
        selectedFrameworkId,
        searchQuery,
        searchResults,
        isSearching,
        searchError,
        detailCard,
        isLoadingDetail,
        isInstalling,
        installError,

        // Computed
        enrichedResults,
        hasInstalledFrameworks,
        installedFrameworks,

        // Actions
        search,
        openDetail,
        installFromRegistry,
        loadFromDisk,
        openInstalledView,
        goToBrowse,
        disableFramework,
        init,
    }
})
