// Deep merge utility
// - Merges plain objects recursively
// - Replaces arrays and non-plain values
// - Returns a new object (immutable)

function isPlainObject(v: unknown): v is Record<string, any> {
    return Boolean(v && typeof v === 'object' && !Array.isArray(v))
}

export function deepMerge<T extends Record<string, any> | undefined, S extends Partial<T> | undefined>(
    target: T,
    source: S
): T {
    const out: Record<string, any> = target && Array.isArray(target) ? [...(target as any)] : { ...(target ?? {}) }
    if (!source) return out as T

    for (const key of Object.keys(source as Record<string, any>)) {
        const s = (source as Record<string, any>)[key]
        const t = (out as Record<string, any>)[key]

        if (isPlainObject(s) && isPlainObject(t)) {
            out[key] = deepMerge(t, s)
        } else if (Array.isArray(s)) {
            out[key] = [...s]
        } else {
            out[key] = s
        }
    }

    return out as T
}

export default deepMerge
