<script setup lang="ts" vapor>
import ExplorerItem from "./explorerItem.vue";
import type { ExplorerNode } from "./fileTree";
import type { ActivePath } from "../../../stores/projectMetadata";

const props = defineProps<{
    nodes: ExplorerNode[];
    depth?: number;
    activePath?: ActivePath | null;
}>();

const emit = defineEmits<{
    (e: "select", node: ExplorerNode): void;
}>();
</script>

<template>
  <div>
    <ExplorerItem
      v-for="node in nodes"
      :key="node.id"
      :node="node"
      :depth="depth ?? 0"
      :active-path="activePath"
      @select="(payload) => emit('select', payload)"
    />
  </div>
</template>
