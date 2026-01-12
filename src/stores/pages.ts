import { defineStore } from "pinia";
import { ref } from "vue";
import { join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import type { Page } from "../types/project";
import { useProjectMetadataStore } from "./projectMetadata";
import { useNotificationStore } from "./notification";
import { generateId } from "../utils/id";
import type { Element, ElementType, ShapePreset } from "../types/element";
import { useElementStore } from "./element";

const DEFAULT_STAGE = {
    width: 1280,
    height: 720,
    background: "#ffffff",
};

export const usePagesStore = defineStore("pages", () => {
    // currently loaded pages only
    const pagesCache = ref<Record<string, Page>>({});
    const activePageId = ref<string | null>(null);
    const projectStore = useProjectMetadataStore();
    const notification = useNotificationStore();
    const elementStore = useElementStore();

    const normalizeStage = (stage?: Page["stage"]) => ({
        width: stage?.width && stage.width > 0 ? stage.width : DEFAULT_STAGE.width,
        height: stage?.height && stage.height > 0 ? stage.height : DEFAULT_STAGE.height,
        background: stage?.background ?? DEFAULT_STAGE.background,
    });

    const withDefaults = (page: Page): Page => ({
        ...page,
        stage: normalizeStage(page.stage),
        elements: page.elements ?? {},
    });

    const nextZIndex = (elements: Record<string, Element>) => {
        const z = Object.values(elements ?? {}).map((el) => {
            const pos = el.layout.positioning;
            return pos.mode === "absolute" ? pos.zIndex ?? 0 : 0;
        });
        return (z.length ? Math.max(...z) : 0) + 1;
    };

    const centerLayout = (stage: Page["stage"], size: { width: number; height: number }, zIndex: number) => ({
        positioning: {
            mode: "absolute" as const,
            anchor: "page" as const,
            x: Math.max(0, Math.round(stage.width / 2 - size.width / 2)),
            y: Math.max(0, Math.round(stage.height / 2 - size.height / 2)),
            zIndex,
        },
        size,
        visible: true,
    });

    const baseEffects = { opacity: 1 };

    const baseStroke = {
        color: "#0f172a",
        width: 1,
        style: "solid" as const,
        sides: { top: true, right: true, bottom: true, left: true },
    };

    const shapeSizes: Partial<Record<ShapePreset, { width: number; height: number }>> = {
        rectangle: { width: 320, height: 180 },
        square: { width: 200, height: 200 },
        circle: { width: 180, height: 180 },
        ellipse: { width: 240, height: 160 },
        triangle: { width: 240, height: 180 },
        hexagon: { width: 260, height: 220 },
        star: { width: 260, height: 220 },
        arrow: { width: 260, height: 90 },
        line: { width: 320, height: 6 },
        hotspot: { width: 220, height: 140 },
    };

    const shapeSides: Partial<Record<ShapePreset, number>> = {
        line: 2,
        rectangle: 4,
        square: 4,
        circle: 0,
        ellipse: 0,
        triangle: 3,
        hexagon: 6,
        star: 5,
        arrow: 2,
        hotspot: 4,
    };

    const shapeRadius: Partial<Record<ShapePreset, number>> = {
        circle: 9999,
        ellipse: 9999,
        rectangle: 8,
        square: 6,
        hotspot: 4,
    };

    const shapeFill: Partial<Record<ShapePreset, string>> = {
        hotspot: "transparent",
    };

    const buildShapeElement = (kind: ShapePreset, page: Page): Element => {
        const stage = normalizeStage(page.stage);
        const size = shapeSizes[kind] ?? { width: 240, height: 160 };
        const elementId = generateId("el");
        return {
            id: elementId,
            name: kind.charAt(0).toUpperCase() + kind.slice(1),
            type: kind,
            layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
            effects: baseEffects,
            style: {
                fill: shapeFill[kind] ?? "#0ea5e9",
                sides: shapeSides[kind] ?? 4,
                stroke: { ...baseStroke, width: kind === "line" ? 2 : baseStroke.width },
                radius: shapeRadius[kind],
            },
        };
    };

    const buildCollectionElement = (page: Page): Element => {
        const stage = normalizeStage(page.stage);
        const size = { width: 520, height: 320 };
        const elementId = generateId("el");
        return {
            id: elementId,
            name: "Collection",
            type: "collection",
            layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
            effects: baseEffects,
            style: {
                fill: "rgba(14,165,233,0.06)",
                sides: 4,
                stroke: { ...baseStroke, style: "dashed", width: 1.5 },
                padding: 16,
                radius: 10,
            },
            memberIds: [],
        } as Element;
    };

    const buildComponentElement = (kind: "component" | "container", page: Page): Element => {
        const stage = normalizeStage(page.stage);
        const size = { width: 520, height: 320 };
        const elementId = generateId("el");
        return {
            id: elementId,
            name: kind === "component" ? "Component" : "Container",
            type: kind,
            layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
            effects: baseEffects,
            style: {},
            memberIds: [],
        } as Element;
    };

    const buildTextElement = (page: Page): Element => {
        const stage = normalizeStage(page.stage);
        const size = { width: 260, height: 88 };
        const elementId = generateId("el");
        return {
            id: elementId,
            name: "Text",
            type: "text",
            layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
            effects: baseEffects,
            style: {
                content: "New text",
                font: { size: 18, weight: 500 },
                color: "#0f172a",
                align: "left",
                lineHeight: 1.4,
            },
        } as Element;
    };

    const buildImageElement = (page: Page): Element => {
        const stage = normalizeStage(page.stage);
        const size = { width: 320, height: 200 };
        const elementId = generateId("el");
        return {
            id: elementId,
            name: "Image",
            type: "image",
            layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
            effects: baseEffects,
            style: {
                src: "",
                fit: "cover",
            },
        } as Element;
    };

    const buildPathElement = (page: Page): Element => {
        const stage = normalizeStage(page.stage);
        const size = { width: 260, height: 160 };
        const elementId = generateId("el");
        return {
            id: elementId,
            name: "Path",
            type: "path",
            layout: centerLayout(stage, size, nextZIndex(page.elements ?? {})),
            effects: baseEffects,
            style: {
                fill: "#c084fc",
                stroke: { color: "#6366f1", width: 2, style: "solid" },
                closed: false,
                smooth: false,
            },
            commands: [
                { type: "M", x: 0, y: size.height / 2 },
                { type: "L", x: size.width, y: size.height / 2 },
            ],
        } as Element;
    };

    const buildElement = (kind: ElementType, page: Page): Element => {
        if (kind === "text") return buildTextElement(page);
        if (kind === "image") return buildImageElement(page);
        if (kind === "path") return buildPathElement(page);
        if (kind === "collection") return buildCollectionElement(page);
        if (kind === "component" || kind === "container") return buildComponentElement(kind, page);
        return buildShapeElement(kind as ShapePreset, page);
    };

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

    async function insertElement(kind: ElementType): Promise<Element | null> {
        const page = getActivePageData();
        if (!page) {
            notification.addNotification("Select a page before adding elements.", { type: "warn", ttl: 4000 });
            return null;
        }

        try {
            const workingPage = withDefaults(page);
            const element = buildElement(kind, workingPage);
            const updated: Page = {
                ...workingPage,
                elements: { ...workingPage.elements, [element.id]: element },
                metadata: { ...workingPage.metadata, updatedAt: Date.now() },
            };

            await savePage(updated);
            activePageId.value = updated.id;
            elementStore.setActiveElement(element.id);
            return element;
        } catch (error) {
            console.error(error);
            notification.addNotification("Failed to insert element.", { type: "error" });
            return null;
        }
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
        insertElement,
        savePage,
        unloadPage,
        getActivePageData
    };
});
