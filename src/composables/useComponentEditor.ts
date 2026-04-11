/**
 * useComponentEditor.ts
 * Composable — tab management for isolated component canvas editing.
 *
 * Each open component definition gets its own editor tab alongside the
 * page tabs. Editing is isolated — changes register to the component's
 * scope in the undo stack, not to the current page.
 *
 * Tab model:
 *   { kind: 'page',      pageId }      — normal page tab
 *   { kind: 'component', componentId } — isolated component editor tab
 *
 * Usage:
 *   const editor = useComponentEditor();
 *   editor.openComponentTab(componentId);
 *   editor.closeTab(tabId);
 *   editor.activateTab(tabId);
 */

import { ref, computed, readonly } from 'vue';
import { useProjectMetadataStore } from '../stores/projectMetadata';
import { usePagesStore } from '../stores/pages';
import { useNotificationStore } from '../stores/notification';

/* ============================================================
   TYPES
   ============================================================ */

export interface PageTab {
    id: string;
    kind: 'page';
    pageId: string;
    label: string;
    isDirty: boolean;
}

export interface ComponentTab {
    id: string;
    kind: 'component';
    componentId: string;
    label: string;
    isDirty: boolean;
}

export type EditorTab = PageTab | ComponentTab;

/* ============================================================
   COMPOSABLE
   ============================================================ */

// Module-level state so tabs survive component re-mounts
const tabs = ref<EditorTab[]>([]);
const activeTabId = ref<string | null>(null);

export function useComponentEditor() {
    const project = useProjectMetadataStore();
    const pages = usePagesStore();
    const notification = useNotificationStore();

    /* ----------------------------------------------------------
       COMPUTED
    ---------------------------------------------------------- */

    const activeTab = computed(() =>
        tabs.value.find(t => t.id === activeTabId.value) ?? null
    );

    const pageTabs = computed(() =>
        tabs.value.filter((t): t is PageTab => t.kind === 'page')
    );

    const componentTabs = computed(() =>
        tabs.value.filter((t): t is ComponentTab => t.kind === 'component')
    );

    /* ----------------------------------------------------------
       PAGE TABS
    ---------------------------------------------------------- */

    /**
     * Open or activate a page tab.
     * Called by usePageSwitcher when navigating between pages.
     */
    async function openPageTab(pageId: string): Promise<void> {
        // Already open — just activate
        const existing = tabs.value.find(t => t.kind === 'page' && t.pageId === pageId);
        if (existing) {
            await _activatePageTab(existing as PageTab);
            return;
        }

        const meta = project.pageMetaById[pageId];
        if (!meta) {
            notification.addNotification('Page not found.', { type: 'error' });
            return;
        }

        const tab: PageTab = {
            id: `page-${pageId}`,
            kind: 'page',
            pageId,
            label: meta.name,
            isDirty: project.dirtyScopes.has(`page:${pageId}`),
        };

        tabs.value.push(tab);
        await _activatePageTab(tab);
    }

    async function _activatePageTab(tab: PageTab) {
        const result = await pages.loadPage(tab.pageId);
        if (result === 'Error') return;
        activeTabId.value = tab.id;
    }

    /* ----------------------------------------------------------
       COMPONENT TABS
    ---------------------------------------------------------- */

    /**
     * Open an isolated component editor tab.
     * If already open, just activate it.
     */
    async function openComponentTab(componentId: string): Promise<void> {
        const existing = tabs.value.find(
            t => t.kind === 'component' && t.componentId === componentId
        );
        if (existing) {
            activeTabId.value = existing.id;
            return;
        }

        const def = project.componentLibrary[componentId];
        if (!def) {
            notification.addNotification('Component definition not found.', { type: 'error' });
            return;
        }

        const tab: ComponentTab = {
            id: `component-${componentId}`,
            kind: 'component',
            componentId,
            label: def.name,
            isDirty: project.dirtyScopes.has(`component:${componentId}`),
        };

        tabs.value.push(tab);
        activeTabId.value = tab.id;

        // The canvas component watches activeTab and renders the component's
        // element tree when kind === 'component'
    }

    /* ----------------------------------------------------------
       CLOSE TAB
    ---------------------------------------------------------- */

    function closeTab(tabId: string): void {
        const index = tabs.value.findIndex(t => t.id === tabId);
        if (index === -1) return;

        const tab = tabs.value[index];

        // Don't close a dirty component tab without warning
        if (tab.kind === 'component' && tab.isDirty) {
            notification.addNotification(
                `"${tab.label}" has unsaved changes. Save or commit before closing.`,
                { type: 'warn', ttl: 5000 }
            );
            return;
        }

        tabs.value.splice(index, 1);

        // If we closed the active tab, activate the nearest remaining tab
        if (activeTabId.value === tabId) {
            const next = tabs.value[index] ?? tabs.value[index - 1] ?? null;
            if (next) {
                activeTabId.value = next.id;
                if (next.kind === 'page') _activatePageTab(next);
            } else {
                activeTabId.value = null;
            }
        }
    }

    /** Force-close a tab even if dirty (used on project close). */
    function forceCloseTab(tabId: string): void {
        const index = tabs.value.findIndex(t => t.id === tabId);
        if (index !== -1) tabs.value.splice(index, 1);
        if (activeTabId.value === tabId) activeTabId.value = null;
    }

    function closeAllTabs(): void {
        tabs.value = [];
        activeTabId.value = null;
    }

    /* ----------------------------------------------------------
       ACTIVATE TAB
    ---------------------------------------------------------- */

    async function activateTab(tabId: string): Promise<void> {
        const tab = tabs.value.find(t => t.id === tabId);
        if (!tab) return;

        if (tab.kind === 'page') {
            await _activatePageTab(tab);
        } else {
            activeTabId.value = tabId;
            // Canvas component re-renders component tree when activeTab changes
        }
    }

    /* ----------------------------------------------------------
       RENAME TAB LABEL (reacts to page/component renames)
    ---------------------------------------------------------- */

    function syncTabLabel(entityId: string, newLabel: string): void {
        const tab = tabs.value.find(t =>
            (t.kind === 'page' && t.pageId === entityId) ||
            (t.kind === 'component' && t.componentId === entityId)
        );
        if (tab) tab.label = newLabel;
    }

    /** Update dirty badge on a tab — call when dirty scope changes. */
    function syncTabDirty(entityId: string, isDirty: boolean): void {
        const tab = tabs.value.find(t =>
            (t.kind === 'page' && t.pageId === entityId) ||
            (t.kind === 'component' && t.componentId === entityId)
        );
        if (tab) tab.isDirty = isDirty;
    }

    /* ----------------------------------------------------------
       PUBLIC
    ---------------------------------------------------------- */

    return {
        tabs: readonly(tabs),
        activeTabId: readonly(activeTabId),
        activeTab,
        pageTabs,
        componentTabs,

        openPageTab,
        openComponentTab,
        activateTab,
        closeTab,
        forceCloseTab,
        closeAllTabs,
        syncTabLabel,
        syncTabDirty,
    };
}