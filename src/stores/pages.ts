import { defineStore } from "pinia";
import { ref } from "vue";
import { join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import type { Page } from "../types/project";
import { useProjectMetadataStore } from "./projectMetadata";
import { useNotificationStore } from "./notification";

export const usePagesStore = defineStore("pages", () => {
    // currently loaded pages only
    const pagesCache = ref<Record<string, Page>>({});
    const activePageId = ref<string | null>(null);
    const projectStore = useProjectMetadataStore();
    const notification = useNotificationStore()

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
        const page: Page = JSON.parse(text);
        pagesCache.value[pageId] = page;
        activePageId.value = pageId;
        return 'Ok';
    }

    async function savePage(page: Page) {
        if (!projectStore.projectPath) throw new Error("Project path not set");

        const dir = await join(projectStore.projectPath, "pages");
        const dirExists = await exists(dir);
        if (!dirExists) await mkdir(dir, { recursive: true });

        const pagePath = await join(dir, `${page.id}.json`);
        await writeTextFile(pagePath, JSON.stringify(page, null, 2));

        // Update cache
        pagesCache.value[page.id] = page;
    }

    function unloadPage(pageId: string) {
        delete pagesCache.value[pageId];
    }

    return {
        pagesCache, activePageId,
        loadPage,
        savePage,
        unloadPage,
        getActivePageData
    };
});
