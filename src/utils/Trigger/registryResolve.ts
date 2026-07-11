/**
 * registryResolve.ts (Trigger DSL)
 *
 * DSL source text always names things by what the author actually called
 * them — an element's name, a page's name, a lesson's title — never the
 * system-generated id backing it (data-eid, page id, lesson id; an author
 * never sees or types these). Both validator.ts (existence/ambiguity
 * diagnostics) and codegen.ts (emitting real ids for DOM queries and
 * __navigate calls) need to do the exact same name -> id lookup; this is
 * the one place it lives, so the two can't drift.
 */

import type { ProjectRegistry } from './validator'

/**
 * DSL identifiers can only contain letters/digits/underscore (lexer.ts's
 * isAlphaNum) — a space or any other character is a lex error. But element
 * names, page names, and lesson titles are free text an author can type
 * anything into elsewhere in the app ("Submit Button", "Page 1 — Intro").
 * Both sides of a name lookup are normalized through this before comparing,
 * so `[Submit_Button]` in DSL source matches an element actually named
 * "Submit Button". Also used by codegen.ts for local function-name
 * generation (`__trigger_<sanitized>`), where the goal is just "a valid JS
 * identifier" rather than a lookup match — same rule either way.
 */
export function sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_')
}

/**
 * Elements: a name resolving to more than one id is not rejected — it's
 * treated like a mini group (all matches are targeted), the same way a
 * bracket list already targets multiple ids. Not found resolves to an
 * empty array; callers fall back to the original author-typed name for
 * existence-check diagnostics wording.
 */
export function resolveElementIdsByName(name: string, registry: ProjectRegistry): string[] {
    return registry.elementIdsByName[name] ?? []
}

/**
 * Pages/lessons: unlike elements, a name resolving to more than one id has
 * no sensible "target all of them" behavior — you can only navigate to one
 * page. Callers should warn on ambiguity and use the first match.
 */
export function resolvePageIdsByName(name: string, registry: ProjectRegistry): string[] {
    return registry.pageIdsByName[name] ?? []
}

export function resolveLessonIdsByName(name: string, registry: ProjectRegistry): string[] {
    return registry.lessonIdsByName[name] ?? []
}
