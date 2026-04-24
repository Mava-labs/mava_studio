<script setup lang="ts" vapor>
    // mava-studio/components/cf/mapper/MapperPanel.vue
    // Container component — swap this into the secondary sidebar panel slot.
    // Owns panel-level navigation between browse / detail / installed views.

    import { onMounted } from 'vue'
    import { useCfMapperStore } from '../../../../stores/useCfMapperStore'
    import MapperBrowseView from './MapperBrowseView.vue'
    import MapperDetailView from './MapperDetailView.vue'
    import MapperInstalledView from './MapperInstalledView.vue'
    import { useStageStore } from '../../../../stores/stage'

    const mapper = useCfMapperStore()
    const stage = useStageStore()

    onMounted(() => mapper.init())
</script>

<template>
    <div class="flex flex-col h-full bg-slate-950/80 overflow-hidden">

        <!-- Panel header -->
        <div v-if="stage.currentStage === 'create'" class="flex items-center justify-between px-3 py-2.5 shrink-0
             border-b border-border">
            <div class="flex items-center gap-2">
                <!-- Back button — shown when in detail view -->
                <button v-if="mapper.currentView !== 'browse' && mapper.currentView !== 'installed'" class="text-muted hover:text-primary
                 text-xs transition-colors duration-fast" @click="mapper.goToBrowse">
                    ← Back
                </button>

                <span class="text-xs font-semibold text-secondary uppercase tracking-widest">
                    {{
                        mapper.currentView === 'browse' ? 'Frameworks'
                            : mapper.currentView === 'detail' ? 'Framework Details'
                                : 'Active Frameworks'
                    }}
                </span>
            </div>

            <!-- Browse button when in installed view -->
            <button v-if="mapper.currentView === 'installed'" class="text-[10px] px-2.5 py-1 rounded-input
               bg-surface-3 text-secondary
               hover:bg-surface-4 hover:text-primary
               transition-colors duration-fast" @click="mapper.goToBrowse">
                + Add framework
            </button>
        </div>

        <!-- View router -->
        <div v-if="stage.currentStage === 'create'" class="flex-1 overflow-hidden">
            <Transition enter-active-class="transition-opacity duration-fast"
                enter-from-class="opacity-0" enter-to-class="opacity-100" mode="out-in">
                <MapperBrowseView v-if="mapper.currentView === 'browse'" key="browse" />
                <MapperDetailView v-else-if="mapper.currentView === 'detail'" key="detail" />
                <MapperInstalledView v-else-if="mapper.currentView === 'installed'" key="installed" />
            </Transition>
        </div>

        <div v-else class="flex-1 flex flex-col justify-center text-center text-sm p-2 bg-slate-950/80 h-full">
            <span class="font-bold">No open course</span>
            <span class="text-slate-600 text-[11px]">
                Open a course to start mapping a framework.
            </span>
        </div>
    </div>
</template>
