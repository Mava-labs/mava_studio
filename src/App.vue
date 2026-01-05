<template>
    <div class="h-screen bg-gray-100 select-none dark:bg-slate-950 grid grid-cols-none overflow-hidden grid-rows-[min-content_1fr] text-gray-950 dark:text-gray-200">
        <header class="max-h-12">
            <AppHeader/>
        </header>
        <section class="h-full min-h-0 grid grid-rows-[1fr_min-content] relative">
            <main class="h-full min-h-0 grid grid-rows-none grid-cols-[min-content_1fr_min-content] relative">
                <!-- DebugPanel removed per user preference -->
                <nav class="bg-white dark:bg-slate-800 shadow-md h-full min-h-0 grid grid-rows-none grid-cols-[min-content_min-content]">
                    
                    <!-- Side navigation component -->
                    <SideNav/>

                    <!-- Nav Associates: hidden when none selected -->
                    <aside ref="asideElementRef" v-if="layout.activeSideNav" class="min-w-48 relative max-w-64 resize-x overflow-hidden  bg-slate-200 dark:bg-slate-700" :style="{ width: `${layout.asideWidth}px` }">
                        <div class="h-full overflow-auto">
                            <NavAssociates/>
                        </div>
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div 
                            class="absolute top-0 right-0 bottom-0 w-0.5 cursor-ew-resize bg-transparent hover:bg-slate-400 transition"
                            @pointerdown="(e) => startResize(e, 'aside')">
                        </div>
                    </aside>

                </nav>

                <section class="h-full min-h-0 overflow-auto relative">
                    <CreateMode v-if="stage.currentStage === 'create'"/>
                    <TemplateMode v-else-if="stage.currentStage === 'template'"/>
                    <EmptyProject v-else/>
                    <GlobalPalette/>

                    <!-- Terminal component -->
                    <div ref="terminalElementRef" id="terminal" class="absolute z-20 bottom-0 left-0 right-0 min-h-0.75 max-h-full resize-y overflow-auto bg-slate-950 border-slate-50 dark:border-slate-800 no-scroll overflow-y-auto" :class="layout.terminalState === 'closed' ? 'border-0' : 'border-t'" :style="{ height: `${layout.terminalState === 'closed' ? 3 : layout.terminalHeight}px` }">
                        <div 
                            class="absolute top-0 right-0 left-0 h-1 cursor-ns-resize bg-transparent hover:bg-slate-400 transition"
                            @pointerdown="(e) => startResize(e, 'terminal')">
                        </div>
                        <!-- TODO -->
                        <!-- <Terminal/> -->
                    </div>
                </section>
        
                <!-- Right pane utilities: hidden when none selected -->
                <section v-if="layout.activeRightUtil" class="h-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-700 text-white">
                    <div class="w-62 h-full min-h-0 flex flex-col">
                        <RightUtilities :active-right-util="layout.activeRightUtil"/>
                    </div>
                </section>
            </main>

            <!-- TODO: Footer -->
            <footer class="bg-white dark:bg-slate-800 shadow-md p-1 relative">
                <p class="text-sm text-gray-500 dark:text-gray-400">Footer content</p>
            </footer>
        </section>
    </div>
</template>

<script setup lang="ts" vapor>
    // TODO: implement terminal component
    // Monaco CSS: let Vite resolve from node_modules (works with vite-plugin-monaco-editor)
    // import 'monaco-editor/min/vs/editor/editor.main.css';
    // Monaco worker environment for Vite/Tauri
    // import '../Terminal/monacoEnv';
    // import Terminal from '../Terminal/terminal.svelte';

