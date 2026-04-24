<script setup lang="ts" vapor>
    // mava-studio/components/cf/mapper/MapperInstalledView.vue
    // Active CF reference view — the course author uses this while building content.
    // Shows installed frameworks as tabs, then the selected brief as a domain tree.

    import { ref, computed } from 'vue'
    import { useCfMapperStore } from '../../../../stores/useCfMapperStore'
    import { useCfStore } from '../../../../stores/useCfStore'
    import type { BriefCompetency } from '../../../../types/cf-alignment.types'

    const mapper = useCfMapperStore()
    const cfStore = useCfStore()

    const expandedDomains = ref<Set<string>>(new Set())
    const expandedCompetencies = ref<Set<string>>(new Set())

    const brief = computed(() => cfStore.activeBrief)
    const entry = computed(() => cfStore.activeEntry)

    // Group competencies by domain using domain_map
    const domainGroups = computed(() => {
        if (!brief.value) return []
        return Object.entries(brief.value.domain_map).map(([domainId, compIds]) => {
            // Find domain name from any competency in this domain
            const firstComp = brief.value!.competencies[compIds[0]]
            return {
                domainId,
                domainName: firstComp?.domain_name ?? domainId,
                competencies: compIds
                    .map(id => brief.value!.competencies[id])
                    .filter(Boolean) as BriefCompetency[],
            }
        })
    })

    function toggleDomain(id: string) {
        expandedDomains.value.has(id)
            ? expandedDomains.value.delete(id)
            : expandedDomains.value.add(id)
    }

    function toggleCompetency(id: string) {
        expandedCompetencies.value.has(id)
            ? expandedCompetencies.value.delete(id)
            : expandedCompetencies.value.add(id)
    }

    const BLOOM_LABELS: Record<string, string> = {
        remember: 'Recall', understand: 'Understand', apply: 'Apply',
        analyze: 'Analyse', evaluate: 'Judge', create: 'Create',
    }

    const EVIDENCE_ICONS: Record<string, string> = {
        quiz: '📝', video_demo: '🎬', file_upload: '📁',
        project_submission: '📦', portfolio_link: '🔗',
        peer_observation: '👥', mentor_sign_off: '✅',
        reflection: '📓', live_assessment: '🎯',
    }
</script>

