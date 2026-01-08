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
                    <div class="">
                        <div class="flex items-center justify-between mb-4">
                            <p class="text-sm font-semibold text-slate-100">Get started</p>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <button
                                v-for="action in quickActions"
                                :key="action.title"
                                type="button"
                                class="group flex flex-col items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left shadow transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                                @click="() => handleQuickAction(action)"
                            >
                                <div class="flex w-full items-center justify-between gap-3">
                                    <div class="flex flex-col items-left gap-3">
                                        <p class="font-semibold text-slate-50">{{ action.title }}</p>
                                        <div class="flex items-center gap-3">
                                            <span class="grid p-2 place-items-center rounded-full bg-linear-to-br" :class="action.accent">
                                                <span class="text-lg" v-html="action.icon"></span>
                                            </span>
                                            <p class="text-sm text-slate-400">{{ action.subtitle }}</p>
                                        </div>
                                    </div>
                                    <svg class="w-5 h-5 text-slate-500 transition group-hover:text-slate-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div class="">
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <p class="text-sm font-semibold text-slate-100">Recent</p>
                                <p class="text-xs text-slate-400">Reopen something you were working on.</p>
                            </div>
                        </div>
                        <ul class="divide-y divide-slate-800">
                            <li v-for="item in recentItems" :key="item.name" class="flex items-center justify-between py-3">
                                <div class="flex items-center gap-3">
                                    <span class="grid h-10 w-10 place-items-center rounded-lg bg-slate-800/80 text-slate-200">
                                        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7a2 2 0 012-2h6a2 2 0 012 2v0a2 2 0 002 2h0a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
                                        </svg>
                                    </span>
                                    <div>
                                        <p class="font-semibold text-slate-100">{{ item.name }}</p>
                                        <p class="text-xs text-slate-400">{{ item.path }}</p>
                                    </div>
                                </div>
                                <span class="text-xs text-slate-500">{{ item.updated }}</span>
                            </li>
                        </ul>
                    </div>
                </section>

                <aside class="space-y-6">
                    <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg space-y-4">
                        <div>
                            <p class="text-sm font-semibold text-slate-100">Guides & resources</p>
                            <p class="text-xs text-slate-400">Quick links similar to the Help section in VS Code.</p>
                        </div>
                        <div class="space-y-3">
                            <a
                                v-for="resource in resources"
                                :key="resource.title"
                                :href="resource.href"
                                class="group flex items-start justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-slate-200 transition hover:border-slate-700 hover:bg-slate-900/90"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <div class="space-y-1">
                                    <p class="font-semibold">{{ resource.title }}</p>
                                    <p class="text-xs text-slate-400">{{ resource.copy }}</p>
                                </div>
                                <svg class="w-4 h-4 text-slate-500 group-hover:text-cyan-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 7l-10 10m0-10h10v10" />
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
import { basename } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../stores/project';
import { useNotificationStore } from '../stores/notification';
import { useStageStore } from '../stores/stage';

type QuickActionKey = 'create' | 'open' | 'clone';

interface QuickAction {
    key: QuickActionKey;
    title: string;
    subtitle: string;
    accent: string;
    icon: string;
}

interface ResourceLink {
    title: string;
    copy: string;
    href: string;
}

interface RecentItem {
    name: string;
    path: string;
    updated: string;
}

const project = useProjectStore();
const notification = useNotificationStore();
const stage = useStageStore();

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
        title: 'Open workspace',
        subtitle: 'Choose a folder to keep working.',
        accent: 'from-emerald-500 to-teal-400',
        icon: '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>',
    },

];

const recentItems: RecentItem[] = [
    { name: 'Landing page concept', path: '~/Projects/mava/landing', updated: 'Yesterday' },
    { name: 'Interaction prototype', path: '~/Projects/mava/prototype', updated: '2 days ago' },
    { name: 'Animation study', path: '~/Projects/mava/anim-lab', updated: 'Last week' },
];

const resources: ResourceLink[] = [
    { title: 'Product docs', copy: 'Platform overview and concepts.', href: 'https://code.visualstudio.com/docs' },
    { title: 'Keyboard reference', copy: 'Learn the essential keybindings.', href: 'https://code.visualstudio.com/docs/getstarted/keybindings' },
    { title: 'Release notes', copy: 'See what shipped recently.', href: 'https://code.visualstudio.com/updates' },
];


async function handleQuickAction(action: QuickAction) {
    if (action.key === 'create') {
        await startNewProjectFlow();
        return;
    }
    if (action.key === 'open') {
        notifyComingSoon('Folder picker integration is coming soon.');
        return;
    }
    notifyComingSoon('Git clone flow will land here.');
}

async function startNewProjectFlow() {
    try {
        const target = await pickProjectDirectory();
        if (!target) {
            notification.addNotification('Project creation cancelled.', { type: 'info', ttl: 2500 });
            return;
        }

        const projectName = target.name || 'Untitled Project';
        project.createProject({ name: projectName, path: target.path });
        await project.persistProjectToDisk(target.path);
        stage.setStage('create');

        notification.addNotification(`Created ${projectName} at ${target.path}`, { type: 'info', ttl: 4500 });
    } catch (error) {
        console.log('Error creating project:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        notification.addNotification(`Failed to create project: ${message}`, { type: 'error', ttl: 6000 });
    }
}

async function pickProjectDirectory() {
    const selection = await open({ directory: true, multiple: false, title: 'Choose a folder for your project' });
    if (!selection) return null;

    const directory = Array.isArray(selection) ? selection[0] : selection;
    const name = await basename(directory);
    return { path: directory, name };
}

function notifyComingSoon(message: string) {
    notification.addNotification(message, { type: 'info' });
}
</script>