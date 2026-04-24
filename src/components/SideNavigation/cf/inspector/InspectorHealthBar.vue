<script setup lang="ts" vapor>
    // mava-studio/components/cf/inspector/InspectorHealthBar.vue
    // Always-visible top bar in the Inspector panel.
    // Shows: overall coverage %, per-framework tabs, publish readiness badge.

    import { computed } from 'vue'
    import { useCfStore } from '../../../../stores/useCfStore'

    const cfStore = useCfStore()

    const pct = computed(() => cfStore.activeCoveragePercent)
    const report = computed(() => cfStore.activeReport)

    const statusColour = computed(() => {
        if (!report.value) return 'bg-[var(--color-surface-4)]'
        if (report.value.publish_ready) return 'bg-[var(--color-status-complete-fg)]'
        const pctVal = pct.value ?? 0
        if (pctVal >= 70) return 'bg-[var(--color-status-sketched-fg)]'
        return 'bg-[var(--color-status-conflict-fg)]'
    })

    const summary = computed(() => report.value?.coverage.summary)
</script>

<template>
    <div class="shrink-0 px-3 py-3 border-b border-border
              bg-surface-1 space-y-2">

        <!-- Framework tabs if multiple -->
        <div v-if="cfStore.frameworkList.length > 1" class="flex gap-0.5 overflow-x-auto">
            <button v-for="fw in cfStore.frameworkList" :key="fw.alignment.framework_id" class="text-[10px] px-2 py-1 rounded whitespace-nowrap shrink-0
               transition-colors duration-fast" :class="cfStore.activeFrameworkId === fw.alignment.framework_id
                ? 'bg-surface-3 text-primary'
                : 'text-muted hover:text-secondary'"
                @click="cfStore.setActiveFramework(fw.alignment.framework_id)">
                {{ fw.alignment.framework_title }}
            </button>
        </div>

        <!-- Coverage bar -->
        <div class="space-y-1">
            <div class="flex items-center justify-between">
                <span class="text-[10px] text-muted uppercase tracking-widest">
                    Coverage
                </span>
                <span class="text-sm font-bold tabular-nums text-primary">
                    {{ pct !== null ? `${pct}%` : '—' }}
                </span>
            </div>

            <!-- Track -->
            <div class="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500" :class="statusColour"
                    :style="{ width: `${pct ?? 0}%` }" />
            </div>
        </div>

        <!-- Stats row -->
        <div v-if="summary" class="grid grid-cols-3 gap-1">
            <div v-for="stat in [
                { label: 'Complete', value: summary.complete, colour: 'text-status-complete-fg' },
                { label: 'Partial', value: summary.partial, colour: 'text-status-sketched-fg' },
                { label: 'Not started', value: summary.not_started, colour: 'text-muted' },
            ]" :key="stat.label" class="text-center">
                <p class="text-sm font-bold tabular-nums" :class="stat.colour">
                    {{ stat.value }}
                </p>
                <p class="text-[9px] text-muted">{{ stat.label }}</p>
            </div>
        </div>

        <!-- Evidence proof stats -->
        <div v-if="summary" class="flex items-center gap-2 text-[10px]">
            <span class="text-status-complete-fg">
                ✓ {{ summary.evidence_proven }} proven
            </span>
            <span class="text-status-sketched-fg">
                ~ {{ summary.evidence_claimed }} claimed
            </span>
            <span class="text-status-conflict-fg">
                ✕ {{ summary.evidence_missing }} missing
            </span>
        </div>

        <!-- Publish readiness badge -->
        <div v-if="report" class="flex items-center gap-2 px-2.5 py-1.5 rounded-input" :class="report.publish_ready
            ? 'bg-status-complete text-status-complete-fg'
            : 'bg-status-conflict text-status-conflict-fg'">
            <span class="text-[11px] font-medium">
                {{ report.publish_ready ? '✓ Ready to publish' : `✕ ${report.blocking_errors.length} blocking error(s)`
                }}
            </span>
        </div>
    </div>
</template>
