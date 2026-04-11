/**
 * useMonaco.ts
 *
 * Manages a single Monaco editor instance attached to a container element.
 * Handles lazy loading, type injection, resize, and disposal.
 */

import {
    ref, onUnmounted,
    watch, type Ref
} from 'vue'
import type { ScriptDef } from '../types/project'

// Monaco is imported dynamically so it never loads until first use
type MonacoEditor = typeof import('monaco-editor')
type EditorInstance = import('monaco-editor').editor.IStandaloneCodeEditor
type ModelInstance = import('monaco-editor').editor.ITextModel

// ── Type declaration sources ──────────────────────────────────────────────────

const STAGE_API_TYPES = `
declare const stage: {
    readonly activeElement: ElementAPI | null
    readonly currentPage:   PageAPI
    [elementName: string]:  ElementAPI
}

declare const project: {
    readonly currentPage:   string
    readonly currentPageId: string
    readonly author:        string
    watch(variable: string, handler: (value: unknown) => void): () => void
    [variable: string]: unknown
}

declare function element(id: string): ElementAPI

declare function fetch(url: string, options?: RequestInit): Promise<Response>

interface ElementAPI {
    readonly id:   string
    readonly name: string
    visible:       boolean
    text:          string
    style:         Record<string, unknown>
    layout:        Record<string, unknown>
    play(animationId: string): void
    stop(animationId: string): void
    [prop: string]: unknown
}

interface PageAPI {
    id:    string
    title: string
}
`

