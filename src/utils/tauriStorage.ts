import { load, type Store } from "@tauri-apps/plugin-store";

// In-memory cache that mirrors the Tauri store so Pinia's sync storage API works.
const cache = new Map<string, string | null>();
let storePromise: Promise<Store> | null = null;

async function getStore() {
    if (!storePromise) {
        storePromise = load("store.dat");
    }
    return storePromise;
}

export async function prepareTauriStorage() {
    const store = await getStore();
    const keys = await store.keys();
    for (const key of keys) {
        const value = await store.get(key);
        cache.set(key, value ? JSON.stringify(value) : null);
    }
}

async function writeThrough(key: string, value: string) {
    const store = await getStore();
    await store.set(key, JSON.parse(value));
    await store.save();
}

export const tauriStorage = {
    getItem(key: string) {
        return cache.has(key) ? cache.get(key) || null : null;
    },

    setItem(key: string, value: string) {
        cache.set(key, value);
        // Fire-and-forget async write; Pinia expects sync API.
        void writeThrough(key, value);
    }
};
