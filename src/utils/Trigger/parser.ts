/**
 * parser.ts
 *
 * Recursive descent parser for the Mava DSL.
 * Consumes a token stream from the lexer and produces a ProgramNode AST.
 * Parse errors are collected and parser attempts to recover and continue.
 */

import {
    type Token, TokenType
} from './lexer'

import type {
    ProgramNode, DefinitionNode,
    GroupDefNode, NamedTriggerDefNode, TriggerDefNode,
    TriggerBodyNode, EventClauseNode, EventSpecNode,
    SubjectNode, StructuralRefNode,
    ConditionalBodyNode, ShortBodyNode,
    WhenBranchNode, ElseBranchNode,
    ExprNode, BinaryExprNode, UnaryExprNode,
    ComparisonNode, IdentifierNode, LiteralNode,
    ActionNode,
    NavigateActionNode, WaitActionNode,
    ExecuteActionNode, TriggerActionNode,
    AssignActionNode, AssignOp,
    EventQualifier, LiteralKind,
} from './ast'

// ─── Parser diagnostics ───────────────────────────────────────────────────────

export type ParseDiagSeverity = 'error' | 'warning' | 'info'

export interface ParseDiagnostic {
    code: string
    severity: ParseDiagSeverity
    message: string
    line: number
    col: number
    endLine: number
    endCol: number
    quickFix?: string
}

