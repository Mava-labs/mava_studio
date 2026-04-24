<script setup lang="ts" vapor>
import { computed, ref, watch, nextTick } from "vue";
import ExplorerTree from "./Structure/explorerTree.vue";
import OutlineTree from "./Structure/outlineTree.vue";
import { buildExplorerTree, type ExplorerNode } from "../../utils/fileTree";
import type { OutlineNode } from "./Structure/outlineTypes";
import { useProjectMetadataStore } from "../../stores/projectMetadata";
import { usePagesStore } from "../../stores/pages";
import { useLayoutStore } from "../../stores/layout";
import { useNotificationStore } from "../../stores/notification";
import { useElementStore } from "../../stores/element";
import type { Element } from "../../types/element";
import { type Module, type Lesson, type Page } from "../../types/project";
import type { EvidenceType } from "../../types/cf-alignment.types";
import { generateId } from "../../utils/id";

type LessonMetadataLike = Omit<Lesson['metadata'], 'prerequisites' | 'tags'> & {
    prerequisites?: readonly string[]
    tags?: readonly string[]
}

type LessonLike = {
    id: string
    type: Lesson['type']
    visible: boolean
    summary?: string
    pages: ReadonlyArray<Readonly<{ name: string; id: string; order: number }>>
    metadata: LessonMetadataLike
    cf_alignment?: {
        framework_id: string
        competency_id: string
        indicator_ids: readonly string[]
        evidence_item_id?: string
        evidence_type?: EvidenceType
    }
}

type ActiveExplorerPath = {
    moduleId?: string;
    lessonId?: string;
    pageId?: string;
} | null;

const project = useProjectMetadataStore();
const pages = usePagesStore();
const layout = useLayoutStore();
const notification = useNotificationStore();
const elements = useElementStore();

const clipboard = ref<{ action: 'copy' | 'cut'; node: ExplorerNode } | null>(null);
const explorerScrollRef = ref<HTMLElement | null>(null);

const treeNodes = ref<ExplorerNode[]>([]);
const expandedOutlineIds = ref<Set<string>>(new Set());

function refreshExplorerTree() {
    treeNodes.value = project.projectId ? buildExplorerTree(project._snapshot(), project.pageMetaById) : [];
}

watch(
    () => project.projectPath,
    () => {
        refreshExplorerTree();
    },
    { immediate: true }
);

const activePage = computed(() => pages.getActivePageData());
const activeExplorerPath = computed<ActiveExplorerPath>(() => {
    const pageId = pages.activePageId;
    if (!pageId) return null;

    const meta = project.pageMetaById[pageId];
    if (!meta) return { pageId };

    const moduleId = Object.values(project.modulesById).find(module =>
        module.lessons.some(lesson => lesson.id === meta.lessonId)
    )?.id;

    return {
        moduleId,
        lessonId: meta.lessonId,
        pageId,
    };
});
const outlineNodes = computed<OutlineNode[]>(() => {
    const page = activePage.value;
    if (!page) return [];
    return buildOutlineTree(page.elements, page.rootIds);
});

watch(
    () => pages.activePageId,
    () => {
        expandedOutlineIds.value = new Set();
    }
);

function scrollActiveExplorerPageIntoView() {
    const activeId = activeExplorerPath.value?.pageId;
    if (!activeId) return false;

    const container = explorerScrollRef.value;
    if (!container) return false;

    const row = container.querySelector<HTMLElement>(`[data-explorer-page-id="${activeId}"]`);
    if (!row) return false;

    row.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    return true;
}

function scheduleActiveExplorerScroll(maxRetries = 3) {
    nextTick(() => {
        if (scrollActiveExplorerPageIntoView()) return;

        let attempts = 0;
        const retry = () => {
            attempts += 1;
            if (scrollActiveExplorerPageIntoView()) return;
            if (attempts >= maxRetries) return;
            requestAnimationFrame(retry);
        };

        requestAnimationFrame(retry);
    });
}

watch(
    [() => activeExplorerPath.value?.pageId, () => treeNodes.value.length, () => layout.explorerOpen],
    () => {
        if (!layout.explorerOpen) return;
        scheduleActiveExplorerScroll();
    },
    { immediate: true }
);

