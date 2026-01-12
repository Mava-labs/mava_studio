<template>
  <div class="p-3 space-y-3 text-sm text-slate-800 dark:text-slate-100">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Add Elements</h3>
      <span class="text-[11px] text-slate-500 dark:text-slate-400" v-if="!pages.activePageId">Select a page</span>
      <span class="text-[11px] text-emerald-500" v-else>Ready</span>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="el in elementTypes"
        :key="el.type"
        type="button"
        class="border border-slate-300 dark:border-slate-600 rounded px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-xs transition"
        :class="[!pages.activePageId || isWorking ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer shadow-sm hover:-translate-y-0.5']"
        :disabled="!pages.activePageId || isWorking"
        @click="() => addElement(el.type)"
      >
        <div class="flex flex-col gap-0.5">
          <span class="font-semibold">{{ el.label }}</span>
          <span class="text-[11px] text-slate-500 dark:text-slate-400" v-if="el.hint">{{ el.hint }}</span>
        </div>
      </button>
    </div>

    <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
      Elements drop onto the center of the active page. You can reposition them afterwards.
    </p>
  </div>
</template>

<script setup lang="ts" vapor>
import { ref } from "vue";
import { usePagesStore } from "../../stores/pages";
import { useNotificationStore } from "../../stores/notification";
import type { ElementType } from "../../types/element";

const pages = usePagesStore();
const notifications = useNotificationStore();
const isWorking = ref(false);

const elementTypes: { type: ElementType; label: string; hint?: string }[] = [
  { type: 'rectangle', label: 'Rectangle', hint: 'Solid block' },
  { type: 'ellipse', label: 'Ellipse', hint: 'Soft shape' },
  { type: 'line', label: 'Line', hint: 'Divider / stroke' },
  { type: 'text', label: 'Text', hint: 'Heading or body' },
  { type: 'image', label: 'Image', hint: 'Upload later' },
  { type: 'hotspot', label: 'Hotspot', hint: 'Invisible click area' },
  { type: 'collection', label: 'Collection', hint: 'Container for children' },
];

async function addElement(type: ElementType) {
  if (isWorking.value) return;
  if (!pages.activePageId) {
    notifications.addNotification('Pick a page first, then add elements.', { type: 'warn', ttl: 3500 });
    return;
  }

  isWorking.value = true;
  try {
    const created = await pages.insertElement(type);
    if (!created) return;
    notifications.addNotification(`${created.name} added to the page.`, { type: 'info', ttl: 2000 });
  } catch (error) {
    console.error(error);
    notifications.addNotification('Could not add the element.', { type: 'error', ttl: 5000 });
  } finally {
    isWorking.value = false;
  }
}
</script>
