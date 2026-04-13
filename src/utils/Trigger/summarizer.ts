/**
 * summarizer.ts
 *
 * Walks a validated Mava DSL AST and produces human-readable
 * intent summaries for each trigger definition.
 *
 * Output is used in the UI to show authors what each trigger does
 * without reading the DSL source.
 *
 * Format:
 *   {
 *     name:    string          // trigger name or "Unnamed trigger"
 *     summary: string          // 1-2 natural language sentences
 *   }
 */

import type {
    ProgramNode,
    TriggerBodyNode,
    EventClauseNode,
    EventSpecNode,
    SubjectNode,
    ConditionalBodyNode,
    ShortBodyNode,
    ExprNode,
    IdentifierNode,
    LiteralNode,
    ActionNode,
    TargetedActionNode,
    WaitActionNode,
    ExecuteActionNode,
    TriggerActionNode,
    AssignActionNode,
    NavigateActionNode,
} from './ast'

// ─── Output ───────────────────────────────────────────────────────────────────

export interface TriggerSummary {
    name: string
    summary: string
}

const MAX_SUMMARY_LENGTH = 120

// ─── Entry point ──────────────────────────────────────────────────────────────

export function summarize(ast: ProgramNode): TriggerSummary[] {
    const summaries: TriggerSummary[] = []

    for (const def of ast.body) {
        if (def.type === 'NamedTriggerDef') {
            summaries.push({
                name: def.name,
                summary: summarizeBody(def.body),
            })
        }
        if (def.type === 'TriggerDef') {
            summaries.push({
                name: 'Unnamed trigger',
                summary: summarizeBody(def.body),
            })
        }
    }

    return summaries
}

// ─── Body summarizer ──────────────────────────────────────────────────────────

function summarizeBody(body: TriggerBodyNode): string {
    const event = summarizeEventClause(body.eventClause)
    const rest = summarizeRest(body.rest)
    const full = `${event}, ${rest}`
    return truncate(full)
}

// ─── Event clause ─────────────────────────────────────────────────────────────

function summarizeEventClause(clause: EventClauseNode): string {
    if (clause.events.length === 1) {
        return `When ${summarizeEventSpec(clause.events[0])}`
    }

    const qualifier = clause.qualifier === 'all-of'
        ? 'all of the following occur'
        : 'any of the following occur'

    const eventList = clause.events
        .map(e => summarizeEventSpec(e))
        .join('; ')

    return `When ${qualifier}: ${eventList}`
}

function summarizeEventSpec(event: EventSpecNode): string {
    const subj = event.subject ? ` on ${summarizeSubject(event.subject)}` : ''
    return `${humanizeEvent(event.name)}${subj}`
}

function humanizeEvent(name: string): string {
    const map: Record<string, string> = {
        'click': 'clicked',
        'dblclick': 'double-clicked',
        'hover': 'hovered',
        'focus': 'focused',
        'blur': 'blurred',
        'keypress': 'key pressed',
        'keydown': 'key held down',
        'keyup': 'key released',
        'submit': 'form submitted',
        'mount': 'page mounts',
        'before.mount': 'page is about to mount',
        'unmount': 'page unmounts',
        'before.unmount': 'page is about to unmount',
        'enter': 'page is entered',
        'leave': 'page is left',
        'media.play': 'media starts playing',
        'media.pause': 'media is paused',
        'media.resume': 'media resumes',
        'media.stop': 'media stops',
        'media.complete': 'media finishes playing',
        'media.progress': 'media progress changes',
        'animation.start': 'animation starts',
        'animation.complete': 'animation completes',
        'animation.loop': 'animation loops',
        'variable.change': 'variable changes',
        'quiz.start': 'quiz starts',
        'quiz.complete': 'quiz is completed',
        'quiz.fail': 'quiz fails',
        'form.submit': 'form is submitted',
        'form.reset': 'form is reset',
        'timeline.start': 'timeline starts',
        'timeline.stop': 'timeline stops',
        'timeline.pause': 'timeline pauses',
        'timeline.resume': 'timeline resumes',
        'timeline.reaches': 'timeline reaches',
    }
    return map[name] ?? name
}

// ─── Subject ──────────────────────────────────────────────────────────────────

function summarizeSubject(subject: SubjectNode): string {
    switch (subject.kind) {
        case 'element-list':
            return subject.ids.length === 1
                ? subject.ids[0]
                : subject.ids.join(', ')

        case 'group':
            return subject.ids[0] ?? ''

        case 'variable':
            return subject.ids[0] ?? ''

        case 'structural-ref':
            if (!subject.ref) return ''
            return `${subject.ref.refType === 'p' ? 'page' : 'lesson'} "${subject.ref.name}"`

        case 'nav-keyword':
            return subject.ids[0] ?? ''

        case 'key-name':
            return `[${subject.ids[0]}]`
    }
}

// ─── Rest (conditional or short) ─────────────────────────────────────────────

function summarizeRest(rest: ConditionalBodyNode | ShortBodyNode): string {
    if (rest.type === 'ShortBody') {
        return summarizeActions(rest.actions)
    }
    return summarizeConditional(rest)
}

function summarizeConditional(body: ConditionalBodyNode): string {
    const parts: string[] = []

    for (let i = 0; i < body.branches.length; i++) {
        const branch = body.branches[i]
        const prefix = i === 0 ? 'if' : 'otherwise if'
        parts.push(
            `${prefix} ${summarizeExpr(branch.condition)}, ${summarizeActions(branch.actions)}`
        )
    }

    if (body.elseBranch) {
        parts.push(`otherwise, ${summarizeActions(body.elseBranch.actions)}`)
    }

    return parts.join('; ')
}

