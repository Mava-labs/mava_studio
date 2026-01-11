<script setup lang="ts" vapor>
import { computed, ref, watch } from "vue";
import ExplorerTree from "./Structure/explorerTree.vue";
import OutlineTree from "./Structure/outlineTree.vue";
import { buildExplorerTree, type ExplorerNode } from "./Structure/fileTree";
import type { OutlineNode } from "./Structure/outlineTypes";
import { useProjectMetadataStore } from "../../stores/projectMetadata";
import { usePagesStore } from "../../stores/pages";
import { useLayoutStore } from "../../stores/layout";
import type { Element } from "../../types/element";

const project = useProjectMetadataStore();
const pages = usePagesStore();
const layout = useLayoutStore();

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

    pages.loadPage(path.pageId);
}
</script>

<template>
    <div class="h-full min-h-0 flex flex-col bg-slate-950/80 text-slate-50 border-r border-slate-800">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[11px] tracking-[0.18em] font-semibold uppercase text-slate-400">
            <span class="flex items-center gap-2">
                <button type="button" class="text-slate-400 hover:text-slate-200" @click="layout.toggleOutlineOrExplorer('explorer')">
                    {{ layout.explorerOpen ? '▾' : '▸' }}
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
                {{ layout.outlineExpaded ? '▾' : '▸' }}
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
