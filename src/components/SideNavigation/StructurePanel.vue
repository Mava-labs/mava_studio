<script setup lang="ts" vapor>
import { computed, ref, watch } from "vue";
import ExplorerTree from "./Structure/explorerTree.vue";
import OutlineTree from "./Structure/outlineTree.vue";
import { buildExplorerTree, type ExplorerNode } from "./Structure/fileTree";
import type { OutlineNode } from "./Structure/outlineTypes";
import { useProjectMetadataStore } from "../../stores/projectMetadata";
import { usePagesStore } from "../../stores/pages";
import { useLayoutStore } from "../../stores/layout";
import { useElementStore } from "../../stores/element";
import { useNotificationStore } from "../../stores/notification";
import type { Element } from "../../types/element";
import type { Module, Lesson, Page, ProjectData } from "../../types/project";
import { remove } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { readJSON, writeJSON } from "../../utils/diskIO";
import { generateId } from "../../utils/id";

const project = useProjectMetadataStore();
const pages = usePagesStore();
const layout = useLayoutStore();
const elements = useElementStore();
const notification = useNotificationStore();

const clipboard = ref<{ action: 'copy' | 'cut'; node: ExplorerNode } | null>(null);

const treeNodes = ref<ExplorerNode[]>([]);
watch(
    () => project.projectPath,
    async (path) => {
        treeNodes.value = await buildExplorerTree(path);
    },
    { immediate: true }
);
const activePath = computed(() => project.projectPath);
const hasProject = computed(() => Boolean(project.projectName));

