<script setup lang="ts" vapor>
    import OutlineItem from "./outlineItem.vue";
    import type { OutlineNode } from "./outlineTypes";

    defineProps<{
        nodes: OutlineNode[];
        depth?: number;
        selectedId?: string | null;
        expandedIds?: Set<string>;
    }>();

    const emit = defineEmits<{
        select: [id: string];
        toggle: [id: string];
    }>();

    function handleSelect(id: string) {
        emit("select", id);
    }

    function handleToggle(id: string) {
        emit("toggle", id);
    }
</script>

<template>
    <div>
        <OutlineItem v-for="node in nodes" :key="node.id" :node="node" :depth="depth ?? 0" :selected-id="selectedId"
            :expanded-ids="expandedIds" @select="handleSelect" @toggle="handleToggle" />
    </div>
</template>
