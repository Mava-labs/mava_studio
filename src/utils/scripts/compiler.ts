/**
 * compiler.ts
 * Main thread interface to the compiler worker.
 * Returns a promise that resolves with compiled JS or rejects with errors.
 */

import { useTerminalStore } from '../../stores/terminal'

let worker: Worker | null = null

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(
            new URL('./compiler.worker.ts', import.meta.url),
            { type: 'module' }
        )
    }
    return worker
}

export interface CompileResult {
    js?: string
    errors: string[]
}

export function compileScript(source: string): Promise<CompileResult> {
    return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2)
        const w = getWorker()

        const handler = (e: MessageEvent) => {
            if (e.data.id !== id) return
            w.removeEventListener('message', handler)

            const { js, errors } = e.data as CompileResult & { id: string }

            if (errors.length) {
                const terminal = useTerminalStore()
                for (const err of errors) terminal.error(`[compiler] ${err}`)
            }

            resolve({ js, errors })
        }

        w.addEventListener('message', handler)
        w.postMessage({ id, source })
    })
}

/** Compile and update ScriptDef.compiledJs in place. */
export async function compileAndStore(script: { codeTs: string; compiledJs?: string }): Promise<boolean> {
    const result = await compileScript(script.codeTs)
    if (result.js) {
        script.compiledJs = result.js
        return true
    }
    return false
}