watch(
    () => elements.activeElementId,
    (elementId) => {
        if (!elementId) return;
        const next = new Set(expandedOutlineIds.value);
        const page = activePage.value;
        if (!page) return;

        let currentId: string | null = elementId;
        while (currentId) {
            const current: Element = page.elements[currentId];
            if (!current?.parentId) break;
            next.delete(current.parentId);
            currentId = current.parentId;
        }

        expandedOutlineIds.value = next;
    },
    { immediate: true }
);

const hasProject = computed(() => Boolean(project.projectName));

function buildOutlineTree(
    elementMap: Record<string, Pick<Element, "id" | "name" | "type" | "parentId">>,
    rootIds: string[]
): OutlineNode[] {
    const buildNode = (id: string): OutlineNode | null => {
        const el = elementMap[id];
        if (!el) return null;

        const children = Object.values(elementMap)
            .filter(candidate => candidate.parentId === id)
            .map(candidate => buildNode(candidate.id))
            .filter((node): node is OutlineNode => Boolean(node));

        return {
            id: el.id,
            name: el.name || el.type,
            kind: el.type,
            children,
        };
    };

    return rootIds
        .map(id => buildNode(id))
        .filter((node): node is OutlineNode => Boolean(node));
}

function handleOutlineSelect(id: string) {
    elements.setActiveElement(id);

    const page = activePage.value;
    if (!page) return;

    const next = new Set(expandedOutlineIds.value);
    let currentId: string | null = id;
    while (currentId) {
        const current: Element = page.elements[currentId];
        if (!current?.parentId) break;
        next.delete(current.parentId);
        currentId = current.parentId;
    }

    expandedOutlineIds.value = next;
}

