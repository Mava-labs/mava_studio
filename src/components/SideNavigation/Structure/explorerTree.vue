<script setup lang="ts" vapor>
    import ExplorerItem from "./explorerItem.vue";
    import type { ExplorerNode } from "../../../utils/fileTree";

    type ActiveExplorerPath = {
        moduleId?: string;
        lessonId?: string;
        pageId?: string;
    } | null;

    const props = defineProps<{
        nodes: ExplorerNode[];
        depth?: number;
        activePath?: ActiveExplorerPath;
        clipboardAction?: 'copy' | 'cut' | null;
        clipboardNodeKind?: ExplorerNode['kind'] | null;
    }>();

    const emit = defineEmits<{
        (e: "select", node: ExplorerNode): void;
        (e: "nodeAction", payload: { action: string; node: ExplorerNode; newName?: string }): void;
    }>();
</script>

<template>
    <div>
        <ExplorerItem v-for="node in nodes" :key="node.id" :node="node" :depth="depth ?? 0" :active-path="activePath"
            :clipboard-action="clipboardAction"
            :clipboard-node-kind="clipboardNodeKind"
            @select="(payload) => emit('select', payload)" @node-action="(payload) => emit('nodeAction', payload)" />
    </div>
</template>
