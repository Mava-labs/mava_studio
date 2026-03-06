<script setup lang="ts" vapor>
import OutlineItem from "./outlineItem.vue";
import type { OutlineNode } from "./outlineTypes";

defineProps<{
    nodes: OutlineNode[];
    depth?: number;
}>();
</script>

<template>
  <div>
    <OutlineItem
      v-for="node in nodes"
      :key="node.id"
      :node="node"
      :depth="depth ?? 0"
    />
  </div>
</template>
