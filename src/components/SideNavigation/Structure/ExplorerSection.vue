<template>
  <section class="border-b border-slate-200 dark:border-slate-700">
    <header class="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-500 dark:text-slate-400">
      <div class="flex items-center gap-2 truncate">
        <span>Explorer</span>
        <span class="text-[10px] font-normal text-slate-500 dark:text-slate-500 truncate max-w-[140px]">{{ projectLabel }}</span>
      </div>
      <div class="flex items-center gap-1 text-slate-500 dark:text-slate-400">
        <button type="button" class="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700" title="Collapse all" @click="collapseAllExplorer">
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M13 5H3v2h10V5zm0 4H3v2h10V9z" />
          </svg>
        </button>
        <button type="button" class="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700" :title="explorerCollapsed ? 'Expand' : 'Collapse'" @click="toggleExplorerCollapsed">
          <svg class="w-3.5 h-3.5 transition-transform" :class="explorerCollapsed ? '-rotate-90' : ''" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M4 6l4 4 4-4H4z" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="explorerCollapsed" class="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400">Collapsed</div>
    <div v-else class="max-h-[52vh] overflow-auto thin-scroll pb-3">
      <div class="space-y-1">
        <div class="px-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspace</div>
        <div class="px-2">
          <div class="flex items-center gap-2 py-1.5 px-2 rounded cursor-default bg-slate-100 dark:bg-slate-800/70">
            <svg class="w-4 h-4 text-slate-600 dark:text-slate-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M2 5.5A1.5 1.5 0 013.5 4h3l1 1h9A1.5 1.5 0 0118 6.5v9A1.5 1.5 0 0116.5 17h-13A1.5 1.5 0 012 15.5v-10z" />
            </svg>
            <span class="font-medium text-sm truncate">{{ projectLabel }}</span>
          </div>
          <ul class="mt-1 space-y-0.5">
            <li v-for="module in props.modules" :key="module.id">
              <div class="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70" :class="module.id === props.activePath?.moduleId ? 'bg-slate-200 dark:bg-slate-700' : ''">
                <button type="button" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600" title="Toggle module" @click="toggleModule(module.id)">
                  <svg class="w-3 h-3 transition-transform" :class="isModuleExpanded(module.id) ? 'rotate-90' : ''" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M6 4l4 4-4 4V4z" />
                  </svg>
                </button>
                <button type="button" class="flex items-center gap-2 flex-1 text-left" @click="props.selectModule(module)">
                  <svg class="w-4 h-4 text-amber-600 dark:text-amber-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path v-if="props.isModuleExpanded(module.id)" d="M3 5h5l1 1h8v8.5A1.5 1.5 0 0115.5 16h-11A1.5 1.5 0 013 14.5V5z" />
                    <path v-else d="M3 6h6l1-1h7.5A1.5 1.5 0 0119 6.5V14a1 1 0 01-1 1H3.5A1.5 1.5 0 012 13.5V7a1 1 0 011-1z" />
                  </svg>
                  <span class="text-sm truncate">{{ module.metadata.title || 'Untitled module' }}</span>
                </button>
              </div>
              <ul v-if="props.isModuleExpanded(module.id)" class="ml-5 border-l border-slate-200 dark:border-slate-700">
                <li v-for="lesson in props.lessonsForModule(module.id)" :key="lesson.id">
                  <div class="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70" :class="lesson.id === props.activePath?.lessonId ? 'bg-slate-200 dark:bg-slate-700' : ''">
                    <button type="button" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600" title="Toggle lesson" @click="props.toggleLesson(lesson.id)">
                      <svg class="w-3 h-3 transition-transform" :class="props.isLessonExpanded(lesson.id) ? 'rotate-90' : ''" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M6 4l4 4-4 4V4z" />
                      </svg>
                    </button>
                    <button type="button" class="flex items-center gap-2 flex-1 text-left" @click="props.selectLesson(module.id, lesson)">
                      <svg class="w-4 h-4 text-blue-600 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M4 4h12a1 1 0 011 1v10l-4-3-4 3-4-3-2 1.5V5a1 1 0 011-1z" />
                      </svg>
                      <span class="text-sm truncate">{{ lesson.metadata.title || 'Lesson' }}</span>
                    </button>
                  </div>
                  <ul v-if="props.isLessonExpanded(lesson.id)" class="ml-5 border-l border-slate-200 dark:border-slate-700">
                    <li v-for="page in props.pagesForLesson(lesson.id)" :key="page.id">
                      <button type="button" class="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70" :class="page.id === props.activePath?.pageId ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800' : ''" @click="props.selectPage(module.id, lesson.id, page)">
                        <svg class="w-4 h-4 text-slate-600 dark:text-slate-200" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M4.5 3A1.5 1.5 0 003 4.5v11A1.5 1.5 0 004.5 17h8.75A1.75 1.75 0 0015 15.25V6.5L11.5 3H4.5z" />
                        </svg>
                        <span class="text-sm truncate">{{ page.metadata.title || 'Page' }}</span>
                      </button>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
          <p v-if="props.modules.length === 0" class="mt-2 text-xs text-slate-500 dark:text-slate-400">No modules yet.</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts" vapor>
import type { Lesson, Module, Page } from "../../../types/project";

const props = defineProps<{
  projectLabel: string;
  modules: Module[];
  activePath: { moduleId: string; lessonId: string; pageId: string } | null;
  explorerCollapsed: boolean;
  isModuleExpanded: (id: string) => boolean;
  isLessonExpanded: (id: string) => boolean;
  toggleExplorerCollapsed: () => void;
  collapseAllExplorer: () => void;
  toggleModule: (id: string) => void;
  toggleLesson: (id: string) => void;
  selectModule: (module: Module) => void;
  selectLesson: (moduleId: string, lesson: Lesson) => void;
  selectPage: (moduleId: string, lessonId: string, page: Page) => void;
  lessonsForModule: (moduleId: string) => Lesson[];
  pagesForLesson: (lessonId: string) => Page[];
}>();
</script>