const ABYSS_THEME = {
    base: 'vs-dark' as const,
    inherit: true,
    rules: [
        { token: '', foreground: '6688AA' },
        { token: 'comment', foreground: '3C9D3C' },
        { token: 'keyword', foreground: 'D37A7A' },
        { token: 'number', foreground: 'AA88FF' },
        { token: 'string', foreground: '88CCAA' },
        { token: 'regexp', foreground: 'C792EA' },
        { token: 'identifier', foreground: '6688AA' },
    ],
    colors: {
        'editor.background': '#000c18',
        'editor.foreground': '#6688AA',
        'editorLineNumber.foreground': '#35516E',
        'editorLineNumber.activeForeground': '#7FA7C9',
        'editorCursor.foreground': '#FFFFFF',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#1B3A57',
        'editor.lineHighlightBackground': '#0D1A2B',
        'editorIndentGuide.background1': '#203A52',
        'editorIndentGuide.activeBackground1': '#35516E',
        'editorBracketMatch.background': '#17344A',
        'editorBracketMatch.border': '#5DADE2',
        'editorGutter.background': '#000c18',
        'editorHoverWidget.background': '#07111f',
        'editorHoverWidget.foreground': '#c9d9ea',
        'editorHoverWidget.border': '#2a4761',
        'editorHoverWidget.statusBarBackground': '#0d1a2b',
        'editorHoverWidget.highlightForeground': '#8bd5ff',
    },
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useMonaco(
    containerRef: Ref<HTMLElement | null>,
    script: Ref<ScriptDef | null>,
    options?: {
        onChange?: (value: string) => void
        onSave?: (value: string) => void   // Ctrl+S
        readOnly?: boolean
        language?: 'typescript' | 'json'
    }
) {
    let monaco: MonacoEditor | null = null
    let editor: EditorInstance | null = null
    let resizeOb: ResizeObserver | null = null
    const modelsByScriptId = new Map<string, ModelInstance>()
    let emptyModel: ModelInstance | null = null
    const isReady = ref(false)
    let initPromise: Promise<void> | null = null

    function languageOf(): 'typescript' | 'json' {
        return options?.language ?? 'typescript'
    }

    function extensionOfLanguage(language: 'typescript' | 'json'): 'ts' | 'json' {
        return language === 'json' ? 'json' : 'ts'
    }

    function getModelForScript(current: ScriptDef | null): ModelInstance | null {
        if (!monaco) return null

        const language = languageOf()
        const ext = extensionOfLanguage(language)

        if (!current) {
            if (emptyModel) return emptyModel
            const emptyUri = monaco.Uri.parse(`file:///scripts/__empty__.${ext}`)
            emptyModel = monaco.editor.getModel(emptyUri)
                ?? monaco.editor.createModel('', language, emptyUri)
            return emptyModel
        }

        const existing = modelsByScriptId.get(current.id)
        if (existing) {
            if (existing.getValue() !== current.codeTs)
                existing.setValue(current.codeTs)
            return existing
        }

        const modelUri = monaco.Uri.parse(`file:///scripts/${current.id}.${ext}`)
        const model = monaco.editor.getModel(modelUri)
            ?? monaco.editor.createModel(current.codeTs, language, modelUri)

        modelsByScriptId.set(current.id, model)
        return model
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    async function init() {
        if (!containerRef.value || editor || initPromise) return

        initPromise = (async () => {
            // Lazy load Monaco
            monaco = await import('monaco-editor')

            // Inject $stage API types once
            monaco.typescript.typescriptDefaults.addExtraLib(
                STAGE_API_TYPES,
                'file:///stage-api.d.ts'
            )

            // Compiler options — strict but no module system
            // (scripts run in a Function scope, not as ES modules)
            monaco.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.typescript.ScriptTarget.ES2020,
                strict: true,
                noImplicitAny: true,
                moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
                module: monaco.typescript.ModuleKind.None,
                noEmit: true,
            })
            monaco.typescript.typescriptDefaults.setEagerModelSync(true)
            monaco.editor.defineTheme('abyss', ABYSS_THEME)

            const initialModel = getModelForScript(script.value)
            if (!initialModel || !containerRef.value || editor) return

            // Create editor
            editor = monaco.editor.create(containerRef.value, {
                model: initialModel,
                theme: 'abyss',
                readOnly: options?.readOnly ?? false,
                automaticLayout: false,     // we handle layout manually via ResizeObserver
                fixedOverflowWidgets: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineHeight: 20,
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                scrollBeyondLastLine: false,
                tabSize: 4,
                padding: { top: 12 },
            })
            monaco.editor.setTheme('abyss')

            // onChange
            if (options?.onChange) {
                editor.onDidChangeModelContent(() => {
                    options.onChange!(editor!.getValue())
                })
            }

            // Ctrl+S → save/compile
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                () => options?.onSave?.(editor!.getValue())
            )

            // ResizeObserver — keeps editor filling its container
            resizeOb = new ResizeObserver(() => editor?.layout())
            resizeOb.observe(containerRef.value)

            isReady.value = true
        })()

        try {
            await initPromise
        } finally {
            initPromise = null
        }
    }

    // ── Sync script content when selected script changes ──────────────────────

    watch(
        () => script.value?.id ?? null,
        (id) => {
            if (!editor || !monaco) return
            const model = getModelForScript(id ? script.value : null)
            if (!model) return
            if (editor.getModel() !== model) editor.setModel(model)
        }
    )

    watch(
        () => script.value?.codeTs ?? '',
        (incoming) => {
            if (!editor || !script.value) return
            const model = modelsByScriptId.get(script.value.id)
            if (!model) return
            if (model.getValue() !== incoming) model.setValue(incoming)
        }
    )

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    watch(
        () => [containerRef.value, script.value?.id],
        () => {
            void init()
        },
        { immediate: true }
    )

    onUnmounted(() => {
        resizeOb?.disconnect()
        editor?.dispose()
        emptyModel?.dispose()
        emptyModel = null
        for (const model of modelsByScriptId.values()) model.dispose()
        modelsByScriptId.clear()
        editor = null
        monaco = null
        isReady.value = false
    })

    // ── Public ────────────────────────────────────────────────────────────────

    function getValue(): string {
        return editor?.getValue() ?? ''
    }

    function setValue(value: string) {
        if (editor && editor.getValue() !== value)
            editor.setValue(value)
    }

    function focus() {
        editor?.focus()
    }

    return { isReady, getValue, setValue, focus }
}