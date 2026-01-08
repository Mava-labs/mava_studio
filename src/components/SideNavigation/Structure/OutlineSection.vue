<template>
  <section class="flex-1 min-h-0 flex flex-col">
    <header class="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-2">
        <span>Outline</span>
        <span v-if="activePage" class="text-[10px] font-normal text-slate-500 dark:text-slate-500 truncate max-w-[140px]">{{ activePage.metadata.title }}</span>
      </div>
      <div class="flex items-center gap-1 text-slate-500 dark:text-slate-400">
        <button type="button" class="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700" :class="autoReveal ? 'text-blue-600 dark:text-blue-300' : ''" title="Auto reveal" @click="setAutoReveal(!autoReveal)">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 3a5 5 0 00-5 5h1.5A3.5 3.5 0 018 4.5V3zm0 10a5 5 0 005-5h-1.5A3.5 3.5 0 018 11.5V13z" />
            <path d="M3 8a5 5 0 015-5V1a7 7 0 00-7 7h2zm5 5a5 5 0 01-5-5H1a7 7 0 007 7v-2zm0-12a5 5 0 015 5h2a7 7 0 00-7-7v2zm5 5a5 5 0 01-5 5v2a7 7 0 007-7h-2z" />
          </svg>
        </button>
        <button type="button" class="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700" title="Expand all" @click="expandAllOutline">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M2 3h12v2H2V3zm0 4h8v2H2V7zm0 4h4v2H2v-2z" />
          </svg>
        </button>
        <button type="button" class="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700" :title="outlineCollapsed ? 'Expand' : 'Collapse'" @click="toggleOutlineCollapsed">
          <svg class="w-3.5 h-3.5 transition-transform" :class="outlineCollapsed ? '-rotate-90' : ''" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M4 6l4 4 4-4H4z" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="outlineCollapsed" class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Collapsed</div>
    <div v-else class="flex-1 min-h-0 overflow-auto thin-scroll px-2 py-2">
      <div v-if="!activePage" class="text-xs text-slate-500 dark:text-slate-400 px-2">Select a page to see its outline.</div>
      <div v-else>
        <div v-if="flatOutline.length === 0" class="text-xs text-slate-500 dark:text-slate-400 px-2">No elements on this page yet.</div>
        <ul v-else class="space-y-0.5">
          <li v-for="item in flatOutline" :key="item.node.element.id">
            <div class="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70" :class="item.node.element.id === selectedElementId ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800' : ''">
              <div class="flex items-center" :style="{ width: `${item.depth * 12}px` }"></div>
              <button v-if="item.hasChildren" type="button" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600" title="Toggle children" @click="toggleElement(item.node.element.id)">
                <svg class="w-3 h-3 transition-transform" :class="expandedElements.has(item.node.element.id) ? 'rotate-90' : ''" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M6 4l4 4-4 4V4z" />
                </svg>
              </button>
              <div v-else class="w-3 h-3" />
              <button type="button" class="flex items-center gap-2 flex-1 text-left" @click="selectElement(item.node.element.id)">
                <svg class="w-4 h-4 text-slate-600 dark:text-slate-200" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path :d="elementIconPath(item.node.element.type, item.hasChildren)" />
                </svg>
                <span class="truncate">{{ item.node.element.name || formatElementLabel(item.node.element.type) }}</span>
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts" vapor>
import type { ElementType } from "../../../types/element";
import type { OutlineRow } from "./useStructureModel";
import type { Page } from "../../../types/project";

const props = defineProps<{
  activePage: Page | null;
  flatOutline: OutlineRow[];
  expandedElements: Set<string>;
  selectedElementId: string | null;
  outlineCollapsed: boolean;
  autoReveal: boolean;
  toggleElement: (id: string) => void;
  selectElement: (id: string) => void;
  expandAllOutline: () => void;
  toggleOutlineCollapsed: () => void;
  elementIconPath: (type: ElementType, hasChildren: boolean) => string;
  formatElementLabel: (type: ElementType) => string;
  setAutoReveal: (value: boolean) => void;
}>();
</script>
