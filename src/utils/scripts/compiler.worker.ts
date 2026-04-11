/**
 * compiler.worker.ts
 * Web Worker — compiles TypeScript source to JS using @typescript/compiler-api.
 * Runs off the main thread so Monaco stays responsive during compilation.
 */

import ts from 'typescript'

interface CompileRequest {
    id: string
    source: string
}

interface CompileResult {
    id: string
    js?: string
    errors: string[]
}

self.onmessage = (e: MessageEvent<CompileRequest>) => {
    const { id, source } = e.data
    const errors: string[] = []

    const result = ts.transpileModule(source, {
        compilerOptions: {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.None,
            strict: true,
            noImplicitAny: true,
        },
        reportDiagnostics: true,
    })

    if (result.diagnostics?.length) {
        for (const diag of result.diagnostics) {
            const msg = typeof diag.messageText === 'string'
                ? diag.messageText
                : diag.messageText.messageText
            const line = diag.file && diag.start !== undefined
                ? ts.getLineAndCharacterOfPosition(diag.file, diag.start).line + 1
                : '?'
            errors.push(`Line ${line}: ${msg}`)
        }
    }

    self.postMessage({
        id,
        js: errors.length ? undefined : result.outputText,
        errors,
    } satisfies CompileResult)
}