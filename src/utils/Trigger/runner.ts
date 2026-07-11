/**
 * runner.ts (Trigger DSL)
 *
 * Compiles a DSLTriggerDocument (lex → parse → validate → codegen) and
 * executes the generated code in a Function() scope with the injected
 * globals from context.ts — the trigger-DSL counterpart to
 * utils/scripts/runner.ts. This is what closes the loop described in
 * CLAUDE.md's step 4: trigger fires → __var write → variable store change
 * → resolveElementBindings() (resolver.ts, Phase 3.12) picks it up on the
 * next render → bound element updates on canvas.
 *
 * codegen.ts already emitted `__var[...]` reads/writes and the rest of the
 * injected-context calls — nothing in codegen needed to change. The actual
 * gap was that nothing built the context object or ran the generated code
 * at all.
 */

import { lex } from './lexer'
import { parse } from './parser'
import { validate, type ProjectRegistry } from './validator'
import { codegen } from './codegen'
import { buildTriggerContext, type NamedTriggerRegistry } from './context'
import { sanitizeId } from './registryResolve'
import { usePagesStore } from '../../stores/pages'
import { useProjectMetadataStore } from '../../stores/projectMetadata'
import { useVariableStore } from '../../stores/variables'
import { useTerminalStore } from '../../stores/terminal'
import type { DSLTriggerDocument } from '../../types/project'
import type { Element } from '../../types/element'

export interface CompileOutcome {
    ok: boolean
    code?: string
    errorSummary?: string
}

/**
 * Named triggers are global (mava_syntax.md §7: "Named triggers are global
 * and lazily loaded on first `trigger name` invocation") — a `trigger
 * <name>` call in one DSL document can target a NamedTriggerDef declared in
 * a completely different document. Parses every document's source to
 * collect every declared name project-wide, not just the current one.
 * Single source of truth for this: TriggersEditor.vue's autocomplete and
 * trigger-list naming already needed the exact same scan and now call this
 * instead of keeping a second copy in sync by hand.
 */
export function collectNamedTriggerNames(triggers: Record<string, DSLTriggerDocument>): Set<string> {
    return new Set(Object.keys(collectNamedTriggerOwners(triggers)))
}

/**
 * name -> every document id that declares it. Two documents independently
 * declaring the same named trigger isn't caught by either document's own
 * (per-document) validation pass on its own — this is what lets
 * validator.ts's cross-document duplicate check (E046) actually see the
 * collision.
 */
export function collectNamedTriggerOwners(triggers: Record<string, DSLTriggerDocument>): Record<string, string[]> {
    const owners: Record<string, string[]> = {}
    for (const trigger of Object.values(triggers)) {
        const lexResult = lex(trigger.dslSource)
        const parseResult = parse(lexResult.tokens)
        for (const def of parseResult.ast.body) {
            if (def.type === 'NamedTriggerDef') {
                (owners[def.name] ??= []).push(trigger.id)
            }
        }
    }
    return owners
}

/**
 * Does this document declare a named trigger (`trigger foo ... end`)? A
 * document that does is *global* — a reusable trigger callable from any page's
 * triggers, so it's listed and activated regardless of which page is focused.
 * A document with only unnamed `on <event>` triggers is *page-local*.
 */
export function documentHasNamedTrigger(doc: DSLTriggerDocument): boolean {
    const { tokens } = lex(doc.dslSource)
    const { ast } = parse(tokens)
    return ast.body.some(d => d.type === 'NamedTriggerDef')
}

/**
 * Scope rule shared by the Triggers list (which docs to show) and Preview
 * activation (which docs to run) so the two never disagree:
 *   - named (global) documents          → always
 *   - unnamed documents with a pageId    → only on that page
 *   - unnamed documents with no pageId   → always (legacy/unassigned — every
 *     trigger created before pageId was set at creation has pageId: null;
 *     treat those as global rather than silently hiding them)
 */
export function triggerAppliesToPage(doc: DSLTriggerDocument, activePageId: string | null): boolean {
    if (documentHasNamedTrigger(doc)) return true
    if (doc.pageId == null) return true
    return doc.pageId === activePageId
}

/**
 * Groups an array of `{id, ...}`-shaped values by the *sanitized* form of
 * `.name` — shared shape for elements/pages/lessons name maps. Keyed by
 * `sanitizeId(name)`, not the raw display name: DSL identifiers can't
 * contain spaces or punctuation (lexer.ts), but "Submit Button" is a
 * perfectly normal thing to name an element elsewhere in the app. An
 * author writes `[Submit_Button]`; sanitizing both sides the same way is
 * what makes that resolve. See registryResolve.ts's sanitizeId doc comment.
 */
function groupIdsByName<T extends { id: string }>(items: T[], nameOf: (item: T) => string): Record<string, string[]> {
    const byName: Record<string, string[]> = {}
    for (const item of items) {
        (byName[sanitizeId(nameOf(item))] ??= []).push(item.id)
    }
    return byName
}