export interface ParseResult {
    ast: ProgramNode
    diagnostics: ParseDiagnostic[]
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parse(tokens: Token[]): ParseResult {
    const diagnostics: ParseDiagnostic[] = []

    let pos = 0

    // ── Token access ──────────────────────────────────────────────────────────

    function current(): Token {
        return tokens[pos] ?? tokens[tokens.length - 1]
    }

    function advance(): Token {
        const t = tokens[pos]
        if (t.type !== TokenType.EOF) pos++
        return t
    }

    function skipNewlines() {
        while (current().type === TokenType.NEWLINE) advance()
    }

    function expectNewlineOrEof() {
        if (
            current().type === TokenType.NEWLINE ||
            current().type === TokenType.EOF
        ) {
            skipNewlines()
            return
        }
        addDiag(
            'E026', 'error',
            `Unexpected '${current().value}' — a statement should end here. Put the next statement on its own line.`,
            current(), current(),
        )
        // Recover by skipping the rest of this line. Without this, a single
        // stray token cascades: it fails this check, then chokes the next
        // parse step (parseActions → expectKeyword('end') → the program loop),
        // producing 3-4 diagnostics for one typo. Resyncing at the next line
        // collapses that to one error here plus whatever the *next* line
        // genuinely says.
        while (
            current().type !== TokenType.NEWLINE &&
            current().type !== TokenType.EOF
        ) advance()
        skipNewlines()
    }

    // ── Matchers ──────────────────────────────────────────────────────────────

    function isKeyword(value: string): boolean {
        return current().type === TokenType.KEYWORD && current().value === value
    }

    function expectKeyword(value: string): Token {
        if (isKeyword(value)) return advance()
        const t = current()
        addDiag(
            'E027', 'error',
            `Expected '${value}' but got '${t.value}'.`,
            t, t,
        )
        return t
    }

    function expectIdentifier(): Token {
        if (current().type === TokenType.IDENTIFIER) return advance()
        const t = current()
        addDiag(
            'E028', 'error',
            `Expected an identifier but got '${t.value}'.`,
            t, t,
        )
        return t
    }

    function expectToken(type: TokenType, humanLabel?: string): Token {
        if (current().type === type) return advance()
        const t = current()
        addDiag(
            'E044', 'error',
            `Expected ${humanLabel ?? type} but got '${t.value}'.`,
            t, t,
        )
        return t
    }

    function expectEventNamePart(): Token {
        if (current().type === TokenType.IDENTIFIER || current().type === TokenType.KEYWORD) {
            return advance()
        }
        const t = current()
        addDiag(
            'E045', 'error',
            `Expected an event name but got '${t.value}'.`,
            t, t,
        )
        return t
    }

    // ── Diagnostics ───────────────────────────────────────────────────────────

    function addDiag(
        code: string,
        severity: ParseDiagSeverity,
        message: string,
        start: Token,
        end: Token,
        quickFix?: string,
    ) {
        diagnostics.push({
            code, severity, message,
            line: start.line,
            col: start.col,
            endLine: end.line,
            endCol: end.col + end.value.length,
            quickFix,
        })
    }

    // ── Recovery ──────────────────────────────────────────────────────────────

    /**
     * Skip tokens until we find a synchronization point.
     * Used to recover from parse errors and continue parsing.
     */
    function recoverTo(...keywords: string[]) {
        while (
            current().type !== TokenType.EOF &&
            !keywords.some(k => isKeyword(k))
        ) {
            advance()
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROGRAM
    // ─────────────────────────────────────────────────────────────────────────

    function parseProgram(): ProgramNode {
        const start = current()
        const body: DefinitionNode[] = []

        skipNewlines()

        while (current().type !== TokenType.EOF) {
            skipNewlines()
            if (current().type === TokenType.EOF) break

            if (isKeyword('group')) {
                const g = parseGroupDef()
                if (g) body.push(g)
            } else if (isKeyword('trigger')) {
                const t = parseNamedTriggerDef()
                if (t) body.push(t)
            } else if (isKeyword('on') || isKeyword('either') || isKeyword('all')) {
                const t = parseTriggerDef()
                if (t) body.push(t)
            } else {
                addDiag(
                    'E029', 'error',
                    `Unexpected token '${current().value}'. Expected 'group', 'trigger', or 'on'.`,
                    current(), current(),
                )
                recoverTo('group', 'trigger', 'on', 'either', 'all')
            }
        }

        return { type: 'Program', body, line: start.line, col: start.col }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GROUP DEFINITION
    // ─────────────────────────────────────────────────────────────────────────

    function parseGroupDef(): GroupDefNode | null {
        const start = current()
        expectKeyword('group')

        const nameTok = expectIdentifier()
        expectToken(TokenType.ASSIGN, "'='")

        // Peek: if '[' follows it's an element group, otherwise variable group
        if (current().type === TokenType.LBRACKET) {
            advance() // consume '['
            const members = parseIdList()
            if (current().type === TokenType.RBRACKET) advance()
            else addDiag('E030', 'error', "Expected ']' to close group definition.", current(), current())

            expectNewlineOrEof()
            return {
                type: 'GroupDef', name: nameTok.value,
                groupKind: 'element', members,
                line: start.line, col: start.col,
            }
        } else {
            // Variable group — comma-separated plain identifiers
            const members = parseIdList()
            expectNewlineOrEof()
            return {
                type: 'GroupDef', name: nameTok.value,
                groupKind: 'variable', members,
                line: start.line, col: start.col,
            }
        }
    }

    function parseIdList(): string[] {
        const ids: string[] = []
        if (current().type === TokenType.IDENTIFIER) {
            ids.push(advance().value)
            while (current().type === TokenType.COMMA) {
                advance() // consume ','
                skipNewlines()
                if (current().type === TokenType.IDENTIFIER) {
                    ids.push(advance().value)
                }
            }
        }
        return ids
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NAMED TRIGGER DEFINITION
    // ─────────────────────────────────────────────────────────────────────────

    function parseNamedTriggerDef(): NamedTriggerDefNode | null {
        const start = current()
        expectKeyword('trigger')

        const nameTok = expectIdentifier()
        expectNewlineOrEof()

        const body = parseTriggerBody()

        expectKeyword('end')
        expectNewlineOrEof()

        return {
            type: 'NamedTriggerDef',
            name: nameTok.value,
            body,
            line: start.line, col: start.col,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRIGGER DEFINITION (unnamed / local)
    // ─────────────────────────────────────────────────────────────────────────

    function parseTriggerDef(): TriggerDefNode | null {
        const start = current()
        const body = parseTriggerBody()
        return { type: 'TriggerDef', body, line: start.line, col: start.col }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRIGGER BODY
    // ─────────────────────────────────────────────────────────────────────────

    function parseTriggerBody(): TriggerBodyNode {
        const start = current()
        const eventClause = parseEventClause()
        expectNewlineOrEof()
        const rest = parseTriggerRest()

        return {
            type: 'TriggerDef',
            eventClause,
            rest,
            line: start.line, col: start.col,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT CLAUSE
    // ─────────────────────────────────────────────────────────────────────────

    function parseEventClause(): EventClauseNode {
        const start = current()
        let qualifier: EventQualifier = 'single'

        if (isKeyword('on')) {
            advance()
            // Check for qualifier: 'either' or 'all of'
            if (isKeyword('either')) {
                advance()
                qualifier = 'either'
            } else if (isKeyword('all')) {
                advance()
                expectKeyword('of')
                qualifier = 'all-of'
            }
        }

        const events: EventSpecNode[] = []
        events.push(parseEventSpec())

        // Multi-event: comma-separated event specs
        while (current().type === TokenType.COMMA) {
            advance() // consume ','
            skipNewlines()
            events.push(parseEventSpec())
        }

        // Validate qualifier vs count
        if (qualifier !== 'single' && events.length < 2) {
            addDiag(
                'E019', 'error',
                `'${qualifier === 'either' ? 'either' : 'all of'}' requires at least 2 event specifications.`,
                start, current(),
            )
        }

        if (qualifier === 'single' && events.length > 1) {
            addDiag(
                'I001', 'info',
                "Multiple events without qualifier — defaulting to 'either'. Add 'either' or 'all of' to be explicit.",
                start, current(),
                'either',
            )
            qualifier = 'either'
        }

        return { type: 'EventClause', qualifier, events, line: start.line, col: start.col }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT SPEC
    // ─────────────────────────────────────────────────────────────────────────

    function parseEventSpec(): EventSpecNode {
        const start = current()
        let name = ''

        // Event name: identifier/keyword or namespace form foo.bar
        const firstTok = expectEventNamePart()
        name = firstTok.value

        if (current().type === TokenType.DOT) {
            advance() // consume '.'
            const secondTok = expectEventNamePart()
            name = `${name}.${secondTok.value}`
        }

        // Subject — optional, depends on event type
        const subject = parseSubjectForEvent(name, start)

        return { type: 'EventSpec', name, subject, line: start.line, col: start.col }
    }

    function parseSubjectForEvent(eventName: string, start: Token): SubjectNode | null {
        // variable.change — expects plain identifier, no brackets
        if (eventName === 'variable.change') {
            if (current().type === TokenType.LBRACKET) {
                addDiag(
                    'E006', 'error',
                    "variable.change subject must be a plain identifier, not [bracketed]. Remove the brackets.",
                    current(), current(),
                    // quickFix: strip brackets — handled by Monaco
                )
                // consume and discard brackets for recovery
                advance()
                const id = current().type === TokenType.IDENTIFIER ? advance().value : ''
                if (current().type === TokenType.RBRACKET) advance()
                return {
                    type: 'Subject', kind: 'variable', ids: [id],
                    line: start.line, col: start.col,
                }
            }
            if (current().type === TokenType.IDENTIFIER) {
                const id = advance()
                return {
                    type: 'Subject', kind: 'variable', ids: [id.value],
                    line: id.line, col: id.col,
                }
            }
            return null
        }

        // timeline.* — no subject (timeline is always current page)
        if (eventName.startsWith('timeline.') && eventName !== 'timeline.reaches') {
            return null
        }

        // timeline.reaches — time literal or variable identifier
        if (eventName === 'timeline.reaches') {
            return parseTimelineReachesSubject(start)
        }

        // Structural ref {\p ...} or {\l ...}
        if (current().type === TokenType.LBRACE) {
            return parseStructuralRef()
        }

        // Bracketed list [id, id, ...]
        if (current().type === TokenType.LBRACKET) {
            return parseBracketedSubject(start)
        }

        // Group name or bare identifier
        if (current().type === TokenType.IDENTIFIER) {
            const id = advance()
            const missingBracket = takeMissingOpenBracket(id)
            if (missingBracket) return missingBracket
            return {
                type: 'Subject', kind: 'group', ids: [id.value],
                line: id.line, col: id.col,
            }
        }

        // nav keyword: next | prev
        if (isKeyword('next') || isKeyword('prev')) {
            const kw = advance()
            return {
                type: 'Subject', kind: 'nav-keyword', ids: [kw.value],
                line: kw.line, col: kw.col,
            }
        }

        return null
    }

    /**
     * Common typo: a bracketed subject written without its opening '[', e.g.
     * `on click continue_btn]`. Called right after consuming a bare identifier
     * — if the very next token is ']', that's almost certainly a dropped '['.
     * Consume the ']', emit ONE targeted error with a quick-fix, and return the
     * intended element-list, instead of leaving the stray ']' to cascade into
     * three or four unrelated parse errors down the line.
     */
    function takeMissingOpenBracket(id: Token): SubjectNode | null {
        if (current().type !== TokenType.RBRACKET) return null
        const rbracket = current()
        advance() // consume the orphan ']'
        // Range spans the identifier *through* the stray ']' so the quick-fix
        // replaces the whole culprit (`continue_btn]` → `[continue_btn]`)
        // rather than inserting at the identifier and leaving `[continue_btn]]`.
        addDiag(
            'E047', 'error',
            `Missing '[' before '${id.value}'. Element lists are written like [${id.value}].`,
            id, rbracket,
            `[${id.value}]`,
        )
        return { type: 'Subject', kind: 'element-list', ids: [id.value], line: id.line, col: id.col }
    }

    function parseTimelineReachesSubject(start: Token): SubjectNode {
        // Accept time literal (1.5s) or plain identifier (variable)
        if (current().type === TokenType.TIME) {
            const t = advance()
            return {
                type: 'Subject', kind: 'variable', ids: [t.value],
                line: t.line, col: t.col,
            }
        }
        if (current().type === TokenType.IDENTIFIER) {
            const id = advance()
            return {
                type: 'Subject', kind: 'variable', ids: [id.value],
                line: id.line, col: id.col,
            }
        }
        addDiag(
            'E020', 'error',
            "timeline.reaches expects a time literal (e.g. 45s) or a variable name.",
            current(), current(),
        )
        return { type: 'Subject', kind: 'variable', ids: [], line: start.line, col: start.col }
    }

    function parseBracketedSubject(start: Token): SubjectNode {
        advance() // consume '['
        const ids = parseIdList()
        if (current().type === TokenType.RBRACKET) advance()
        else addDiag('E031', 'error', "Expected ']' to close subject list.", current(), current())

        return { type: 'Subject', kind: 'element-list', ids, line: start.line, col: start.col }
    }

    function parseStructuralRef(): SubjectNode {
        const start = current()
        advance() // consume '{'
        if (current().type !== TokenType.BACKSLASH) {
            addDiag('E032', 'error', "Expected '\\' inside structural ref '{\\p ...}'.", current(), current())
        } else {
            advance() // consume '\'
        }

        const refTypeTok = current()
        let refType: 'p' | 'l' = 'p'
        if (current().type === TokenType.IDENTIFIER || current().type === TokenType.KEYWORD) {
            const val = advance().value
            if (val === 'p' || val === 'l') refType = val
            else addDiag('E033', 'error', `Unknown structural ref type '${val}'. Use 'p' for page or 'l' for lesson.`, refTypeTok, refTypeTok)
        }

        const nameTok = expectIdentifier()

        if (current().type === TokenType.RBRACE) advance()
        else addDiag('E034', 'error', "Expected '}' to close structural ref.", current(), current())

        const ref: StructuralRefNode = {
            type: 'StructuralRef', refType,
            name: nameTok.value,
            line: refTypeTok.line, col: refTypeTok.col,
        }

        return {
            type: 'Subject', kind: 'structural-ref', ids: [],
            ref,
            line: start.line, col: start.col,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRIGGER REST (conditional or short)
    // ─────────────────────────────────────────────────────────────────────────

    function parseTriggerRest(): ConditionalBodyNode | ShortBodyNode {
        skipNewlines()

        if (isKeyword('when')) {
            return parseConditionalBody()
        }

        // Short form — actions follow directly until 'end'
        return parseShortBody()
    }

    function parseShortBody(): ShortBodyNode {
        const start = current()
        const actions = parseActions()
        expectKeyword('end')
        expectNewlineOrEof()
        return { type: 'ShortBody', actions, line: start.line, col: start.col }
    }

    function parseConditionalBody(): ConditionalBodyNode {
        const start: Token = current()
        const branches: WhenBranchNode[] = []
        let elseBranch: ElseBranchNode | null = null

        // Parse first when branch
        branches.push(parseWhenBranch())

        // Parse elsewhen branches
        while (isKeyword('elsewhen')) {
            branches.push(parseElseWhenBranch())
        }

        // Parse optional else
        if (isKeyword('else')) {
            advance() // consume 'else'
            expectNewlineOrEof()

            // Check for unreachable elsewhen after else
            if (isKeyword('elsewhen')) {
                addDiag(
                    'E015', 'error',
                    "'elsewhen' after 'else' is unreachable. Move 'elsewhen' before 'else'.",
                    current(), current(),
                )
            }

            const actions = parseActions()
            elseBranch = {
                type: 'ElseBranch', actions,
                line: start.line, col: start.col,
            }
        }

        expectKeyword('end')
        expectNewlineOrEof()

        return {
            type: 'ConditionalBody',
            branches,
            elseBranch,
            line: start.line, col: start.col,
        }
    }

    function parseWhenBranch(): WhenBranchNode {
        const start = current()
        expectKeyword('when')
        const condition = parseExpr()
        expectNewlineOrEof()
        expectKeyword('then')
        expectNewlineOrEof()
        const actions = parseActions()
        return { type: 'WhenBranch', condition, actions, line: start.line, col: start.col }
    }

    function parseElseWhenBranch(): WhenBranchNode {
        const start = current()
        expectKeyword('elsewhen')
        const condition = parseExpr()
        expectNewlineOrEof()
        expectKeyword('then')
        expectNewlineOrEof()
        const actions = parseActions()
        return { type: 'WhenBranch', condition, actions, line: start.line, col: start.col }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    const ACTION_KEYWORDS = new Set([
        'show', 'hide', 'enable', 'disable', 'highlight',
        'play', 'pause', 'resume', 'stop', 'finish', 'run',
        'navigate', 'lock', 'unlock', 'submit',
        'wait', 'execute', 'trigger',
    ])

    const BLOCK_END_KEYWORDS = new Set(['end', 'else', 'elsewhen'])

    function parseActions(): ActionNode[] {
        const actions: ActionNode[] = []
        skipNewlines()

        while (canStartActionHere()) {
            if (current().type === TokenType.NEWLINE) {
                skipNewlines()
                if (!canStartActionHere()) break
            }

            const action = parseActionStatement()
            if (action) {
                actions.push(action)
            }

            skipNewlines()
            if (current().type === TokenType.EOF) break
            if (BLOCK_END_KEYWORDS.has(current().value)) break
        }

        return actions
    }

    function canStartActionHere(): boolean {
        const t = current()
        if (t.type === TokenType.EOF) return false
        if (BLOCK_END_KEYWORDS.has(t.value)) return false
        if (t.type === TokenType.NEWLINE) return isActionStart()
        if (t.type === TokenType.KEYWORD) return ACTION_KEYWORDS.has(t.value)
        // Identifier starts assignment statements.
        if (t.type === TokenType.IDENTIFIER) return true
        return false
    }

    function isActionStart(): boolean {
        // Look ahead past newlines to see if next non-newline is an action keyword or identifier (assignment)
        let i = pos
        while (i < tokens.length && tokens[i].type === TokenType.NEWLINE) i++
        const t = tokens[i]
        if (!t) return false
        return (
            (t.type === TokenType.KEYWORD && ACTION_KEYWORDS.has(t.value)) ||
            t.type === TokenType.IDENTIFIER
        )
    }

    function parseActionStatement(): ActionNode | null {
        // Assignment: identifier = / += / -=
        if (current().type === TokenType.IDENTIFIER) {
            const next = tokens[pos + 1]
            if (
                next?.type === TokenType.ASSIGN ||
                next?.type === TokenType.PLUS_ASSIGN ||
                next?.type === TokenType.MINUS_ASSIGN
            ) {
                return parseAssignAction()
            }
        }

        if (current().type !== TokenType.KEYWORD) {
            addDiag('E035', 'error', `Expected an action but got '${current().value}'.`, current(), current())
            recoverTo(...Array.from(BLOCK_END_KEYWORDS), ...Array.from(ACTION_KEYWORDS))
            return null
        }

        const kw = current().value

        switch (kw) {
            case 'show': return parseTargetedAction('ShowAction')
            case 'hide': return parseTargetedAction('HideAction')
            case 'enable': return parseTargetedAction('EnableAction')
            case 'disable': return parseTargetedAction('DisableAction')
            case 'highlight': return parseTargetedAction('HighlightAction')
            case 'play': return parseTargetedAction('PlayAction')
            case 'pause': return parseTargetedAction('PauseAction')
            case 'resume': return parseTargetedAction('ResumeAction')
            case 'stop': return parseTargetedAction('StopAction')
            case 'finish': return parseTargetedAction('FinishAction')
            case 'run': return parseTargetedAction('RunAction')
            case 'lock': return parseTargetedAction('LockAction')
            case 'unlock': return parseTargetedAction('UnlockAction')
            case 'submit': return parseTargetedAction('SubmitAction')
            case 'navigate': return parseNavigateAction()
            case 'wait': return parseWaitAction()
            case 'execute': return parseExecuteAction()
            case 'trigger': return parseTriggerAction()
            default:
                addDiag('E036', 'error', `Unknown action '${kw}'.`, current(), current())
                advance()
                return null
        }
    }

    type TargetedActionType =
        | 'ShowAction' | 'HideAction'
        | 'EnableAction' | 'DisableAction'
        | 'HighlightAction'
        | 'PlayAction' | 'PauseAction' | 'ResumeAction' | 'StopAction' | 'FinishAction'
        | 'RunAction'
        | 'LockAction' | 'UnlockAction'
        | 'SubmitAction'

    function parseTargetedAction(type: TargetedActionType): ActionNode {
        const start = current()
        advance() // consume action keyword
        const target = parseTarget(start)
        const delay = parseAfterClause()
        expectNewlineOrEof()
        return { type, target, delay, line: start.line, col: start.col } as ActionNode
    }

    function parseNavigateAction(): NavigateActionNode {
        const start = current()
        advance() // consume 'navigate'
        const target = parseTarget(start)
        const delay = parseAfterClause()
        expectNewlineOrEof()
        return { type: 'NavigateAction', target, delay, line: start.line, col: start.col }
    }

    function parseWaitAction(): WaitActionNode {
        const start = current()
        advance() // consume 'wait'
        if (current().type !== TokenType.TIME) {
            addDiag(
                'E037', 'error',
                "wait expects a time duration (e.g. wait 2s, wait 500ms).",
                current(), current(),
            )
        }
        const duration = parseLiteral() as LiteralNode
        expectNewlineOrEof()
        return { type: 'WaitAction', duration, line: start.line, col: start.col }
    }

    function parseExecuteAction(): ExecuteActionNode {
        const start = current()
        advance() // consume 'execute'
        const nameTok = expectIdentifier()
        expectNewlineOrEof()
        return { type: 'ExecuteAction', scriptName: nameTok.value, line: start.line, col: start.col }
    }

    function parseTriggerAction(): TriggerActionNode {
        const start = current()
        advance() // consume 'trigger'
        const nameTok = expectIdentifier()
        expectNewlineOrEof()
        return { type: 'TriggerAction', triggerName: nameTok.value, line: start.line, col: start.col }
    }

    function parseAssignAction(): AssignActionNode {
        const start = current()
        const variable = advance().value    // identifier
        const opTok = advance()          // = | += | -=
        const op = opTok.value as AssignOp
        const value = parseExpr()
        expectNewlineOrEof()
        return { type: 'AssignAction', variable, op, value, line: start.line, col: start.col }
    }

    // ─── After clause ─────────────────────────────────────────────────────────

    function parseAfterClause(): LiteralNode | undefined {
        if (!isKeyword('after')) return undefined
        advance() // consume 'after'
        if (current().type !== TokenType.TIME) {
            addDiag('E038', 'error', "'after' expects a time duration (e.g. after 2s).", current(), current())
            return undefined
        }
        return parseLiteral() as LiteralNode
    }

    // ─── Target ───────────────────────────────────────────────────────────────

    function parseTarget(start: Token): SubjectNode {
        if (current().type === TokenType.LBRACKET) {
            return parseBracketedSubject(start)
        }
        if (current().type === TokenType.LBRACE) {
            return parseStructuralRef()
        }
        if (isKeyword('next') || isKeyword('prev')) {
            const kw = advance()
            return { type: 'Subject', kind: 'nav-keyword', ids: [kw.value], line: kw.line, col: kw.col }
        }
        if (current().type === TokenType.IDENTIFIER) {
            const id = advance()
            const missingBracket = takeMissingOpenBracket(id)
            if (missingBracket) return missingBracket
            return { type: 'Subject', kind: 'group', ids: [id.value], line: id.line, col: id.col }
        }
        addDiag('E039', 'error', "Expected a target — [element_name], group_name, or {\\p page_name}.", current(), current())
        return { type: 'Subject', kind: 'element-list', ids: [], line: start.line, col: start.col }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPRESSIONS
    // ─────────────────────────────────────────────────────────────────────────

    // Precedence (low → high):
    //   or → and → not → comparison → primary

    function parseExpr(): ExprNode {
        return parseOr()
    }

    function parseOr(): ExprNode {
        let left = parseAnd()
        while (isKeyword('or')) {
            const start = current()
            advance()
            const right = parseAnd()
            left = { type: 'BinaryExpr', op: 'or', left, right, line: start.line, col: start.col } as BinaryExprNode
        }
        return left
    }

    function parseAnd(): ExprNode {
        let left = parseNot()
        while (isKeyword('and')) {
            const start = current()
            advance()
            const right = parseNot()
            left = { type: 'BinaryExpr', op: 'and', left, right, line: start.line, col: start.col } as BinaryExprNode
        }
        return left
    }

    function parseNot(): ExprNode {
        if (isKeyword('not')) {
            const start = current()
            advance()
            const operand = parseComparison()
            return { type: 'UnaryExpr', op: 'not', operand, line: start.line, col: start.col } as UnaryExprNode
        }
        return parseComparison()
    }

    function parseComparison(): ExprNode {
        const left = parsePrimary()

        const compOps = [
            TokenType.GT, TokenType.GTE,
            TokenType.LT, TokenType.LTE,
            TokenType.EQ, TokenType.NEQ,
        ]

        if (compOps.includes(current().type as any)) {
            const opTok = advance()
            const right = parsePrimary()
            return {
                type: 'Comparison',
                left, op: opTok.value as ComparisonNode['op'], right,
                line: opTok.line, col: opTok.col,
            } as ComparisonNode
        }

        return left
    }

    function parsePrimary(): ExprNode {
        const t = current()

        // Parenthesised expression
        if (t.type === TokenType.LPAREN) {
            advance()
            const expr = parseExpr()
            if (current().type === TokenType.RPAREN) advance()
            else addDiag('E040', 'error', "Expected ')' to close expression.", current(), current())
            return expr
        }

        // Literals
        if (
            t.type === TokenType.NUMBER ||
            t.type === TokenType.TIME ||
            t.type === TokenType.PERCENT ||
            t.type === TokenType.PIXELS ||
            t.type === TokenType.STRING ||
            t.type === TokenType.BOOL
        ) {
            return parseLiteral()
        }

        // List literal
        if (t.type === TokenType.LBRACKET) {
            return parseListLiteral()
        }

        // Object literal
        if (t.type === TokenType.LBRACE) {
            return parseObjectLiteral()
        }

        // Identifier (variable reference)
        if (t.type === TokenType.IDENTIFIER) {
            const id = advance()
            return { type: 'Identifier', name: id.value, line: id.line, col: id.col } as IdentifierNode
        }

        addDiag('E041', 'error', `Expected a value or variable but got '${t.value}'.`, t, t)
        advance()
        return { type: 'Identifier', name: '', line: t.line, col: t.col } as IdentifierNode
    }

    function parseLiteral(): LiteralNode {
        const t = advance()
        let kind: LiteralKind
        let value: unknown

        switch (t.type) {
            case TokenType.NUMBER: kind = 'number'; value = parseFloat(t.value); break
            case TokenType.TIME: kind = 'time'; value = t.value; break
            case TokenType.PERCENT: kind = 'percent'; value = parseFloat(t.value); break
            case TokenType.PIXELS: kind = 'pixels'; value = parseFloat(t.value); break
            case TokenType.STRING: kind = 'string'; value = t.value; break
            case TokenType.BOOL: kind = 'bool'; value = t.value === 'true'; break
            default:
                kind = 'string'
                value = t.value
        }

        return { type: 'Literal', kind, value, raw: t.value, line: t.line, col: t.col }
    }

    function parseListLiteral(): LiteralNode {
        const start = current()
        advance() // consume '['
        const items: unknown[] = []

        while (current().type !== TokenType.RBRACKET && current().type !== TokenType.EOF) {
            const item = parsePrimary()
            if (item.type === 'Literal') {
                items.push(item.value)
            } else if (item.type === 'Identifier') {
                items.push(item.name)
            } else {
                items.push(null)
            }
            if (current().type === TokenType.COMMA) advance()
        }

        if (current().type === TokenType.RBRACKET) advance()
        else addDiag('E042', 'error', "Expected ']' to close list literal.", current(), current())

        return { type: 'Literal', kind: 'list', value: items, raw: '', line: start.line, col: start.col }
    }

    function parseObjectLiteral(): LiteralNode {
        const start = current()
        advance() // consume '{'
        const obj: Record<string, unknown> = {}

        while (current().type !== TokenType.RBRACE && current().type !== TokenType.EOF) {
            skipNewlines()
            const keyTok = expectIdentifier()
            expectToken(TokenType.COLON, "':'")
            const val = parsePrimary()
            obj[keyTok.value] = (val as LiteralNode).value ?? (val as IdentifierNode).name
            if (current().type === TokenType.COMMA) advance()
            skipNewlines()
        }

        if (current().type === TokenType.RBRACE) advance()
        else addDiag('E043', 'error', "Expected '}' to close object literal.", current(), current())

        return { type: 'Literal', kind: 'object', value: obj, raw: '', line: start.line, col: start.col }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RUN
    // ─────────────────────────────────────────────────────────────────────────

    return { ast: parseProgram(), diagnostics }
}