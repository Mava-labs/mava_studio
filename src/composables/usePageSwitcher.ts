/**
 * usePageSwitcher.ts
 * Composable — LRU-aware page navigation with tab coordination.
 *
 * Handles:
 *   - Switching to a page (load if not cached, open tab, mount stage)
 *   - Navigating between pages within a lesson
 *   - Preloading adjacent pages in the background
 *
 * Usage:
 *   const switcher = usePageSwitcher();
 *   await switcher.switchToPage(pageId);
 *   await switcher.switchToNextPage();
 *   await switcher.switchToPrevPage();
 */

import { computed, ref } from 'vue';
import { useProjectMetadataStore } from '../stores/projectMetadata';
import { usePagesStore } from '../stores/pages';
import { useComponentEditor } from './useComponentEditor';
import { useNotificationStore } from '../stores/notification';

/* ============================================================
   COMPOSABLE
   ============================================================ */

export function usePageSwitcher() {
    const project = useProjectMetadataStore();
    const pages = usePagesStore();
    const editor = useComponentEditor();
    const notification = useNotificationStore();

    const isSwitching = ref(false);

    /* ----------------------------------------------------------
       CONTEXT HELPERS
    ---------------------------------------------------------- */

    /** The lesson that owns the currently active page. */
    const activeLessonId = computed(() => {
        const pageId = pages.activePageId;
        if (!pageId) return null;
        return project.pageMetaById[pageId]?.lessonId ?? null;
    });

    /** Ordered page references for the active lesson. */
    const activeLessonPages = computed(() => {
        if (!activeLessonId.value) return [];
        return project.orderedPagesForLesson(activeLessonId.value).value;
    });

    /** Index of the active page within its lesson. */
    const activePageIndex = computed(() => {
        const pageId = pages.activePageId;
        if (!pageId) return -1;
        return activeLessonPages.value.findIndex(p => p.id === pageId);
    });

    const hasNextPage = computed(() =>
        activePageIndex.value < activeLessonPages.value.length - 1
    );

    const hasPrevPage = computed(() =>
        activePageIndex.value > 0
    );

    /* ----------------------------------------------------------
       SWITCH
    ---------------------------------------------------------- */

    /**
     * Switch to a page by id.
     * Opens or activates the corresponding tab, loads the page into
     * the LRU cache if needed, and mounts the stage.
     */
    async function switchToPage(pageId: string): Promise<'Ok' | 'Error'> {
        if (isSwitching.value) return 'Error';
        if (pages.activePageId === pageId) return 'Ok';

        isSwitching.value = true;

        try {
            // Open/activate the tab — this calls pages.loadPage internally
            await editor.openPageTab(pageId);

            // Kick off background preload of adjacent pages
            _preloadAdjacent(pageId);

            return 'Ok';
        } catch (err) {
            notification.addNotification('Failed to switch page.', { type: 'error' });
            console.error('[usePageSwitcher] switchToPage error:', err);
            return 'Error';
        } finally {
            isSwitching.value = false;
        }
    }

    async function switchToNextPage(): Promise<'Ok' | 'Error'> {
        if (!hasNextPage.value) return 'Error';
        const next = activeLessonPages.value[activePageIndex.value + 1];
        return switchToPage(next.id);
    }

    async function switchToPrevPage(): Promise<'Ok' | 'Error'> {
        if (!hasPrevPage.value) return 'Error';
        const prev = activeLessonPages.value[activePageIndex.value - 1];
        return switchToPage(prev.id);
    }

    /* ----------------------------------------------------------
       PRELOAD ADJACENT PAGES
       Load the next and previous pages into the LRU cache in the
       background so switching feels instant.
    ---------------------------------------------------------- */

    function _preloadAdjacent(currentPageId: string) {
        const lessonPages = (() => {
            const lessonId = project.pageMetaById[currentPageId]?.lessonId;
            if (!lessonId) return [];
            return project.orderedPagesForLesson(lessonId).value;
        })();

        const currentIndex = lessonPages.findIndex(p => p.id === currentPageId);

        const toPreload: string[] = [];
        if (currentIndex > 0)
            toPreload.push(lessonPages[currentIndex - 1].id);
        if (currentIndex < lessonPages.length - 1)
            toPreload.push(lessonPages[currentIndex + 1].id);

        // Fire and forget — errors are non-fatal
        for (const pageId of toPreload) {
            if (!pages.pagesCache[pageId]) {
                pages.loadPage(pageId).catch(() => {
                    // Preload failed silently — will load on demand when needed
                });
            }
        }
    }

    /* ----------------------------------------------------------
       PUBLIC
    ---------------------------------------------------------- */

    return {
        isSwitching,
        activeLessonId,
        activeLessonPages,
        activePageIndex,
        hasNextPage,
        hasPrevPage,

        switchToPage,
        switchToNextPage,
        switchToPrevPage,
    };
}