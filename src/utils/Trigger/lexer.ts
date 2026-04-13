/**
 * lexer.ts
 *
 * Converts a Mava DSL source string into a flat token stream.
 * - Strips comments before tokenizing
 * - Emits NEWLINE as a significant token (statement terminator)
 * - Tracks line and column for every token (used by Monaco diagnostics)
 */

// ─── Token types ──────────────────────────────────────────────────────────────

export const TokenType = {
    // Structure
    KEYWORD: 'KEYWORD',
    IDENTIFIER: 'IDENTIFIER',

    // Literals
    NUMBER: 'NUMBER',
    TIME: 'TIME',
    PERCENT: 'PERCENT',
    PIXELS: 'PIXELS',
    STRING: 'STRING',
    BOOL: 'BOOL',

    // Punctuation
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    LBRACKET: 'LBRACKET',
    RBRACKET: 'RBRACKET',
    LBRACE: 'LBRACE',
    RBRACE: 'RBRACE',
    COLON: 'COLON',
    COMMA: 'COMMA',
    BACKSLASH: 'BACKSLASH',
    DOT: 'DOT',

    // Operators
    ASSIGN: 'ASSIGN',
    PLUS_ASSIGN: 'PLUS_ASSIGN',
    MINUS_ASSIGN: 'MINUS_ASSIGN',
    GT: 'GT',
    GTE: 'GTE',
    LT: 'LT',
    LTE: 'LTE',
    EQ: 'EQ',
    NEQ: 'NEQ',

    // Control
    NEWLINE: 'NEWLINE',
    EOF: 'EOF',

    // Error token — unknown character, lexer continues
    UNKNOWN: 'UNKNOWN',
} as const

export type TokenType = typeof TokenType[keyof typeof TokenType]

export interface Token {
    type: TokenType
    value: string
    line: number    // 1-based
    col: number    // 1-based, points to start of token
}

// ─── Keywords ─────────────────────────────────────────────────────────────────

export const KEYWORDS = new Set([
    // structure
    'on', 'when', 'then', 'end', 'else', 'elsewhen',
    'group', 'trigger', 'either', 'all', 'of', 'after', 'as',
    // actions
    'show', 'hide', 'enable', 'disable', 'highlight',
    'play', 'pause', 'resume', 'stop', 'finish', 'run',
    'navigate', 'lock', 'unlock', 'submit',
    'wait', 'execute',
    // values / logic
    'next', 'prev', 'not', 'and', 'or',
    // structural ref tags
    'p', 'l',
])

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export type LexDiagSeverity = 'error' | 'warning' | 'info'

