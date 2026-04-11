<template>
    <div class="bg-gray-100 dark:bg-slate-900 h-full flex items-center">
        <section class="flex justify-between flex-1 items-center">

            <!-- Left nav -->
            <nav class="shadow-md h-full flex justify-between">
                <ul class="flex space-x-4 p-4">

                    <!-- Project dropdown -->
                    <li class="relative">
                        <button type="button" id="project-nav-button"
                            class="flex items-center flex-col space-y-1 cursor-pointer" @click="toggleProjectMenu">
                            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
                                viewBox="0 0 24 24">
                                <path fill-rule="evenodd"
                                    d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 .087.586l2.977-7.937A1 1 0 0 1 6 10h12V9a2 2 0 0 0-2-2h-4.532l-1.9-2.28A2 2 0 0 0 8.032 4H4Zm2.693 8H6.5l-3 8H18l3-8H6.693Z"
                                    clip-rule="evenodd" />
                            </svg>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Project</span>
                        </button>

                        <div id="dropdown-project"
                            class="z-20 hidden absolute top-full left-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg w-52 dark:bg-gray-700">
                            <ul class="py-2 px-4 text-sm space-y-2">
                                <!-- Always available -->
                                <li>
                                    <button type="button" :disabled="lifecycle.isCreating.value" class="menu-item"
                                        @click="handleCreate">
                                        New project
                                    </button>
                                </li>
                                <li>
                                    <button type="button" :disabled="lifecycle.isOpening.value" class="menu-item"
                                        @click="handleOpen">
                                        Open project…
                                    </button>
                                </li>

                                <!-- Open Recent submenu -->
                                <li class="relative group">
                                    <button type="button" class="menu-item flex items-center justify-between w-full">
                                        Open recent
                                        <svg class="w-3 h-3 ml-2 text-gray-400" xmlns="http://www.w3.org/2000/svg"
                                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                    <!-- Submenu -->
                                    <div
                                        class="hidden group-hover:block absolute left-full top-0 ml-1 w-72 bg-white dark:bg-gray-700 rounded-lg shadow-lg z-30">
                                        <ul class="py-1 text-sm">
                                            <li v-if="recentProjects.length === 0">
                                                <span
                                                    class="block px-4 py-2 text-gray-400 dark:text-gray-500 text-xs">No
                                                    recent projects</span>
                                            </li>
                                            <li v-for="item in recentProjects" :key="item.projectId"
                                                class="group/item flex items-center">
                                                <button type="button"
                                                    class="flex-1 text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 truncate"
                                                    @click="handleOpenRecent(item.archivePath)">
                                                    <span class="block font-medium truncate">{{ item.projectName
                                                        }}</span>
                                                    <span class="block text-xs text-gray-400 truncate">{{
                                                        item.archivePath }}</span>
                                                </button>
                                                <button type="button"
                                                    class="hidden group-hover/item:flex items-center justify-center w-6 h-6 mr-2 text-gray-400 hover:text-red-500 shrink-0"
                                                    title="Remove from recent"
                                                    @click.stop="handleRemoveRecent(item.projectId)">
                                                    <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg"
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                </li>

                                <!-- Project-open-only section -->
                                <li class="border-t border-gray-100 dark:border-gray-600">
                                    <button type="button" :disabled="!project.isProjectOpen"
                                        class="menu-item flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none"
                                        @click="handleSave">
                                        Save
                                        <span class="text-xs text-gray-400 dark:text-gray-500 ml-4">Ctrl+S</span>
                                    </button>
                                </li>
                                <li>
                                    <button type="button"
                                        :disabled="!project.isProjectOpen || lifecycle.isSavingAs.value"
                                        class="menu-item disabled:opacity-40 disabled:pointer-events-none"
                                        @click="handleSaveAs">
                                        {{ lifecycle.isSavingAs.value ? 'Saving…' : 'Save as…' }}
                                    </button>
                                </li>
                                <li>
                                    <button type="button"
                                        :disabled="!project.isProjectOpen || lifecycle.isRevealing.value"
                                        class="menu-item disabled:opacity-40 disabled:pointer-events-none"
                                        @click="handleReveal">
                                        Reveal in Explorer
                                    </button>
                                </li>

                                <li class="border-t border-gray-100 dark:border-gray-600">
                                    <button type="button"
                                        :disabled="!project.isProjectOpen || lifecycle.isClosing.value"
                                        class="menu-item text-red-600 dark:text-red-400 disabled:opacity-40 disabled:pointer-events-none"
                                        @click="handleClose">
                                        {{ lifecycle.isClosing.value ? 'Closing…' : 'Close project' }}
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </li>

                    <!-- Publish -->
                    <li v-for="item in navFileItems" :key="item.name" class="cursor-pointer">
                        <button type="button" class="flex items-center flex-col space-y-1"
                            @click="() => handleFileNav(item.name)">
                            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
                                viewBox="0 0 24 24">
                                <g v-html="item.icon"></g>
                            </svg>
                            <span class="text-xs text-gray-500 dark:text-gray-400">{{ item.name }}</span>
                        </button>
                    </li>
                </ul>
            </nav>

            <!-- Project name centre -->
            <div class="text-sm text-gray-500 dark:text-gray-400 select-none">
                {{ project.projectName || '' }}
            </div>

            <!-- Right nav -->
            <nav class="flex items-center space-x-4">
                <ul class="flex space-x-4 pr-4">
                    <li v-for="item in navItems[0]" :key="item.name">
                        <button type="button" class="flex items-center flex-col space-y-1"
                            :class="project.isProjectOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'"
                            @click="() => (item.name === 'Scripts' ? openTerminal('scripts') : openTerminal('timeline'))">
                            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
                                viewBox="0 0 24 24">
                                <g v-html="item.icon"></g>
                            </svg>
                            <span class="text-xs text-gray-500 dark:text-gray-400">{{ item.name }}</span>
                        </button>
                    </li>
                </ul>

                <ul class="flex justify-around p-4 w-72">
                    <li v-for="item in navItems[1]" :key="item.name">
                        <button type="button" class="flex items-center flex-col space-y-1"
                            :class="project.isProjectOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'"
                            @click="() => toggleRightUtil(item)">
                            <svg class="w-6 h-6"
                                :class="(item.key ?? item.name.toLowerCase()) === layout.activeRightUtil ? 'text-gray-900 dark:text-white' : 'text-gray-500'"
                                aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                fill="currentColor" viewBox="0 0 24 24">
                                <g v-html="item.icon"></g>
                            </svg>
                            <span class="text-xs"
                                :class="(item.key ?? item.name.toLowerCase()) === layout.activeRightUtil ? 'text-gray-900 dark:text-white' : 'text-gray-500'">
                                {{ item.name }}
                            </span>
                        </button>
                    </li>

                    <!-- Context — stage switcher only -->
                    <li class="cursor-pointer relative">
                        <div class="flex items-center flex-col space-y-1" id="context-button">
                            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    d="M20 14h-2.722L11 20.278a5.511 5.511 0 0 1-.9.722H20a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1ZM9 3H4a1 1 0 0 0-1 1v13.5a3.5 3.5 0 1 0 7 0V4a1 1 0 0 0-1-1ZM6.5 18.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM19.132 7.9 15.6 4.368a1 1 0 0 0-1.414 0L12 6.55v9.9l7.132-7.132a1 1 0 0 0 0-1.418Z" />
                            </svg>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Context</span>
                        </div>
                        <div id="dropdown-context"
                            class="z-10 hidden absolute top-full right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-sm w-44 dark:bg-gray-700">
                            <ul class="py-1 text-sm">
                                <li>
                                    <button type="button" :disabled="!project.isProjectOpen"
                                        class="menu-item disabled:opacity-40 disabled:pointer-events-none"
                                        @click="() => chooseStage('create')">Create</button>
                                </li>
                                <li>
                                    <button type="button" :disabled="!project.isProjectOpen"
                                        class="menu-item disabled:opacity-40 disabled:pointer-events-none"
                                        @click="() => chooseStage('template')">Template</button>
                                </li>
                                <li>
                                    <button type="button" :disabled="!project.isProjectOpen"
                                        class="menu-item disabled:opacity-40 disabled:pointer-events-none"
                                        @click="() => chooseStage('animate')">Animate</button>
                                </li>
                            </ul>
                        </div>
                    </li>
                </ul>
            </nav>
        </section>
    </div>
