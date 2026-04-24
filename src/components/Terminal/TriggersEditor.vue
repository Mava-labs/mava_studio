<script setup lang="ts" vapor>
    import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'
    import type * as MonacoNS from 'monaco-editor'
    import { useMonaco } from '../../composables/useMonaco'
    import { useProjectMetadataStore } from '../../stores/projectMetadata'
    import { useTerminalStore } from '../../stores/terminal'
    import { usePagesStore } from '../../stores/pages'
    import { useVariableStore } from '../../stores/variables'
    import type { DSLTriggerDocument, ScriptDef } from '../../types/project'
    import { lex } from '../../utils/Trigger/lexer'
    import { parse } from '../../utils/Trigger/parser'
    import { summarize } from '../../utils/Trigger/summarizer'
    import { validate } from '../../utils/Trigger/validator'

    const project = useProjectMetadataStore()
    const terminal = useTerminalStore()
    const pages = usePagesStore()
    const variables = useVariableStore()

    const KEYWORD_DOCS: Record<string, string> = {
        on: 'Start a trigger block for one or more events.',
        when: 'Add a condition to gate action execution.',
        then: 'Start the action block for a condition.',
        end: 'Close a trigger, conditional branch, or named trigger.',
        else: 'Fallback branch when no condition matches.',
        elsewhen: 'Additional conditional branch.',
        trigger: 'Define or invoke a named trigger.',
        group: 'Define a reusable group of ids.',
        either: 'Fire when any one listed event occurs.',
        all: 'Use with "of" to require all listed events.',
        show: 'Show an element target.',
        hide: 'Hide an element target.',
        enable: 'Enable an interactive element.',
        disable: 'Disable an interactive element.',
        highlight: 'Toggle highlight on a target.',
        play: 'Play a media target.',
        pause: 'Pause a media or animation target.',
        resume: 'Resume a media or animation target.',
        stop: 'Stop and reset a media or animation target.',
        finish: 'Skip an animation target to its end.',
        run: 'Run an animation target.',
        navigate: 'Navigate to a page, next, or prev.',
        lock: 'Lock a page or section target.',
        unlock: 'Unlock a page or section target.',
        submit: 'Submit a form target.',
        wait: 'Pause sequence execution for a duration.',
        execute: 'Execute a named script.',
        after: 'Delay an action with a time literal.',
        not: 'Logical negation.',
        and: 'Logical AND.',
        or: 'Logical OR.',
    }

    const EVENT_DOCS: Record<string, string> = {
        click: 'Fires on click.',
        dblclick: 'Fires on double click.',
        hover: 'Fires when pointer enters a target.',
        focus: 'Fires when a target receives focus.',
        blur: 'Fires when a target loses focus.',
        mount: 'Fires after page mount.',
        'before.mount': 'Fires before page mount.',
        unmount: 'Fires after page unmount.',
        'before.unmount': 'Fires before page unmount.',
        'variable.change': 'Fires when a variable changes.',
        'timeline.reaches': 'Fires when the timeline reaches a time point.',
        'media.complete': 'Fires when media finishes.',
        'animation.complete': 'Fires when animation finishes.',
        'form.submit': 'Fires when form submits.',
    }

    const EVENT_NAMES = [
        'click', 'dblclick', 'hover', 'focus', 'blur',
        'keypress', 'keydown', 'keyup', 'submit',
        'mount', 'before.mount', 'unmount', 'before.unmount', 'enter', 'leave',
        'media.play', 'media.pause', 'media.resume', 'media.stop', 'media.complete', 'media.progress',
        'animation.start', 'animation.complete', 'animation.loop',
        'variable.change',
        'timeline.start', 'timeline.stop', 'timeline.pause', 'timeline.resume', 'timeline.reaches',
        'quiz.start', 'quiz.complete', 'quiz.fail',
        'form.submit', 'form.reset',
    ]

    const triggers = computed(() => Object.values(project.dslTriggers ?? {}))
    const selectedId = computed(() => terminal.selectedTriggerId)

    const selectedTrigger = computed<DSLTriggerDocument | null>(() =>
        selectedId.value ? project.dslTriggers[selectedId.value] ?? null : null
    )

    type TriggerPresentation = {
        id: string
        title: string
        summary: string
    }

    function hashString(value: string): number {
        let hash = 0
        for (let index = 0; index < value.length; index++) {
            hash = ((hash << 5) - hash) + value.charCodeAt(index)
            hash |= 0
        }
        return Math.abs(hash)
    }

    function extractTopComment(source: string): string | null {
        const trimmed = source.replace(/^\uFEFF/, '').trimStart()

        if (trimmed.startsWith('//')) {
            const firstLine = trimmed.split(/\r?\n/, 1)[0].replace(/^\/\/\s?/, '').trim()
            return firstLine.length ? firstLine : null
        }

        if (trimmed.startsWith('/*')) {
            const endIndex = trimmed.indexOf('*/')
            const block = endIndex >= 0 ? trimmed.slice(2, endIndex) : trimmed.slice(2)
            const lines = block.split(/\r?\n/)
                .map(line => line.replace(/^\s*\*\s?/, '').trim())
                .filter(Boolean)
            return lines[0] ?? null
        }

        return null
    }

    function fallbackTriggerName(source: string): string {
        const adjectives = [
            'Amber', 'Quiet', 'Brisk', 'Soft', 'Velvet', 'Calm', 'Brave', 'Slate',
            'Silver', 'Kind', 'Bright', 'Rapid', 'Warm', 'Misty', 'Pure', 'Gentle',
        ]
        const nouns = [
            'Harbor', 'Signal', 'Anchor', 'Bloom', 'Thread', 'Pulse', 'Field', 'Beacon',
            'Orbit', 'Canvas', 'Ledger', 'Spark', 'Drift', 'Bridge', 'Echo', 'Kernel',
        ]
        const seed = hashString(source)
        return `${adjectives[seed % adjectives.length]} ${nouns[(seed >>> 4) % nouns.length]}`
    }

    function getTriggerPresentation(trigger: DSLTriggerDocument): TriggerPresentation {
        const lexResult = lex(trigger.dslSource)
        const parseResult = parse(lexResult.tokens)
        const summaries = summarize(parseResult.ast)
        const namedDef = parseResult.ast.body.find(def => def.type === 'NamedTriggerDef')
        const namedTitle = namedDef?.type === 'NamedTriggerDef' ? namedDef.name : null
        const title = namedTitle ?? extractTopComment(trigger.dslSource) ?? fallbackTriggerName(trigger.dslSource)
        const summary = namedTitle
            ? summaries.find(item => item.name === namedTitle)?.summary ?? summaries[0]?.summary ?? 'No summary available.'
            : summaries[0]?.summary ?? 'No summary available.'

        return {
            id: trigger.id,
            title,
            summary,
        }
    }

    const triggerItems = computed<TriggerPresentation[]>(() =>
        triggers.value
            .map(getTriggerPresentation)
            .sort((left, right) => left.title.localeCompare(right.title))
    )

    const namedTriggerNames = computed(() => {
        const names: string[] = []
        for (const trigger of triggers.value) {
            const lexResult = lex(trigger.dslSource)
            const parsed = parse(lexResult.tokens)
            for (const def of parsed.ast.body) {
                if (def.type === 'NamedTriggerDef') names.push(def.name)
            }
        }
        return [...new Set(names)].sort((left, right) => left.localeCompare(right))
    })

    const monacoModel = computed<ScriptDef | null>(() => {
        if (!selectedTrigger.value) return null
        return {
            id: selectedTrigger.value.id,
            name: selectedTrigger.value.id,
            scope: selectedTrigger.value.scope,
            codeTs: selectedTrigger.value.dslSource,
        }
    })

    const containerRef = useTemplateRef('containerRef')
    const isSaving = ref(false)
    const markerOwner = 'mava-trigger-dsl'
    let validateTimer: ReturnType<typeof setTimeout> | null = null
    let quickFixProvider: MonacoNS.IDisposable | null = null
    let completionProvider: MonacoNS.IDisposable | null = null
    let hoverProvider: MonacoNS.IDisposable | null = null
    let lastCompileStatusKey = ''
    const quickFixByMarkerKey = new Map<string, string>()

    const { isReady, getEditor, getMonaco } = useMonaco(containerRef, monacoModel, {
        language: 'mava-trigger',
        onChange(value) {
            if (!selectedTrigger.value) return
            project.upsertDslTrigger({
                ...selectedTrigger.value,
                dslSource: value,
            })
            queueValidation(value)
        },
        async onSave(value) {
            if (!selectedTrigger.value) return
            isSaving.value = true
            project.upsertDslTrigger({
                ...selectedTrigger.value,
                dslSource: value,
            })
            runValidation(value)
            terminal.info(`Trigger ${selectedTrigger.value.id} saved.`)
            isSaving.value = false
        },
    })

    function markerKey(marker: {
        code: string
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
    }, uri: string): string {
        return [
            uri,
            marker.code,
            marker.startLineNumber,
            marker.startColumn,
            marker.endLineNumber,
            marker.endColumn,
        ].join(':')
    }

    function mapSeverity(
        monaco: typeof MonacoNS,
        severity: 'error' | 'warning' | 'info',
    ): MonacoNS.MarkerSeverity {
        if (severity === 'error') return monaco.MarkerSeverity.Error
        if (severity === 'warning') return monaco.MarkerSeverity.Warning
        return monaco.MarkerSeverity.Info
    }

    function buildRegistry() {
        const pagesCache = pages.pagesCache as Record<string, import('../../types/project').Page>
        const elements = Object.values(pagesCache).reduce<Record<string, import('../../types/element').Element>>((acc, page) => {
            for (const [id, el] of Object.entries(page.elements ?? {})) {
                acc[id] = el as unknown as import('../../types/element').Element
            }
            return acc
        }, {})

        return {
            elements,
            variables: { ...variables.definitions },
            scripts: { ...project.actionScripts },
            namedTriggers: new Set(Object.keys(project.dslTriggers ?? {})),
            pages: new Set(Object.keys(project.pageMetaById ?? {})),
            lessons: new Set(Object.keys(project.lessonsById ?? {})),
        }
    }

    function setModelDiagnostics(
        diagnostics: Array<{
            code: string
            severity: 'error' | 'warning' | 'info'
            message: string
            line: number
            col: number
            endLine: number
            endCol: number
            quickFix?: string
        }>,
    ) {
        const monaco = getMonaco()
        const editor = getEditor()
        const model = editor?.getModel()
        if (!monaco || !editor || !model) return

        quickFixByMarkerKey.clear()

        const markers: MonacoNS.editor.IMarkerData[] = diagnostics.map((diag) => {
            const lineCount = Math.max(1, model.getLineCount())
            const line = Math.min(Math.max(diag.line, 1), lineCount)
            const endLine = Math.min(Math.max(diag.endLine, line), lineCount)
            const maxStartCol = model.getLineMaxColumn(line)
            const maxEndCol = model.getLineMaxColumn(endLine)
            const startColumn = Math.min(Math.max(diag.col, 1), maxStartCol)
            const endColumn = Math.min(Math.max(diag.endCol, startColumn + 1), maxEndCol)

            const marker: MonacoNS.editor.IMarkerData = {
                code: diag.code,
                severity: mapSeverity(monaco, diag.severity),
                message: `[${diag.code}] ${diag.message}`,
                source: 'Mava DSL',
                startLineNumber: line,
                startColumn,
                endLineNumber: endLine,
                endColumn,
            }

            if (diag.quickFix && diag.quickFix.trim()) {
                quickFixByMarkerKey.set(
                    markerKey(
                        {
                            code: diag.code,
                            startLineNumber: marker.startLineNumber,
                            startColumn: marker.startColumn,
                            endLineNumber: marker.endLineNumber,
                            endColumn: marker.endColumn,
                        },
                        model.uri.toString(),
                    ),
                    diag.quickFix,
                )
            }

            return marker
        })

        monaco.editor.setModelMarkers(model, markerOwner, markers)
    }

    function runValidation(source: string) {
        const lexResult = lex(source)
        const parseResult = parse(lexResult.tokens)
        const validateResult = validate(parseResult.ast, buildRegistry())

        const allDiagnostics = [
            ...lexResult.diagnostics,
            ...parseResult.diagnostics,
            ...validateResult.diagnostics,
        ]

        setModelDiagnostics(allDiagnostics)
        const displayName = triggerItems.value.find(item => item.id === selectedTrigger.value?.id)?.title
            ?? selectedTrigger.value?.id
            ?? 'trigger'
        logCompileStatus(displayName, allDiagnostics)
    }

    function logCompileStatus(triggerName: string, diagnostics: Array<{ severity: 'error' | 'warning' | 'info' }>) {
        const errorCount = diagnostics.filter(diag => diag.severity === 'error').length
        const warningCount = diagnostics.filter(diag => diag.severity === 'warning').length
        const infoCount = diagnostics.filter(diag => diag.severity === 'info').length
        const statusKey = `${triggerName}:${errorCount}:${warningCount}:${infoCount}`

        if (statusKey === lastCompileStatusKey) return
        lastCompileStatusKey = statusKey

        const summary = `Trigger ${triggerName} compile status: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}, ${infoCount} info.`

        if (errorCount > 0) {
            terminal.error(summary)
        } else if (warningCount > 0) {
            terminal.warn(summary)
        } else {
            terminal.info(summary)
        }
    }

    function queueValidation(source: string) {
        if (validateTimer) {
            clearTimeout(validateTimer)
        }
        validateTimer = setTimeout(() => {
            runValidation(source)
            validateTimer = null
        }, 160)
    }

    function ensureQuickFixProvider() {
        if (quickFixProvider) return
        const monaco = getMonaco()
        if (!monaco) return

        quickFixProvider = monaco.languages.registerCodeActionProvider('mava-trigger', {
            provideCodeActions(model, range, context) {
                const actions: MonacoNS.languages.CodeAction[] = []
                const uri = model.uri.toString()

                for (const marker of context.markers) {
                    const code = typeof marker.code === 'string'
                        ? marker.code
                        : typeof marker.code === 'object' && marker.code
                            ? String(marker.code.value)
                            : ''
                    if (!code) continue

                    const key = markerKey(
                        {
                            code,
                            startLineNumber: marker.startLineNumber,
                            startColumn: marker.startColumn,
                            endLineNumber: marker.endLineNumber,
                            endColumn: marker.endColumn,
                        },
                        uri,
                    )
                    const replacement = quickFixByMarkerKey.get(key)
                    if (!replacement) continue

                    actions.push({
                        title: `Apply quick fix (${code})`,
                        kind: 'quickfix',
                        diagnostics: [marker],
                        edit: {
                            edits: [{
                                resource: model.uri,
                                versionId: model.getVersionId(),
                                textEdit: {
                                    range: new monaco.Range(
                                        marker.startLineNumber,
                                        marker.startColumn,
                                        marker.endLineNumber,
                                        marker.endColumn,
                                    ),
                                    text: replacement,
                                },
                            }],
                        },
                        isPreferred: true,
                    })
                }

                return {
                    actions,
                    dispose: () => {
                        void range
                    },
                }
            },
        })
    }

    function ensureCompletionProvider() {
        if (completionProvider) return
        const monaco = getMonaco()
        if (!monaco) return

        completionProvider = monaco.languages.registerCompletionItemProvider('mava-trigger', {
            triggerCharacters: [' ', '.', '[', '{', '"'],
            provideCompletionItems(model, position) {
                const word = model.getWordUntilPosition(position)
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                }

                const snippets = [
                    ['on', 'on ', 'Start a trigger'],
                    ['when', 'when ', 'Begin a conditional body'],
                    ['then', 'then ', 'Start the action block'],
                    ['elsewhen', 'elsewhen ', 'Add another condition'],
                    ['else', 'else', 'Add a fallback branch'],
                    ['end', 'end', 'Close the trigger body'],
                    ['either', 'either ', 'Any listed event may fire'],
                    ['all', 'all of ', 'Require all listed events'],
                    ['show', 'show ', 'Show elements'],
                    ['hide', 'hide ', 'Hide elements'],
                    ['enable', 'enable ', 'Enable interactive elements'],
                    ['disable', 'disable ', 'Disable interactive elements'],
                    ['highlight', 'highlight ', 'Highlight elements'],
                    ['play', 'play ', 'Play media'],
                    ['run', 'run ', 'Run animations'],
                    ['navigate', 'navigate ', 'Navigate to a page'],
                    ['lock', 'lock ', 'Lock a page or section'],
                    ['unlock', 'unlock ', 'Unlock a page or section'],
                    ['submit', 'submit ', 'Submit a form'],
                    ['wait', 'wait ', 'Pause execution'],
                    ['execute', 'execute ', 'Run a script'],
                    ['trigger', 'trigger ', 'Invoke a named trigger'],
                    ['after', 'after ', 'Add a delay'],
                    ['not', 'not ', 'Negate a condition'],
                    ['and', 'and ', 'Combine conditions'],
                    ['or', 'or ', 'Combine alternatives'],
                ]

                const items: MonacoNS.languages.CompletionItem[] = snippets.map(([label, insertText, detail]) => ({
                    label,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText,
                    detail,
                    documentation: KEYWORD_DOCS[label] ?? detail,
                    range,
                }))

                for (const eventName of EVENT_NAMES) {
                    items.push({
                        label: eventName,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: eventName,
                        detail: 'event',
                        documentation: EVENT_DOCS[eventName] ?? 'Event',
                        range,
                    })
                }

                const triggerNames = namedTriggerNames.value
                const scriptNames = Object.values(project.actionScripts ?? {}).map(script => script.name)
                const variableNames = Object.values(variables.definitions ?? {}).map(def => def.name)
                const pageNames = Object.values(project.pageMetaById ?? {}).map(page => page.name)
                const activePage = pages.getActivePageData()
                const elementIds = activePage
                    ? Object.values(activePage.elements ?? {}).map(element => element.id)
                    : []

                for (const name of [...new Set([...triggerNames, ...scriptNames, ...variableNames, ...pageNames, ...elementIds])]) {
                    items.push({
                        label: name,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        insertText: name,
                        range,
                    })
                }

                items.push(
                    {
                        label: 'trigger block',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'on ${1:click} [${2:element_id}]\n  ${3:show} [${4:target}]\nend',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Short-form trigger block',
                        range,
                    },
                    {
                        label: 'trigger with condition',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'on ${1:click} [${2:element_id}]\nwhen ${3:variable} ${4:>} ${5:0}\nthen\n  ${6:show} [${7:target}]\nend',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Conditional trigger block',
                        range,
                    },
                    {
                        label: 'named trigger',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: 'trigger ${1:name}\n  on ${2:click} [${3:element_id}]\n  then\n    ${4:show} [${5:target}]\n  end\nend',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'Named reusable trigger definition',
                        range,
                    },
                )

                return { suggestions: items }
            },
        })
    }

    function ensureHoverProvider() {
        if (hoverProvider) return
        const monaco = getMonaco()
        if (!monaco) return

        hoverProvider = monaco.languages.registerHoverProvider('mava-trigger', {
            provideHover(model, position) {
                const word = model.getWordAtPosition(position)
                if (!word) return null

                const token = word.word
                const lineContent = model.getLineContent(position.lineNumber)
                const lineSlice = lineContent.slice(Math.max(0, word.startColumn - 1))
                const eventMatch = lineSlice.match(/^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+/)
                const fullToken = eventMatch?.[0] ?? token
                const doc = EVENT_DOCS[fullToken] ?? KEYWORD_DOCS[token]
                if (!doc) return null

                return {
                    range: new monaco.Range(
                        position.lineNumber,
                        word.startColumn,
                        position.lineNumber,
                        word.endColumn,
                    ),
                    contents: [{ value: doc }],
                }
            },
        })
    }

    watch(
        () => isReady.value,
        (ready) => {
            if (!ready) return
            ensureQuickFixProvider()
            ensureCompletionProvider()
            ensureHoverProvider()
            runValidation(selectedTrigger.value?.dslSource ?? '')
        },
        { immediate: true }
    )

    watch(
        selectedId,
        () => {
            const monaco = getMonaco()
            const editor = getEditor()
            const model = editor?.getModel()
            if (monaco && model) {
                monaco.editor.setModelMarkers(model, markerOwner, [])
            }
            quickFixByMarkerKey.clear()
            lastCompileStatusKey = ''
            queueValidation(selectedTrigger.value?.dslSource ?? '')
        }
    )

    watch(
        () => [project.actionScripts, project.dslTriggers, project.pageMetaById, project.lessonsById, variables.definitions, pages.pagesCache],
        () => {
            queueValidation(selectedTrigger.value?.dslSource ?? '')
        },
        { deep: true }
    )

    onUnmounted(() => {
        if (validateTimer) {
            clearTimeout(validateTimer)
            validateTimer = null
        }
        quickFixProvider?.dispose()
        quickFixProvider = null
        completionProvider?.dispose()
        completionProvider = null
        hoverProvider?.dispose()
        hoverProvider = null
        quickFixByMarkerKey.clear()
    })


    // watch(
    //     triggers,
    //     () => {
    //         if (selectedId.value === null) return
    //         if (selectedId.value && project.dslTriggers[selectedId.value]) return
    //         const preferred = terminal.selectedTriggerId
    //         if (preferred && project.dslTriggers[preferred]) {
    //             selectedId.value = preferred
    //             return
    //         }
    //         selectedId.value = triggers.value[0]?.id ?? null
    //     },
    //     { immediate: true }
    // )