import { defineAsyncComponent, onMounted, ref, shallowRef, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import SideNav from './components/SideNav.vue';
import NavAssociates from './components/NavAssociates.vue';
import RightUtilities from './components/RightUtilities.vue';

// TODO: Implementation to change to defineAsyncComponent in future when stabilized in vapor mode
// for lazy loading of modules. Delete direct imports below when lazy loading is supported
import CreateMode from './mods/createMode.vue';
import TemplateMode from './mods/templateMode.vue';
import EmptyProject from './mods/emptyProject.vue';

// DebugPanel removed per user preference
import GlobalPalette from './components/GlobalPalette.vue';

// import { currentModuleId, currentLessonId, currentPageId, deleteModule, deleteLesson, deletePage } from '../stores/project';
// import '../stores/timelineOrchestrator';
// import { undo, redo, setFocusScope, focusScope } from '../stores/historyScoped';
// Initialize persisted triggers and rebind on timeline creation
// import '../stores/triggersInit';

import { useLayoutStore } from './stores/layout';
import { useStageStore } from './stores/stage';

const layout = useLayoutStore();
const stage = useStageStore();

// TODO: Lazy loading implementation for stage components
//Uncomment when defineAsyncComponent is stable in vapor mode
// const stageComponent = shallowRef<any>(null)

// watch(
//   () => stage.currentStage,
//   async (s) => {
//     switch (s) {
//       case 'create':
//         stageComponent.value =
//           (await import('./mods/createMode.vue')).default
//         break

//       case 'template':
//         stageComponent.value =
//           (await import('./mods/templateMode.vue')).default
//         break

//       case 'animate':
//         stageComponent.value =
//           (await import('./mods/animateMode.vue')).default
//         break

//       default:
//         stageComponent.value =
//           (await import('./mods/emptyProject.vue')).default
//     }
//   },
//   { immediate: true }
// )


let asideEl = ref<HTMLElement | null>(null);
let terminalEl = ref<HTMLElement | null>(null);

let dragTarget: "aside" | "terminal" | null = null;

function startResize(e: PointerEvent, target: "aside" | "terminal") {
    e.preventDefault();
    dragTarget = target;

    // Prevent accidental text selection while dragging
    document.body.style.userSelect = "none";

    document.addEventListener("pointermove", handleResize);
    document.addEventListener("pointerup", stopResize);
}

function handleResize(e: PointerEvent) {
    if (dragTarget === "aside") {
        if (!asideEl.value) return;
        const newWidth = e.clientX - asideEl.value.getBoundingClientRect().left;
        if (newWidth >= 150 && newWidth <= 400) {
            layout.setAsideWidth(newWidth);
        }
    }
else if (dragTarget === "terminal") {
        if (!terminalEl) return;
        const containerBottom = window.innerHeight;
        const newHeight = containerBottom - e.clientY;
        // terminal state should change from closed if was closed so that the ui can adjust accordingly
        if (newHeight >= 3 && newHeight <= containerBottom - 50) {
            layout.setTerminalHeight(newHeight);
            if (layout.terminalState === 'closed') layout.openTerminal();
        } else if (newHeight < 3) {
            layout.setTerminalHeight(3); // Prevent it from going below minimum height
            layout.closeTerminal();
        }
    }
}

function stopResize() {
    dragTarget = null;
    document.body.style.userSelect = "";
    document.removeEventListener("pointermove", handleResize);
    document.removeEventListener("pointerup", stopResize);
}


onMounted(()=>{
    // Ensure initial element sizes reflect store values
    if (asideEl.value) asideEl.value.style.width = `${layout.asideWidth}px`;
    if (terminalEl.value) terminalEl.value.style.height = `${layout.terminalState === 'closed' ? 0 : layout.terminalHeight}px`;

    // Load autosaved project (if any)
    // TODO: implement project loading logic
    // historyManager.loadFromStorage();

    // Global undo/redo/delete shortcuts
    const onKey = (e: KeyboardEvent) => {
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
            return; // don't hijack text inputs
        }
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
        if (!ctrlOrCmd) return;
        const key = e.key.toLowerCase();
        // Redo: Ctrl+Shift+Z or Ctrl+Y
        if ((key === 'z' && e.shiftKey) || key === 'y') {
            e.preventDefault();
            // TODO: implement redo logic
            // redo();
            return;
        }
        // Undo: Ctrl+Z
        if (key === 'z') {
            e.preventDefault();
            // TODO: implement undo logic
            // undo();
            return;
        }

        // TODO: re-implement delete functionality if needed
        // Delete: Ctrl+Delete (Windows) — delete selected page, else lesson, else module
        // if (key === 'delete') {
        //     e.preventDefault();
        //     if ($currentPageId) {
        //         deletePage($currentPageId);
        //     } else if ($currentLessonId) {
        //         deleteLesson($currentLessonId);
        //     } else if ($currentModuleId) {
        //         deleteModule($currentModuleId);
        //     }
        //     return;
        // }
    };
    window.addEventListener('keydown', onKey, { capture: true });

    // Reactive focus scope derivation (simple heuristic)
    // const deriveScope = () => {
    //     if (layout.currentPageId) setFocusScope('page');
    //     else if (layout.currentLessonId) setFocusScope('lesson');
    //     else setFocusScope('module');
    // };
    // const unsub1 = currentPageId.subscribe(()=>deriveScope());
    // const unsub2 = currentLessonId.subscribe(()=>deriveScope());
    // const unsub3 = currentModuleId.subscribe(()=>deriveScope());
    // deriveScope();
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
})
</script>