</template>

<style scoped>
    @reference '../assets/main.css'
    .menu-item {
        @apply inline-flex w-full px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white;
    }
</style>

<script setup lang="ts" vapor>
    import { computed, onMounted, onBeforeUnmount } from 'vue';
    import { useLayoutStore, type RightUtilKey } from '../stores/layout';
    import { useStageStore, type StageKey } from '../stores/stage';
    import { useNotificationStore } from '../stores/notification';
    import { useProjectMetadataStore } from '../stores/projectMetadata';
    import { useProjectLifecycle } from '../composables/useProjectLifecycle';
    import { useTerminalStore } from '../stores/terminal';

    const layout = useLayoutStore();
    const notification = useNotificationStore();
    const stage = useStageStore();
    const project = useProjectMetadataStore();
    const lifecycle = useProjectLifecycle();
    const terminal = useTerminalStore();

    const recentProjects = computed(() => project.recentProjects);

    // ── Project menu ───────────────────────────────────────────────────────────

    function toggleProjectMenu() {
        const menu = document.getElementById('dropdown-project');
        if (!menu) return;
        const opening = menu.classList.contains('hidden');
        menu.classList.toggle('hidden');
        if (opening) setTimeout(() => document.addEventListener('click', onProjectOutside), 0);
    }

    const onProjectOutside = (e: Event) => {
        const t = e.target as HTMLElement;
        const menu = document.getElementById('dropdown-project');
        const btn = document.getElementById('project-nav-button');
        if (menu && !menu.contains(t) && !btn?.contains(t)) closeProjectMenu();
    };

    function closeProjectMenu() {
        document.getElementById('dropdown-project')?.classList.add('hidden');
        document.removeEventListener('click', onProjectOutside);
    }

    async function handleCreate() { closeProjectMenu(); await lifecycle.createProject(); }
    async function handleOpen() { closeProjectMenu(); await lifecycle.openProject(); }
    async function handleOpenRecent(p: string) { closeProjectMenu(); await lifecycle.openProject(p); }
    async function handleRemoveRecent(id: string) { await lifecycle.removeRecentProject(id); }
    async function handleSave() { closeProjectMenu(); await lifecycle.saveNow(); }
    async function handleSaveAs() { closeProjectMenu(); await lifecycle.saveAs(); }
    async function handleReveal() { closeProjectMenu(); await lifecycle.revealInExplorer(); }
    async function handleClose() { closeProjectMenu(); await lifecycle.closeProject(); }

    // ── File nav ───────────────────────────────────────────────────────────────

    async function handleFileNav(name: string) {
        if (name === 'Publish') {
            const note = notification.addNotification('Building publish bundle…', { type: 'info', ttl: 1500 });
            try {
                notification.addNotification('Publish bundle downloaded', { type: 'info' });
            } catch (err: any) {
                notification.addNotification(`Publish failed: ${err?.message ?? err}`, { type: 'error', ttl: 6000 });
            } finally {
                if (note) notification.dismissNotification(note);
            }
        }
    }

    // ── Stage (Context menu) ───────────────────────────────────────────────────

    function chooseStage(s: StageKey) {
        stage.setStage(s);
        closeContextMenu();
    }

    function closeContextMenu() {
        document.getElementById('dropdown-context')?.classList.add('hidden');
        document.removeEventListener('click', onContextOutside);
    }

    const onContextOutside = (e: Event) => {
        const t = e.target as HTMLElement;
        const menu = document.getElementById('dropdown-context');
        const isBtn = t.id === 'context-button' || !!t.closest('#context-button');
        if (menu && !t.contains(menu) && !isBtn) closeContextMenu();
    };

    // ── Right utilities ────────────────────────────────────────────────────────

    function toggleRightUtil(item: { name: string; key?: RightUtilKey }) {
        if (!project.isProjectOpen) {
            notification.addNotification('Please create or open a project to use this utility.', { type: 'warn', ttl: 4000 });
            return;
        }
        const key = (item.key ?? item.name.toLowerCase()) as RightUtilKey;
        layout.activeRightUtil === key ? layout.setActiveRightUtil(null) : layout.setActiveRightUtil(key);
    }

    function openTerminal(source: 'scripts' | 'timeline') {
        if (!project.isProjectOpen) {
            notification.addNotification('Please create or open a project to use the terminal.', { type: 'warn', ttl: 4000 });
            return;
        }
        terminal.openTerminalWithTab(source);
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    onMounted(() => {
        document.getElementById('context-button')?.addEventListener('click', () => {
            const menu = document.getElementById('dropdown-context');
            if (!menu) return;
            const opening = menu.classList.contains('hidden');
            menu.classList.toggle('hidden');
            if (opening) setTimeout(() => document.addEventListener('click', onContextOutside), 0);
        });
    });

    onBeforeUnmount(() => {
        document.removeEventListener('click', onProjectOutside);
        document.removeEventListener('click', onContextOutside);
    });

    // ── Nav definitions ────────────────────────────────────────────────────────

    const navFileItems = [
        { 
            name: 'Publish', 
            icon: `<svg class="w-6 h-6 text-gray-800 dark:text-white" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m226-559 78 33q14-28 29-54t33-52l-56-11-84 84Zm142 83 114 113q42-16 90-49t90-75q70-70 109.5-155.5T806-800q-72-5-158 34.5T492-656q-42 42-75 90t-49 90Zm178-65q-23-23-23-56.5t23-56.5q23-23 57-23t57 23q23 23 23 56.5T660-541q-23 23-57 23t-57-23Zm19 321 84-84-11-56q-26 18-52 32.5T532-299l33 79Zm313-653q19 121-23.5 235.5T708-419l20 99q4 20-2 39t-20 33L538-80l-84-197-171-171-197-84 167-168q14-14 33.5-20t39.5-2l99 20q104-104 218-147t235-24ZM157-321q35-35 85.5-35.5T328-322q35 35 34.5 85.5T327-151q-25 25-83.5 43T82-76q14-103 32-161.5t43-83.5Zm57 56q-10 10-20 36.5T180-175q27-4 53.5-13.5T270-208q12-12 13-29t-11-29q-12-12-29-11.5T214-265Z"/></svg>` 
        },
    ];

    const navItems: { name: string; icon: string; key?: RightUtilKey }[][] = [
        [
            { name: 'Scripts', icon: `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 8-4 4 4 4m8 0 4-4-4-4m-2-3-4 14"/></svg>` },
            { name: 'Timeline', icon: `<svg class="w-6 h-6 text-gray-800 dark:text-white" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M610-760q-21 0-35.5-14.5T560-810q0-21 14.5-35.5T610-860q21 0 35.5 14.5T660-810q0 21-14.5 35.5T610-760Zm0 660q-21 0-35.5-14.5T560-150q0-21 14.5-35.5T610-200q21 0 35.5 14.5T660-150q0 21-14.5 35.5T610-100Zm160-520q-21 0-35.5-14.5T720-670q0-21 14.5-35.5T770-720q21 0 35.5 14.5T820-670q0 21-14.5 35.5T770-620Zm0 380q-21 0-35.5-14.5T720-290q0-21 14.5-35.5T770-340q21 0 35.5 14.5T820-290q0 21-14.5 35.5T770-240Zm60-190q-21 0-35.5-14.5T780-480q0-21 14.5-35.5T830-530q21 0 35.5 14.5T880-480q0 21-14.5 35.5T830-430ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880v80q-134 0-227 93t-93 227q0 134 93 227t227 93v80Zm132-212L440-464v-216h80v184l148 148-56 56Z"/></svg>` },
        ],
        [
            { name: 'Styles', key: 'styles', icon: `<svg class="w-6 h-6 " aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 7h.01m3.486 1.513h.01m-6.978 0h.01M6.99 12H7m9 4h2.706a1.957 1.957 0 0 0 1.883-1.325A9 9 0 1 0 3.043 12.89 9.1 9.1 0 0 0 8.2 20.1a8.62 8.62 0 0 0 3.769.9 2.013 2.013 0 0 0 2.03-2v-.857A2.036 2.036 0 0 1 16 16Z"/></svg>` },
            { name: 'Properties', key: 'props', icon: `<svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 7h12M6 12h7m-7 5h10"/></svg>` },
            { name: 'Actions', key: 'actions', icon: `<svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><g><rect fill="none" height="24" width="24"/></g><g><path d="M11,21h-1l1-7H7.5c-0.88,0-0.33-0.75-0.31-0.78C8.48,10.94,10.42,7.54,13.01,3h1l-1,7h3.51c0.4,0,0.62,0.19,0.4,0.66 C12.97,17.55,11,21,11,21z"/></g></svg>` },
        ],
    ];
</script>