// mava-studio/composables/useCfInspectorNavigation.ts
//
// Handles navigation from Inspector action links to lessons and pages.
// Uses the existing page store pattern: set active page ID,
// path (moduleId, lessonId) derives automatically from pageMetaById.

import { useProjectMetadataStore } from '../stores/projectMetadata'
import { usePagesStore } from '../stores/pages'
import type { InspectorNavTarget } from '../types/cf-alignment.types'

export function useCfInspectorNavigation() {
    const project = useProjectMetadataStore()
    const pages = usePagesStore()

    /**
     * Navigate to an InspectorNavTarget.
     * Finds the first page of the target lesson and sets it active.
     * Returns true if navigation succeeded.
     */
    function navigateTo(target: InspectorNavTarget): boolean {
        switch (target.type) {
            case 'lesson':
                return target.lesson_id ? navigateToLesson(target.lesson_id) : false
            case 'page':
                return target.page_id ? navigateToPage(target.page_id) : false
            case 'element':
                return (target.page_id && target.element_id)
                    ? navigateToElement(target.page_id, target.element_id)
                    : false
            case 'module':
                return target.module_id ? navigateToModule(target.module_id) : false
            default:
                return false
        }
    }

    function navigateToLesson(lessonId: string): boolean {
        const lesson = project.lessonsById[lessonId]
        if (!lesson) return false

        // Resolve using store accessor to preserve canonical ordering semantics.
        const orderedPages = project.orderedPagesForLesson(lessonId).value
        const firstPage = orderedPages[0]
        if (!firstPage) return false

        void pages.loadPage(firstPage.id)
        return true
    }

    function navigateToPage(pageId: string): boolean {
        // Page existence should come from project metadata, not current cache state.
        if (!project.pageMetaById[pageId]) return false
        void pages.loadPage(pageId)
        return true
    }

    function navigateToElement(pageId: string, _elementId: string): boolean {
        // Navigate to the page first; element selection is handled by the canvas store
        // The Inspector can emit a follow-up event for element selection if needed
        return navigateToPage(pageId)
    }

    function navigateToModule(moduleId: string): boolean {
        const module = project.modulesById[moduleId]
        if (!module) return false

        const orderedLessons = project.orderedLessonsForModule(moduleId).value
        const firstLesson = orderedLessons[0]
        if (!firstLesson) return false

        return navigateToLesson(firstLesson.id)
    }

    /**
     * For a given competency_id, find the module aligned to it and navigate there.
     */
    function navigateToCompetency(
        competencyId: string,
        frameworkId: string,
    ): boolean {
        const module = Object.values(project.modulesById).find(m =>
            m.cf_alignment?.framework_id === frameworkId &&
            m.cf_alignment?.competency_id === competencyId
        )
        if (!module) return false
        return navigateToModule(module.id)
    }

    /**
     * For a given evidence_item_id, find the assessment lesson and navigate.
     */
    function navigateToEvidence(
        evidenceItemId: string,
        frameworkId: string,
    ): boolean {
        const lesson = Object.values(project.lessonsById).find(l =>
            l.cf_alignment?.framework_id === frameworkId &&
            (l.cf_alignment as any).evidence_item_id === evidenceItemId
        )
        if (!lesson) return false
        return navigateToLesson(lesson.id)
    }

    return {
        navigateTo,
        navigateToLesson,
        navigateToPage,
        navigateToModule,
        navigateToCompetency,
        navigateToEvidence,
    }
}
