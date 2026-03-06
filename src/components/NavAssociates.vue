<template>
  <section class="h-full w-full">
    <StructurePanel v-if="layout.activeSideNav === 'structure'" />
    <ElementsPanel v-else-if="layout.activeSideNav === 'elements'" />
    <div v-else-if="layout.activeSideNav === 'components'" class="p-4 text-sm text-slate-800 dark:text-slate-100 space-y-1">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Components</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">Components panel placeholder.</p>
    </div>
    <div v-else-if="layout.activeSideNav === 'cf_map'" class="p-4 text-sm text-slate-800 dark:text-slate-100 space-y-1">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">CF Map</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">CF Map panel placeholder.</p>
    </div>
    <div v-else-if="layout.activeSideNav === 'assets'" class="p-4 text-sm text-slate-800 dark:text-slate-100 space-y-1">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Assets</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">Assets panel placeholder.</p>
    </div>
    <div v-else-if="layout.activeSideNav === 'inspector'" class="p-4 text-sm text-slate-800 dark:text-slate-100 space-y-1">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inspector</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">Inspector panel placeholder.</p>
    </div>
    <div v-else-if="layout.activeSideNav === 'animations'" class="p-4 text-sm text-slate-800 dark:text-slate-100 space-y-1">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Animations</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">Animations panel placeholder.</p>
    </div>
    <div v-else class="p-4 text-sm text-slate-800 dark:text-slate-100 space-y-2">
      <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Associates</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">No panel selected.</p>
    </div>
  </section>
</template>

<script setup lang="ts" vapor>
import StructurePanel from './SideNavigation/StructurePanel.vue';
import ElementsPanel from './SideNavigation/ElementsPanel.vue';
import { useLayoutStore } from '../stores/layout';

const layout = useLayoutStore();

</script>
