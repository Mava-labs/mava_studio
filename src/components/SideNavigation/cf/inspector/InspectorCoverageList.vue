<script setup lang="ts" vapor>
    // mava-studio/components/cf/inspector/InspectorCoverageList.vue
    // Competency coverage list — the main body of the Inspector panel.
    // Each competency is a row; clicking expands inline detail.

    import { ref, computed } from 'vue'
    import { useCfInspectorNavigation } from '../../../../composables/useCfInspectorNavigation'
    import type {
        CoverageSection,
        CompetencyCoverageResult,
        EvidenceCoverageResult,
    } from '../../../../types/cf-alignment.types'

    const props = defineProps<{
        coverage: CoverageSection
        frameworkId: string
    }>()

    const nav = useCfInspectorNavigation()
    const expanded = ref<Set<string>>(new Set())

    function toggle(id: string) {
        expanded.value.has(id) ? expanded.value.delete(id) : expanded.value.add(id)
    }

    // Sort: not_started first, then partial, then complete
    const sortedCompetencies = computed(() => {
        const order = { not_started: 0, partial: 1, complete: 2 }
        return Object.values(props.coverage.by_competency)
            .sort((a, b) => order[a.status] - order[b.status])
    })

    // Status visuals
    const STATUS_CONFIG = {
        complete: {
            stripe: 'bg-status-complete-fg',
            label: 'Complete',
            labelClass: 'text-status-complete-fg',
        },
        partial: {
            stripe: 'bg-[var(--color-status-sketched-fg)]',
            label: 'Partial',
            labelClass: 'text-[var(--color-status-sketched-fg)]',
        },
        not_started: {
            stripe: 'bg-[var(--color-surface-4)]',
            label: 'Not started',
            labelClass: 'text-muted',
        },
    }

    const EVIDENCE_STATUS_CONFIG = {
        proven: {
            icon: '✓',
            title: 'PROVEN — element proof found',
            class: 'text-status-complete-fg bg-[var(--color-status-complete)]',
        },
        claimed: {
            icon: '~',
            title: 'CLAIMED — lesson mapped but no component proof',
            class: 'text-[var(--color-status-sketched-fg)] bg-[var(--color-status-sketched)]',
        },
        missing: {
            icon: '✕',
            title: 'MISSING — no assessment lesson mapped',
            class: 'text-status-conflict-fg bg-[var(--color-status-conflict)]',
        },
    }

    function navigateToLesson(comp: CompetencyCoverageResult) {
        if (comp.covered_by_module_id) {
            nav.navigateToModule(comp.covered_by_module_id)
        }
    }

    function navigateToEvidence(ev: EvidenceCoverageResult) {
        if (ev.mapped_lesson_id) {
            nav.navigateToLesson(ev.mapped_lesson_id)
        } else {
            // No lesson yet — navigate to competency module if available
        }
    }

    function navigateToElement(ev: EvidenceCoverageResult) {
        if (ev.proven_by_element) {
            nav.navigateToPage(ev.proven_by_element.page_id)
        }
    }

    // Mini indicator coverage bar
    function indicatorPct(comp: CompetencyCoverageResult): number {
        if (!comp.indicators.length) return 0
        const covered = comp.indicators.filter(i => i.status === 'covered').length
        return Math.round((covered / comp.indicators.length) * 100)
    }
</script>

