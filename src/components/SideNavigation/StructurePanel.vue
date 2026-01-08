<template>
  <div class="h-full min-h-0 flex flex-col bg-slate-50 dark:bg-slate-900/70 text-sm text-slate-800 dark:text-slate-100">
    <!-- <ExplorerSection
      :project-label="projectLabel"
      :modules="modules"
      :active-path="project.activePath"
      :explorer-collapsed="explorerCollapsed"
      :is-module-expanded="isModuleExpanded"
      :is-lesson-expanded="isLessonExpanded"
      :toggle-explorer-collapsed="toggleExplorerCollapsed"
      :collapse-all-explorer="collapseAllExplorer"
      :toggle-module="toggleModule"
      :toggle-lesson="toggleLesson"
      :select-module="selectModule"
      :select-lesson="selectLesson"
      :select-page="selectPage"
      :lessons-for-module="lessonsForModule"
      :pages-for-lesson="pagesForLesson"
    /> -->

    <OutlineSection
      :active-page="activePage"
      :flat-outline="flatOutline"
      :expanded-elements="expandedElements"
      :selected-element-id="selectedElementId"
      :outline-collapsed="outlineCollapsed"
      :auto-reveal="autoReveal"
      :toggle-element="toggleElement"
      :select-element="selectElement"
      :expand-all-outline="expandAllOutline"
      :toggle-outline-collapsed="toggleOutlineCollapsed"
      :element-icon-path="elementIconPath"
      :format-element-label="formatElementLabel"
      :set-auto-reveal="setAutoReveal"
    />
  </div>
</template>

<script setup lang="ts" vapor>
import ExplorerSection from "./Structure/ExplorerSection.vue";
import OutlineSection from "./Structure/OutlineSection.vue";
import { useStructureModel } from "./Structure/useStructureModel";

const {
  project,
  projectLabel,
  modules,
  activePage,
  flatOutline,
  explorerCollapsed,
  outlineCollapsed,
  autoReveal,
  expandedElements,
  selectedElementId,
  isModuleExpanded,
  isLessonExpanded,
  toggleModule,
  toggleLesson,
  toggleElement,
  collapseAllExplorer,
  expandAllOutline,
  selectModule,
  selectLesson,
  selectPage,
  selectElement,
  toggleExplorerCollapsed,
  toggleOutlineCollapsed,
  formatElementLabel,
  elementIconPath,
  lessonsForModule,
  pagesForLesson,
  setAutoReveal,
} = useStructureModel();
</script>
