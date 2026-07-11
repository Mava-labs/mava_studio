/**
 * validator.ts
 *
 * Walks a parsed Mava DSL AST and validates it against the project registry.
 * Produces errors, warnings, and info diagnostics with precise positions.
 * Does NOT mutate the AST — returns a diagnostic list only.
 *
 * Validation covers:
 *   - Element references exist in element registry
 *   - Variable references exist in variable store
 *   - Script names exist in actionScripts
 *   - Named trigger references exist
 *   - Group names are unique and members resolve
 *   - Action/target type compatibility
 *   - Assignment type compatibility
 *   - Structural rules (unreachable branches, etc.)
 *   - Contextual warnings (show in unmount, navigate in mount, etc.)
 */

import type {
    ProgramNode,
    GroupDefNode, NamedTriggerDefNode, TriggerDefNode,
    TriggerBodyNode, EventClauseNode, EventSpecNode,
    SubjectNode, StructuralRefNode, ConditionalBodyNode, ShortBodyNode,
    ExprNode,
    ComparisonNode, IdentifierNode, LiteralNode,
    ActionNode, AssignActionNode,
    TriggerActionNode, NavigateActionNode,
    TargetedActionNode,
} from './ast'

import type { Element, FlatHtmlElement, ContainerElement } from '../../types/element'
import type { VariableDef } from '../../types/variables'
import type { ScriptDef } from '../../types/project'

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Everything the validator needs to know about the project.
 * Passed in from the outside — validator has no store access.
 */