/** Single source of truth for the registry shape — TriggersEditor.vue's live-diagnostics pass imports and calls this directly rather than keeping its own copy in sync by hand. */
export function buildProjectRegistry(): ProjectRegistry {
    const pages = usePagesStore()
    const project = useProjectMetadataStore()
    const variables = useVariableStore()

    const pagesCache = pages.pagesCache as Record<string, import('../../types/project').Page>
    const elementList = Object.values(pagesCache).flatMap(page => Object.values(page.elements ?? {})) as Element[]
    const elements = elementList.reduce<Record<string, Element>>((acc, el) => {
        acc[el.id] = el
        return acc
    }, {})

    const pageMetas = Object.values(project.pageMetaById ?? {})
    const lessons = Object.values(project.lessonsById ?? {})

    const lessonFirstPageId: Record<string, string> = {}
    for (const lesson of lessons) {
        const first = [...lesson.pages].sort((a, b) => a.order - b.order)[0]
        if (first) lessonFirstPageId[lesson.id] = first.id
    }

    return {
        elements,
        elementIdsByName: groupIdsByName(elementList, el => el.name),
        variables: { ...variables.definitions },
        scripts: { ...project.actionScripts },
        namedTriggers: collectNamedTriggerNames(project.dslTriggers ?? {}),
        namedTriggerOwners: collectNamedTriggerOwners(project.dslTriggers ?? {}),
        pages: new Set(Object.keys(project.pageMetaById ?? {})),
        pageIdsByName: groupIdsByName(pageMetas, p => p.name),
        lessons: new Set(Object.keys(project.lessonsById ?? {})),
        lessonIdsByName: groupIdsByName(lessons, l => l.metadata.title),
        lessonFirstPageId,
    }
}

export function compileDslTrigger(
    source: string,
    registry: ProjectRegistry,
    currentDocumentId?: string,
): CompileOutcome {
    const lexResult = lex(source)
    const parseResult = parse(lexResult.tokens)
    const validateResult = validate(parseResult.ast, registry, currentDocumentId)

    const allDiagnostics = [...lexResult.diagnostics, ...parseResult.diagnostics, ...validateResult.diagnostics]
    const errors = allDiagnostics.filter(d => d.severity === 'error')

    if (errors.length) {
        return {
            ok: false,
            errorSummary: errors.map(e => `[${e.code}] ${e.message} (line ${e.line})`).join('; '),
        }
    }

    const { code } = codegen(parseResult.ast, registry)
    return { ok: true, code }
}

const CONTEXT_PARAM_NAMES = [
    '__el', '__var', '__page', '__dispatch', '__watch',
    '__on', '__off', '__navigate', '__lock', '__unlock', '__waitMs',
    '__namedTriggers',
] as const

/**
 * Compiles and runs a single trigger document, returning a cleanup function.
 * On compile failure, logs to the terminal and returns a no-op cleanup —
 * callers don't need to branch on success/failure themselves.
 *
 * @param namedTriggerRegistry Shared across every document activated in the
 * same batch (see `activateDslTriggers`) so `trigger <name>` calls resolve
 * across document boundaries. Defaults to a fresh, single-use Map — correct
 * only when activating one document in isolation with no cross-document
 * trigger calls (e.g. a future "test this trigger alone" tool), not the
 * normal page-activation path.
 */
export function activateDslTrigger(
    trigger: DSLTriggerDocument,
    registry: ProjectRegistry,
    namedTriggerRegistry: NamedTriggerRegistry = new Map(),
): () => void {
    const terminal = useTerminalStore()
    const outcome = compileDslTrigger(trigger.dslSource, registry, trigger.id)

    if (!outcome.ok || !outcome.code) {
        terminal.error(`Trigger "${trigger.id}" failed to compile: ${outcome.errorSummary ?? 'unknown error'}`)
        return () => {}
    }

    const ctx = buildTriggerContext(namedTriggerRegistry)

    try {
        const fn = new Function(...CONTEXT_PARAM_NAMES, outcome.code)
        const cleanup = fn(...CONTEXT_PARAM_NAMES.map(name => (ctx as unknown as Record<string, unknown>)[name]))
        return typeof cleanup === 'function' ? cleanup : () => {}
    } catch (err) {
        terminal.error(`Trigger "${trigger.id}" threw during activation: ${(err as Error).message}`)
        return () => {}
    }
}

/**
 * Activates every enabled trigger applicable to the current page (global
 * scope, or page scope matching the active page) and returns a single
 * cleanup function that tears all of them down.
 *
 * All documents activated here share one `namedTriggerRegistry` — each
 * document's own NamedTriggerDefs register themselves into it as they
 * activate (see codegen.ts), and any document's `trigger <name>` action
 * reads from the same map, regardless of which document declared the
 * target. Since every document is compiled and run synchronously in this
 * loop before this function returns, the map is always fully populated by
 * the time any *real* event (async by nature — a click, a timer, a lifecycle
 * CustomEvent) can actually invoke a `trigger <name>` action.
 */
export function activateDslTriggers(triggers: Record<string, DSLTriggerDocument>): () => void {
    const pages = usePagesStore()
    const registry = buildProjectRegistry()
    const activePageId = pages.activePageId
    const namedTriggerRegistry: NamedTriggerRegistry = new Map()

    const cleanups: Array<() => void> = []

    for (const trigger of Object.values(triggers)) {
        if (!trigger.enabled) continue
        // Named (global) docs run on every page; unnamed docs only on their
        // own page — same rule the Triggers list uses. Replaces the old
        // `trigger.scope === 'page'` check, which never fired because every
        // document was hardcoded scope:'global' at creation.
        if (!triggerAppliesToPage(trigger, activePageId)) continue
        cleanups.push(activateDslTrigger(trigger, registry, namedTriggerRegistry))
    }

    return () => cleanups.forEach(fn => fn())
}
