import { mkdir, writeTextFile, exists, readTextFile } from "@tauri-apps/plugin-fs";

export async function ensureDir(path: string) {
    if (!(await exists(path))) {
        await mkdir(path, { recursive: true });
    }
}

export async function writeJSON(path: string, data: unknown) {
    await writeTextFile(path, JSON.stringify(data, null, 2));
}

export async function readJSON<T>(path: string): Promise<T | null> {
    try {
        if (!(await exists(path))) return null;
        const raw = await readTextFile(path);
        return JSON.parse(raw) as T;
    } catch (error) {
        console.error("Failed to read", path, error);
        return null;
    }
}