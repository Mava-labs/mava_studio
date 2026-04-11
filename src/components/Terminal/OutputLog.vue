<script setup lang="ts" vapor>
    import { useTerminalStore } from '../../stores/terminal'
    import { ref, watch, nextTick } from 'vue'

    const terminal = useTerminalStore()
    const logEl = ref<HTMLElement | null>(null)

    // Auto-scroll to bottom on new entries
    watch(
        () => terminal.entries.length,
        async () => {
            await nextTick()
            if (logEl.value)
                logEl.value.scrollTop = logEl.value.scrollHeight
        }
    )
</script>

<template>
    <div ref="logEl" class="output-log">
        <div v-for="entry in terminal.entries" :key="entry.id" :class="['log-entry', `log-entry--${entry.level}`]">
            <span class="log-entry__time">
                {{ new Date(entry.timestamp).toLocaleTimeString() }}
            </span>
            <span class="log-entry__msg">{{ entry.message }}</span>
        </div>

        <div v-if="!terminal.entries.length" class="log-empty">
            No output yet.
        </div>
    </div>
</template>

<style scoped>
    .output-log {
        height: 100%;
        overflow-y: auto;
        padding: 8px 12px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 12px;
        line-height: 1.6;
    }

    .log-entry {
        display: flex;
        gap: 12px;
    }

    .log-entry__time {
        color: #555;
        flex-shrink: 0;
    }

    .log-entry--info .log-entry__msg {
        color: #ccc;
    }

    .log-entry--warn .log-entry__msg {
        color: #e5a50a;
    }

    .log-entry--error .log-entry__msg {
        color: #f44747;
    }

    .log-empty {
        color: #555;
        font-size: 12px;
        padding: 8px 0;
    }
</style>