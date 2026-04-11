/**
 * useProjectLifecycle.ts
 * Composable — create, open, and close project flows.
 *
 * Extracts the lifecycle logic from view components so they stay thin.
 * Orchestrates: save dialogue → store → autosave → stage routing.
 *
 * Usage:
 *   const lifecycle = useProjectLifecycle();
 *   await lifecycle.createProject();
 *   await lifecycle.openProject(path);
 *   await lifecycle.closeProject();
 */

import { ref } from 'vue';
import { save, open } from '@tauri-apps/plugin-dialog';
import { basename, extname } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { useProjectMetadataStore } from '../stores/projectMetadata';
import { useNotificationStore } from '../stores/notification';
import { usePagesStore } from '../stores/pages';
import { useStageStore } from '../stores/stage';
import { useAutosave } from './useAutosave';
import type { ProjectData } from '../types/project';

// ── Notification helper ────────────────────────────────────────────────────

function useNotify() {
    let store: { addNotification?: (msg: string, opts?: Record<string, unknown>) => void } | null = null;
    try {
        store = useNotificationStore();
    } catch { /* not available yet */ }

    return (msg: string, type: 'info' | 'warn' | 'error' = 'info', ttl = 3000) => {
        if (store?.addNotification) {
            store.addNotification(msg, { type, ttl });
        } else {
            const fn_ = type === 'error' ? console.error : type === 'warn' ? console.warn : console.info;
            fn_(`[mava] ${msg}`);
        }
    };
}

/* ----------------------------------------------------------
HELPERS
---------------------------------------------------------- */

function _firstPageId(data: ProjectData): string | null {
    for (const moduleRef of data.course.modules.slice().sort((a, b) => a.order - b.order)) {
        const mod = data.modulesById[moduleRef.id];
        if (!mod) continue;
        for (const lessonRef of mod.lessons.slice().sort((a, b) => a.order - b.order)) {
            const lesson = data.lessonsById[lessonRef.id];
            if (!lesson) continue;
            const sorted = lesson.pages.slice().sort((a, b) => a.order - b.order);
            if (sorted.length > 0) return sorted[0].id;
        }
    }
    return null;
}

async function _pickSaveLocation(defaultName = 'untitled-project'): Promise<{ path: string; name: string } | null> {
    const selection = await save({
        title:       'Save your project',
        defaultPath: `${defaultName}.mava`,
        filters:     [{ name: 'Mava Studio Project', extensions: ['mava'] }],
    });
    if (!selection) return null;

    const rawName = await basename(selection);
    const ext     = await extname(selection);
    const name    = (ext.length > 0 && rawName.endsWith(ext))
        ? rawName.slice(0, -(ext.length + 1))
        : rawName;

    return { path: selection, name: name || 'Untitled Project' };
}

