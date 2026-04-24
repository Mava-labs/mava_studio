<script setup lang="ts" vapor>
// mava-studio/components/cf/mapper/MapperBrowseView.vue
// Marketplace grid — shown when no CFs are imported yet, or via "+ Add framework".

import { ref, onMounted } from 'vue'
import { useCfMapperStore } from '../../../../stores/useCfMapperStore'

const mapper = useCfMapperStore()
const localQuery = ref('')

let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => mapper.search(localQuery.value), 300)
}

onMounted(() => {
  if (!mapper.searchResults.length) mapper.search('')
})

const BLOOM_COLOUR: Record<string, string> = {
  Remember: 'text-muted',
  Understand: 'text-muted',
  Apply: 'text-[var(--color-status-progress-fg)]',
  Analyse: 'text-[var(--color-status-sketched-fg)]',
  Judge: 'text-[var(--color-status-review-fg)]',
  Create: 'text-[var(--color-status-complete-fg)]',
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- Search bar + load from disk -->
    <div class="px-3 py-2.5 space-y-2 shrink-0 border-b border-border-soft">
      <div class="relative">
        <input
          v-model="localQuery"
          placeholder="Search frameworks…"
          class="w-full bg-surface-3 text-xs
                 text-primary px-3 py-2 pl-7
                 rounded-input border border-border
                 placeholder:text-muted
                 focus:border-accent outline-none
                 transition-colors duration-fast"
          @input="onSearchInput"
        />
        <span class="absolute left-2.5 top-2 text-muted text-[10px]">🔍</span>
      </div>

      <button
        class="w-full flex items-center justify-center gap-1.5 text-[11px]
               text-muted hover:text-secondary
               py-1.5 rounded-input border border-dashed
               border-border hover:border-surface-4
               transition-all duration-fast"
        :disabled="mapper.isInstalling"
        @click="mapper.loadFromDisk"
      >
        <span>📂</span>
        {{ mapper.isInstalling ? 'Loading…' : 'Load from disk (.json)' }}
      </button>

      <!-- Install error -->
      <p
        v-if="mapper.installError"
        class="text-[10px] text-status-conflict-fg px-1"
      >
        {{ mapper.installError }}
      </p>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-2">

      <!-- Loading skeleton -->
      <div v-if="mapper.isSearching" class="space-y-2">
        <div
          v-for="i in 3"
          :key="i"
          class="h-20 rounded-card bg-surface-3 animate-pulse"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!mapper.enrichedResults.length"
        class="text-center py-12"
      >
        <p class="text-sm text-muted">No frameworks found</p>
        <p class="text-[11px] text-muted mt-1">
          Try a different search or load from disk
        </p>
      </div>

      <!-- CF cards -->
      <button
        v-for="card in mapper.enrichedResults"
        :key="card.framework_id"
        class="w-full text-left rounded-card border
               bg-surface-3 hover:bg-surface-4
               transition-all duration-fast overflow-hidden"
        :class="card.installed_version
          ? 'border-accent'
          : 'border-border hover:border-surface-4'"
        @click="mapper.openDetail(card.framework_id)"
      >
        <div class="px-3 py-2.5 space-y-1.5">

          <!-- Title row -->
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs font-semibold text-primary leading-snug">
              {{ card.title }}
            </p>
            <span
              v-if="card.installed_version"
              class="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full
                     bg-status-complete text-status-complete-fg
                     font-medium"
            >
              Installed
            </span>
          </div>

          <!-- Publisher -->
          <p class="text-[10px] text-muted">
            {{ card.publisher }}
            <span v-if="card.institution"> · {{ card.institution }}</span>
          </p>

          <!-- Description -->
          <p class="text-[11px] text-secondary line-clamp-2 leading-snug">
            {{ card.description }}
          </p>

          <!-- Meta row -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] text-muted">
              v{{ card.version }}
            </span>
            <span class="text-border-soft">·</span>
            <span class="text-[10px] text-muted">
              {{ card.domain_count }} domains
            </span>
            <span class="text-border-soft">·</span>
            <span class="text-[10px] text-muted">
              {{ card.competency_count }} competencies
            </span>
            <span class="text-border-soft">·</span>
            <span
              class="text-[10px] font-medium"
              :class="BLOOM_COLOUR[card.bloom_range.max] ?? 'text-muted'"
            >
              up to {{ card.bloom_range.max }}
            </span>
          </div>

          <!-- Tags -->
          <div class="flex flex-wrap gap-1">
            <span
              v-for="tag in card.tags.slice(0, 4)"
              :key="tag"
              class="text-[9px] px-1.5 py-0.5 rounded-full
                     bg-surface-4 text-muted"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </button>

      <!-- Registry note -->
      <p class="text-[10px] text-muted text-center pt-2 pb-4">
        Showing local registry. Online registry coming soon.
      </p>
    </div>
  </div>
</template>
