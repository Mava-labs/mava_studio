/**
 * identifierName.ts (Trigger DSL)
 *
 * Variables and scripts exist specifically to be referenced from DSL
 * trigger/script code via a bare identifier (`on variable.change attempts`,
 * `attempts > 3`, `execute my_script`) — unlike element/page names (free
 * text authored elsewhere, resolved through registryResolve.ts's
 * sanitizeId()), a variable/script name *is* the identifier an author
 * types. So instead of adding a second resolution layer the way
 * elements/pages needed, these are constrained to valid identifier shape
 * at creation time — preventing the mismatch instead of working around it.
 */

import { KEYWORDS } from './lexer'

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// lexer.ts special-cases 'true'/'false' as BOOL tokens rather than
// IDENTIFIER, on top of its own KEYWORDS set — both are equally unusable
// as a variable/script name.
const RESERVED = new Set([...KEYWORDS, 'true', 'false'])

/**
 * Returns a user-facing error message if `name` can't be used as a DSL
 * identifier, or null if it's valid. Does not check uniqueness — that's
 * the caller's responsibility (varies by scope: variables are unique
 * project-wide, scripts may not need to be).
 */
export function validateDslIdentifierName(name: string): string | null {
    const trimmed = name.trim()
    if (!trimmed.length) return 'Name cannot be empty.'
    if (!IDENTIFIER_PATTERN.test(trimmed)) {
        return 'Name must start with a letter or underscore, and contain only letters, numbers, and underscores — no spaces or punctuation.'
    }
    if (RESERVED.has(trimmed)) {
        return `"${trimmed}" is a reserved DSL keyword and can't be used as a name.`
    }
    return null
}