function buildOutlineTree(elements: Pick<Element, "id" | "name" | "type" | "parentId">[]): OutlineNode[] {
    const orderLookup: Record<string, number> = {};
    const nodes = new Map<string, OutlineNode & { children: OutlineNode[] }>();
    const roots: OutlineNode[] = [];

    //TODO: Order lookup needs refactoring to miirror actual element order
    for (const [index, el] of elements.entries()) {
        nodes.set(el.id, {
            id: el.id,
            name: el.name || el.type,
            kind: el.type,
            children: [],
        });
        orderLookup[el.id] =  index;
    }

    for (const el of elements) {
        const node = nodes.get(el.id);
        if (!node) continue;
        if (el.parentId && nodes.has(el.parentId)) {
            nodes.get(el.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    const sortTree = (list: OutlineNode[]) => {
        list.sort((a, b) => (orderLookup[b.id] ?? 0) - (orderLookup[a.id] ?? 0));
        list.forEach((child) => {
            if (child.children && child.children.length) sortTree(child.children);
        });
    };

    sortTree(roots);
    return roots;
}

const outlineNodes = computed(() => {
    const elements = pages.getActivePageData()?.elements;
    return buildOutlineTree(Array.isArray(elements) ? elements : Object.values(elements ?? {}));
});

function handleSelect(node: ExplorerNode) {
    if (node.kind !== "page") return;
    const path = node.meta;
    if (!path?.moduleId || !path.lessonId || !path.pageId) return;

    pages.loadPage(path.pageId)
}

async function handleNodeAction(payload: { action: string; node: ExplorerNode; newName?: string }) {
    const { action, node, newName } = payload;
    const projectPath = project.projectPath;
    if (!projectPath) return;

    try {
        switch (action) {
            case 'new-lesson': {
                const moduleId = node.meta?.moduleId;
                if (!moduleId) return;
                const modulePath = await join(projectPath, 'modules', `${moduleId}.json`);
                const mod = await readJSON<Module>(modulePath);
                if (!mod) return;
                const newId = generateId('lesson');
                const now = Date.now();
                const newLesson: Lesson = {
                    id: newId,
                    type: 'activity',
                    visible: true,
                    pages: [],
                    metadata: {
                        title: 'New Lesson',
                        duration: 0,
                        version: 1,
                        createdAt: now,
                        updatedAt: now,
                        lastEditedBy: { userId: 'system', name: 'System' },
                    },
                };
                mod.lessons.push({ name: 'New Lesson', id: newId, order: mod.lessons.length + 1 });
                await Promise.all([
                    writeJSON(await join(projectPath, 'lessons', `${newId}.json`), newLesson),
                    writeJSON(modulePath, mod),
                ]);
                notification.addNotification('New lesson created', { type: 'info' });
                break;
            }
            case 'new-page': {
                const lessonId = node.meta?.lessonId;
                if (!lessonId) return;
                const lessonPath = await join(projectPath, 'lessons', `${lessonId}.json`);
                const lesson = await readJSON<Lesson>(lessonPath);
                if (!lesson) return;
                const newId = generateId('page');
                const now = Date.now();
                const newPage: Page = {
                    id: newId,
                    visible: true,
                    elements: {},
                    rootIds: [],
                    stage: {
                        width: 1280,
                        height: 720,
                        background: '#1d293d',
                        display: { columns: '1', rows: '3', gap: '0' },
                    },
                    metadata: {
                        title: 'New Page',
                        version: 1,
                        createdAt: now,
                        updatedAt: now,
                        lastEditedBy: { userId: 'system', name: 'System' },
                    },
                };
                lesson.pages.push({ name: 'New Page', id: newId, order: lesson.pages.length + 1 });
                await Promise.all([
                    writeJSON(await join(projectPath, 'pages', `${newId}.json`), newPage),
                    writeJSON(lessonPath, lesson),
                ]);
                notification.addNotification('New page created', { type: 'info' });
                break;
            }
            case 'rename': {
                if (!newName) return;
                const moduleId = node.meta?.moduleId;
                const lessonId = node.meta?.lessonId;
                const pageId = node.meta?.pageId;
                if (node.kind === 'module' && moduleId) {
                    const projectFile = await join(projectPath, 'project.mava');
                    const projectData = await readJSON<ProjectData>(projectFile);
                    if (!projectData) return;
                    const modRef = projectData.course.modules.find(m => m.id === moduleId);
                    if (modRef) modRef.name = newName;
                    await writeJSON(projectFile, projectData);
                    const modulePath = await join(projectPath, 'modules', `${moduleId}.json`);
                    const mod = await readJSON<Module>(modulePath);
                    if (mod) { mod.metadata.title = newName; await writeJSON(modulePath, mod); }
                } else if (node.kind === 'lesson' && moduleId && lessonId) {
                    const modulePath = await join(projectPath, 'modules', `${moduleId}.json`);
                    const mod = await readJSON<Module>(modulePath);
                    if (!mod) return;
                    const lesRef = mod.lessons.find(l => l.id === lessonId);
                    if (lesRef) lesRef.name = newName;
                    await writeJSON(modulePath, mod);
                    const lessonPath = await join(projectPath, 'lessons', `${lessonId}.json`);
                    const lesson = await readJSON<Lesson>(lessonPath);
                    if (lesson) { lesson.metadata.title = newName; await writeJSON(lessonPath, lesson); }
                } else if (node.kind === 'page' && lessonId && pageId) {
                    const lessonPath = await join(projectPath, 'lessons', `${lessonId}.json`);
                    const lesson = await readJSON<Lesson>(lessonPath);
                    if (!lesson) return;
                    const pageRef = lesson.pages.find(p => p.id === pageId);
                    if (pageRef) pageRef.name = newName;
                    await writeJSON(lessonPath, lesson);
                    const pagePath = await join(projectPath, 'pages', `${pageId}.json`);
                    const page = await readJSON<Page>(pagePath);
                    if (page) { page.metadata.title = newName; await writeJSON(pagePath, page); }
                }
                notification.addNotification(`Renamed to "${newName}"`, { type: 'info' });
                break;
            }
            case 'delete': {
                const moduleId = node.meta?.moduleId;
                const lessonId = node.meta?.lessonId;
                const pageId = node.meta?.pageId;
                if (node.kind === 'module' && moduleId) {
                    const modulePath = await join(projectPath, 'modules', `${moduleId}.json`);
                    const mod = await readJSON<Module>(modulePath);
                    if (mod) {
                        for (const lesRef of mod.lessons) {
                            const lesPath = await join(projectPath, 'lessons', `${lesRef.id}.json`);
                            const les = await readJSON<Lesson>(lesPath);
                            if (les) {
                                for (const pageRef of les.pages) {
                                    await remove(await join(projectPath, 'pages', `${pageRef.id}.json`));
                                }
                            }
                            await remove(lesPath);
                        }
                    }
                    await remove(modulePath);
                    const projectFile = await join(projectPath, 'project.mava');
                    const projectData = await readJSON<ProjectData>(projectFile);
                    if (projectData) {
                        projectData.course.modules = projectData.course.modules.filter(m => m.id !== moduleId);
                        await writeJSON(projectFile, projectData);
                    }
                } else if (node.kind === 'lesson' && moduleId && lessonId) {
                    const lessonPath = await join(projectPath, 'lessons', `${lessonId}.json`);
                    const lesson = await readJSON<Lesson>(lessonPath);
                    if (lesson) {
                        for (const pageRef of lesson.pages) {
                            await remove(await join(projectPath, 'pages', `${pageRef.id}.json`));
                        }
                    }
                    await remove(lessonPath);
                    const modulePath = await join(projectPath, 'modules', `${moduleId}.json`);
                    const mod = await readJSON<Module>(modulePath);
                    if (mod) {
                        mod.lessons = mod.lessons.filter(l => l.id !== lessonId);
                        await writeJSON(modulePath, mod);
                    }
                } else if (node.kind === 'page' && lessonId && pageId) {
                    await remove(await join(projectPath, 'pages', `${pageId}.json`));
                    const lessonPath = await join(projectPath, 'lessons', `${lessonId}.json`);
                    const lesson = await readJSON<Lesson>(lessonPath);
                    if (lesson) {
                        lesson.pages = lesson.pages.filter(p => p.id !== pageId);
                        await writeJSON(lessonPath, lesson);
                    }
                }
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
        }
        treeNodes.value = await buildExplorerTree(projectPath);
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

        <div v-if="layout.explorerOpen" class="flex-1 min-h-0 overflow-auto thin-scroll">
            <ExplorerTree
                v-if="treeNodes.length"
                :nodes="treeNodes"
                :active-path="activePath"
                @select="handleSelect"
                @node-action="handleNodeAction"
            />

            <div v-else class="px-3 py-4 text-xs text-slate-500 space-y-1">
                <p v-if="hasProject">No lessons or pages yet.</p>
                <p v-else>Create or open a project to see its structure.</p>
            </div>
        </div>

        <div class="mt-1 border-t border-slate-800" />

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
            />

            <div v-else class="px-3 py-4 text-xs text-slate-500 space-y-1">
                <p v-if="pages.activePageId">No elements on this page yet.</p>
                <p v-else>Select a page to view its outline.</p>
            </div>
        </div>
    </div>
</template>