export interface ProjectRegistry {
    /** Keyed by element.id — the real, system-generated id (matches data-eid in the DOM). */
    elements: Record<string, Element>
    /**
     * Keyed by element.name — what an author actually types in DSL source
     * ([brackets], group members). A name can map to more than one id if
     * two elements share a name; see registryResolve.ts for how that's
     * handled at each use site.
     */
    elementIdsByName: Record<string, string[]>
    variables: Record<string, VariableDef>
    scripts: Record<string, ScriptDef>
    namedTriggers: Set<string>               // every named trigger name declared project-wide
    /** name -> every document id that declares it — for cross-document duplicate detection. */
    namedTriggerOwners: Record<string, string[]>
    pages: Set<string>               // page ids in the project
    /** Keyed by page display name — what an author types in `{\p name}` / `navigate [name]`. */
    pageIdsByName: Record<string, string[]>
    lessons: Set<string>               // lesson ids in the project
    /** Keyed by lesson title — what an author types in `{\l name}`. */
    lessonIdsByName: Record<string, string[]>
    /** lesson id -> that lesson's first page id (by `order`) — the interpretation used for `navigate {\l name}`, since there's no other defined "enter a lesson" behavior anywhere in the app. */
    lessonFirstPageId: Record<string, string>
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export type ValidateDiagSeverity = 'error' | 'warning' | 'info'

export interface ValidateDiagnostic {
    code: string
    severity: ValidateDiagSeverity
    message: string
    line: number
    col: number
    endLine: number
    endCol: number
    quickFix?: string
}

export interface ValidateResult {
    diagnostics: ValidateDiagnostic[]
}

// ─── Element type helpers ─────────────────────────────────────────────────────

const MEDIA_TYPES = new Set(['video', 'audio'])
const INTERACTIVE = new Set(['button', 'input', 'textarea', 'label', 'select'])

function isMediaElement(el: Element): boolean {
    return el.kind === 'flatHtml' && MEDIA_TYPES.has((el as FlatHtmlElement).type)
}

function isAnimationElement(el: Element): boolean {
    return el.kind === 'svg'
}

function isInteractiveElement(el: Element): boolean {
    return el.kind === 'flatHtml' && INTERACTIVE.has((el as FlatHtmlElement).type)
}

function isFormElement(el: Element): boolean {
    return el.kind === 'container' && (el as ContainerElement).type === 'form'
}

function isPageOrSection(id: string, registry: ProjectRegistry): boolean {
    return registry.pages.has(id)
}

// ─── Lifecycle context ────────────────────────────────────────────────────────

/**
 * Track which lifecycle events are active so we can warn about
 * contextually impossible actions.
 */
type LifecycleContext =
    | 'mount'
    | 'before.mount'
    | 'unmount'
    | 'before.unmount'
    | 'leave'
    | 'other'

function getLifecycleContext(eventName: string): LifecycleContext {
    if (eventName === 'mount') return 'mount'
    if (eventName === 'before.mount') return 'before.mount'
    if (eventName === 'unmount') return 'unmount'
    if (eventName === 'before.unmount') return 'before.unmount'
    if (eventName === 'leave') return 'leave'
    return 'other'
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validate(
    ast: ProgramNode,
    registry: ProjectRegistry,
    /**
     * The DSLTriggerDocument id this AST was parsed from — needed to tell
     * "this name is declared here and nowhere else" apart from "this name
     * collides with a different document" when checking
     * registry.namedTriggerOwners. Omit only for standalone/test parsing
     * that isn't tied to a real project document; the cross-document
     * duplicate check is skipped in that case rather than risking a false
     * positive against every other owner.
     */
    currentDocumentId?: string,
): ValidateResult {

    const diagnostics: ValidateDiagnostic[] = []

    // Collected during first pass — used for cross-reference checks
    const declaredGroups: Map<string, GroupDefNode> = new Map()
    const declaredNamedTriggers: Map<string, NamedTriggerDefNode> = new Map()

    // ── Helpers ───────────────────────────────────────────────────────────────

    function diag(
        code: string,
        severity: ValidateDiagSeverity,
        message: string,
        node: { line: number; col: number },
        endNode?: { line: number; col: number },
        quickFix?: string,
    ) {
        diagnostics.push({
            code, severity, message,
            line: node.line,
            col: node.col,
            endLine: endNode?.line ?? node.line,
            endCol: (endNode?.col ?? node.col) + 1,
            quickFix,
        })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASS 1 — collect declarations
    // ─────────────────────────────────────────────────────────────────────────

    function collectDeclarations() {
        for (const def of ast.body) {
            if (def.type === 'GroupDef') {
                if (declaredGroups.has(def.name)) {
                    diag('E017', 'error', `Group name '${def.name}' is already declared.`, def)
                } else {
                    declaredGroups.set(def.name, def)
                }
            }
            if (def.type === 'NamedTriggerDef') {
                if (declaredNamedTriggers.has(def.name)) {
                    diag('E016', 'error', `Named trigger '${def.name}' is already declared.`, def)
                } else {
                    declaredNamedTriggers.set(def.name, def)

                    // Cross-document: named triggers are global (mava_syntax.md
                    // §7), so a name can't collide with a DIFFERENT document's
                    // declaration either, not just a repeat within this one.
                    // Reject rather than silently disambiguate (e.g. a
                    // timestamp suffix) — a silently-renamed trigger would
                    // break every existing `trigger <name>` call site
                    // referencing it, which is worse than making the author
                    // pick a different name up front.
                    if (currentDocumentId) {
                        const owners = registry.namedTriggerOwners[def.name] ?? []
                        const otherOwners = owners.filter(id => id !== currentDocumentId)
                        if (otherOwners.length > 0) {
                            diag(
                                'E046', 'error',
                                `Named trigger '${def.name}' is already declared in another trigger document. Trigger names are global — rename one of them.`,
                                def,
                            )
                        }
                    }
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASS 2 — validate all definitions
    // ─────────────────────────────────────────────────────────────────────────

    function validateProgram() {
        for (const def of ast.body) {
            switch (def.type) {
                case 'GroupDef': validateGroup(def); break
                case 'NamedTriggerDef': validateNamedTrigger(def); break
                case 'TriggerDef': validateTriggerDef(def); break
            }
        }

        // Post-pass: unused declarations
        for (const [name] of declaredGroups) {
            const used = isGroupUsedAnywhere(name)
            if (!used) {
                const node = declaredGroups.get(name)!
                diag('I003', 'info', `Group '${name}' is defined but never referenced.`, node)
            }
        }

        for (const [name] of declaredNamedTriggers) {
            const used = isNamedTriggerInvokedAnywhere(name)
            if (!used) {
                const node = declaredNamedTriggers.get(name)!
                diag('I004', 'info', `Named trigger '${name}' is defined but never invoked.`, node)
            }
        }
    }

    // ─── Group validation ─────────────────────────────────────────────────────

    function validateGroup(def: GroupDefNode) {
        if (def.groupKind === 'element') {
            // Group members are element names, same as any bracketed
            // element-list — not raw ids. Ambiguity (two elements sharing a
            // name) isn't warned about here; it's warned once per actual use
            // site instead (resolveElementIds), to avoid double-noise.
            for (const name of def.members) {
                if (!(registry.elementIdsByName[name]?.length)) {
                    diag('E001', 'error', `Element '${name}' not found in project.`, def)
                }
            }
        } else {
            // variable group
            for (const id of def.members) {
                if (!registry.variables[id]) {
                    diag('E002', 'error', `Variable '${id}' not found. Define it in the Variables panel.`, def)
                }
            }
        }
    }

    // ─── Named trigger validation ─────────────────────────────────────────────

    function validateNamedTrigger(def: NamedTriggerDefNode) {
        // Named trigger body validated same as local, but element refs
        // are warned (not errored) since they're resolved at invocation time
        validateTriggerBody(def.body, 'other', true)
    }

    // ─── Trigger definition validation ────────────────────────────────────────

    function validateTriggerDef(def: TriggerDefNode) {
        const lifecycleCtx = getLifecycleFromBody(def.body)
        validateTriggerBody(def.body, lifecycleCtx, false)
    }

    function getLifecycleFromBody(body: TriggerBodyNode): LifecycleContext {
        const events = body.eventClause.events
        // Use first event to determine context — multi-event uses loosest context
        if (events.length > 0) {
            return getLifecycleContext(events[0].name)
        }
        return 'other'
    }

    function validateTriggerBody(
        body: TriggerBodyNode,
        lifecycle: LifecycleContext,
        isNamed: boolean,
    ) {
        validateEventClause(body.eventClause, isNamed)
        validateTriggerRest(body.rest, lifecycle, isNamed)
    }

    // ─── Event clause validation ──────────────────────────────────────────────

    function validateEventClause(clause: EventClauseNode, isNamed: boolean) {
        for (const event of clause.events) {
            validateEventSpec(event, isNamed)
        }

        // all of + variable.change warning
        if (clause.qualifier === 'all-of') {
            const hasVarChange = clause.events.some(e => e.name === 'variable.change')
            const hasOther = clause.events.some(e => e.name !== 'variable.change')
            if (hasVarChange && hasOther) {
                diag(
                    'W003', 'warning',
                    "'all of' with 'variable.change' may never resolve if other events fire before the variable changes.",
                    clause,
                )
            }
        }

        // either with single event
        if (clause.qualifier === 'either' && clause.events.length === 1) {
            diag('I002', 'info', "'either' with a single event is redundant.", clause, undefined, '')
        }
    }

    function validateEventSpec(event: EventSpecNode, isNamed: boolean) {
        // timeline.* on page without timeline — we emit a warning since we
        // can't know at DSL compile time whether the page has a timeline
        if (event.name.startsWith('timeline.')) {
            diag(
                'W014', 'warning',
                `'${event.name}' is a timeline event. Ensure this page has a timeline configured, otherwise this trigger will never fire.`,
                event,
            )
        }

        // quiz.* — no quiz feature exists yet anywhere in this app (no quiz
        // element type, no quiz runtime to emit these), same unbuilt-feature
        // situation as timeline.* above. Warn, don't block authoring ahead
        // of the feature landing.
        if (event.name.startsWith('quiz.')) {
            diag(
                'W015', 'warning',
                `'${event.name}' has no quiz feature to emit it yet — this trigger will never fire until quizzes are implemented.`,
                event,
            )
        }

        if (event.subject) {
            validateSubject(event.subject, event.name, isNamed)
        }
    }

    // ─── Subject validation ───────────────────────────────────────────────────

    function validateSubject(subject: SubjectNode, _eventName: string, isNamed: boolean) {
        switch (subject.kind) {
            case 'element-list':
                for (const name of subject.ids) {
                    const matches = registry.elementIdsByName[name] ?? []
                    if (matches.length === 0) {
                        if (isNamed) {
                            diag('W005', 'warning', `Element '${name}' not found on current page — will error at invocation time.`, subject)
                        } else {
                            diag('E001', 'error', `Element '${name}' not found in project.`, subject)
                        }
                    } else if (matches.length > 1) {
                        diag('W008', 'warning', `'${name}' matches ${matches.length} elements with the same name — all will be targeted. Rename elements to make this unambiguous.`, subject)
                    }
                }
                break

            case 'group':
                for (const name of subject.ids) {
                    if (!declaredGroups.has(name)) {
                        // Could be an element name typed without brackets
                        if (registry.elementIdsByName[name]?.length) {
                            diag(
                                'W007', 'warning',
                                `'${name}' looks like an element name. Did you mean [${name}]?`,
                                subject,
                                undefined,
                                `[${name}]`,
                            )
                        } else {
                            diag('E005', 'error', `Group '${name}' is not defined.`, subject)
                        }
                    }
                }
                break

            case 'variable':
                for (const id of subject.ids) {
                    // Skip time literals — they're valid as-is
                    const isTimeLiteral = /^\d+(\.\d+)?(s|ms|m)$/.test(id)
                    if (!isNamed && !isTimeLiteral && !registry.variables[id]) {
                        diag('E002', 'error', `Variable '${id}' not found. Define it in the Variables panel.`, subject)
                    }
                }
                break

            case 'structural-ref':
                if (subject.ref) validateStructuralRef(subject.ref)
                break
        }
    }

    /** Shared by event subjects and action targets ({\p ...} is valid in both positions). */
    function validateStructuralRef(ref: StructuralRefNode) {
        const { refType, name } = ref
        if (refType === 'p' && !(registry.pageIdsByName[name]?.length)) {
            diag('E001', 'error', `Page '${name}' not found in project.`, ref)
        }
        if (refType === 'l' && !(registry.lessonIdsByName[name]?.length)) {
            diag('E001', 'error', `Lesson '${name}' not found in project.`, ref)
        }
    }

    // ─── Trigger rest validation ──────────────────────────────────────────────

    function validateTriggerRest(
        rest: ConditionalBodyNode | ShortBodyNode,
        lifecycle: LifecycleContext,
        isNamed: boolean,
    ) {
        if (rest.type === 'ShortBody') {
            validateActions(rest.actions, lifecycle, isNamed)
            return
        }

        // ConditionalBody
        for (const branch of rest.branches) {
            validateExpr(branch.condition, isNamed)
            validateActions(branch.actions, lifecycle, isNamed)
        }

        if (rest.elseBranch) {
            validateActions(rest.elseBranch.actions, lifecycle, isNamed)
        }
    }

    // ─── Expression validation ────────────────────────────────────────────────

    function validateExpr(expr: ExprNode, isNamed: boolean) {
        switch (expr.type) {
            case 'BinaryExpr':
                validateExpr(expr.left, isNamed)
                validateExpr(expr.right, isNamed)
                break
            case 'UnaryExpr':
                validateExpr(expr.operand, isNamed)
                break
            case 'Comparison':
                validateExpr(expr.left, isNamed)
                validateExpr(expr.right, isNamed)
                // Check variable types for comparison operands
                validateComparisonTypes(expr)
                break
            case 'Identifier':
                if (!isNamed && !registry.variables[expr.name]) {
                    diag('E002', 'error', `Variable '${expr.name}' not found. Define it in the Variables panel.`, expr)
                }
                break
            case 'Literal':
                // Literals are always valid — no cross-reference needed
                break
        }
    }

    function validateComparisonTypes(expr: ComparisonNode) {
        // Warn if comparing a boolean variable with > or < — likely a mistake
        if (expr.left.type === 'Identifier') {
            const def = registry.variables[expr.left.name]
            if (def?.type === 'boolean' && ['>', '>=', '<', '<='].includes(expr.op)) {
                diag(
                    'W008', 'warning',
                    `Comparing boolean variable '${expr.left.name}' with '${expr.op}' is likely a mistake. Use == or != for booleans.`,
                    expr,
                )
            }
            if ((def?.type === 'list' || def?.type === 'object') && expr.op !== '==' && expr.op !== '!=') {
                diag(
                    'W009', 'warning',
                    `Comparing list or object variable '${expr.left.name}' with '${expr.op}' is not meaningful. Use == or !=.`,
                    expr,
                )
            }
        }
    }

    // ─── Action validation ────────────────────────────────────────────────────

    function validateActions(
        actions: ActionNode[],
        lifecycle: LifecycleContext,
        isNamed: boolean,
    ) {
        for (const action of actions) {
            validateAction(action, lifecycle, isNamed)
        }
    }

    function validateAction(
        action: ActionNode,
        lifecycle: LifecycleContext,
        isNamed: boolean,
    ) {
        switch (action.type) {

            // ── Element visibility ──────────────────────────────────────────
            case 'ShowAction':
            case 'HideAction': {
                const isUnmounting =
                    lifecycle === 'unmount' ||
                    lifecycle === 'before.unmount' ||
                    lifecycle === 'leave'
                if (isUnmounting) {
                    diag(
                        'W001', 'warning',
                        `'${action.type === 'ShowAction' ? 'show' : 'hide'}' inside a page unmount/leave trigger is likely a no-op — the page is leaving. This action will be ignored at runtime.`,
                        action,
                    )
                }
                validateTargetExistsAsElement(action as TargetedActionNode, isNamed)
                break
            }

            // ── Interactive element control ─────────────────────────────────
            case 'EnableAction':
            case 'DisableAction':
                validateTargetIsInteractive(action as TargetedActionNode, isNamed)
                break

            // ── Highlight ───────────────────────────────────────────────────
            case 'HighlightAction':
                validateTargetExistsAsElement(action as TargetedActionNode, isNamed)
                break

            // ── Media ───────────────────────────────────────────────────────
            case 'PlayAction':
                validateTargetIsMedia(action as TargetedActionNode, isNamed)
                break

            // ── Animation ──────────────────────────────────────────────────
            case 'RunAction':
                validateTargetIsAnimation(action as TargetedActionNode, isNamed)
                break

            // ── pause/resume/stop — resolve by target type ─────────────────
            case 'PauseAction':
            case 'ResumeAction':
            case 'StopAction':
            case 'FinishAction':
                validateTargetIsMediaOrAnimation(action as TargetedActionNode, isNamed)
                break

            // ── Lock / unlock ───────────────────────────────────────────────
            case 'LockAction':
            case 'UnlockAction':
                validateTargetIsPageOrSection(action as TargetedActionNode, isNamed)
                break

            // ── Submit ──────────────────────────────────────────────────────
            case 'SubmitAction':
                validateTargetIsForm(action as TargetedActionNode, isNamed)
                break

            // ── Navigate ────────────────────────────────────────────────────
            case 'NavigateAction': {
                const isMounting =
                    lifecycle === 'mount' ||
                    lifecycle === 'before.mount'
                if (isMounting) {
                    diag(
                        'W002', 'warning',
                        "'navigate' inside a mount or before.mount trigger may cause a navigation loop.",
                        action,
                    )
                }
                validateNavigateTarget(action as NavigateActionNode, isNamed)
                break
            }

            // ── Wait ────────────────────────────────────────────────────────
            case 'WaitAction': {
                const val = action.duration.value
                if (typeof val === 'number' && val <= 0) {
                    diag('W004', 'warning', "'wait' with zero or negative duration will be ignored at runtime.", action)
                }
                break
            }

            // ── Execute ─────────────────────────────────────────────────────
            case 'ExecuteAction': {
                // Find script by name
                const script = Object.values(registry.scripts)
                    .find(s => s.name === action.scriptName)
                if (!script) {
                    diag('E003', 'error', `Script '${action.scriptName}' not found. Check the Scripts panel.`, action)
                } else if (!script.compiledJs) {
                    diag(
                        'I005', 'info',
                        `Script '${action.scriptName}' has no compiled output — save it in the Scripts panel to compile.`,
                        action,
                    )
                }
                break
            }

            // ── Trigger invocation ──────────────────────────────────────────
            // Named triggers are global (mava_syntax.md §7) — the target may
            // be declared in this document (declaredNamedTriggers, collected
            // in Pass 1) or in a different one entirely (registry.namedTriggers,
            // built by runner.ts's collectNamedTriggerNames() scanning every
            // document in the project). registry.namedTriggers is already a
            // superset that includes this document's own declarations, but
            // declaredNamedTriggers is checked too so this still resolves
            // correctly using only the current document's own AST in contexts
            // that build a registry without the full project (e.g. tests).
            case 'TriggerAction': {
                if (!declaredNamedTriggers.has(action.triggerName) && !registry.namedTriggers.has(action.triggerName)) {
                    diag('E004', 'error', `Named trigger '${action.triggerName}' is not defined.`, action)
                }
                break
            }

            // ── Assignment ──────────────────────────────────────────────────
            case 'AssignAction':
                validateAssignment(action, isNamed)
                break
        }
    }

    // ─── Target validators ────────────────────────────────────────────────────

    /**
     * Resolves a target/subject's raw entries (bracket list, or a declared
     * group's members) — all author-typed element *names* — down to real
     * element ids. Not-found entries pass through unchanged so the existing
     * "not found" diagnostics below still fire, now quoting the exact name
     * the author typed instead of an id they never saw. A name matching more
     * than one element expands to all of them (like a mini group) with a
     * one-time ambiguity warning here, rather than silently picking one.
     */
    function resolveTargetIds(target: SubjectNode): string[] {
        let rawNames: string[]
        if (target.kind === 'element-list') rawNames = target.ids
        else if (target.kind === 'group') {
            const group = declaredGroups.get(target.ids[0])
            rawNames = group?.members ?? []
        } else {
            return []
        }

        const resolved: string[] = []
        for (const name of rawNames) {
            const matches = registry.elementIdsByName[name] ?? []
            if (matches.length === 0) {
                resolved.push(name)
                continue
            }
            if (matches.length > 1) {
                diag('W008', 'warning', `'${name}' matches ${matches.length} elements with the same name — all will be targeted. Rename elements to make this unambiguous.`, target)
            }
            resolved.push(...matches)
        }
        return resolved
    }

    /** Same as resolveTargetIds, but against page names — a bracketed lock/unlock/navigate target can only ever mean one page, so ambiguity picks the first match with a warning instead of expanding. */
    function resolvePageTargetIds(target: SubjectNode): string[] {
        if (target.kind !== 'element-list') return [] // pages have no group concept
        const resolved: string[] = []
        for (const name of target.ids) {
            const matches = registry.pageIdsByName[name] ?? []
            if (matches.length === 0) {
                resolved.push(name)
                continue
            }
            if (matches.length > 1) {
                diag('W009', 'warning', `'${name}' matches ${matches.length} pages with the same name — the first match will be used. Rename pages to make this unambiguous.`, target)
            }
            resolved.push(matches[0])
        }
        return resolved
    }

    function validateTargetExistsAsElement(
        action: TargetedActionNode,
        isNamed: boolean,
    ) {
        const ids = resolveTargetIds(action.target)
        for (const id of ids) {
            if (!registry.elements[id]) {
                if (isNamed) {
                    diag('W005', 'warning', `Element '${id}' not found on current page — will error at invocation time.`, action)
                } else {
                    diag('E001', 'error', `Element '${id}' not found in project.`, action)
                }
            }
        }
    }

    function validateTargetIsInteractive(action: TargetedActionNode, isNamed: boolean) {
        const ids = resolveTargetIds(action.target)
        for (const id of ids) {
            const el = registry.elements[id]
            if (!el) {
                if (isNamed) {
                    diag('W005', 'warning', `Element '${id}' not found on current page — will error at invocation time.`, action)
                } else {
                    diag('E001', 'error', `Element '${id}' not found in project.`, action)
                }
                continue
            }
            if (!isInteractiveElement(el)) {
                diag(
                    'E009', 'error',
                    `'${action.type === 'EnableAction' ? 'enable' : 'disable'}' expects an interactive element (button, input, etc.), but '${id}' is a ${el.kind}.`,
                    action,
                    undefined,
                    // Suggest show/hide if it's a container
                    el.kind === 'container' ? `show [${id}]` : undefined,
                )
            }
        }
    }

    function validateTargetIsMedia(action: TargetedActionNode, isNamed: boolean) {
        const ids = resolveTargetIds(action.target)
        for (const id of ids) {
            const el = registry.elements[id]
            if (!el) {
                if (isNamed) {
                    diag('W005', 'warning', `Element '${id}' not found on current page — will error at invocation time.`, action)
                } else {
                    diag('E001', 'error', `Element '${id}' not found in project.`, action)
                }
                continue
            }
            if (!isMediaElement(el)) {
                diag(
                    'E007', 'error',
                    `'play' expects a media element (video or audio), but '${id}' is a ${el.kind}. Did you mean 'run'?`,
                    action, undefined, `run [${id}]`,
                )
            }
        }
    }

    function validateTargetIsAnimation(action: TargetedActionNode, isNamed: boolean) {
        const ids = resolveTargetIds(action.target)
        for (const id of ids) {
            const el = registry.elements[id]
            if (!el) {
                if (isNamed) {
                    diag('W005', 'warning', `Element '${id}' not found on current page — will error at invocation time.`, action)
                } else {
                    diag('E001', 'error', `Element '${id}' not found in project.`, action)
                }
                continue
            }
            if (!isAnimationElement(el)) {
                diag(
                    'E008', 'error',
                    `'run' expects an animation element, but '${id}' is a ${el.kind}. Did you mean 'play'?`,
                    action, undefined, `play [${id}]`,
                )
            }
        }
    }

    function validateTargetIsMediaOrAnimation(action: TargetedActionNode, isNamed: boolean) {
        const ids = resolveTargetIds(action.target)
        for (const id of ids) {
            const el = registry.elements[id]
            if (!el) {
                if (isNamed) {
                    diag('W005', 'warning', `Element '${id}' not found on current page — will error at invocation time.`, action)
                } else {
                    diag('E001', 'error', `Element '${id}' not found in project.`, action)
                }
                continue
            }
            if (!isMediaElement(el) && !isAnimationElement(el)) {
                diag(
                    'E009', 'error',
                    `'${action.type.replace('Action', '').toLowerCase()}' expects a media or animation element, but '${id}' is a ${el.kind}.`,
                    action,
                )
            }
        }
    }

    function validateTargetIsForm(action: TargetedActionNode, isNamed: boolean) {
        const ids = resolveTargetIds(action.target)
        for (const id of ids) {
            const el = registry.elements[id]
            if (!el) {
                if (isNamed) {
                    diag('W005', 'warning', `Element '${id}' not found on current page — will error at invocation time.`, action)
                } else {
                    diag('E001', 'error', `Element '${id}' not found in project.`, action)
                }
                continue
            }
            if (!isFormElement(el)) {
                diag('E011', 'error', `'submit' expects a form element, but '${id}' is a ${el.kind}.`, action)
            }
        }
    }

    function validateTargetIsPageOrSection(action: TargetedActionNode, _isNamed: boolean) {
        const ids = resolvePageTargetIds(action.target)
        for (const id of ids) {
            if (!isPageOrSection(id, registry)) {
                // Check if it's actually an element name — common mistake
                if (registry.elementIdsByName[id]?.length) {
                    diag(
                        'E010', 'error',
                        `'${action.type === 'LockAction' ? 'lock' : 'unlock'}' expects a page or section, but '${id}' is an element. Did you mean 'disable [${id}]'?`,
                        action, undefined, `disable [${id}]`,
                    )
                } else {
                    diag('E001', 'error', `Page or section '${id}' not found in project.`, action)
                }
            }
        }
    }

    function validateNavigateTarget(action: NavigateActionNode, _isNamed: boolean) {
        const target = action.target
        if (target.kind === 'nav-keyword') return // 'next' and 'prev' are always valid
        if (target.kind === 'structural-ref') {
            // A structural-ref TARGET (not an event subject) was never
            // actually reaching validateSubject() — that function is only
            // called for event subjects, never action targets, despite this
            // comment previously claiming otherwise. `navigate {\p typo}`
            // compiled with zero diagnostics. Validate it directly here.
            if (target.ref) validateStructuralRef(target.ref)
            return
        }
        const ids = resolvePageTargetIds(target)
        for (const id of ids) {
            if (!registry.pages.has(id)) {
                diag('E001', 'error', `Page '${id}' not found in project.`, action)
            }
        }
    }

    // ─── Assignment validation ────────────────────────────────────────────────

    function validateAssignment(action: AssignActionNode, isNamed: boolean) {
        const def = registry.variables[action.variable]
        if (!def) {
            if (!isNamed) {
                diag('E002', 'error', `Variable '${action.variable}' not found. Define it in the Variables panel.`, action)
            }
            return
        }

        // += and -= only on numbers
        if ((action.op === '+=' || action.op === '-=') && def.type !== 'number') {
            diag(
                'E012', 'error',
                `'${action.op}' is only valid on number variables, but '${action.variable}' is a ${def.type}.`,
                action,
            )
        }

        // Type compatibility of assigned value
        if (action.value.type === 'Literal') {
            const lit = action.value as LiteralNode
            const compatible = isLiteralCompatibleWithType(lit, def.type)
            if (!compatible) {
                diag(
                    'E013', 'error',
                    `Type mismatch: variable '${action.variable}' expects ${def.type} but value is ${lit.kind}.`,
                    action,
                )
            }
        }

        // If right side is another variable, check type compatibility
        if (action.value.type === 'Identifier') {
            const rhsDef = registry.variables[(action.value as IdentifierNode).name]
            if (rhsDef && rhsDef.type !== def.type) {
                diag(
                    'W010', 'warning',
                    `Assigning ${rhsDef.type} variable '${(action.value as IdentifierNode).name}' to ${def.type} variable '${action.variable}' — types differ.`,
                    action,
                )
            }
        }
    }

    function isLiteralCompatibleWithType(
        lit: LiteralNode,
        varType: VariableDef['type'],
    ): boolean {
        switch (varType) {
            case 'string': return lit.kind === 'string'
            case 'number': return lit.kind === 'number' || lit.kind === 'percent' || lit.kind === 'pixels'
            case 'boolean': return lit.kind === 'bool'
            case 'list': return lit.kind === 'list'
            case 'object': return lit.kind === 'object'
        }
    }

    // ─── Usage checkers (for unused declaration warnings) ────────────────────

    function isGroupUsedAnywhere(name: string): boolean {
        return checkActionsInProgram(action =>
            'target' in action &&
            (action as TargetedActionNode).target.kind === 'group' &&
            (action as TargetedActionNode).target.ids.includes(name)
        )
    }

    function isNamedTriggerInvokedAnywhere(name: string): boolean {
        return checkActionsInProgram(action =>
            action.type === 'TriggerAction' &&
            (action as TriggerActionNode).triggerName === name
        )
    }

    function checkActionsInProgram(predicate: (a: ActionNode) => boolean): boolean {
        for (const def of ast.body) {
            if (def.type === 'NamedTriggerDef' || def.type === 'TriggerDef') {
                const body = def.type === 'NamedTriggerDef' ? def.body : def.body
                if (checkActionsInBody(body, predicate)) return true
            }
        }
        return false
    }

    function checkActionsInBody(
        body: TriggerBodyNode,
        predicate: (a: ActionNode) => boolean,
    ): boolean {
        const rest = body.rest
        if (rest.type === 'ShortBody') {
            return rest.actions.some(predicate)
        }
        for (const branch of rest.branches) {
            if (branch.actions.some(predicate)) return true
        }
        if (rest.elseBranch?.actions.some(predicate)) return true
        return false
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RUN
    // ─────────────────────────────────────────────────────────────────────────

    collectDeclarations()
    validateProgram()

    return { diagnostics }
}