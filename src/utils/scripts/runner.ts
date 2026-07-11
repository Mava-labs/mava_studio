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
        // Only mava, stage, project, element, fetch are in scope
        // window, document, DOM APIs are not passed in
        const fn = new Function(
            'mava',
            'stage',
            'project',
            'element',
            'fetch',
            script.compiledJs
        )
        await fn(ctx.mava, ctx.stage, ctx.project, ctx.element, ctx.fetch)
    } catch (err) {
        terminal.error(`[script: ${script.name}] ${(err as Error).message}`)
    }
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register all project scripts into the action registry.
 * Each script gets action type 'script:{scriptName}' — keyed by name, not id,
 * because that's the only handle a trigger author ever writes (`execute
 * <name>` in the DSL) and the only thing `validator.ts`'s ExecuteAction
 * check resolves against (`s.name === action.scriptName`). Keying by id here
 * silently broke every `execute` trigger action: it validated clean (name
 * exists) and compiled clean, then found no registered handler at runtime
 * unless a script's id happened to equal its name.
 * Called once on project load, and again when scripts are added or updated.
 */
export function registerScripts(scripts: Record<string, ScriptDef>): void {
    for (const script of Object.values(scripts)) {
        registerAction(`script:${script.name}`, async () => {
            await runScript(script)
        })
    }
}

/**
 * Re-register a single script after edit/recompile.
 * Overwrites the previous handler for that script's current name. If the
 * script was just renamed, the handler under its old name is intentionally
 * left registered (stale) rather than tracked/removed here — this module
 * has no record of the previous name to clean up, and the stale entry is
 * harmless (nothing left in the project still points at the old name after
 * a rename, since triggers reference scripts by name and would have been
 * updated or flagged E003 by the validator).
 */
export function reregisterScript(script: ScriptDef): void {
    registerAction(`script:${script.name}`, async () => {
        await runScript(script)
    })
}