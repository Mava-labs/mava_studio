<script setup lang="ts" vapor>
    import { ref } from 'vue'
    import { useCfInspectorNavigation } from '../../../../composables/useCfInspectorNavigation'
    import type { CompatibilitySection } from '../../../../types/cf-alignment.types'

    const props = defineProps<{ section: CompatibilitySection }>()
    const nav = useCfInspectorNavigation()
    const open = ref(false)

    const SEVERITY_CONFIG = {
        error: { icon: '✕', class: 'text-[var(--color-status-conflict-fg)]' },
        warning: { icon: '!', class: 'text-[var(--color-status-sketched-fg)]' },
        suggestion: { icon: '💡', class: 'text-muted' },
        ok: { icon: '✓', class: 'text-[var(--color-status-complete-fg)]' },
    }

    const nonOkChecks = props.section.checks.filter(c => c.severity !== 'ok')
</script>

<template>
    <div>
        <button class="w-full flex items-center justify-between px-3 py-2.5
             hover:bg-surface-3
             transition-colors duration-(--duration-fast)" @click="open = !open">
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold" :class="SEVERITY_CONFIG[section.overall].class">
                    {{ SEVERITY_CONFIG[section.overall].icon }}
                </span>
                <span class="text-[11px] font-medium text-secondary">
                    Compatibility
                </span>
                <span v-if="nonOkChecks.length" class="text-[9px] px-1.5 py-0.5 rounded-full
                 bg-surface-3 text-muted">
                    {{ nonOkChecks.length }} issue(s)
                </span>
            </div>
            <span class="text-[10px] text-muted">{{ open ? '▲' : '▼' }}</span>
        </button>

        <div v-if="open" class="px-3 pb-3 space-y-2 bg-surface-2">
            <div v-for="check in section.checks" :key="check.check_id" class="flex items-start gap-2">
                <span class="shrink-0 text-[10px] font-bold mt-0.5" :class="SEVERITY_CONFIG[check.severity].class">
                    {{ SEVERITY_CONFIG[check.severity].icon }}
                </span>
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] text-secondary">{{ check.message }}</p>
                    <button v-if="check.navigation"
                        class="text-[10px] text-accent hover:underline mt-0.5"
                        @click="nav.navigateTo(check.navigation)">
                        Go to →
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
