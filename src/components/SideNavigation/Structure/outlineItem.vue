<script setup lang="ts" vapor>
import { computed } from "vue";
import OutlineTree from "./outlineTree.vue";
import type { OutlineNode } from "./outlineTypes";
import { useLayoutStore } from "../../../stores/layout";

const layout = useLayoutStore();

const props = defineProps<{
  node: OutlineNode;
  depth: number;
}>();

const hasChildren = computed(() => Boolean(props.node.children?.length));

function toggle() {
  if (hasChildren.value) layout.toggleOutlineOrExplorer('outline');
}
</script>

<template>
    <div>
        <button
            type="button"
            class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-slate-200 hover:bg-slate-900/60 border border-transparent rounded-md"
            :style="{ paddingLeft: `${depth * 12 + 8}px` }"
            @click="toggle"
        >
            <span class="w-3 text-center text-[10px] text-slate-500" v-if="hasChildren">
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
            </span>
            <span v-else class="w-3" />

            <span class="w-2 h-2 rounded-full bg-slate-500" />

            <span class="truncate text-sm">{{ node.name }}</span>
            <span class="text-[10px] uppercase tracking-wide text-slate-500">{{ node.kind }}</span>
        </button>

        <div v-if="hasChildren && layout.outlineExpaded" class="border-l border-slate-800 ml-4">
            <OutlineTree
                :nodes="node.children || []"
                :depth="depth + 1"
            />
        </div>
    </div>
</template>
