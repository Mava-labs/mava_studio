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
import { useProjectMetadataStore } from '../stores/projectMetadata';
import { usePagesStore } from '../stores/pages';
import { useStageStore } from '../stores/stage';
import { useNotificationStore } from '../stores/notification';
import { useAutosave } from './useAutosave';

/* ============================================================
   COMPOSABLE
   ============================================================ */

export function useProjectLifecycle() {
    const project = useProjectMetadataStore();
    const pages = usePagesStore();
    const stage = useStageStore();
    const notification = useNotificationStore();
    const autosave = useAutosave();

    const isCreating = ref(false);
    const isOpening = ref(false);
    const isClosing = ref(false);

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
                notification.addNotification('Project creation cancelled.', { type: 'info', ttl: 2500 });
                return false;
            }

            const result = await project.createProjectAndPersist({
                name: target.name,
                path: target.path,
                archivePath: target.path,
            });

            const loadResult = await pages.loadPage(result.newPageId);
            if (loadResult === 'Error') {
                notification.addNotification('Project created but failed to open first page.', { type: 'warn', ttl: 5000 });
            }

            stage.setStage('create');
            stage.resetCanvas();
            autosave.start();

            notification.addNotification(`Project "${target.name}" created.`, { type: 'info', ttl: 3000 });
            return true;
        } catch (err: any) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            notification.addNotification(`Failed to create project: ${message}`, { type: 'error', ttl: 6000 });
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
                notification.addNotification('No file selected.', { type: 'info', ttl: 2000 });
                return false;
            }

            // If another project is open, close it first
            if (project.isProjectOpen) {
                await closeProject();
            }

            const result = await project.loadProject(path);

            // Load the first available page
            const firstPage = Object.values(result.projectData.pagesById)[0];
            if (firstPage) {
                await pages.loadPage(firstPage.id);
            }

            stage.setStage('create');
            stage.resetCanvas();
            autosave.start();

            notification.addNotification(`Opened "${result.projectData.projectName}".`, { type: 'info', ttl: 3000 });
            return true;
        } catch (err: any) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            notification.addNotification(`Failed to open project: ${message}`, { type: 'error', ttl: 6000 });
            return false;
        } finally {
            isOpening.value = false;
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
            // Flush before closing — don't lose work
            await autosave.flushNow();
            autosave.stop();

            await project.closeProject();

            stage.setStage('empty');
            stage.resetCanvas();
        } catch (err: any) {
            console.error('[useProjectLifecycle] closeProject error:', err);
        } finally {
            isClosing.value = false;
        }
    }

    /* ----------------------------------------------------------
       EXPLICIT SAVE (Ctrl+S)
    ---------------------------------------------------------- */

    async function saveNow(): Promise<void> {
        if (!project.isProjectOpen) return;
        await autosave.flushNow();
        await project.saveProject();
        notification.addNotification('Project saved.', { type: 'info', ttl: 2000 });
    }

    /* ----------------------------------------------------------
       HELPERS
    ---------------------------------------------------------- */

    async function _pickSaveLocation(): Promise<{ path: string; name: string } | null> {
        const selection = await save({
            title: 'Save your project',
            defaultPath: 'untitled-project.mava',
            filters: [{ name: 'Mava Studio Project', extensions: ['mava'] }],
        });
        if (!selection) return null;

        const rawName = await basename(selection);
        const ext = await extname(selection);
        const name = ext.length > 0 && rawName.endsWith(ext)
            ? rawName.slice(0, -(ext.length + 1))
            : rawName;

        return { path: selection, name: name || 'Untitled Project' };
    }

    async function _pickOpenLocation(): Promise<string | null> {
        const selection = await open({
            title: 'Open project',
            filters: [{ name: 'Mava Studio Project', extensions: ['mava'] }],
            multiple: false,
        });
        return typeof selection === 'string' ? selection : null;
    }

    /* ----------------------------------------------------------
       PUBLIC
    ---------------------------------------------------------- */

    return {
        isCreating,
        isOpening,
        isClosing,
        createProject,
        openProject,
        closeProject,
        saveNow,
    };
}