// ─── Expressions ─────────────────────────────────────────────────────────────

function summarizeExpr(expr: ExprNode): string {
    switch (expr.type) {
        case 'BinaryExpr':
            return `${summarizeExpr(expr.left)} ${expr.op} ${summarizeExpr(expr.right)}`

        case 'UnaryExpr':
            return `not ${summarizeExpr(expr.operand)}`

        case 'Comparison':
            return `${summarizeExpr(expr.left)} ${humanizeOp(expr.op)} ${summarizeExpr(expr.right)}`

        case 'Identifier':
            return expr.name

        case 'Literal':
            return summarizeLiteral(expr)
    }
}

function humanizeOp(op: string): string {
    const map: Record<string, string> = {
        '>': 'is greater than',
        '>=': 'is at least',
        '<': 'is less than',
        '<=': 'is at most',
        '==': 'equals',
        '!=': 'does not equal',
    }
    return map[op] ?? op
}

function summarizeLiteral(lit: LiteralNode): string {
    switch (lit.kind) {
        case 'string': return `"${lit.value}"`
        case 'bool': return lit.value ? 'true' : 'false'
        case 'list': return `[${(lit.value as unknown[]).join(', ')}]`
        case 'object': return 'an object value'
        case 'time': return String(lit.raw)
        case 'percent': return `${lit.value}%`
        case 'pixels': return `${lit.value}px`
        default: return String(lit.value)
    }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Collapses a list of actions into a readable phrase.
 * e.g. "shows tip_overlay, hides nav_bar and runs intro_animation"
 *
 * If more than MAX_ACTIONS actions, truncates with "…and N more actions".
 */
const MAX_ACTIONS = 4

function summarizeActions(actions: ActionNode[]): string {
    if (actions.length === 0) return 'does nothing'

    const visible = actions.slice(0, MAX_ACTIONS)
    const rest = actions.length - visible.length

    const phrases = visible.map(summarizeAction)
    const joined = joinList(phrases)

    return rest > 0
        ? `${joined} …and ${rest} more action${rest > 1 ? 's' : ''}`
        : joined
}

function summarizeAction(action: ActionNode): string {
    switch (action.type) {
        case 'ShowAction':
            return `shows ${summarizeTarget(action as TargetedActionNode)}`
        case 'HideAction':
            return `hides ${summarizeTarget(action as TargetedActionNode)}`
        case 'EnableAction':
            return `enables ${summarizeTarget(action as TargetedActionNode)}`
        case 'DisableAction':
            return `disables ${summarizeTarget(action as TargetedActionNode)}`
        case 'HighlightAction':
            return `highlights ${summarizeTarget(action as TargetedActionNode)}`
        case 'PlayAction':
            return `plays ${summarizeTarget(action as TargetedActionNode)}`
        case 'PauseAction':
            return `pauses ${summarizeTarget(action as TargetedActionNode)}`
        case 'ResumeAction':
            return `resumes ${summarizeTarget(action as TargetedActionNode)}`
        case 'StopAction':
            return `stops ${summarizeTarget(action as TargetedActionNode)}`
        case 'FinishAction':
            return `skips ${summarizeTarget(action as TargetedActionNode)} to end`
        case 'RunAction':
            return `runs ${summarizeTarget(action as TargetedActionNode)}`
        case 'LockAction':
            return `locks ${summarizeTarget(action as TargetedActionNode)}`
        case 'UnlockAction':
            return `unlocks ${summarizeTarget(action as TargetedActionNode)}`
        case 'SubmitAction':
            return `submits ${summarizeTarget(action as TargetedActionNode)}`
        case 'NavigateAction':
            return summarizeNavigate(action as NavigateActionNode)
        case 'WaitAction':
            return `waits ${(action as WaitActionNode).duration.raw}`
        case 'ExecuteAction':
            return `executes script "${(action as ExecuteActionNode).scriptName}"`
        case 'TriggerAction':
            return `invokes trigger "${(action as TriggerActionNode).triggerName}"`
        case 'AssignAction':
            return summarizeAssign(action as AssignActionNode)
    }
}

function summarizeTarget(action: TargetedActionNode): string {
    const base = summarizeSubject(action.target)
    const delay = action.delay ? ` after ${action.delay.raw}` : ''
    return `${base}${delay}`
}

function summarizeNavigate(action: NavigateActionNode): string {
    const target = summarizeSubject(action.target)
    const delay = action.delay ? ` after ${action.delay.raw}` : ''
    return `navigates to ${target}${delay}`
}

function summarizeAssign(action: AssignActionNode): string {
    const op = action.op === '='
        ? 'sets'
        : action.op === '+='
            ? 'increases'
            : 'decreases'

    const value = action.value.type === 'Literal'
        ? summarizeLiteral(action.value as LiteralNode)
        : (action.value as IdentifierNode).name

    return action.op === '='
        ? `sets ${action.variable} to ${value}`
        : `${op} ${action.variable} by ${value}`
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Join a list of phrases with commas and 'and' before the last item.
 * ["shows x", "hides y", "runs z"] → "shows x, hides y and runs z"
 */
function joinList(items: string[]): string {
    if (items.length === 0) return ''
    if (items.length === 1) return items[0]
    if (items.length === 2) return `${items[0]} and ${items[1]}`
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * Truncate a summary to MAX_SUMMARY_LENGTH characters.
 * Breaks at the last word boundary before the limit.
 */
function truncate(text: string): string {
    if (text.length <= MAX_SUMMARY_LENGTH) return text
    const cut = text.lastIndexOf(' ', MAX_SUMMARY_LENGTH)
    return `${text.slice(0, cut > 0 ? cut : MAX_SUMMARY_LENGTH)}…`
}