async function _pickOpenLocation(): Promise<string | null> {
    const selection = await open({
        title:   'Open project',
        filters: [{ name: 'Mava Studio Project', extensions: ['mava'] }],
        multiple: false,
    });
    return typeof selection === 'string' ? selection : null;
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useProjectLifecycle() {
    const project  = useProjectMetadataStore();
    const pages    = usePagesStore();
    const stage    = useStageStore();
    const autosave = useAutosave();
    const notify   = useNotify();

    const isCreating  = ref(false);
    const isOpening   = ref(false);
    const isClosing   = ref(false);
    const isSavingAs  = ref(false);
    const isRevealing = ref(false);

    
    /* ----------------------------------------------------------
       CREATE
    ---------------------------------------------------------- */

    /**
     * Full create flow:
     * 1. Open save dialogue to pick name + location
     * 2. Call projectMetadata.createProjectAndPersist()
     * 3. Load the first page
     * 4. Switch to create stage
     * 5. Start autosave
     */
    async function createProject(): Promise<boolean> {
        if (isCreating.value) return false;
        isCreating.value = true;
        try {
            const target = await _pickSaveLocation();
            if (!target) {
                 notify('Project creation cancelled.', 'info', 2500);
                return false;
            }

            const result = await project.createProjectAndPersist({
                name:        target.name,
                path:        target.path,
                archivePath: target.path,
            });

            const loadResult = await pages.loadPage(result.newPageId);
            if (loadResult === 'Error') {
                notify('Project created but failed to open first page.', 'warn', 5000);
            }

            stage.setStage('create');
            stage.resetCanvas();
            autosave.start();
            notify(`Project "${target.name}" created.`, 'info', 3000);
            return true;
        } catch (err: unknown) {
            notify(`Failed to create project: ${err instanceof Error ? err.message : String(err)}`, 'error', 6000);
            return false;
        } finally {
            isCreating.value = false;
        }
    }
    /* ----------------------------------------------------------
       OPEN
    ---------------------------------------------------------- */

    /**
     * Open an existing project from a given path, or show an open dialogue.
     */
    async function openProject(filePath?: string): Promise<boolean> {
        if (isOpening.value) return false;
        isOpening.value = true;
        try {
            const path = filePath ?? await _pickOpenLocation();
            if (!path) {
                notify('No file selected.', 'info', 2000);
                return false;
            }

            if (project.isProjectOpen) {
                await closeProject();
            }

            const result = await project.loadProject(path);

            const firstPageId = _firstPageId(result.projectData);
            if (firstPageId) {
                await pages.loadPage(firstPageId);
            } else {
                notify('Project opened but no pages found.', 'warn', 4000);
            }

            stage.setStage('create');
            stage.resetCanvas();
            autosave.start();
            notify(`Opened "${result.projectData.projectName}".`, 'info', 3000);
            return true;
        } catch (err: unknown) {
            notify(`Failed to open project: ${err instanceof Error ? err.message : String(err)}`, 'error', 6000);
            return false;
        } finally {
            isOpening.value = false;
        }
    }

    /* ----------------------------------------------------------
       EXPLICIT SAVE (Ctrl+S)
    ---------------------------------------------------------- */

    async function saveNow(): Promise<void> {
        if (!project.isProjectOpen) return;
        try {
            await autosave.flushNow();
            await project.saveProject();
            notify('Project saved.', 'info', 2000);
        } catch (err: unknown) {
            notify(`Failed to save: ${err instanceof Error ? err.message : String(err)}`, 'error', 5000);
        }
    }

    // ── Save As ──────────────────────────────────────────────────────────

    /**
     * Copies the entire .mava SQLite file to a new location.
     * The copy becomes the active project. The original is untouched.
     */
    async function saveAs(): Promise<boolean> {
        if (isSavingAs.value || !project.isProjectOpen) return false;
        isSavingAs.value = true;
        try {
            const target = await _pickSaveLocation(project.projectName || 'untitled-project');
            if (!target) return false;

            // Flush unsaved state into the current db before copying
            await autosave.flushNow();

            const result = await invoke<{ projectData: ProjectData; sessionLock: unknown }>(
                'copy_project_to',
                {
                    projectId:       project.projectId,
                    destinationPath: target.path,
                }
            );

            // Hydrate store with updated project data (new archive path etc.)
            project._hydrate(result.projectData);
            notify(`Saved as "${target.name}".`, 'info', 3000);
            return true;
        } catch (err: unknown) {
            notify(`Save As failed: ${err instanceof Error ? err.message : String(err)}`, 'error', 6000);
            return false;
        } finally {
            isSavingAs.value = false;
        }
    }

    /* ----------------------------------------------------------
       CLOSE
    ---------------------------------------------------------- */

    /**
     * Close the current project:
     * 1. Flush any unsaved changes immediately
     * 2. Stop autosave
     * 3. Reset stores
     * 4. Return to empty stage
     */
    async function closeProject(): Promise<void> {
        if (isClosing.value || !project.isProjectOpen) return;
        isClosing.value = true;
        try {
            await autosave.flushNow();
            autosave.stop();
            await project.closeProject();
            stage.setStage('empty');
            stage.resetCanvas();
            pages.closeAll()
        } catch (err: unknown) {
            console.error('[useProjectLifecycle] closeProject error:', err);
        } finally {
            isClosing.value = false;
        }
    }

    // ── Reveal in Explorer ────────────────────────────────────────────────

    async function revealInExplorer(): Promise<void> {
        if (isRevealing.value || !project.isProjectOpen) return;
        isRevealing.value = true;
        try {
            await invoke('reveal_in_explorer', { projectId: project.projectId });
        } catch (err: unknown) {
            notify(`Could not open file location: ${err instanceof Error ? err.message : String(err)}`, 'error', 4000);
        } finally {
            isRevealing.value = false;
        }
    }

    // ── Remove recent ─────────────────────────────────────────────────────

    async function removeRecentProject(projectId: string): Promise<void> {
        try {
            await invoke('remove_recent_project', { projectId });
            await project.loadRecentProjects();
        } catch (err: unknown) {
            console.error('[useProjectLifecycle] removeRecentProject error:', err);
        }
    }
    
    /* ----------------------------------------------------------
       PUBLIC
    ---------------------------------------------------------- */

    return {
        isCreating,
        isOpening,
        isClosing,
        isSavingAs,
        isRevealing,
        createProject,
        openProject,
        saveNow,
        saveAs,
        closeProject,
        revealInExplorer,
        removeRecentProject,
    };
}