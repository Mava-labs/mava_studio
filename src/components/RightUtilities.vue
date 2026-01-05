<template>
  <section class="h-full min-h-0 w-full pt-3 overflow-hidden flex flex-col bg-slate-200 dark:bg-slate-900">
    <StylePanel v-if="activeRightUtil === 'styles'" />
    <DSLActionsPanel v-else-if="activeRightUtil === 'actions'" />
    
  </section>
</template>

<script setup lang="ts" vapor>
import { computed } from 'vue';
import DSLActionsPanel from './RightPanel/DSLActionsPanel.vue';
import StylePanel from './RightPanel/StylePanel.vue';

const props = defineProps<{
  activeRightUtil: string | null;
}>();

const activeRightUtil = computed(() => props.activeRightUtil);
</script>
