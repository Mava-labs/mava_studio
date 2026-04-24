// mava-studio/composables/useCfProjectSlice.ts
//
// Builds a ProjectInspectorSlice from the project store.
// This is the lean payload the Inspector Tauri command accepts —
// only CF-relevant data, not the full ProjectData.
//
// Called by the debounced Inspector watcher.

import { computed } from 'vue'
import { useProjectMetadataStore } from '../stores/projectMetadata'
import { usePagesStore } from '../stores/pages'
import type {
    ProjectInspectorSlice,
    ModuleSlice,
    LessonSlice,
    PageSlice,
    CfElementSlice,
    AssessmentCFAlignment,
    EvidenceType,
} from '../types/cf-alignment.types'

export function useCfProjectSlice() {
    const project = useProjectMetadataStore()
    const pagesStore = usePagesStore()

    /**
     * Reactive ProjectInspectorSlice.
     * Recomputes when project store changes.
     * Used as the input to useCfStore.scheduleInspectorRun().
     */
    const slice = computed<ProjectInspectorSlice>(() => {
        const modules: ModuleSlice[] = Object.values(project.modulesById).map(mod => ({
            id: mod.id,
            cf_alignment: mod.cf_alignment ?? null,
            lesson_ids: mod.lessons.map(l => l.id),
        }))

        const lessons: Record<string, LessonSlice> = {}
        for (const lesson of Object.values(project.lessonsById)) {
            const alignment = lesson.cf_alignment ?? null

            // Normalise alignment to flat shape the Rust side expects
            let flatAlignment = null
            if (alignment) {
                const hasAssessmentFields =
                    typeof alignment === 'object' &&
                    alignment !== null &&
                    'evidence_item_id' in alignment &&
                    'evidence_type' in alignment

                const assessment = hasAssessmentFields
                    ? (alignment as AssessmentCFAlignment)
                    : null

                flatAlignment = {
                    framework_id: alignment.framework_id,
                    competency_id: alignment.competency_id,
                    indicator_ids: [...alignment.indicator_ids],
                    evidence_item_id: assessment?.evidence_item_id ?? null,
                    evidence_type: (assessment?.evidence_type ?? null) as EvidenceType | null,
                }
            }

            lessons[lesson.id] = {
                id: lesson.id,
                lesson_type: lesson.type,
                cf_alignment: flatAlignment,
                page_ids: lesson.pages.map(p => p.id),
            }
        }

        const pages: Record<string, PageSlice> = {}
        const loadedPages = pagesStore.pagesCache as Record<string, import('../types/project').Page>
        for (const [pageId, page] of Object.entries(loadedPages)) {
            // Extract only ComponentElements that have cf_proof set
            const cfElements: CfElementSlice[] = []
            for (const element of Object.values(page.elements)) {
                if (element.kind !== 'component') continue
                const comp = element as any
                if (!comp.cf_proof) continue
                cfElements.push({
                    element_id: element.id,
                    component_id: comp.componentId,
                    cf_proof: comp.cf_proof,
                })
            }

            // Only include pages that have CF elements or belong to CF-aligned lessons
            if (cfElements.length > 0) {
                pages[pageId] = {
                    id: pageId,
                    cf_elements: cfElements,
                }
            }
        }

        return {
            project_id: project.projectId ?? 'unknown',
            framework_alignments: project.course?.cf_alignments
                ? [...project.course.cf_alignments]
                : [],
            modules,
            lessons,
            pages,
        }
    })

    return { slice }
}