export interface LexDiagnostic {
    code: string
    severity: LexDiagSeverity
    message: string
    line: number
    col: number
    endLine: number
    endCol: number
    quickFix?: string
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

export interface LexResult {
    tokens: Token[]
    diagnostics: LexDiagnostic[]
}

export function lex(source: string): LexResult {
    const tokens: Token[] = []
    const diagnostics: LexDiagnostic[] = []

    // Strip comments first, preserving line structure
    const stripped = stripComments(source)

    let pos = 0
    let line = 1
    let col = 1

    // ── Helpers ───────────────────────────────────────────────────────────────

    function peek(offset = 0): string {
        return stripped[pos + offset] ?? ''
    }

    function advance(): string {
        const ch = stripped[pos++]
        if (ch === '\n') { line++; col = 1 }
        else col++
        return ch
    }

    function addToken(type: TokenType, value: string, startLine: number, startCol: number) {
        tokens.push({ type, value, line: startLine, col: startCol })
    }

    function addDiag(
        code: string,
        severity: LexDiagSeverity,
        message: string,
        startLine: number,
        startCol: number,
        endLine: number,
        endCol: number,
        quickFix?: string,
    ) {
        diagnostics.push({ code, severity, message, line: startLine, col: startCol, endLine, endCol, quickFix })
    }

    // ── Main loop ─────────────────────────────────────────────────────────────

    while (pos < stripped.length) {
        const startLine = line
        const startCol = col
        const ch = peek()

        // ── Skip spaces and tabs ──────────────────────────────────────────────
        if (ch === ' ' || ch === '\t' || ch === '\r') {
            advance()
            continue
        }

        // ── Newline ───────────────────────────────────────────────────────────
        if (ch === '\n') {
            advance()
            // Collapse consecutive newlines — only emit one
            const last = tokens[tokens.length - 1]
            if (!last || last.type !== TokenType.NEWLINE) {
                addToken(TokenType.NEWLINE, '\n', startLine, startCol)
            }
            continue
        }

        // ── Two-char operators ────────────────────────────────────────────────
        if (ch === '+' && peek(1) === '=') {
            advance(); advance()
            addToken(TokenType.PLUS_ASSIGN, '+=', startLine, startCol)
            continue
        }
        if (ch === '-' && peek(1) === '=') {
            advance(); advance()
            addToken(TokenType.MINUS_ASSIGN, '-=', startLine, startCol)
            continue
        }
        if (ch === '>' && peek(1) === '=') {
            advance(); advance()
            addToken(TokenType.GTE, '>=', startLine, startCol)
            continue
        }
        if (ch === '<' && peek(1) === '=') {
            advance(); advance()
            addToken(TokenType.LTE, '<=', startLine, startCol)
            continue
        }
        if (ch === '=' && peek(1) === '=') {
            advance(); advance()
            addToken(TokenType.EQ, '==', startLine, startCol)
            continue
        }
        if (ch === '!' && peek(1) === '=') {
            advance(); advance()
            addToken(TokenType.NEQ, '!=', startLine, startCol)
            continue
        }

        // ── Single-char operators and punctuation ─────────────────────────────
        if (ch === '=') { advance(); addToken(TokenType.ASSIGN, '=', startLine, startCol); continue }
        if (ch === '>') { advance(); addToken(TokenType.GT, '>', startLine, startCol); continue }
        if (ch === '<') { advance(); addToken(TokenType.LT, '<', startLine, startCol); continue }
        if (ch === '[') { advance(); addToken(TokenType.LBRACKET, '[', startLine, startCol); continue }
        if (ch === ']') { advance(); addToken(TokenType.RBRACKET, ']', startLine, startCol); continue }
        if (ch === '(') { advance(); addToken(TokenType.LPAREN, '(', startLine, startCol); continue }
        if (ch === ')') { advance(); addToken(TokenType.RPAREN, ')', startLine, startCol); continue }
        if (ch === '{') { advance(); addToken(TokenType.LBRACE, '{', startLine, startCol); continue }
        if (ch === '}') { advance(); addToken(TokenType.RBRACE, '}', startLine, startCol); continue }
        if (ch === ':') { advance(); addToken(TokenType.COLON, ':', startLine, startCol); continue }
        if (ch === ',') { advance(); addToken(TokenType.COMMA, ',', startLine, startCol); continue }
        if (ch === '\\') { advance(); addToken(TokenType.BACKSLASH, '\\', startLine, startCol); continue }
        if (ch === '.') { advance(); addToken(TokenType.DOT, '.', startLine, startCol); continue }

        // ── String literal ────────────────────────────────────────────────────
        if (ch === '"') {
            advance() // consume opening quote
            let str = ''
            while (pos < stripped.length && peek() !== '"' && peek() !== '\n') {
                str += advance()
            }
            if (peek() === '"') {
                advance() // consume closing quote
                addToken(TokenType.STRING, str, startLine, startCol)
            } else {
                // Unterminated string
                addDiag(
                    'E024', 'error',
                    'Unterminated string literal — missing closing "',
                    startLine, startCol, line, col,
                )
                addToken(TokenType.STRING, str, startLine, startCol)
            }
            continue
        }

        // ── Number, time, percent, pixels ─────────────────────────────────────
        // ── Number, time, percent, pixels (corrected, self-contained) ─────────────────

        if (isDigit(ch)) {
            let num = ''
            while (pos < stripped.length && (isDigit(peek()) || (peek() === '.' && isDigit(peek(1))))) {
                num += advance()
            }

            // Read unit suffix
            let unit = ''
            if (peek() === '%') {
                unit = '%'; advance()
            } else if (peek() === 'm' && peek(1) === 's') {
                unit = 'ms'; advance(); advance()
            } else if (peek() === 'm' && !isAlpha(peek(1))) {
                unit = 'm'; advance()
            } else if (peek() === 's' && !isAlpha(peek(1))) {
                unit = 's'; advance()
            } else if (peek() === 'p' && peek(1) === 'x') {
                unit = 'px'; advance(); advance()
            }

            if (unit === 's' || unit === 'ms' || unit === 'm') {
                addToken(TokenType.TIME, num + unit, startLine, startCol)
            } else if (unit === '%') {
                addToken(TokenType.PERCENT, num + '%', startLine, startCol)
            } else if (unit === 'px') {
                addToken(TokenType.PIXELS, num + 'px', startLine, startCol)
            } else {
                addToken(TokenType.NUMBER, num, startLine, startCol)
            }
            continue
        }

        // ── Identifier or keyword ─────────────────────────────────────────────
        if (isAlpha(ch)) {
            let word = ''
            while (isAlphaNum(peek())) word += advance()

            // Check for compound keyword: 'all of', 'any of' (not used — 'either' used instead)
            // 'all of' is two tokens: KEYWORD('all') KEYWORD('of')
            // handled at parser level — lexer just emits them separately

            if (word === 'true' || word === 'false') {
                addToken(TokenType.BOOL, word, startLine, startCol)
            } else if (KEYWORDS.has(word)) {
                // It's a keyword
                addToken(TokenType.KEYWORD, word, startLine, startCol)
            } else {
                // Check if it looks like a keyword with wrong case
                const lower = word.toLowerCase()
                if (KEYWORDS.has(lower)) {
                    addDiag(
                        'E022', 'error',
                        `'${word}' is not a valid keyword — keywords are lowercase. Did you mean '${lower}'?`,
                        startLine, startCol, line, col - 1,
                        lower, // quickFix
                    )
                    // Emit as keyword anyway so parser can continue
                    addToken(TokenType.KEYWORD, lower, startLine, startCol)
                } else {
                    addToken(TokenType.IDENTIFIER, word, startLine, startCol)
                }
            }
            continue
        }

        // ── Semicolon — explicit error ────────────────────────────────────────
        if (ch === ';') {
            advance()
            addDiag(
                'E021', 'error',
                "Unexpected token ';' — statements are separated by newlines, not semicolons.",
                startLine, startCol, line, col - 1,
            )
            continue
        }

        // ── Unknown character ─────────────────────────────────────────────────
        advance()
        addDiag(
            'E025', 'error',
            `Unexpected character '${ch}'.`,
            startLine, startCol, line, col - 1,
        )
        addToken(TokenType.UNKNOWN, ch, startLine, startCol)
    }

    // Always end with EOF
    addToken(TokenType.EOF, '', line, col)

    return { tokens, diagnostics }
}

// ─── Comment stripper ─────────────────────────────────────────────────────────

/**
 * Strips // line comments and /* block comments from source.
 * Replaces comment content with spaces to preserve character positions
 * for accurate line/col reporting.
 * Newlines inside block comments are preserved to keep line numbers accurate.
 */
function stripComments(source: string): string {
    let result = ''
    let i = 0

    while (i < source.length) {
        // Line comment
        if (source[i] === '/' && source[i + 1] === '/') {
            // Replace until newline with spaces
            while (i < source.length && source[i] !== '\n') {
                result += ' '
                i++
            }
            continue
        }

        // Block comment
        if (source[i] === '/' && source[i + 1] === '*') {
            result += '  ' // replace /*
            i += 2
            while (i < source.length) {
                if (source[i] === '*' && source[i + 1] === '/') {
                    result += '  ' // replace */
                    i += 2
                    break
                }
                // Preserve newlines for line tracking
                result += source[i] === '\n' ? '\n' : ' '
                i++
            }
            continue
        }

        result += source[i]
        i++
    }

    return result
}

// ─── Character helpers ────────────────────────────────────────────────────────

function isDigit(ch: string): boolean { return ch >= '0' && ch <= '9' }
function isAlpha(ch: string): boolean { return /[a-zA-Z_]/.test(ch) }
function isAlphaNum(ch: string): boolean { return /[a-zA-Z0-9_]/.test(ch) }

// ─── Unit reader ──────────────────────────────────────────────────────────────

/**
 * Reads a unit suffix from current position if present.
 * Advances pos past the unit characters.
 * Returns the unit string or empty string if no unit found.
 *
 * This is a closure over the lexer's pos/advance — passed as a
 * helper from the main lex() function context.
 * Exposed here as a standalone for clarity — in practice it is
 * inlined in the lexer's number branch.
 */
// function readUnit(this: { peek: (o?: number) => string; advance: () => string }): string {
//     const next = this.peek()
//     if (next === '%') { this.advance(); return '%' }
//     if (next === 's') { this.advance(); return 's' }
//     if (next === 'm') {
//         if (this.peek(1) === 's') { this.advance(); this.advance(); return 'ms' }
//         this.advance(); return 'm'
//     }
//     if (next === 'p' && this.peek(1) === 'x') { this.advance(); this.advance(); return 'px' }
//     return ''
// }