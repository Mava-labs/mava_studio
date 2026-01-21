import { defineStore } from "pinia";
import { ref } from "vue";
import { join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import type { Page } from "../types/project";
import { useProjectMetadataStore } from "./projectMetadata";
import { useNotificationStore } from "./notification";
import type { Element, ElementType } from "../types/element";
import { generateId } from "../utils/id";

const DEFAULT_STAGE = {
    width: 1280,
    height: 720,
    background: "#ff0000",
};

export const usePagesStore = defineStore("pages", () => {
    // currently loaded pages only
    const pagesCache = ref<Record<string, Page>>({});
    const activePageId = ref<string | null>(null);
    const projectStore = useProjectMetadataStore();
    const notification = useNotificationStore();

    const normalizeStage = (stage?: Page["stage"]) => ({
        width: stage?.width && stage.width > 0 ? stage.width : DEFAULT_STAGE.width,
        height: stage?.height && stage.height > 0 ? stage.height : DEFAULT_STAGE.height,
        background: stage?.background ?? DEFAULT_STAGE.background,
        display: {
            columns: 1,
            rows: 3,
            gap: 0
        }
    });

    const withDefaults = (page: Page): Page => ({
        ...page,
        stage: normalizeStage(page.stage),
        elements: page.elements ?? {},
    });

    const getElementById = (elementId: string): Element | null => {
        if (!activePageId.value) return null;
        const element = pagesCache.value[activePageId.value]?.elements[elementId] || null;
        return element;
    };

    const getActivePageData = () => {
        if (activePageId.value && pagesCache.value[activePageId.value]) {
            return pagesCache.value[activePageId.value];
        }
        return null;
    };

    async function loadPage(pageId: string): Promise<'Ok' | 'Error'> {
        if (pagesCache.value[pageId]) {
            activePageId.value = pageId;
            return 'Ok';
        }

        if (!projectStore.projectPath) {
            notification.addNotification('Project path error. Try reloading the project', {type: 'error'});
            return 'Error';
        }

        const pagePath = await join(projectStore.projectPath, "pages", `${pageId}.json`);

        const existsOnDisk = await exists(pagePath);
        if (!existsOnDisk) {
            notification.addNotification('Page file does not exist on disk', {type: 'error'});
            return 'Error'
        };

        const text = await readTextFile(pagePath);
        const page = withDefaults(JSON.parse(text) as Page);
        pagesCache.value[pageId] = page;
        activePageId.value = pageId;
        return 'Ok';
    }

    async function savePage(page: Page) {
        if (!projectStore.projectPath) throw new Error("Project path not set");

        const hydrated = withDefaults(page);
        const dir = await join(projectStore.projectPath, "pages");
        const dirExists = await exists(dir);
        if (!dirExists) await mkdir(dir, { recursive: true });

        const pagePath = await join(dir, `${hydrated.id}.json`);
        await writeTextFile(pagePath, JSON.stringify(hydrated, null, 2));

        pagesCache.value[hydrated.id] = hydrated;
    }

    function unloadPage(pageId: string) {
        delete pagesCache.value[pageId];
    }

    return {
        pagesCache, activePageId,
        loadPage, getElementById,
        savePage,
        unloadPage,
        getActivePageData
    };
});

