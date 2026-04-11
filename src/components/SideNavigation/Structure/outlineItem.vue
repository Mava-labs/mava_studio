<script setup lang="ts" vapor>
    import { computed } from "vue";
    import OutlineTree from "./outlineTree.vue";
    import type { OutlineNode } from "./outlineTypes";

    const props = defineProps<{
        node: OutlineNode;
        depth: number;
        selectedId?: string | null;
        expandedIds?: Set<string>;
    }>();

    const emit = defineEmits<{
        select: [id: string];
        toggle: [id: string];
    }>();

    const hasChildren = computed(() => Boolean(props.node.children?.length));
    const isExpanded = computed(() => {
        if (!hasChildren.value) return false;
        if (!props.expandedIds) return true;
        return !props.expandedIds.has(props.node.id);
    });
    const isSelected = computed(() => props.selectedId === props.node.id);

    function toggle() {
        if (hasChildren.value) emit("toggle", props.node.id);
    }

    function select() {
        emit("select", props.node.id);
    }
</script>

<template>
    <div>
        <div class="w-full flex items-center gap-2 px-2 py-1.5 text-left" :class="isSelected
            ? 'bg-slate-800/90 text-slate-100'
            : 'text-slate-200 hover:bg-slate-900/60 border-transparent'"
            :style="{ paddingLeft: `${depth * 12 + 8}px` }">
            <button v-if="hasChildren" type="button"
                class="w-4 h-4 inline-flex items-center justify-center text-slate-500 hover:text-slate-300"
                @click.stop="toggle">
                <svg v-if="isExpanded" class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24"
                    height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="m19 9-7 7-7-7" />
                </svg>
                <svg v-else class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                    fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="m9 5 7 7-7 7" />
                </svg>
            </button>
            <span v-else class="w-4"></span>

            <button type="button" class="min-w-0 flex-1 flex items-center gap-2 text-left" @click="select">
                <span class="w-2 h-2 rounded-full bg-slate-500"></span>
                <span class="truncate text-sm">{{ node.name }}</span>
                <span class="text-[10px] uppercase tracking-wide text-slate-500">{{ node.kind }}</span>
            </button>
        </div>

        <div v-if="hasChildren && isExpanded" class="border-l border-slate-800 ml-4">
            <OutlineTree :nodes="node.children || []" :depth="depth + 1" :selected-id="selectedId"
                :expanded-ids="expandedIds" @select="(id) => emit('select', id)" @toggle="(id) => emit('toggle', id)" />
        </div>
    </div>
</template>
