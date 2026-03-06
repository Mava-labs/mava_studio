<script setup lang="ts" vapor>
import { computed, ref } from "vue";
import ExplorerTree from "./explorerTree.vue";
import type { ExplorerNode } from "./fileTree";
import type { ActivePath } from "../../../stores/projectMetadata";

const props = defineProps<{
    node: ExplorerNode;
    depth: number;
    activePath?: ActivePath | null;
}>();

const emit = defineEmits<{
    (e: "select", node: ExplorerNode): void;
}>();

const expanded = ref(props.node.kind !== "page");
const isBranch = computed(() => Boolean(props.node.children?.length));

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
</script>

<template>
  <div>
    <button
      type="button"
      class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left border border-transparent transition-colors"
      :class="[
        isActive ? 'bg-slate-800/80 border-slate-700 text-slate-50' : 'text-slate-200 hover:bg-slate-900/60',
      ]"
      :style="{ paddingLeft: `${depth * 12 + 8}px` }"
      @click="handleClick"
    >
      <span class="w-3 text-center text-[10px] text-slate-500" v-if="isBranch">
        {{ expanded ? '▾' : '▸' }}
      </span>
      <span v-else class="w-3" />

      <span class="w-2 h-2 rounded-full" :class="badgeClass" />

      <span class="truncate text-sm">{{ node.name }}</span>
    </button>

    <ExplorerTree
      v-if="node.children && expanded"
      :nodes="node.children"
      :depth="depth + 1"
      :active-path="activePath"
      @select="(payload) => emit('select', payload)"
    />
  </div>
</template>