<template>
    <div class="divide-y divide-border-soft">

        <!-- Section header -->
        <div class="flex items-center justify-between px-3 py-2">
            <span class="text-[10px] uppercase tracking-widest text-muted">
                Coverage · {{ coverage.summary.total_competencies }} competencies
            </span>
        </div>

        <!-- Competency rows -->
        <div v-for="comp in sortedCompetencies" :key="comp.competency_id"
            class="border-b border-border-soft last:border-0">
            <!-- Row header -->
            <button class="w-full flex items-start gap-2 px-3 py-2.5 text-left
               hover:bg-surface-3
               transition-colors duration-fast" @click="toggle(comp.competency_id)">
                <!-- Status stripe -->
                <div class="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
                    :class="STATUS_CONFIG[comp.status].stripe" />

                <div class="flex-1 min-w-0 space-y-1">
                    <!-- Title + status -->
                    <div class="flex items-start justify-between gap-2">
                        <p class="text-xs font-medium text-primary leading-snug">
                            {{ comp.title }}
                        </p>
                        <span class="text-[9px] shrink-0 font-medium" :class="STATUS_CONFIG[comp.status].labelClass">
                            {{ STATUS_CONFIG[comp.status].label }}
                        </span>
                    </div>

                    <!-- Domain + module -->
                    <p class="text-[10px] text-muted">
                        {{ comp.domain_name }}
                        <span v-if="comp.covered_by_module_id"> · Module assigned</span>
                        <span v-else class="text-status-conflict-fg"> · No module assigned</span>
                    </p>

                    <!-- Mini indicator progress bar + evidence dots -->
                    <div class="flex items-center gap-2">
                        <!-- Indicator bar -->
                        <div class="flex-1 h-1 rounded-full bg-surface-4 overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-300" :class="indicatorPct(comp) === 100
                                ? 'bg-status-complete-fg'
                                : indicatorPct(comp) > 0
                                    ? 'bg-status-sketched-fg'
                                    : 'bg-transparent'" :style="{ width: `${indicatorPct(comp)}%` }" />
                        </div>
                        <span class="text-[9px] text-muted shrink-0">
                            {{comp.indicators.filter(i => i.status === 'covered').length}}
                            /{{ comp.indicators.length }}
                        </span>

                        <!-- Evidence status dots -->
                        <div class="flex gap-0.5 shrink-0">
                            <span v-for="ev in comp.evidence" :key="ev.evidence_item_id" class="w-2 h-2 rounded-full"
                                :class="{
                                    'bg-status-complete-fg': ev.status === 'proven',
                                    'bg-status-sketched-fg': ev.status === 'claimed',
                                    'bg-status-conflict-fg': ev.status === 'missing',
                                }" :title="`${ev.evidence_type} — ${ev.status.toUpperCase()}`" />
                        </div>
                    </div>
                </div>

                <!-- Expand arrow -->
                <span class="text-[10px] text-muted shrink-0 mt-0.5">
                    {{ expanded.has(comp.competency_id) ? '▲' : '▼' }}
                </span>
            </button>

            <!-- Expanded detail -->
            <div v-if="expanded.has(comp.competency_id)" class="px-4 pb-3 space-y-3 bg-surface-2
               border-t border-border-soft">

                <!-- Module navigation -->
                <div class="flex items-center justify-between pt-2">
                    <span class="text-[10px] text-muted">
                        {{ comp.covered_by_module_id ? 'Module assigned' : 'No module assigned yet' }}
                    </span>
                    <button v-if="comp.covered_by_module_id"
                        class="text-[10px] text-accent hover:underline" @click="navigateToLesson(comp)">
                        Go to module →
                    </button>
                </div>

                <!-- Indicators -->
                <div class="space-y-1.5">
                    <p class="text-[9px] uppercase tracking-widest text-muted">
                        Indicators
                    </p>
                    <div v-for="ind in comp.indicators" :key="ind.indicator_id" class="flex items-start gap-2">
                        <span class="shrink-0 text-[9px] font-bold mt-0.5" :class="ind.status === 'covered'
                            ? 'text-status-complete-fg'
                            : 'text-status-conflict-fg'">
                            {{ ind.status === 'covered' ? '✓' : '✕' }}
                        </span>
                        <div class="flex-1 min-w-0">
                            <p class="text-[11px] text-secondary leading-snug">
                                {{ ind.description }}
                            </p>
                            <p v-if="ind.covered_by_lesson_ids.length"
                                class="text-[9px] text-muted">
                                Covered by {{ ind.covered_by_lesson_ids.length }} lesson(s)
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Evidence demands -->
                <div class="space-y-2">
                    <p class="text-[9px] uppercase tracking-widest text-muted">
                        Evidence
                    </p>
                    <div v-for="ev in comp.evidence" :key="ev.evidence_item_id"
                        class="rounded-input border overflow-hidden" :class="{
                            'border-status-complete-fg': ev.status === 'proven',
                            'border-status-sketched-fg': ev.status === 'claimed',
                            'border-status-conflict-fg': ev.status === 'missing',
                        }">
                        <!-- Evidence header -->
                        <div class="flex items-center gap-2 px-2.5 py-2" :class="{
                            'bg-status-complete': ev.status === 'proven',
                            'bg-status-sketched': ev.status === 'claimed',
                            'bg-status-conflict': ev.status === 'missing',
                        }">
                            <span class="text-[10px] font-bold"
                                :class="EVIDENCE_STATUS_CONFIG[ev.status].class.split(' ')[0]">
                                {{ EVIDENCE_STATUS_CONFIG[ev.status].icon }}
                            </span>
                            <span class="text-[11px] font-medium text-primary flex-1">
                                {{ String(ev.evidence_type).replace(/_/g, ' ') }}
                            </span>
                            <span class="text-[9px] uppercase font-bold"
                                :class="EVIDENCE_STATUS_CONFIG[ev.status].class.split(' ')[0]">
                                {{ ev.status }}
                            </span>
                        </div>

                        <!-- Evidence body -->
                        <div class="px-2.5 py-2 space-y-1.5 bg-surface-3">
                            <p class="text-[10px] text-muted">
                                {{ ev.description }}
                            </p>

                            <!-- PROVEN: show element link -->
                            <div v-if="ev.status === 'proven' && ev.proven_by_element" class="flex items-center gap-2">
                                <span class="text-[10px] text-status-complete-fg">
                                    Component: {{ ev.proven_by_element.component_id }}
                                </span>
                                <button class="text-[10px] text-accent hover:underline"
                                    @click="navigateToElement(ev)">
                                    Go to page →
                                </button>
                            </div>

                            <!-- CLAIMED: show gap + go to lesson -->
                            <div v-if="ev.status === 'claimed'" class="space-y-1">
                                <p class="text-[10px] text-status-sketched-fg">
                                    {{ ev.claim_gap }}
                                </p>
                                <button v-if="ev.mapped_lesson_id"
                                    class="text-[10px] text-accent hover:underline"
                                    @click="navigateToEvidence(ev)">
                                    Go to assessment lesson →
                                </button>
                            </div>

                            <!-- MISSING: clear action -->
                            <div v-if="ev.status === 'missing'">
                                <p class="text-[10px] text-muted">
                                    No assessment lesson references this evidence item.
                                    Create an assessment lesson and add a
                                    <strong class="text-secondary">
                                        {{ String(ev.evidence_type).replace(/_/g, ' ') }}
                                    </strong>
                                    component with a CF proof reference.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>
