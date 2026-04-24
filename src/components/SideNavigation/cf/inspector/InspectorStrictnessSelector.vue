<script setup lang="ts" vapor>
    // InspectorStrictnessSelector.vue
    import { useCfStore } from '../../../../stores/useCfStore'
    import type { InspectorStrictness } from '../../../../types/cf-alignment.types'

    const cfStore = useCfStore()

    const OPTIONS: { value: InspectorStrictness; label: string; title: string }[] = [
        { value: 'lenient', label: 'Lenient', title: 'Hard errors only' },
        { value: 'standard', label: 'Standard', title: 'Errors + coverage warnings' },
        { value: 'strict', label: 'Strict', title: 'Full integrity posture validation' },
    ]
</script>

<template>
    <div class="flex items-center gap-1">
        <span class="text-[9px] uppercase tracking-widest text-muted mr-1">
            Mode
        </span>
        <button v-for="opt in OPTIONS" :key="opt.value"
            class="text-[10px] px-2 py-1 rounded transition-colors duration-fast" :class="cfStore.strictness === opt.value
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:text-secondary'" :title="opt.title" @click="cfStore.setStrictness(opt.value)">
            {{ opt.label }}
        </button>
    </div>
</template>
