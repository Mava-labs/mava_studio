<script setup lang="ts" vapor>
    import { ref } from 'vue'
    import { useCfInspectorNavigation } from '../../../../composables/useCfInspectorNavigation'
    import type { AssessmentQualitySection } from '../../../../types/cf-alignment.types'

    const props = defineProps<{ section: AssessmentQualitySection }>()
    const nav = useCfInspectorNavigation()
    const open = ref(false)
</script>

<template>
    <div>
        <button class="w-full flex items-center justify-between px-3 py-2.5
             hover:bg-surface-3
             transition-colors duration-fast" @click="open = !open">
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-status-sketched-fg">!</span>
                <span class="text-[11px] font-medium text-secondary">
                    Assessment quality
                </span>
                <span class="text-[9px] px-1.5 py-0.5 rounded-full
                 bg-status-sketched text-status-sketched-fg">
                    {{ section.issues.length }} warning(s)
                </span>
            </div>
            <span class="text-[10px] text-muted">{{ open ? '▲' : '▼' }}</span>
        </button>

        <div v-if="open" class="px-3 pb-3 space-y-3 bg-surface-2">
            <div v-for="issue in section.issues" :key="issue.issue_id" class="rounded-input bg-status-sketched
               border border-status-sketched-fg px-3 py-2.5 space-y-1.5">
                <p class="text-[11px] text-primary">{{ issue.message }}</p>

                <!-- Suggested types -->
                <div v-if="issue.suggested_types.length" class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[9px] text-muted">Try instead:</span>
                    <span v-for="t in issue.suggested_types" :key="String(t)" class="text-[9px] px-1.5 py-0.5 rounded-full
                   bg-surface-3 text-secondary">
                        {{ String(t).replace(/_/g, ' ') }}
                    </span>
                </div>

                <button class="text-[10px] text-accent hover:underline" @click="nav.navigateTo(issue.navigation)">
                    Go to lesson →
                </button>
            </div>
        </div>
    </div>
</template>
