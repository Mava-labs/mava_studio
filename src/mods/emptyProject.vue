<template>
    <div class="h-full w-full overflow-auto bg-slate-950 text-slate-50">
        <div class="max-w-6xl mx-auto px-8 py-10 space-y-10">
            <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="space-y-2">
                    <h1 class="text-3xl font-semibold text-slate-50">Mava Studio</h1>
                    <p class="text-slate-400">Content creation evolved.</p>
                </div>
            </header>

            <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <section class="space-y-6">

                    <!-- Quick actions -->
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <p class="text-sm font-semibold text-slate-100">Get started</p>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <button v-for="action in quickActions" :key="action.key" type="button"
                                :disabled="actionLoading(action.key)"
                                class="group flex flex-col items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left shadow transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-50"
                                @click="() => handleQuickAction(action.key)">
                                <div class="flex w-full items-center justify-between gap-3">
                                    <div class="flex flex-col items-left gap-3">
                                        <p class="font-semibold text-slate-50">{{ action.title }}</p>
                                        <div class="flex items-center gap-3">
                                            <span class="grid p-2 place-items-center rounded-full bg-linear-to-br"
                                                :class="action.accent">
                                                <span class="text-lg" v-html="action.icon"></span>
                                            </span>
                                            <p class="text-sm text-slate-400">{{ action.subtitle }}</p>
                                        </div>
                                    </div>
                                    <!-- Spinner while loading, chevron otherwise -->
                                    <svg v-if="actionLoading(action.key)" class="w-5 h-5 text-slate-400 animate-spin"
                                        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                            stroke-width="4" />
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    <svg v-else class="w-5 h-5 text-slate-500 transition group-hover:text-slate-200"
                                        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- Recent projects -->
                    <div>
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <p class="text-sm font-semibold text-slate-100">Recent</p>
                                <p class="text-xs text-slate-400">Reopen something you were working on.</p>
                            </div>
                        </div>

                        <!-- Loading -->
                        <div v-if="isLoadingRecent" class="flex items-center gap-2 py-6 text-slate-500 text-sm">
                            <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none"
                                viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    stroke-width="4" />
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Loading recent projects…
                        </div>

                        <!-- Empty -->
                        <div v-else-if="recentItems.length === 0" class="py-6 text-slate-500 text-sm">
                            No recent projects yet. Create or open one to get started.
                        </div>

                        <!-- List -->
                        <ul v-else class="divide-y divide-slate-800">
                            <li v-for="item in recentItems" :key="item.projectId"
                                class="group flex items-center justify-between py-3 rounded-lg px-2 -mx-2 hover:bg-slate-900/60 transition">
                                <!-- Clickable area opens the project -->
                                <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left"
                                    :disabled="lifecycle.isOpening.value"
                                    @click="lifecycle.openProject(item.archivePath)">
                                    <span
                                        class="grid h-10 w-10 place-items-center rounded-lg bg-slate-800/80 text-slate-200 shrink-0">
                                        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none"
                                            viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M4 7a2 2 0 012-2h6a2 2 0 012 2v0a2 2 0 002 2h0a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
                                        </svg>
                                    </span>
                                    <div class="min-w-0">
                                        <p class="font-semibold text-slate-100 truncate">{{ item.projectName }}</p>
                                        <p class="text-xs text-slate-400 truncate max-w-xs">{{ item.archivePath }}</p>
                                    </div>
                                </button>

                                <div class="flex items-center gap-3 shrink-0 ml-4">
                                    <span class="text-xs text-slate-500">{{ formatRelativeTime(item.lastOpenedAt)
                                        }}</span>

                                    <!-- Remove from recent — visible on row hover -->
                                    <button type="button"
                                        class="hidden group-hover:flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-red-400 transition"
                                        title="Remove from recent" @click.stop="handleRemoveRecent(item.projectId)">
                                        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none"
                                            viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </li>
                        </ul>
                    </div>
                </section>

                <!-- Sidebar -->
                <aside class="space-y-6">
                    <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg space-y-4">
                        <div>
                            <p class="text-sm font-semibold text-slate-100">Guides & resources</p>
                            <p class="text-xs text-slate-400">Quick links to help you get up to speed.</p>
                        </div>
                        <div class="space-y-3">
                            <a v-for="resource in resources" :key="resource.title" :href="resource.href"
                                class="group flex items-start justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-slate-200 transition hover:border-slate-700 hover:bg-slate-900/90"
                                target="_blank" rel="noreferrer">
                                <div class="space-y-1">
                                    <p class="font-semibold">{{ resource.title }}</p>
                                    <p class="text-xs text-slate-400">{{ resource.copy }}</p>
                                </div>
                                <svg class="w-4 h-4 text-slate-500 group-hover:text-cyan-300 shrink-0 mt-0.5"
                                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M17 7l-10 10m0-10h10v10" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
    import { ref, computed, onMounted } from 'vue';
    import { useProjectMetadataStore } from '../stores/projectMetadata';
    import { useProjectLifecycle } from '../composables/useProjectLifecycle';

    // ── Stores & composables ───────────────────────────────────────────────────

    const project = useProjectMetadataStore();
    const lifecycle = useProjectLifecycle();

    // ── Recent projects ────────────────────────────────────────────────────────

    const isLoadingRecent = ref(false);
    const recentItems = computed(() => project.recentProjects);

    onMounted(async () => {
        isLoadingRecent.value = true;
        try {
            await project.loadRecentProjects();
        } finally {
            isLoadingRecent.value = false;
        }
    });

    async function handleRemoveRecent(projectId: string) {
        await lifecycle.removeRecentProject(projectId);
    }

    // ── Quick actions ──────────────────────────────────────────────────────────

    type QuickActionKey = 'create' | 'open';

    interface QuickAction {
        key: QuickActionKey;
        title: string;
        subtitle: string;
        accent: string;
        icon: string;
    }

    const quickActions: QuickAction[] = [
        {
            key: 'create',
            title: 'New blank project',
            subtitle: 'Start with an empty layout.',
            accent: 'from-sky-500 to-cyan-400',
            icon: '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687 1.687a1 1 0 010 1.414l-9.9 9.9a1 1 0 01-.41.25l-3.22.966a.5.5 0 01-.62-.62l.966-3.22a1 1 0 01.25-.41l9.9-9.9a1 1 0 011.414 0z"/></svg>',
        },
        {
            key: 'open',
            title: 'Open project',
            subtitle: 'Resume an existing .mava file.',
            accent: 'from-emerald-500 to-teal-400',
            icon: '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>',
        },
    ];

    function actionLoading(key: QuickActionKey): boolean {
        if (key === 'create') return lifecycle.isCreating.value;
        if (key === 'open') return lifecycle.isOpening.value;
        return false;
    }

    async function handleQuickAction(key: QuickActionKey) {
        if (key === 'create') await lifecycle.createProject();
        if (key === 'open') await lifecycle.openProject();
    }

    // ── Resources ──────────────────────────────────────────────────────────────

    interface ResourceLink {
        title: string;
        copy: string;
        href: string;
    }

    const resources: ResourceLink[] = [
        { title: 'Product docs', copy: 'Platform overview and concepts.', href: 'https://docs.mavastudio.io' },
        { title: 'Keyboard reference', copy: 'Learn the essential keybindings.', href: 'https://docs.mavastudio.io/keybindings' },
        { title: 'Release notes', copy: 'See what shipped recently.', href: 'https://docs.mavastudio.io/changelog' },
    ];

    // ── Helpers ────────────────────────────────────────────────────────────────

    function formatRelativeTime(ms: number): string {
        const diff = Date.now() - ms;
        const mins = Math.floor(diff / 60_000);
        const hours = Math.floor(diff / 3_600_000);
        const days = Math.floor(diff / 86_400_000);

        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 2) return '1 hour ago';
        if (hours < 24) return `${hours} hours ago`;
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
</script>