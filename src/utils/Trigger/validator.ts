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
    SubjectNode, ConditionalBodyNode, ShortBodyNode,
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
    elements: Record<string, Element>
    variables: Record<string, VariableDef>
    scripts: Record<string, ScriptDef>
    namedTriggers: Set<string>               // names declared in this DSL program
    pages: Set<string>               // page ids in the project
    lessons: Set<string>               // lesson ids in the project
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
            for (const id of def.members) {
                if (!registry.elements[id]) {
                    diag('E001', 'error', `Element '${id}' not found in project.`, def)
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
                'E014', 'error',
                `'${event.name}' is a timeline event. Ensure this page has a timeline configured, otherwise this trigger will never fire.`,
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
                for (const id of subject.ids) {
                    if (!registry.elements[id]) {
                        if (isNamed) {
                            diag('W005', 'warning', `Element '${id}' not found on current page — will error at invocation time.`, subject)
                        } else {
                            diag('E001', 'error', `Element '${id}' not found in project.`, subject)
                        }
                    }
                }
                break

            case 'group':
                for (const name of subject.ids) {
                    if (!declaredGroups.has(name)) {
                        // Could be a single element id used without brackets
                        if (registry.elements[name]) {
                            diag(
                                'W007', 'warning',
                                `'${name}' looks like an element id. Did you mean [${name}]?`,
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
                if (subject.ref) {
                    const { refType, name } = subject.ref
                    if (refType === 'p' && !registry.pages.has(name)) {
                        diag('E001', 'error', `Page '${name}' not found in project.`, subject.ref)
                    }
                    if (refType === 'l' && !registry.lessons.has(name)) {
                        diag('E001', 'error', `Lesson '${name}' not found in project.`, subject.ref)
                    }
                }
                break
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
            case 'TriggerAction': {
                if (!declaredNamedTriggers.has(action.triggerName)) {
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

    function resolveTargetIds(target: SubjectNode): string[] {
        if (target.kind === 'element-list') return target.ids
        if (target.kind === 'group') {
            const group = declaredGroups.get(target.ids[0])
            return group?.members ?? []
        }
        return []
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
        const ids = resolveTargetIds(action.target)
        for (const id of ids) {
            if (!isPageOrSection(id, registry)) {
                // Check if it's an element — common mistake
                if (registry.elements[id]) {
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
            // Already validated in subject validator
            return
        }
        const ids = resolveTargetIds(target)
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