</script>

<template>
    <div class="script-editor">
        <div class="editor-area bg-slate-950">
            <div v-if="!selectedId" class="editor-empty absolute top-0 right-0 left-0 z-30 bg-slate-950">
                No trigger selected. Create one to get started.
            </div>
            
            <div class="editor-shell">
                <div ref="containerRef" class="editor-mount"></div>
                <div v-if="!isReady" class="editor-loading">
                    <div class="editor-loading__card">
                        <div class="editor-loading__spinner"></div>
                        <p class="editor-loading__text">Preparing Editor...</p>
                    </div>
                </div>
            </div>

            <div v-if="isSaving" class="editor-status">
                Saving...
            </div>
        </div>

        <aside class="trigger-list">
            <ul class="thin-scroll">
                <li
                    v-for="trigger in triggerItems"
                    :key="trigger.id"
                    class="trigger-item group"
                    :class="selectedId === trigger.id ? 'active-trigger' : 'bg-transparent'"
                    @click="terminal.setSelectedTriggerId(trigger.id)"
                >
                    <span class="trigger-item__text">
                        <span class="trigger-item__label">{{ trigger.title }}</span>
                        <span class="trigger-item__summary">{{ trigger.summary }}</span>
                    </span>
                </li>
            </ul>
        </aside>
    </div>
