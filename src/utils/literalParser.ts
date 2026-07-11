/**
 * literalParser.ts
 *
 * Safe parser for user-authored JS-like literals (arrays, objects, strings,
 * numbers, booleans, null) — e.g. "[1, 'two', true]" or "{ count: 2 }".
 * Replaces `new Function(...)`/eval-style parsing: no code ever executes,
 * only literal syntax is recognized.
 */

export class LiteralParseError extends Error {}

export function parseLiteral(input: string): unknown {
    let i = 0

    function skipWs() {
        while (i < input.length && /\s/.test(input[i])) i++
    }

    function parseValue(): unknown {
        skipWs()
        const c = input[i]
        if (c === undefined) throw new LiteralParseError('Unexpected end of input.')
        if (c === '[') return parseArray()
        if (c === '{') return parseObject()
        if (c === '"' || c === "'") return parseString()
        if (c === '-' || (c >= '0' && c <= '9')) return parseNumber()
        return parseKeyword()
    }

    function parseArray(): unknown[] {
        i++ // consume '['
        const arr: unknown[] = []
        skipWs()
        if (input[i] === ']') { i++; return arr }
        while (true) {
            arr.push(parseValue())
            skipWs()
            if (input[i] === ',') { i++; skipWs(); continue }
            if (input[i] === ']') { i++; break }
            throw new LiteralParseError('Expected "," or "]" in array literal.')
        }
        return arr
    }

    function parseObject(): Record<string, unknown> {
        i++ // consume '{'
        const obj: Record<string, unknown> = {}
        skipWs()
        if (input[i] === '}') { i++; return obj }
        while (true) {
            skipWs()
            const key = parseKey()
            skipWs()
            if (input[i] !== ':') throw new LiteralParseError('Expected ":" in object literal.')
            i++
            obj[key] = parseValue()
            skipWs()
            if (input[i] === ',') { i++; skipWs(); continue }
            if (input[i] === '}') { i++; break }
            throw new LiteralParseError('Expected "," or "}" in object literal.')
        }
        return obj
    }

    function parseKey(): string {
        if (input[i] === '"' || input[i] === "'") return parseString()
        const start = i
        while (i < input.length && /[A-Za-z0-9_$]/.test(input[i])) i++
        if (i === start) throw new LiteralParseError('Expected object key.')
        return input.slice(start, i)
    }

    function parseString(): string {
        const quote = input[i]
        i++
        let result = ''
        const escapeMap: Record<string, string> = {
            n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '\\': '\\', "'": "'", '"': '"',
        }
        while (i < input.length && input[i] !== quote) {
            if (input[i] === '\\') {
                i++
                const esc = input[i]
                result += escapeMap[esc] ?? esc
                i++
            } else {
                result += input[i]
                i++
            }
        }
        if (input[i] !== quote) throw new LiteralParseError('Unterminated string literal.')
        i++
        return result
    }

    function parseNumber(): number {
        const start = i
        if (input[i] === '-') i++
        while (i < input.length && input[i] >= '0' && input[i] <= '9') i++
        if (input[i] === '.') {
            i++
            while (i < input.length && input[i] >= '0' && input[i] <= '9') i++
        }
        if (input[i] === 'e' || input[i] === 'E') {
            i++
            if (input[i] === '+' || input[i] === '-') i++
            while (i < input.length && input[i] >= '0' && input[i] <= '9') i++
        }
        const numStr = input.slice(start, i)
        const n = Number(numStr)
        if (!Number.isFinite(n)) throw new LiteralParseError('Invalid number literal.')
        return n
    }

    function parseKeyword(): unknown {
        if (input.startsWith('true', i)) { i += 4; return true }
        if (input.startsWith('false', i)) { i += 5; return false }
        if (input.startsWith('null', i)) { i += 4; return null }
        throw new LiteralParseError(`Unexpected token at position ${i}.`)
    }

    const value = parseValue()
    skipWs()
    if (i !== input.length) throw new LiteralParseError('Unexpected trailing characters.')
    return value
}
