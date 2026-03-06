<template>
  <div class="absolute top-4 right-4 z-10 rounded bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 shadow px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
    <p class="font-semibold text-slate-800 dark:text-slate-100">Global Palette</p>
    <p class="text-[11px] text-slate-500 dark:text-slate-400">Hook palette actions here.</p>
    <p>{{ layoutStore.activeRightUtil }}</p>
  </div>
</template>

<script setup lang="ts" vapor>
    import { useLayoutStore } from '../stores/layout';
    const layoutStore = useLayoutStore();
// Placeholder palette overlay.
</script>
