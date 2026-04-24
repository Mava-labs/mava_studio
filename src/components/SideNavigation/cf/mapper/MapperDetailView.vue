<script setup lang="ts" vapor>
// mava-studio/components/cf/mapper/MapperDetailView.vue
// CF detail page — shown after clicking a card from browse or installed list.
// Layout mirrors VS Code extension detail: header, action buttons, domain tree preview.

import { computed } from 'vue'
import { useCfMapperStore } from '../../../../stores/useCfMapperStore'
import { useCfStore } from '../../../../stores/useCfStore'

const mapper = useCfMapperStore()
const cfStore = useCfStore()

const card = computed(() => mapper.detailCard)
const frameworkId = computed(() => mapper.selectedFrameworkId ?? '')

const isInstalled = computed(() =>
  !!cfStore.frameworks[frameworkId.value]
)

const installedVersion = computed(() =>
  cfStore.frameworks[frameworkId.value]?.alignment.framework_version
)

const canInstall = computed(() =>
  !isInstalled.value && !mapper.isInstalling
)

function install() {
  mapper.installFromRegistry(frameworkId.value)
}

function openInstalled() {
  mapper.openInstalledView(frameworkId.value)
}

function disable() {
  mapper.disableFramework(frameworkId.value)
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- Loading skeleton -->
    <div v-if="mapper.isLoadingDetail" class="px-4 py-4 space-y-3">
      <div class="h-6 w-48 bg-surface-3 rounded animate-pulse" />
      <div class="h-4 w-32 bg-surface-3 rounded animate-pulse" />
      <div class="h-16 bg-surface-3 rounded animate-pulse" />
    </div>

    <template v-else-if="card">
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        <!-- Header -->
        <div class="space-y-1">
          <h2 class="text-sm font-semibold text-primary leading-snug">
            {{ card.title }}
          </h2>
          <p class="text-[11px] text-muted">
            {{ card.publisher }}
            <span v-if="card.institution"> · {{ card.institution }}</span>
            <span> · v{{ card.version }}</span>
          </p>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-if="canInstall"
            class="text-xs px-4 py-1.5 rounded-input font-medium
                   bg-accent text-white
                   hover:bg-accent-hover
                   transition-colors duration-fast"
            :disabled="mapper.isInstalling"
            @click="install"
          >
            {{ mapper.isInstalling ? 'Installing…' : 'Install' }}
          </button>

          <template v-if="isInstalled">
            <button
              class="text-xs px-4 py-1.5 rounded-input font-medium
                     bg-accent-soft text-accent 
                     border border-accent
                     hover:bg-accent hover:text-white
                     transition-colors duration-fast"
              @click="openInstalled"
            >
              Open reference
            </button>
            <button
              class="text-xs px-3 py-1.5 rounded-input
                     bg-surface-3 text-muted
                     hover:bg-surface-4 hover:text-status-conflict-fg
                     transition-colors duration-fast"
              @click="disable"
            >
              Disable
            </button>
            <span class="text-[10px] text-status-complete-fg">
              ✓ Installed {{ installedVersion }}
            </span>
          </template>

          <button
            class="text-xs px-3 py-1.5 rounded-input
                   bg-surface-3 text-muted
                   hover:bg-surface-4
                   transition-colors duration-fast"
            @click="mapper.loadFromDisk"
          >
            Load local version
          </button>
        </div>

        <!-- Install error -->
        <p
          v-if="mapper.installError"
          class="text-[11px] text-status-conflict-fg"
        >
          {{ mapper.installError }}
        </p>

        <!-- Description -->
        <div class="space-y-1">
          <p class="text-[10px] uppercase tracking-widest text-muted">
            About
          </p>
          <p class="text-xs text-secondary leading-relaxed">
            {{ card.description }}
          </p>
        </div>

        <!-- Details grid -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
          <div v-for="item in [
            { label: 'Version',      value: card.version },
            { label: 'Domains',      value: String(card.domain_count) },
            { label: 'Competencies', value: String(card.competency_count) },
            { label: 'Bloom range',  value: `${card.bloom_range.min} → ${card.bloom_range.max}` },
            { label: 'Locale',       value: card.locale ?? '—' },
            { label: 'License',      value: card.license ?? '—' },
            { label: 'Offline',      value: card.requires_offline ? 'Required' : 'Optional' },
            { label: 'Downloads',    value: String(card.downloads) },
          ]" :key="item.label">
            <p class="text-[10px] text-muted">{{ item.label }}</p>
            <p class="text-[11px] text-secondary">{{ item.value }}</p>
          </div>
        </div>

        <!-- Evidence types demanded -->
        <div v-if="card.required_evidence_types?.length" class="space-y-1.5">
          <p class="text-[10px] uppercase tracking-widest text-muted">
            Required evidence types
          </p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="et in card.required_evidence_types"
              :key="et"
              class="text-[10px] px-2 py-0.5 rounded-full
                     bg-surface-3 text-secondary
                     border border-border"
            >
              {{ et.replace(/_/g, ' ') }}
            </span>
          </div>
        </div>

        <!-- Domain preview -->
        <div v-if="card.domains?.length" class="space-y-1.5">
          <p class="text-[10px] uppercase tracking-widest text-muted">
            Domains
          </p>
          <div class="space-y-1">
            <div
              v-for="domain in card.domains"
              :key="domain.id"
              class="flex items-center justify-between px-2.5 py-2
                     rounded-input bg-surface-3"
            >
              <span class="text-[11px] text-secondary">
                {{ domain.name }}
              </span>
              <span class="text-[10px] text-muted">
                {{ domain.competency_count }} competencies
              </span>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="card.tags?.length" class="space-y-1.5">
          <p class="text-[10px] uppercase tracking-widest text-muted">Tags</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="tag in card.tags"
              :key="tag"
              class="text-[9px] px-1.5 py-0.5 rounded-full
                     bg-surface-4 text-muted"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Changelog -->
        <div v-if="card.changelog" class="space-y-1.5">
          <p class="text-[10px] uppercase tracking-widest text-muted">
            Changelog
          </p>
          <p class="text-[11px] text-secondary leading-relaxed">
            {{ card.changelog }}
          </p>
        </div>

      </div>
    </template>

    <!-- No detail available -->
    <div
      v-else
      class="flex items-center justify-center h-full
             text-sm text-muted"
    >
      Framework details unavailable
    </div>
  </div>
</template>
