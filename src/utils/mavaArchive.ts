import { invoke } from "@tauri-apps/api/core";
import { dirname, join, tempDir } from "@tauri-apps/api/path";
import { ensureDir } from "./diskIO";

/** Create a fresh workspace directory under the OS temp folder. */
export async function createWorkspaceDir(): Promise<string> {
    const base = await tempDir();
    const folder = await join(base, `mava-workspace-${Date.now()}`);
    await ensureDir(folder);
    return folder;
}

export async function extractMavaArchive(mavaPath: string): Promise<string> {
    return invoke<string>("extract_mava_archive", { mavaPath });
}

export async function packMavaArchive(workspacePath: string, destMavaPath: string): Promise<void> {
    const parent = await dirname(destMavaPath);
    await ensureDir(parent);
    await invoke("pack_mava_archive", { workspacePath, destMavaPath });
}
