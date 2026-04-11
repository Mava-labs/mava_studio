<script setup lang="ts" vapor>
    import { computed, ref, nextTick, onMounted, onUnmounted, watch } from "vue";
    import ExplorerTree from "./explorerTree.vue";
    import type { ExplorerNode } from "../../../utils/fileTree";

    type ActiveExplorerPath = {
        moduleId?: string;
        lessonId?: string;
        pageId?: string;
    } | null;

    const props = defineProps<{
        node: ExplorerNode;
        depth: number;
        activePath?: ActiveExplorerPath;
        clipboardAction?: 'copy' | 'cut' | null;
        clipboardNodeKind?: ExplorerNode['kind'] | null;
    }>();

    const emit = defineEmits<{
        (e: "select", node: ExplorerNode): void;
        (e: "nodeAction", payload: { action: string; node: ExplorerNode; newName?: string }): void;
    }>();

    const expanded = ref(props.node.kind !== "page");
    const isBranch = computed(() => Boolean(props.node.children?.length));

    const isInActivePath = computed(() => {
        if (!props.activePath?.pageId) return false;
        if (props.node.kind === 'course') return true;
        if (props.node.kind === 'module') return props.activePath.moduleId === props.node.id;
        if (props.node.kind === 'lesson') return props.activePath.lessonId === props.node.id;
        return false;
    });

    // --- context menu ---
    const menuVisible = ref(false);
    const menuX = ref(0);
    const menuY = ref(0);

    // --- inline rename ---
    const isRenaming = ref(false);
    const renameValue = ref("");
    const renameInputRef = ref<HTMLInputElement | null>(null);

    const hasActivePageDescendant = computed(() => {
        const activePageId = props.activePath?.pageId;
        if (!activePageId) return false;

        const walk = (node: ExplorerNode): boolean => {
            if (node.kind === "page") return node.id === activePageId;
            return (node.children ?? []).some(child => walk(child));
        };

        return walk(props.node);
    });

    const isDirectPageActive = computed(() => {
        if (props.node.kind !== "page") return false;
        return props.node.id === props.activePath?.pageId;
    });

    const isInheritedActive = computed(() => {
        if (props.node.kind !== "module" && props.node.kind !== "lesson") return false;
        return !expanded.value && hasActivePageDescendant.value;
    });

    const isActive = computed(() => {
        if (props.node.kind === "course") return true;
        return isDirectPageActive.value || isInheritedActive.value;
    });

    const canPasteIntoNode = computed(() => {
        if (!props.clipboardNodeKind) return false;
        if (props.node.kind === "course") return props.clipboardNodeKind === "module";
        if (props.node.kind === "module") return props.clipboardNodeKind === "lesson";
        if (props.node.kind === "lesson") return props.clipboardNodeKind === "page";
        return false;
    });

    const badgeClass = computed(() => {
        switch (props.node.kind) {
            case "course":
                return "bg-indigo-400";
            case "module":
                return "bg-emerald-400";
            case "lesson":
                return "bg-amber-300";
            case "page":
                return "bg-sky-300";
            default:
                return "bg-slate-400";
        }
    });

    function handleClick() {
        if (isBranch.value) {
            expanded.value = !expanded.value;
        }
        emit("select", props.node);
    }

    function handleContextMenu(event: MouseEvent) {
        if (props.node.kind === "course") return;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        menuX.value = Math.min(event.clientX, winW - 168);
        menuY.value = Math.min(event.clientY, winH - 200);
        menuVisible.value = true;
    }

    function closeMenu() {
        menuVisible.value = false;
    }

    async function handleAction(action: string) {
        closeMenu();
        if (action === "rename") {
            isRenaming.value = true;
            renameValue.value = props.node.name;
            await nextTick();
            renameInputRef.value?.focus();
            renameInputRef.value?.select();
            return;
        }
        emit("nodeAction", { action, node: props.node });
    }

    function handleCourseAction(action: string) {
        emit("nodeAction", { action, node: props.node });
    }

    function confirmRename() {
        const newName = renameValue.value.trim();
        isRenaming.value = false;
        if (newName && newName !== props.node.name) {
            emit("nodeAction", { action: "rename", node: props.node, newName });
        }
    }

    function cancelRename() {
        isRenaming.value = false;
    }

    function onDocumentClick() {
        if (menuVisible.value) closeMenu();
    }

    watch(
        () => props.activePath?.pageId,
        () => {
            if (!isBranch.value) return;
            if (!isInActivePath.value) return;
            expanded.value = true;
        },
        { immediate: true }
    );

    onMounted(() => document.addEventListener("click", onDocumentClick));
    onUnmounted(() => document.removeEventListener("click", onDocumentClick));
</script>

