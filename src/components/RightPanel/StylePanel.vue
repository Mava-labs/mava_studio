<template>
  <div v-if="!element" class="panel-root flex-1 min-h-0 overflow-hidden">
    <div class="px-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <label class="element-header" for="device-select">Device</label>
      <select
        id="device-select"
        class="w-full mb-3 bg-slate-900 border border-slate-600 text-slate-100 text-xs p-2 rounded"
      >
        <!-- <option value="" :selected="!anyDeviceMatch">Custom size</option>
        <optgroup v-for="([cat, grp], idx) in profileEntries" :key="cat + idx" :label="grp.label">
          <option
            v-for="it in grp.items"
            :key="it.id"
            :value="`${cat}:${it.id}`"
            :selected="matches(it.w, it.h)"
          >
            {{ `${it.label} — ${it.w}×${it.h}` }}
          </option>
        </optgroup> -->
      </select>

    </div>
  </div>

  <div v-else-if="element" class="panel-root flex-1 min-h-0 overflow-hidden">
    <div class="border-b border-slate-300 dark:border-slate-600 mb-2 px-3">
      <UnifiedToolbar mode="multiselect" :singleStageAlign="true" placement="panel" />
    </div>

    <div class="element-header flex justify-between items-center px-3">
      <button
        ref="elementNameRef"
        aria-label="Edit element name"
        tabindex="0"
        aria-pressed="true"
        class="w-[60%] border-b border-dashed text-left"
      >
        {{ element.name }}
      </button>
      <div class="flex gap-2">
        <svg
          v-if="element.layout.locked"
          role="button"
          tabindex="0"
          aria-label="Unlock element"
          aria-pressed="true"
          class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            fill-rule="evenodd"
            d="M8 10V7a4 4 0 1 1 8 0v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2-3a2 2 0 1 1 4 0v3h-4V7Zm2 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
            clip-rule="evenodd"
          />
        </svg>
        <svg
          v-else
          role="button"
          tabindex="0"
          aria-label="Unlock element"
          aria-pressed="true"
          class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            fill-rule="evenodd"
            d="M15 7a2 2 0 1 1 4 0v4a1 1 0 1 0 2 0V7a4 4 0 0 0-8 0v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2V7Zm-5 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
            clip-rule="evenodd"
          />
        </svg>

        <svg
          v-if="element.layout.visible"
          role="button"
          tabindex="0"
          aria-label="Unlock element"
          aria-pressed="true"
          class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path stroke="currentColor" stroke-width="2" d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z" />
          <path stroke="currentColor" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        <svg
          v-else
          role="button"
          tabindex="0"
          aria-label="Unlock element"
          aria-pressed="true"
          class="w-4 h-4 cursor-pointer outline-0 text-gray-800 dark:text-white"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3.933 13.909A4.357 4.357 0 0 1 3 12c0-1 4-6 9-6m7.6 3.8A5.068 5.068 0 0 1 21 12c0 1-3 6-9 6-.314 0-.62-.014-.918-.04M5 19 19 5m-4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </div>
    </div>

   
  </div>

  <div v-else class="text-xs text-slate-500">Nothing selected.</div>
</template>

<script setup lang="ts" vapor>
import { computed } from 'vue';
import type { Element } from '../../types/element';
import { usePagesStore } from '../../stores/pages';
import { useElementStore } from '../../stores/element';
import UnifiedToolbar from './UnifiedToolbar.vue';

const pages = usePagesStore();
const elements = useElementStore();

const element = computed<Element | null>(() => {
    return pages.getElementById(elements.activeElementId!)
});

type DeviceItem = { id: string; label: string; w: number; h: number };
const deviceProfiles: Record<string, { label: string; items: DeviceItem[] }> = {
  mobile: {
    label: 'Mobile',
    items: [
      { id: 'iphone-13', label: 'iPhone 13', w: 390, h: 844 },
      { id: 'iphone-se-2', label: 'iPhone SE (2nd gen)', w: 375, h: 667 },
      { id: 'pixel-7', label: 'Pixel 7', w: 412, h: 915 }
    ]
  },
  tablet: {
    label: 'Tablet',
    items: [
      { id: 'ipad-portrait', label: 'iPad (P)', w: 768, h: 1024 },
      { id: 'ipad-landscape', label: 'iPad (L)', w: 1024, h: 768 }
    ]
  },
  laptop: {
    label: 'Laptop',
    items: [
      { id: 'macbook-13', label: '13" MacBook', w: 1280, h: 800 },
      { id: 'hd-1366', label: 'HD 1366×768', w: 1366, h: 768 },
      { id: 'fhd-1536', label: 'FHD (scaled 1536×864)', w: 1536, h: 864 }
    ]
  },
  desktop: {
    label: 'Desktop',
    items: [
      { id: 'fhd', label: 'FHD 1920×1080', w: 1920, h: 1080 },
      { id: 'wqhd', label: 'WQHD 2560×1440', w: 2560, h: 1440 }
    ]
  }
};

const profileEntries = computed(() => Object.entries(deviceProfiles));

</script>

<style scoped>
.panel-root { font-family: system-ui, sans-serif; display: flex; flex-direction: column; gap: 12px; font-size: 12px; }
.element-header { font-weight: 600; font-size: 13px; }
.section { margin-bottom: 1rem; }
.section-title { font-size: 11px; text-transform: capitalize; letter-spacing: .05em; margin-bottom: 6px; }
</style>