<template>
    <div class="flex flex-col h-full overflow-hidden">

        <!-- Framework tabs (when multiple installed) -->
        <div v-if="mapper.installedFrameworks.length > 1" class="flex gap-0.5 px-3 pt-2 pb-0 shrink-0 overflow-x-auto">
            <button v-for="fw in mapper.installedFrameworks" :key="fw.framework_id" class="text-[10px] px-2.5 py-1.5 rounded-t-md whitespace-nowrap
               transition-colors duration-fast" :class="cfStore.activeFrameworkId === fw.framework_id
                ? 'bg-surface-2 text-primary'
                : 'text-muted hover:text-secondary'"
                @click="cfStore.setActiveFramework(fw.framework_id)">
                {{ fw.title }}
            </button>
        </div>

        <!-- Stale brief warning -->
        <div v-if="entry?.briefState === 'stale'" class="mx-3 mt-2 px-3 py-2 rounded-input
             bg-status-sketched border border-status-sketched-fg
             text-[11px] text-status-sketched-fg shrink-0">
            ⚠ Framework has been updated. Re-import to refresh.
        </div>

        <!-- Loading -->
        <div v-if="entry?.briefState === 'loading'"
            class="flex items-center justify-center flex-1 text-sm text-muted">
            Loading framework…
        </div>

        <!-- Brief content -->
        <div v-else-if="brief" class="flex-1 overflow-y-auto">

            <!-- Brief header -->
            <div class="px-3 py-3 border-b border-border-soft">
                <p class="text-xs font-semibold text-primary">
                    {{ entry?.alignment.framework_title ?? brief.framework_id }}
                </p>
                <p class="text-[10px] text-muted mt-0.5">
                    v{{ brief.framework_version }} ·
                    {{ Object.keys(brief.competencies).length }} competencies ·
                    {{ Object.keys(brief.indicators).length }} indicators
                </p>

                <!-- Platform capabilities summary -->
                <div class="flex flex-wrap gap-1 mt-2">
                    <span v-for="et in brief.required_evidence_types" :key="String(et)" class="text-[9px] px-1.5 py-0.5 rounded-full
                   bg-surface-3 text-muted" :title="String(et)">
                        {{ EVIDENCE_ICONS[String(et)] ?? '?' }}
                    </span>
                    <span v-if="brief.requires_offline_support" class="text-[9px] px-1.5 py-0.5 rounded-full
                   bg-status-complete text-status-complete-fg">
                        Offline ✓
                    </span>
                </div>
            </div>

            <!-- Domain tree -->
            <div class="divide-y divide-border-soft">
                <div v-for="group in domainGroups" :key="group.domainId">

                    <!-- Domain header -->
                    <button class="w-full flex items-center justify-between px-3 py-2.5 text-left
                   hover:bg-surface-3
                   transition-colors duration-fast" @click="toggleDomain(group.domainId)">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] text-muted">
                                {{ expandedDomains.has(group.domainId) ? '▼' : '▶' }}
                            </span>
                            <span class="text-xs font-medium text-primary">
                                {{ group.domainName }}
                            </span>
                        </div>
                        <span class="text-[10px] text-muted">
                            {{ group.competencies.length }}
                        </span>
                    </button>

                    <!-- Competencies -->
                    <div v-if="expandedDomains.has(group.domainId)">
                        <div v-for="comp in group.competencies" :key="comp.competency_id"
                            class="border-t border-border-soft">
                            <!-- Competency row -->
                            <button class="w-full flex items-start gap-2 px-4 py-2.5 text-left
                       hover:bg-surface-3
                       transition-colors duration-fast"
                                @click="toggleCompetency(comp.competency_id)">
                                <span class="text-[10px] text-muted mt-0.5 shrink-0">
                                    {{ expandedCompetencies.has(comp.competency_id) ? '▼' : '▶' }}
                                </span>
                                <div class="flex-1 min-w-0">
                                    <p class="text-[11px] font-medium text-primary leading-snug">
                                        {{ comp.title }}
                                    </p>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <span class="text-[9px] text-muted">
                                            {{ BLOOM_LABELS[comp.bloom_level] ?? comp.bloom_level }}
                                        </span>
                                        <span class="text-border-soft">·</span>
                                        <span class="text-[9px] text-muted capitalize">
                                            {{ comp.proficiency_level }}
                                        </span>
                                        <span class="text-border-soft">·</span>
                                        <span class="text-[9px] text-muted">
                                            diff {{ comp.difficulty }}/5
                                        </span>
                                    </div>
                                </div>
                            </button>

                            <!-- Competency detail (expanded) -->
                            <div v-if="expandedCompetencies.has(comp.competency_id)"
                                class="px-5 pb-3 space-y-3 bg-surface-2">
                                <!-- Description -->
                                <p class="text-[11px] text-secondary leading-relaxed">
                                    {{ comp.description }}
                                </p>
                                <p v-if="comp.context" class="text-[10px] text-muted italic">
                                    Context: {{ comp.context }}
                                </p>

                                <!-- Indicators -->
                                <div class="space-y-1">
                                    <p class="text-[9px] uppercase tracking-widest text-muted">
                                        Indicators
                                    </p>
                                    <div v-for="ind in comp.indicators" :key="ind.indicator_id"
                                        class="flex items-start gap-1.5">
                                        <span class="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />
                                        <p class="text-[11px] text-secondary leading-snug">
                                            {{ ind.description }}
                                        </p>
                                    </div>
                                </div>

                                <!-- Evidence demands -->
                                <div class="space-y-1">
                                    <p class="text-[9px] uppercase tracking-widest text-muted">
                                        Evidence required
                                    </p>
                                    <div v-for="ev in comp.evidence_demands" :key="ev.evidence_item_id"
                                        class="flex items-center gap-2">
                                        <span class="text-base leading-none shrink-0">
                                            {{ EVIDENCE_ICONS[String(ev.type)] ?? '?' }}
                                        </span>
                                        <span class="text-[11px] text-secondary">
                                            {{ String(ev.type).replace(/_/g, ' ') }}
                                        </span>
                                        <span v-if="ev.offline_compatible"
                                            class="text-[9px] text-status-complete-fg">✓ offline</span>
                                    </div>
                                </div>

                                <!-- Prerequisites -->
                                <div v-if="comp.prerequisite_ids.length" class="space-y-1">
                                    <p class="text-[9px] uppercase tracking-widest text-muted">
                                        Prerequisites
                                    </p>
                                    <div v-for="prereqId in comp.prerequisite_ids" :key="prereqId"
                                        class="text-[10px] text-muted">
                                        → {{ brief.competencies[prereqId]?.title ?? prereqId }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- No brief loaded -->
        <div v-else class="flex flex-col items-center justify-center flex-1 gap-3 px-4 text-center">
            <p class="text-sm text-muted">
                Framework reference unavailable
            </p>
            <button class="text-xs px-3 py-1.5 rounded-input
               bg-surface-3 text-secondary
               hover:bg-surface-4
               transition-colors duration-fast" @click="mapper.goToBrowse">
                Re-import framework
            </button>
        </div>
    </div>
</template>
