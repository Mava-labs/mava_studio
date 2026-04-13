<template>
    <div
        class="h-screen bg-gray-100 select-none dark:bg-slate-950 grid grid-cols-none overflow-hidden grid-rows-[min-content_1fr] text-gray-950 dark:text-gray-200">
        <header class="max-h-12">
            <AppHeader />
        </header>
        <section class="h-full min-h-0 grid grid-rows-[1fr_min-content] relative">
            <main class="h-full min-h-0 grid grid-rows-none grid-cols-[min-content_1fr_min-content] relative">
                <!-- DebugPanel removed per user preference -->
                <nav
                    class="bg-white dark:bg-slate-800 shadow-md h-full min-h-0 grid grid-rows-none grid-cols-[min-content_min-content]">

                    <!-- Side navigation component -->
                    <SideNav />

                    <!-- Nav Associates: hidden when none selected -->
                    <aside ref="asideEl" v-if="layout.activeSideNav"
                        class="min-w-48 relative max-w-64 resize-x overflow-hidden  bg-slate-200 dark:bg-slate-700"
                        :style="{ width: `${layout.asideWidth}px` }">
                        <div class="h-full overflow-auto">
                            <NavAssociates />
                        </div>
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div class="absolute top-0 right-0 bottom-0 w-0.5 cursor-ew-resize bg-transparent hover:bg-slate-400 transition"
                            @pointerdown="(e) => startResize(e, 'aside')">
                        </div>
                    </aside>

                </nav>

                <section class="h-full min-h-0 overflow-hidden relative">
                    <CreateMode v-if="stage.currentStage === 'create'" />
                    <TemplateMode v-else-if="stage.currentStage === 'template'" />
                    <EmptyProject v-else />
                    <!-- <GlobalPalette/> -->
                    <NotificationsTray />

                    <!-- Terminal component -->
                    <div ref="terminalEl" id="terminal"
                        class="absolute z-20 bottom-0 left-0 right-0 min-h-0.75 max-h-full resize-y overflow-auto bg-slate-950 border-slate-50 dark:border-slate-800 no-scroll overflow-y-auto"
                        :class="layout.terminalState === 'closed' ? 'border-0' : 'border-t'"
                        :style="{ height: `${terminalRenderHeight}px` }">
                        <div class="absolute z-30 -top-1 right-0 left-0 h-2 cursor-ns-resize touch-none transition"
                            :class="terminalResizeHandleClass"
                            @pointerdown="(e) => startResize(e, 'terminal')">
                        </div>
                        <TerminalPanel/>
                    </div>
                </section>

                <!-- Right pane utilities: hidden when none selected -->
                <section v-if="layout.activeRightUtil && stage.currentStage !== 'empty'"
                    class="h-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-700 text-white">
                    <div class="w-62 h-full min-h-0 flex flex-col">
                        <RightUtilities :active-right-util="layout.activeRightUtil" />
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

    import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
    import AppHeader from './components/AppHeader.vue';
    import SideNav from './components/SideNav.vue';
    import NavAssociates from './components/NavAssociates.vue';
    import RightUtilities from './components/RightUtilities.vue';
    import TerminalPanel from './components/Terminal/TerminalPanel.vue';
    import NotificationsTray from './components/NotificationsTray.vue';

    import CreateMode from './mods/createMode.vue';
    import TemplateMode from './mods/templateMode.vue';
    import EmptyProject from './mods/emptyProject.vue';

    import { useLayoutStore } from './stores/layout';
    import { useNotificationStore } from './stores/notification';
    import { useProjectMetadataStore } from './stores/projectMetadata';
    import { useStageStore } from './stores/stage';

    const layout = useLayoutStore();
    const notification = useNotificationStore();
    const stage = useStageStore();
    const project = useProjectMetadataStore();

    let asideEl = useTemplateRef('asideEl');
    let terminalEl = useTemplateRef('terminalEl');

    const dragTarget = ref<"aside" | "terminal" | null>(null);
    const terminalDragHeight = ref<number | null>(null);
    const isTerminalLocked = computed(() => stage.currentStage === 'empty' || !project.isProjectOpen);
    const terminalRenderHeight = computed(() => terminalDragHeight.value ?? (layout.terminalState === 'closed' ? 3 : layout.terminalHeight));
    const terminalResizeHandleClass = computed(() =>
        dragTarget.value === 'terminal' ? 'bg-slate-400/70' : 'bg-transparent hover:bg-slate-400/70'
    );

    watch(
        isTerminalLocked,
        (locked) => {
            layout.setTerminalLocked(locked);
        },
        { immediate: true }
    );

    function startResize(e: PointerEvent, target: "aside" | "terminal") {
        if (target === 'terminal' && isTerminalLocked.value) {
            notification.addNotification('Terminal is disabled until a project is open and not in empty mode.', {
                type: 'warn',
                ttl: 3000,
            });
            return;
        }
        e.preventDefault();
        dragTarget.value = target;

        if (target === 'terminal') {
            (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
        }

        // Prevent accidental text selection while dragging
        document.body.style.userSelect = "none";

        document.addEventListener("pointermove", handleResize);
        document.addEventListener("pointerup", stopResize);
    }

    function handleResize(e: PointerEvent) {
        if (dragTarget.value === "aside") {
            if (!asideEl.value) return;
            const newWidth = e.clientX - asideEl.value.getBoundingClientRect().left;
            if (newWidth >= 150 && newWidth <= 400) {
                layout.setAsideWidth(newWidth);
            }
        }
        else if (dragTarget.value === "terminal") {
            if (!terminalEl.value || isTerminalLocked.value) return;
            const hostRect = terminalEl.value.parentElement?.getBoundingClientRect();
            if (!hostRect) return;

            const containerBottom = hostRect.bottom;
            const maxHeight = Math.max(3, hostRect.height - 50);
            const newHeight = Math.max(3, Math.min(maxHeight, containerBottom - e.clientY));

            // Keep drag interaction 1:1 with pointer position and commit once on pointerup.
            terminalDragHeight.value = newHeight;

            if (newHeight > 3 && layout.terminalState === 'closed') {
                layout.openTerminal();
            }
        }
    }

    function stopResize() {
        const activeTarget = dragTarget.value;
        dragTarget.value = null;

        if (activeTarget === 'terminal' && terminalDragHeight.value !== null) {
            const finalHeight = terminalDragHeight.value;
            terminalDragHeight.value = null;

            if (finalHeight <= 3) {
                layout.setTerminalHeight(3);
                layout.closeTerminal();
            } else {
                layout.setTerminalHeight(finalHeight);
                if (layout.terminalState === 'closed') layout.openTerminal();
            }
        }

        document.body.style.userSelect = "";
        document.removeEventListener("pointermove", handleResize);
        document.removeEventListener("pointerup", stopResize);
    }


    onMounted(() => {
        // Ensure initial element sizes reflect store values
        if (asideEl.value) asideEl.value.style.width = `${layout.asideWidth}px`;
        if (terminalEl.value) terminalEl.value.style.height = `${layout.terminalState === 'closed' ? 0 : layout.terminalHeight}px`;

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

        return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
    })
</script>
