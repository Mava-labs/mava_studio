<template>
  <div class="p-3 space-y-3 text-sm text-slate-800 dark:text-slate-100">
    <h3 class="font-semibold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Add Elements</h3>
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="el in elementTypes"
        :key="el.type"
        type="button"
        class="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-xs cursor-not-allowed opacity-70"
        disabled
      >
        {{ el.label }}
      </button>
    </div>
    <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
      Disabled stub. Hook createElementOfType once project store is ported.
    </p>
  </div>
</template>

<script setup lang="ts" vapor>
const elementTypes = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'ellipse', label: 'Circle' },
  { type: 'line', label: 'Line' },
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'hotspot', label: 'Hotspot' },
  { type: 'collection', label: 'Collection' },
];
</script>
