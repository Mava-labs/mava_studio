// mava-studio/stores/useCfStore.ts
//
// Central store for all CF runtime state in Mava Studio.
// Owns: loaded CourseBriefs, InspectorReports, strictness setting,
// active framework selection, and the debounced Inspector trigger.
//
// Does NOT own project data (modulesById, lessonsById etc.) —
// those stay in the project store. This store only owns CF processing output.

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

import type {
  CourseBrief,
  InspectorReport,
  InspectorStrictness,
  InspectorRunInput,
  InspectorRunOutput,
  GetBriefOutput,
  MapperRunOutput,
  MapperRunInput,
  CacheFrameworkOutput,
  CacheFrameworkInput,
  ProjectInspectorSlice,
  CourseFrameworkAlignment,
} from '../types/cf-alignment.types'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type BriefLoadState = 'idle' | 'loading' | 'loaded' | 'stale' | 'error'
export type InspectorRunState = 'idle' | 'running' | 'done' | 'error'

export interface FrameworkEntry {
  alignment: CourseFrameworkAlignment
  brief: CourseBrief | null
  briefState: BriefLoadState
  report: InspectorReport | null
  inspectorState: InspectorRunState
  lastError: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useCfStore = defineStore('cf', () => {

  // ── State ───────────────────────────────────────────────────────────────

  /**
   * One entry per framework alignment on the course.
   * Keyed by framework_id.
   */
  const frameworks = ref<Record<string, FrameworkEntry>>({})

  /** The framework_id currently displayed in Mapper / Inspector panels */
  const activeFrameworkId = ref<string | null>(null)

  const strictness = ref<InspectorStrictness>('standard')

  const isImportingFramework = ref(false)
  const importError = ref<string | null>(null)

  // Debounce handle for Inspector
  let inspectorDebounceTimer: ReturnType<typeof setTimeout> | null = null
  const INSPECTOR_DEBOUNCE_MS = 1500

  // ── Computed ────────────────────────────────────────────────────────────

  const frameworkList = computed(() => Object.values(frameworks.value))

  const activeEntry = computed(() =>
    activeFrameworkId.value
      ? frameworks.value[activeFrameworkId.value] ?? null
      : null
  )

  const activeBrief = computed(() => activeEntry.value?.brief ?? null)

  const activeReport = computed(() => activeEntry.value?.report ?? null)

  /** True if any framework has a report with publish_ready: false */
  const hasBlockingErrors = computed(() =>
    frameworkList.value.some(e => e.report && !e.report.publish_ready)
  )

  /** Aggregate blocking error count across all frameworks */
  const totalBlockingErrors = computed(() =>
    frameworkList.value.reduce((sum, e) =>
      sum + (e.report?.blocking_errors.length ?? 0), 0
    )
  )

  /** Overall coverage percent for the active framework */
  const activeCoveragePercent = computed(() => {
    const report = activeReport.value
    if (!report) return null
    const s = report.coverage.summary
    if (s.total_competencies === 0) return 0
    return Math.round((s.complete / s.total_competencies) * 100)
  })

  // ── Project open: initialise from saved alignments ─────────────────────

  /**
   * Called on project open with the course's cf_alignments array.
   * For each alignment: load brief from cache, run Inspector if fresh,
   * trigger Mapper rebuild if stale.
   */
  async function initFromAlignments(
    alignments: CourseFrameworkAlignment[],
  ) {
    // Reset
    frameworks.value = {}

    if (!alignments.length) return

    for (const alignment of alignments) {
      frameworks.value[alignment.framework_id] = {
        alignment,
        brief: null,
        briefState: 'loading',
        report: null,
        inspectorState: 'idle',
        lastError: null,
      }
    }

    // Set first framework as active
    if (alignments.length > 0 && !activeFrameworkId.value) {
      activeFrameworkId.value = alignments[0].framework_id
    }

    // Load briefs in parallel
    await Promise.all(alignments.map(a => loadBrief(a)))
  }

  async function loadBrief(alignment: CourseFrameworkAlignment) {
    const entry = frameworks.value[alignment.framework_id]
    if (!entry) return

    try {
      const result: GetBriefOutput = await invoke('cf_get_brief', {
        input: {
          framework_id: alignment.framework_id,
          framework_version: alignment.framework_version,
          brief_id: alignment.brief_id,
        },
      })

      if (!result.found || !result.brief) {
        // Brief missing — needs Mapper rebuild
        entry.briefState = 'stale'
        return
      }

      entry.brief = result.brief
      entry.briefState = result.is_fresh ? 'loaded' : 'stale'
    } catch (e) {
      entry.briefState = 'error'
      entry.lastError = String(e)
    }
  }

  // ── Import a CF from bundle JSON or disk ───────────────────────────────

  /**
   * Import a CF bundle JSON string.
   * Caches the framework, runs the Mapper, returns the resulting alignment
   * for the caller (project store) to save onto the course.
   */
  async function importFramework(
    bundleJson: string,
  ): Promise<CourseFrameworkAlignment | null> {
    isImportingFramework.value = true
    importError.value = null

    try {
      // Step 1: cache the framework
      const cacheResult: CacheFrameworkOutput = await invoke('cf_cache_framework', {
        input: { bundle_json: bundleJson } satisfies CacheFrameworkInput,
      })

      if (!cacheResult.success) {
        importError.value = cacheResult.errors.join('; ')
        return null
      }

      // Step 2: run the Mapper
      const mapperResult: MapperRunOutput = await invoke('cf_mapper_run', {
        input: {
          framework_json: bundleJson,
          project_id: 'current', // project store owns actual ID
          existing_brief_id: null,
        } satisfies MapperRunInput,
      })

      if (!mapperResult.success || !mapperResult.brief) {
        importError.value = mapperResult.errors.join('; ')
        return null
      }

      const brief = mapperResult.brief

      // Register in store
      const alignment: CourseFrameworkAlignment = {
        framework_id: brief.framework_id,
        framework_version: brief.framework_version,
        framework_checksum: brief.framework_checksum,
        aligned_at: Date.now(),
        brief_id: brief.brief_id,
        framework_title: brief.competencies[
          Object.keys(brief.competencies)[0]
        ]?.domain_name ?? brief.framework_id,
      }

      frameworks.value[brief.framework_id] = {
        alignment,
        brief,
        briefState: 'loaded',
        report: null,
        inspectorState: 'idle',
        lastError: null,
      }

      activeFrameworkId.value = brief.framework_id
      return alignment
    } catch (e) {
      importError.value = String(e)
      return null
    } finally {
      isImportingFramework.value = false
    }
  }

  /**
   * Rebuild the brief for a specific framework (called when brief is stale).
   * Requires the framework JSON to be in the cache already.
   */
  async function rebuildBrief(
    frameworkId: string,
    bundleJson: string,
  ): Promise<void> {
    const entry = frameworks.value[frameworkId]
    if (!entry) return

    entry.briefState = 'loading'

    const result: MapperRunOutput = await invoke('cf_mapper_run', {
      input: {
        framework_json: bundleJson,
        project_id: 'current',
        existing_brief_id: entry.alignment.brief_id,
      } satisfies MapperRunInput,
    })

    if (result.success && result.brief) {
      entry.brief = result.brief
      entry.briefState = 'loaded'
      entry.alignment.brief_id = result.brief.brief_id
      entry.alignment.framework_checksum = result.brief.framework_checksum
    } else {
      entry.briefState = 'error'
      entry.lastError = result.errors.join('; ')
    }
  }

  // ── Inspector ──────────────────────────────────────────────────────────

  /**
   * Trigger a debounced Inspector run for all loaded frameworks.
   * Called by the project store watcher on CF-relevant mutations.
   */
  function scheduleInspectorRun(slice: ProjectInspectorSlice) {
    if (inspectorDebounceTimer) clearTimeout(inspectorDebounceTimer)
    inspectorDebounceTimer = setTimeout(() => {
      runInspectorAll(slice)
    }, INSPECTOR_DEBOUNCE_MS)
  }

  /**
   * Run the Inspector for all loaded frameworks immediately.
   */
  async function runInspectorAll(slice: ProjectInspectorSlice) {
    for (const entry of Object.values(frameworks.value)) {
      if (!entry.brief || entry.briefState !== 'loaded') continue
      await runInspectorForFramework(entry, slice)
    }
  }

  async function runInspectorForFramework(
    entry: FrameworkEntry,
    slice: ProjectInspectorSlice,
  ) {
    if (!entry.brief) return
    entry.inspectorState = 'running'

    try {
      const result: InspectorRunOutput = await invoke('cf_inspector_run', {
        input: {
          project_slice: slice,
          brief: entry.brief,
          strictness: strictness.value,
        } satisfies InspectorRunInput,
      })

      if (result.success && result.report) {
        entry.report = result.report
        entry.inspectorState = 'done'
      } else {
        entry.inspectorState = 'error'
        entry.lastError = result.errors.join('; ')
      }
    } catch (e) {
      entry.inspectorState = 'error'
      entry.lastError = String(e)
    }
  }

  // ── Active framework selection ─────────────────────────────────────────

  function setActiveFramework(frameworkId: string) {
    if (frameworks.value[frameworkId]) {
      activeFrameworkId.value = frameworkId
    }
  }

  function setStrictness(s: InspectorStrictness) {
    strictness.value = s
  }

  // ── Remove a framework ─────────────────────────────────────────────────

  function removeFramework(frameworkId: string) {
    delete frameworks.value[frameworkId]
    if (activeFrameworkId.value === frameworkId) {
      const remaining = Object.keys(frameworks.value)
      activeFrameworkId.value = remaining[0] ?? null
    }
  }

  // ── Expose ─────────────────────────────────────────────────────────────

  return {
    // State
    frameworks,
    activeFrameworkId,
    strictness,
    isImportingFramework,
    importError,

    // Computed
    frameworkList,
    activeEntry,
    activeBrief,
    activeReport,
    hasBlockingErrors,
    totalBlockingErrors,
    activeCoveragePercent,

    // Actions
    initFromAlignments,
    importFramework,
    rebuildBrief,
    scheduleInspectorRun,
    runInspectorAll,
    setActiveFramework,
    setStrictness,
    removeFramework,
  }
})
