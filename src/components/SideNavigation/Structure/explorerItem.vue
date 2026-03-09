<script setup lang="ts" vapor>
    import { computed, ref, nextTick, onMounted, onUnmounted } from "vue";
    import ExplorerTree from "./explorerTree.vue";
    import type { ExplorerNode } from "./fileTree";

    const props = defineProps<{
        node: ExplorerNode;
        depth: number;
        activePath?: any;
    }>();

    const emit = defineEmits<{
        (e: "select", node: ExplorerNode): void;
        (e: "nodeAction", payload: { action: string; node: ExplorerNode; newName?: string }): void;
    }>();

    const expanded = ref(props.node.kind !== "page");
    const isBranch = computed(() => Boolean(props.node.children?.length));

    // --- context menu ---
    const menuVisible = ref(false);
    const menuX = ref(0);
    const menuY = ref(0);

    // --- inline rename ---
    const isRenaming = ref(false);
    const renameValue = ref("");
    const renameInputRef = ref<HTMLInputElement | null>(null);

    const isActive = computed(() => {
        if (!props.activePath) return false;
        switch (props.node.kind) {
            case "module":
                return props.node.id === props.activePath.moduleId;
            case "lesson":
                return props.node.id === props.activePath.lessonId;
            case "page":
                return props.node.id === props.activePath.pageId;
            case "course":
                return true;
            default:
                return false;
        }
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

    onMounted(() => document.addEventListener("click", onDocumentClick));
    onUnmounted(() => document.removeEventListener("click", onDocumentClick));
</script>

<template>
    <div>
        <button type="button"
            :style="{ paddingLeft: props.node.kind !== 'course' ? `${depth * 12 + 8}px` : '0px' }" 
            class="w-full flex items-center gap-2 rounded-mdy py-1.5 text-left border border-transparent transition-colors"
            :class="[
                isActive && props.node.kind == 'page' ? 'bg-slate-800/80 border-slate-700 text-slate-50' : 'text-slate-200 hover:bg-slate-900/60',
                props.node.kind == 'course' ? 'font-semibold text-indigo-300 capitalize ' : ''
            ]" 
            @click="handleClick"
            @contextmenu.prevent.stop="handleContextMenu">
            <span class="w-3 text-center text-[10px] text-slate-500" v-if="isBranch && props.node.kind != 'course'">
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
            <span v-else class="w-3"></span>

            <span :class="props.node.kind !== 'course' ? `${badgeClass} w-2 h-2 rounded-full` : ''"  />

            <span v-if="!isRenaming" class="truncate text-sm">{{ node.name }}</span>
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
        </button>

        <ExplorerTree v-if="node.children && expanded" :nodes="node.children" :depth="depth + 1"
            :active-path="activePath"
            @select="(payload) => emit('select', payload)"
            @node-action="(payload) => emit('nodeAction', payload)" />

        <!-- Context menu -->
        <div v-if="menuVisible" class="fixed inset-0 z-40" @click.stop="closeMenu" @contextmenu.prevent.stop="closeMenu">
            <div
                class="fixed z-50 min-w-[160px] rounded-md border border-slate-700 bg-slate-900 shadow-xl text-sm py-1"
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
                <div class="my-1 border-t border-slate-700" />
                <button type="button" class="w-full px-3 py-1.5 text-left text-red-400 hover:bg-slate-700/70"
                    @click="handleAction('delete')">Delete</button>
            </div>
        </div>
    </div>
</template>