<template>
    <div>
        <button type="button"
            :data-explorer-page-id="props.node.kind === 'page' ? props.node.id : undefined"
            :style="{ paddingLeft: props.node.kind !== 'course' ? `${depth * 12 + 8}px` : '0px' }" 
            class="w-full flex items-center gap-2 rounded-mdy py-1.5 text-left border border-transparent transition-colors"
            :class="[
                isActive && props.node.kind !== 'course' ? 'bg-slate-800/80 border-slate-700 text-slate-50' : 'text-slate-200 hover:bg-slate-900/60',
                props.node.kind == 'course' ? 'sticky top-0 z-20 bg-slate-900/95 font-semibold text-indigo-300 capitalize backdrop-blur-sm' : ''
            ]" 
            @click="handleClick"
            @contextmenu.prevent.stop="handleContextMenu"
        >
            <span class="w-3 shrink-0 text-center text-[10px] text-slate-500" v-if="isBranch && props.node.kind != 'course'">
                <svg v-if="expanded" class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="m19 9-7 7-7-7" />
                </svg>
                <svg v-else class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="m9 5 7 7-7 7" />
                </svg>
            </span>
            <span v-else class="w-3 shrink-0"></span>

            <span :class="props.node.kind !== 'course' ? `${badgeClass} w-2 h-2 rounded-full shrink-0` : ''"  />

            <span v-if="!isRenaming" class="min-w-0 flex-1 truncate text-sm">{{ node.name }}</span>
            <input
                v-else
                ref="renameInputRef"
                v-model="renameValue"
                class="min-w-0 flex-1 text-sm bg-slate-800 border border-slate-600 rounded px-1 outline-none text-slate-100"
                @keydown.enter.prevent="confirmRename"
                @keydown.escape.prevent="cancelRename"
                @blur="confirmRename"
                @click.stop
            />

            <span v-if="props.node.kind === 'course'" class="ml-auto inline-flex items-center gap-1">
                <button
                    type="button"
                    class="w-6 h-6 inline-flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800"
                    title="New Module"
                    @click.stop="handleCourseAction('new-module')"
                >
                    <svg class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M5 12h14m-7 7V5" />
                    </svg>
                </button>
                <button
                    type="button"
                    class="w-6 h-6 inline-flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800"
                    title="Refresh Tree"
                    @click.stop="handleCourseAction('refresh-tree')"
                >
                    <svg class="w-4 h-4 text-gray-800 dark:text-white" aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4" />
                    </svg>
                </button>
                <button
                    v-if="canPasteIntoNode"
                    type="button"
                    class="w-6 h-6 inline-flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800"
                    title="Paste"
                    @click.stop="handleCourseAction('paste')"
                >
                    <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8h10M9 12h10M9 16h10M5 8h.01M5 12h.01M5 16h.01" />
                    </svg>
                </button>
            </span>
        </button>

        <ExplorerTree v-if="node.children && expanded" :nodes="node.children" :depth="depth + 1"
            :active-path="activePath"
            :clipboard-action="clipboardAction"
            :clipboard-node-kind="clipboardNodeKind"
            @select="(payload) => emit('select', payload)"
            @node-action="(payload) => emit('nodeAction', payload)" />

        <!-- Context menu -->
        <div v-if="menuVisible" class="fixed inset-0 z-40" @click.stop="closeMenu" @contextmenu.prevent.stop="closeMenu">
            <div
                class="fixed z-50 min-w-40 rounded-md border border-slate-700 bg-slate-900 shadow-xl text-sm py-1"
                :style="{ top: `${menuY}px`, left: `${menuX}px` }"
                @click.stop
            >
                <template v-if="node.kind === 'module'">
                    <button type="button"
                        class="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-slate-700/70 flex items-center gap-2"
                        @click="handleAction('new-lesson')">
                        <span class="text-amber-300 font-bold">+</span> New Lesson
                    </button>
                    <div class="my-1 border-t border-slate-700" />
                </template>
                <template v-else-if="node.kind === 'lesson'">
                    <button type="button"
                        class="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-slate-700/70 flex items-center gap-2"
                        @click="handleAction('new-page')">
                        <span class="text-sky-300 font-bold">+</span> New Page
                    </button>
                    <div class="my-1 border-t border-slate-700" />
                </template>
                <button type="button" class="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-slate-700/70"
                    @click="handleAction('copy')">Copy</button>
                <button type="button" class="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-slate-700/70"
                    @click="handleAction('cut')">Cut</button>
                <button type="button" class="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-slate-700/70"
                    @click="handleAction('rename')">Rename</button>
                <button v-if="canPasteIntoNode" type="button" class="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-slate-700/70"
                    @click="handleAction('paste')">Paste</button>
                <div class="my-1 border-t border-slate-700" />
                <button type="button" class="w-full px-3 py-1.5 text-left text-red-400 hover:bg-slate-700/70"
                    @click="handleAction('delete')">Delete</button>
            </div>
        </div>
    </div>
</template>
