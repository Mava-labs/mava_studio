import { defineStore } from "pinia";
import { Ref, ref } from "vue";

function newId() { return 'n_' + Math.random().toString(36).slice(2, 10); }

export const useNotificationStore = defineStore("notification", () =>{
    let notifications: Ref<AppNotification[]> = ref([]);  
    
    function addNotification(message: string, opts: { type?: 'info'|'warn'|'error'; ttl?: number } = {}) {
        const note: AppNotification = { 
            id: newId(), type: opts.type ?? 'info', 
            message, ts: Date.now(), 
            ttl: opts.ttl ?? 4000 
        };
        notifications.value.push(note);
        if (note.ttl) setTimeout(() => dismissNotification(note.id), note.ttl);
        return note.id;
    }

    function dismissNotification(id: string) { 
        notifications.value = notifications.value.filter(n => n.id !== id); 
    }

    function clearNotifications() { notifications.value = []; }

    return { notifications, addNotification, dismissNotification, clearNotifications }
})

/** Unified notification object */
export interface AppNotification {
  id: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  ts: number;
  ttl?: number; // auto-dismiss after ttl ms
}