function handleOutlineToggle(id: string) {
    const next = new Set(expandedOutlineIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedOutlineIds.value = next;
}


function handleSelect(node: ExplorerNode) {
    if (node.kind !== "page") return;
    const path = node.meta;
    if (!path?.moduleId || !path.lessonId || !path.pageId) return;

    pages.loadPage(path.pageId)
}

async function handleNodeAction(payload: { action: string; node: ExplorerNode; newName?: string }) {
    const { action, node, newName } = payload;
    if (!project.projectId) return;

    const persistStructure = async () => {
        await project.saveProject();
        refreshExplorerTree();
    };

    const ensurePageLoaded = async (pageId: string): Promise<Page | null> => {
        const cached = pages.getPage(pageId);
        if (cached) return cached;
        const result = await pages.loadPage(pageId);
        if (result === 'Error') return null;
        return pages.getPage(pageId);
    };

    const makeLesson = (id: string, title: string): Lesson => {
        const now = Date.now();
        return {
            id,
            type: 'activity',
            visible: true,
            pages: [],
            metadata: {
                title,
                duration: 0,
                version: 1,
                createdAt: now,
                updatedAt: now,
                lastEditedBy: { userId: 'system', name: 'System' },
            },
        };
    };

    const toMutableLessonMetadata = (
        metadata: LessonMetadataLike,
        title?: string,
        updatedAt?: number
    ): Lesson['metadata'] => ({
        ...metadata,
        ...(title ? { title } : {}),
        ...(typeof updatedAt === 'number' ? { updatedAt } : {}),
        lastEditedBy: {
            userId: metadata.lastEditedBy.userId,
            name: metadata.lastEditedBy.name,
        },
        prerequisites: metadata.prerequisites ? [...metadata.prerequisites] : undefined,
        tags: metadata.tags ? [...metadata.tags] : undefined,
    });

    const toMutableLesson = (
        lesson: LessonLike,
        overrides?: Partial<Lesson>
    ): Lesson => {
        const baseAlignment = lesson.cf_alignment
            ? {
                framework_id: lesson.cf_alignment.framework_id,
                competency_id: lesson.cf_alignment.competency_id,
                indicator_ids: [...lesson.cf_alignment.indicator_ids],
                ...(lesson.cf_alignment.evidence_item_id
                    ? {
                        evidence_item_id: lesson.cf_alignment.evidence_item_id,
                        evidence_type: lesson.cf_alignment.evidence_type as EvidenceType,
                    }
                    : {}),
            }
            : undefined

        return {
            ...lesson,
            ...overrides,
            cf_alignment: overrides?.cf_alignment ?? baseAlignment,
            pages: [...(overrides?.pages ?? lesson.pages)].map((p) => ({ ...p })),
            metadata: toMutableLessonMetadata(
                lesson.metadata,
                overrides?.metadata?.title,
                overrides?.metadata?.updatedAt
            ),
        }
    };

    const makePage = (id: string, title: string): Page => {
        const now = Date.now();
        return {
            id,
            visible: true,
            elements: {},
            rootIds: [],
            stage: {
                width: 1280,
                height: 720,
                background: '#1d293d',
            },
            metadata: {
                title,
                version: 1,
                createdAt: now,
                updatedAt: now,
                lastEditedBy: { userId: 'system', name: 'System' },
            },
        };
    };

    const makeModule = (id: string, title: string): Module => {
        const now = Date.now();
        return {
            id,
            visible: true,
            lessons: [],
            metadata: {
                title,
                duration: 0,
                version: 1,
                createdAt: now,
                updatedAt: now,
                lastEditedBy: { userId: 'system', name: 'System' },
            },
        };
    };

    const copyPageToLesson = async (sourcePageId: string, destinationLessonId: string) => {
        const source = await ensurePageLoaded(sourcePageId);
        if (!source) return;

        const newPageId = generateId('page');
        const now = Date.now();
        const pageCopy: Page = {
            ...source,
            id: newPageId,
            metadata: {
                ...source.metadata,
                title: `${source.metadata.title} Copy`,
                createdAt: now,
                updatedAt: now,
            },
        };

        project.registerPage(destinationLessonId, newPageId, pageCopy.metadata.title);
        pages.commitPageToCache(pageCopy);
        await pages.savePage(newPageId);
    };

    const movePageToLesson = async (sourceLessonId: string, pageId: string, destinationLessonId: string) => {
        if (sourceLessonId === destinationLessonId) return;

        const sourceLesson = project.lessonsById[sourceLessonId];
        const destinationLesson = project.lessonsById[destinationLessonId];
        if (!sourceLesson || !destinationLesson) return;

        const sourceRef = sourceLesson.pages.find(p => p.id === pageId);
        if (!sourceRef) return;

        project.deletePage(pageId);
        project.registerPage(destinationLessonId, pageId, sourceRef.name);
    };

    const copyLessonToModule = async (sourceLessonId: string, destinationModuleId: string) => {
        const sourceLesson = project.lessonsById[sourceLessonId];
        if (!sourceLesson) return;

        const newLessonId = generateId('lesson');
        const now = Date.now();
        const pageCopies: Array<{ id: string; name: string; order: number }> = [];

        for (const pageRef of sourceLesson.pages) {
            const page = await ensurePageLoaded(pageRef.id);
            if (!page) continue;

            const newPageId = generateId('page');
            const clonedPage: Page = {
                ...page,
                id: newPageId,
                metadata: {
                    ...page.metadata,
                    title: `${page.metadata.title} Copy`,
                    createdAt: now,
                    updatedAt: now,
                },
            };

            pages.commitPageToCache(clonedPage);
            await pages.savePage(newPageId);
            pageCopies.push({ id: newPageId, name: clonedPage.metadata.title, order: pageCopies.length + 1 });
        }

        const lessonCopy: Lesson = toMutableLesson(sourceLesson, {
            id: newLessonId,
            pages: pageCopies,
            metadata: {
                ...toMutableLessonMetadata(sourceLesson.metadata, `${sourceLesson.metadata.title} Copy`, now),
                createdAt: now,
            },
        });

        project.addLesson(destinationModuleId, { ...lessonCopy, pages: [] });
        for (const pageRef of pageCopies) {
            project.registerPage(newLessonId, pageRef.id, pageRef.name);
        }
    };

    const moveLessonToModule = async (sourceModuleId: string, lessonId: string, destinationModuleId: string) => {
        if (sourceModuleId === destinationModuleId) return;

        const sourceModule = project.modulesById[sourceModuleId];
        const destinationModule = project.modulesById[destinationModuleId];
        const lesson = project.lessonsById[lessonId];
        if (!sourceModule || !destinationModule || !lesson) return;

        const sourceRef = sourceModule.lessons.find(l => l.id === lessonId);
        if (!sourceRef) return;

        const originalPages = lesson.pages.map((p) => ({ ...p }));
        const lessonClone = toMutableLesson(lesson);
        project.deleteLesson(lessonId);
        project.addLesson(destinationModuleId, { ...lessonClone, pages: [] });
        for (const pageRef of originalPages) {
            project.registerPage(lessonId, pageRef.id, pageRef.name);
        }
    };

    const copyModuleToCourse = async (sourceModuleId: string) => {
        const sourceModule = project.modulesById[sourceModuleId];
        if (!sourceModule) return;

        const newModuleId = generateId('module');
        const now = Date.now();
        const newModule = makeModule(newModuleId, `${sourceModule.metadata.title} Copy`);
        const clonedLessons: Lesson[] = [];

        for (const lessonRef of sourceModule.lessons) {
            const lesson = project.lessonsById[lessonRef.id];
            if (!lesson) continue;

            const newLessonId = generateId('lesson');
            const clonedPages: Array<{ id: string; name: string; order: number }> = [];

            for (const pageRef of lesson.pages) {
                const page = await ensurePageLoaded(pageRef.id);
                if (!page) continue;

                const newPageId = generateId('page');
                const pageCopy: Page = {
                    ...page,
                    id: newPageId,
                    metadata: {
                        ...page.metadata,
                        title: `${page.metadata.title} Copy`,
                        createdAt: now,
                        updatedAt: now,
                    },
                };

                pages.commitPageToCache(pageCopy);
                await pages.savePage(newPageId);
                clonedPages.push({ id: newPageId, name: pageCopy.metadata.title, order: clonedPages.length + 1 });
            }

            const lessonCopy: Lesson = toMutableLesson(lesson, {
                id: newLessonId,
                pages: clonedPages,
                metadata: {
                    ...toMutableLessonMetadata(lesson.metadata, `${lesson.metadata.title} Copy`, now),
                    createdAt: now,
                },
            });

            clonedLessons.push(lessonCopy);
            newModule.lessons.push({ id: newLessonId, name: lessonCopy.metadata.title, order: newModule.lessons.length + 1 });
        }

        project.addModule({ ...newModule, lessons: [] });
        for (const lesson of clonedLessons) {
            project.addLesson(newModuleId, { ...lesson, pages: [] });
            for (const pageRef of lesson.pages) {
                project.registerPage(lesson.id, pageRef.id, pageRef.name);
            }
        }
    };

    try {
        switch (action) {
            case 'refresh-tree': {
                refreshExplorerTree();
                return;
            }
            case 'new-module': {
                const newId = generateId('module');
                const newModule = makeModule(newId, 'New Module');

                project.addModule(newModule);
                await persistStructure();
                notification.addNotification('New module created', { type: 'info' });
                break;
            }
            case 'new-lesson': {
                const moduleId = node.meta?.moduleId;
                if (!moduleId) return;
                const newId = generateId('lesson');
                const newLesson = makeLesson(newId, 'New Lesson');
                project.addLesson(moduleId, newLesson);
                await persistStructure();
                notification.addNotification('New lesson created', { type: 'info' });
                break;
            }
            case 'new-page': {
                const lessonId = node.meta?.lessonId;
                if (!lessonId) return;
                const newId = generateId('page');
                const newPage = makePage(newId, 'New Page');
                project.registerPage(lessonId, newId, 'New Page');
                pages.commitPageToCache(newPage);
                await pages.savePage(newId);
                await pages.loadPage(newId);
                await persistStructure();
                notification.addNotification('New page created', { type: 'info' });
                break;
            }
            case 'rename': {
                if (!newName) return;
                const moduleId = node.meta?.moduleId;
                const lessonId = node.meta?.lessonId;
                const pageId = node.meta?.pageId;
                if (node.kind === 'module' && moduleId) {
                    const mod = project.modulesById[moduleId];
                    if (mod) {
                        const metadata: Module['metadata'] = {
                            ...mod.metadata,
                            title: newName,
                            lastEditedBy: {
                                userId: mod.metadata.lastEditedBy.userId,
                                name: mod.metadata.lastEditedBy.name,
                            },
                            prerequisites: mod.metadata.prerequisites ? [...mod.metadata.prerequisites] : undefined,
                            unlockConditions: mod.metadata.unlockConditions ? [...mod.metadata.unlockConditions] : undefined,
                            tags: mod.metadata.tags ? [...mod.metadata.tags] : undefined,
                        };
                        project.updateModule(moduleId, { metadata });
                    }
                } else if (node.kind === 'lesson' && moduleId && lessonId) {
                    const mod = project.modulesById[moduleId];
                    if (!mod) return;
                    const lesson = project.lessonsById[lessonId];
                    if (lesson) {
                        const metadata: Lesson['metadata'] = {
                            ...lesson.metadata,
                            title: newName,
                            lastEditedBy: {
                                userId: lesson.metadata.lastEditedBy.userId,
                                name: lesson.metadata.lastEditedBy.name,
                            },
                            prerequisites: lesson.metadata.prerequisites ? [...lesson.metadata.prerequisites] : undefined,
                            tags: lesson.metadata.tags ? [...lesson.metadata.tags] : undefined,
                        };
                        project.updateLesson(lessonId, { metadata });
                    }
                } else if (node.kind === 'page' && lessonId && pageId) {
                    project.renamePage(pageId, newName);

                    const page = await ensurePageLoaded(pageId);
                    if (page) {
                        const updatedPage: Page = {
                            ...page,
                            metadata: {
                                ...page.metadata,
                                title: newName,
                                updatedAt: Date.now(),
                            },
                        };
                        pages.commitPageToCache(updatedPage);
                        await pages.savePage(pageId);
                    }
                }
                await persistStructure();
                notification.addNotification(`Renamed to "${newName}"`, { type: 'info' });
                break;
            }
            case 'delete': {
                const moduleId = node.meta?.moduleId;
                const lessonId = node.meta?.lessonId;
                const pageId = node.meta?.pageId;
                if (node.kind === 'module' && moduleId) {
                    project.deleteModule(moduleId);
                } else if (node.kind === 'lesson' && moduleId && lessonId) {
                    project.deleteLesson(lessonId);
                } else if (node.kind === 'page' && lessonId && pageId) {
                    project.deletePage(pageId);
                    pages.unloadPage(pageId);
                }
                await persistStructure();
                notification.addNotification(`"${node.name}" deleted`, { type: 'info' });
                break;
            }
            case 'copy':
                clipboard.value = { action: 'copy', node };
                notification.addNotification(`Copied "${node.name}"`, { type: 'info' });
                return;
            case 'cut':
                clipboard.value = { action: 'cut', node };
                notification.addNotification(`Cut "${node.name}"`, { type: 'info' });
                return;
            case 'paste': {
                if (!clipboard.value) {
                    notification.addNotification('Clipboard is empty', { type: 'info' });
                    return;
                }

                const source = clipboard.value.node;
                const pasteAction = clipboard.value.action;

                if (source.kind === 'page' && node.kind === 'lesson') {
                    const sourceLessonId = source.meta?.lessonId;
                    const sourcePageId = source.meta?.pageId;
                    const destinationLessonId = node.meta?.lessonId;
                    if (!sourcePageId || !destinationLessonId) return;

                    if (pasteAction === 'cut' && sourceLessonId === destinationLessonId) {
                        notification.addNotification('Page is already in this lesson', { type: 'info' });
                        return;
                    }

                    if (pasteAction === 'copy') {
                        await copyPageToLesson(sourcePageId, destinationLessonId);
                    } else if (sourceLessonId) {
                        await movePageToLesson(sourceLessonId, sourcePageId, destinationLessonId);
                    }
                } else if (source.kind === 'lesson' && node.kind === 'module') {
                    const sourceLessonId = source.meta?.lessonId;
                    const sourceModuleId = source.meta?.moduleId;
                    const destinationModuleId = node.meta?.moduleId;
                    if (!sourceLessonId || !destinationModuleId) return;

                    if (pasteAction === 'cut' && sourceModuleId === destinationModuleId) {
                        notification.addNotification('Lesson is already in this module', { type: 'info' });
                        return;
                    }

                    if (pasteAction === 'copy') {
                        await copyLessonToModule(sourceLessonId, destinationModuleId);
                    } else if (sourceModuleId) {
                        await moveLessonToModule(sourceModuleId, sourceLessonId, destinationModuleId);
                    }
                } else if (source.kind === 'module' && node.kind === 'course') {
                    const sourceModuleId = source.meta?.moduleId;
                    if (!sourceModuleId) return;

                    if (pasteAction === 'copy') {
                        await copyModuleToCourse(sourceModuleId);
                    } else {
                        const ordered = project.course?.modules.map(m => m.id) ?? [];
                        if (!ordered.length || ordered[ordered.length - 1] === sourceModuleId) {
                            notification.addNotification('Module is already at the target position', { type: 'info' });
                            return;
                        }

                        const nextOrder = ordered.filter(id => id !== sourceModuleId);
                        nextOrder.push(sourceModuleId);
                        project.reorderModules(nextOrder);
                    }
                } else {
                    notification.addNotification('Paste target is not compatible', { type: 'error' });
                    return;
                }

                if (pasteAction === 'cut') {
                    clipboard.value = null;
                }

                await persistStructure();

                notification.addNotification('Paste completed', { type: 'info' });
                break;
            }
        }
    } catch (err) {
        notification.addNotification(`Action failed: ${String(err)}`, { type: 'error' });
    }
}
</script>

<template>
    <div class="h-full min-h-0 flex flex-col bg-slate-950/80 text-slate-50 border-r border-slate-800">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[11px] tracking-[0.18em] font-semibold uppercase text-slate-400">
            <span class="flex items-center gap-2">
                <button type="button" class="text-slate-400 hover:text-slate-200" @click="layout.toggleOutlineOrExplorer('explorer')">
                    <svg v-if="layout.explorerOpen" class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="m19 9-7 7-7-7" />
                    </svg>
                    <svg v-else class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="m9 5 7 7-7 7" />
                    </svg>
                </button>
                Explorer
            </span>
        </div>

        <div ref="explorerScrollRef" v-if="layout.explorerOpen" class="flex-1 min-h-0 overflow-auto thin-scroll">
            <ExplorerTree
                v-if="treeNodes.length"
                :nodes="treeNodes"
                :active-path="activeExplorerPath"
                :clipboard-action="clipboard?.action ?? null"
                :clipboard-node-kind="clipboard?.node.kind ?? null"
                @select="handleSelect"
                @node-action="handleNodeAction"
            />

            <div v-else class="px-3 py-4 text-xs text-slate-500 space-y-1">
                <p v-if="hasProject">No lessons or pages yet.</p>
                <p v-else>Create or open a project to see its structure.</p>
            </div>
        </div>

        <div class="mt-1 border-t border-slate-800"></div>

        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[11px] tracking-[0.18em] font-semibold uppercase text-slate-400">
            <span class="flex items-center gap-2">
                <button type="button" class="text-slate-400 hover:text-slate-200" @click="layout.toggleOutlineOrExplorer('outline')">
                    <svg v-if="layout.outlineExpaded" class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                        width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="m19 9-7 7-7-7" />
                    </svg>
                    <svg v-else class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                        width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="m9 5 7 7-7 7" />
                    </svg>
                </button>
                Outline
            </span>
            <span class="text-[10px] text-slate-500" v-if="pages.activePageId">{{ outlineNodes.length }} items</span>
        </div>

        <div v-if="layout.outlineExpaded" class="flex-1 min-h-0 overflow-auto thin-scroll">
            <OutlineTree
                v-if="outlineNodes.length"
                :nodes="outlineNodes"
                :selected-id="elements.activeElementId"
                :expanded-ids="expandedOutlineIds"
                @select="handleOutlineSelect"
                @toggle="handleOutlineToggle"
            />

            <div v-else class="px-3 py-4 text-xs text-slate-500 space-y-1">
                <p v-if="pages.activePageId">No elements on this page yet.</p>
                <p v-else>Select a page to view its outline.</p>
            </div>
        </div>
    </div>
</template>
