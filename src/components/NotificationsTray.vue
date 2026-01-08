<template>
    <div class="absolute top-4 right-4 z-30 flex flex-col gap-3 pointer-events-none">
        <div
            v-for="note in notifications"
            :key="note.id"
            class="pointer-events-auto w-80 max-w-sm rounded-xl border shadow-lg backdrop-blur px-4 py-3 flex items-start gap-3 transition hover:-translate-y-0.5"
            :class="noteClass(note.type)"
            role="status"
            aria-live="polite"
        >
            <div class="mt-0.5 h-2.5 w-2.5 rounded-full" :class="dotClass(note.type)"></div>
            <div class="flex-1 space-y-1">
                <p class="text-sm leading-snug">{{ note.message }}</p>
            </div>
            <button
                type="button"
                class="ml-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                @click="() => notification.dismissNotification(note.id)"
                aria-label="Dismiss notification"
            >
                x
            </button>
        </div>
    </div>
</template>

<script setup lang="ts" vapor>
import { storeToRefs } from 'pinia';
import { useNotificationStore, type AppNotification } from '../stores/notification';

type NoteType = AppNotification['type'];

const notification = useNotificationStore();
const { notifications } = storeToRefs(notification);

function noteClass(type: NoteType) {
    if (type === 'error') return 'bg-red-50/90 dark:bg-red-900/40 border-red-300/80 dark:border-red-700/70 text-red-900 dark:text-red-50';
    if (type === 'warn') return 'bg-amber-50/90 dark:bg-amber-900/40 border-amber-300/80 dark:border-amber-700/70 text-amber-900 dark:text-amber-50';
    return 'bg-sky-50/90 dark:bg-sky-900/40 border-sky-200/80 dark:border-sky-700/70 text-sky-900 dark:text-sky-50';
}

function dotClass(type: NoteType) {
    if (type === 'error') return 'bg-red-500';
    if (type === 'warn') return 'bg-amber-400';
    return 'bg-sky-400';
}
</script>
