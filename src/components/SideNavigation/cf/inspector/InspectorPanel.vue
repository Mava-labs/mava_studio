<script setup lang="ts" vapor>
    // mava-studio/components/cf/inspector/InspectorPanel.vue
    // Container component — swap this into the secondary sidebar panel slot.

    import { computed, watch } from 'vue'
    import { useCfStore } from '../../../../stores/useCfStore'
    import { useCfProjectSlice } from '../../../../composables/useCfProjectSlice'
    import InspectorHealthBar from './InspectorHealthBar.vue'
    import InspectorStrictnessSelector from './InspectorStrictnessSelector.vue'
    import InspectorCompatibilitySection from './InspectorCompatibilitySection.vue'
    import InspectorCoverageList from './InspectorCoverageList.vue'
    import InspectorQualitySection from './InspectorQualitySection.vue'
    import { useStageStore } from '../../../../stores/stage'
    // import type { InspectorStrictness } from '../../../../types/cf-alignment.types'

    const cfStore = useCfStore()
    const stage = useStageStore()
    const { slice } = useCfProjectSlice()

    // Watch for project changes → schedule Inspector run
    watch(
        slice,
        (newSlice) => {
            cfStore.scheduleInspectorRun(newSlice)
        },
        { deep: true },
    )

    // Also re-run when strictness changes
    watch(
        () => cfStore.strictness,
        () => cfStore.runInspectorAll(slice.value),
    )

    const report = computed(() => cfStore.activeReport)
    const entry = computed(() => cfStore.activeEntry)

    const isRunning = computed(() =>
        entry.value?.inspectorState === 'running'
    )

    const noFrameworks = computed(() =>
        cfStore.frameworkList.length === 0
    )
</script>

<template>
    <div v-if="stage.currentStage == 'create'" class="flex flex-col h-full bg-slate-950/80 overflow-hidden">

        <!-- No frameworks state -->
        <div v-if="noFrameworks" class="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <span class="text-3xl opacity-30">🔍</span>
            <p class="text-sm">
                No frameworks imported yet
            </p>
            <p class="text-[11px] text-slate-500">
                Open the Frameworks panel to import a Competence Framework
            </p>
        </div>

        <template v-else>
            <!-- Health bar — always visible -->
            <InspectorHealthBar />

            <!-- Panel body -->
            <div class="flex-1 overflow-y-auto">

                <!-- Strictness + run state -->
                <div class="flex items-center justify-between px-3 py-2
                 border-b border-border-soft">
                    <InspectorStrictnessSelector />

                    <span v-if="isRunning" class="text-[10px] text-muted animate-pulse">
                        Checking…
                    </span>
                    <span v-else-if="report" class="text-[10px] text-muted">
                        {{ new Date(report.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }}
                    </span>
                </div>

                <!-- No report yet -->
                <div v-if="!report && !isRunning" class="flex items-center justify-center py-12
                 text-sm text-muted">
                    Start authoring to see inspection results
                </div>

                <template v-else-if="report">
                    <!-- Compatibility -->
                    <InspectorCompatibilitySection :section="report.compatibility"
                        class="border-b border-border-soft)]" />

                    <!-- Coverage -->
                    <InspectorCoverageList :coverage="report.coverage" :framework-id="report.framework_id" />

                    <!-- Assessment quality -->
                    <InspectorQualitySection v-if="report.assessment_quality.issues.length"
                        :section="report.assessment_quality" class="border-t border-border-soft)]" />
                </template>
            </div>
        </template>
    </div>

    <div v-else class="flex-1 flex flex-col justify-center text-center text-sm p-2 bg-slate-950/80 h-full">
        <span class="font-bold">No open course</span>
        <span class="text-slate-600 text-[11px]">
            Open a course to start mapping a framework.
        </span>
    </div>
</template>