</template>

<style scoped>
    .script-editor {
        display: flex;
        height: 100%;
        overflow: hidden;
        color: #e2e8f0;
    }

    .editor-area {
        flex: 1;
        position: relative;
        overflow: hidden;
    }

    .editor-shell {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .editor-mount {
        width: 100%;
        height: 100%;
    }

    .editor-loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
        z-index: 10;
    }

    .editor-loading__card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
    }

    .editor-loading__spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(148, 163, 184, 0.25);
        border-top-color: #38bdf8;
        border-radius: 999px;
        animation: spin 0.85s linear infinite;
        flex-shrink: 0;
    }

    .editor-loading__text {
        margin: 2px 0 0;
        color: #94a3b8;
        font-size: 15px;
    }

    .editor-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #64748b;
        font-size: 13px;
    }

    .editor-status {
        position: absolute;
        bottom: 8px;
        right: 12px;
        font-size: 11px;
        color: #94a3b8;
        background: rgba(2, 6, 23, 0.72);
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 999px;
        padding: 4px 10px;
    }

    .trigger-list {
        width: 220px;
        border-left: 1px solid #1f2937;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
    }

    .trigger-list ul {
        list-style: none;
        margin: 0;
        overflow-y: auto;
        flex: 1;
    }

    .trigger-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 120ms ease, color 120ms ease, opacity 120ms ease;
    }

    .trigger-item:hover {
        background: rgba(148, 163, 184, 0.12);
    }

    .active-trigger {
        background: rgba(14, 165, 233, 0.18);
        color: #f8fafc;
    }

    .trigger-item__label {
        min-width: 0;
        display: block;
        font-size: 12px;
        line-height: 1.3;
        color: inherit;
    }

    .trigger-item__text {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .trigger-item__summary {
        min-width: 0;
        display: block;
        color: #64748b;
        font-size: 11px;
        line-height: 1.35;
        white-space: normal;
        line-clamp: 2;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .trigger-item__close {
        flex-shrink: 0;
    }

    .icon-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 14px;
        transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease;
    }

    .icon-btn:hover {
        background: rgba(148, 163, 184, 0.14);
    }

    .icon-btn--danger:hover {
        color: #f87171;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
