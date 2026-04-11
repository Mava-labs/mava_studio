/**
 * runner.ts
 * Executes compiled scripts in a controlled scope.
 * Registers scripts into the action registry so triggers can call them.
 * All errors route to the terminal store.
 */

import { registerAction } from '../element.actions'
import { buildScriptContext } from './context'
import { useTerminalStore } from '../../stores/terminal'
import type { ScriptDef } from '../../types/project'

// ── Execution ─────────────────────────────────────────────────────────────────

export async function runScript(script: ScriptDef): Promise<void> {
    const terminal = useTerminalStore()

    if (!script.compiledJs) {
        terminal.error(`Script "${script.name}" has no compiled output. Save to compile.`)
        return
    }

    const ctx = buildScriptContext()

    try {
        // Only stage, project, element, fetch are in scope
        // window, document, DOM APIs are not passed in
        const fn = new Function(
            'stage',
            'project',
            'element',
            'fetch',
            script.compiledJs
        )
        await fn(ctx.stage, ctx.project, ctx.element, ctx.fetch)
    } catch (err) {
        terminal.error(`[script: ${script.name}] ${(err as Error).message}`)
    }
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register all project scripts into the action registry.
 * Each script gets action type 'script:{scriptId}'.
 * Called once on project load, and again when scripts are added or updated.
 */
export function registerScripts(scripts: Record<string, ScriptDef>): void {
    for (const script of Object.values(scripts)) {
        registerAction(`script:${script.id}`, async () => {
            await runScript(script)
        })
    }
}

/**
 * Re-register a single script after edit/recompile.
 * Overwrites the previous handler for that script id.
 */
export function reregisterScript(script: ScriptDef): void {
    registerAction(`script:${script.id}`, async () => {
        await runScript(script)
    })
}