# Mava Studio — Claude Code entry point

This file exists so a fresh Claude session (in Claude Code / VS Code, or anywhere else) can
resume this project without re-deriving context that already exists. **Read `AUDIT.md` and
`CLEANUP_TODO.md` before touching any code** — this file is a short orientation layer on top
of those two, not a replacement for them. `CLEANUP_TODO.md` in particular is the authoritative,
continuously-updated log of every decision, bug, and fix made across this project's working
sessions — it reads like a diary and should be trusted over anyone's memory, including this file.

## What this is

Mava Studio is one of three products in the **BitPulse CF Ecosystem**, all siblings under
`C:\Users\USER\Mava\`:

- **`mava_studio`** (this project) — Tauri v2 + Vue 3.6 desktop app for authoring courses. Consumes
  Competence Frameworks (CFs) published by CF Builder.
- **`cf-builder`** — separate Tauri app for authoring Competence Frameworks (`.cfb` working
  drafts, `.mcf` published bundles — protobuf + AES-256-GCM + RSA-OAEP + Ed25519 signed).
- **`mava-registry`** ("BitPulse Registry") — Rust/Axum server + Vue portal hosting published
  `.mcf` bundles, handles licensing.

Mava Studio itself: Tauri v2 (Rust backend, SQLite/WAL persistence) + Vue 3.6 **Vapor mode**
(deliberately scoped to canvas rendering only — see Architecture decisions below) + Pinia +
Tailwind v4. Protobuf is compiled but not yet used for serialization (JSON blobs today) — a
deliberate, sequenced-for-later migration, not an oversight.

## Standing conventions — do not deviate without a reason

- **Delivery mode: edit files directly in the repo.** The user has a *global* preference to
  receive code as chat text, but explicitly overrode that for this project given its size —
  confirmed via an explicit choice, not an assumption. Keep editing files directly.
- **Guiding principle, the user's own words:** *"simplified, direct-to-the-point codebase. When
  a decision has a 'do the minimal real thing' option and a 'build the whole general system'
  option, default to the former unless there's a concrete reason not to."* This has driven every
  scoping call so far — keep applying it.
- **Don't build inert controls.** If a UI control has no system to consume it yet (e.g. a resize
  constraint checkbox with no drag-resize system), show it disabled with a clear tooltip
  explaining why, rather than hiding it or faking functionality. Established pattern from the
  Publish/Animate menu items and the Radius panel's "Scale radius" checkbox.
- **Gate panels/features by type capability, not by whether a field currently exists in saved
  data.** Old projects predate newer fields. See `utils/elementCapabilities.ts` — decides
  eligibility from `element.kind`/`element.type` against what the style type *should* support,
  not `'x' in style`. This was a real, repeatedly-hit bug class this session (buttons, then divs,
  missing radius/padding/fill because the panel gate checked key-presence instead of type).
- **Panel file pattern** (`src/components/RightPanel/panels/*.vue`): root element is always
  `<div class="panel-root px-3">` — no `flex-1`/`min-h-0`/`overflow-hidden` on individual panel
  roots, that combination silently crushes a panel to zero height inside `StylePanel.vue`'s
  scrolling flex column once enough panels are stacked (this was a real, hard-to-spot bug — see
  CLEANUP_TODO Phase 3.9). Panels read/write the active element exclusively through
  `useActiveElement()` (`composables/useActiveElement.ts`) — never touch the stores directly
  unless operating on a *different* element (e.g. a composite's children — see `FillStroke.vue`'s
  child-fill editing, which uses `useElementStore().updateElement(childId, ...)` directly since
  `useActiveElement` is hard-wired to the active id only).
- **`ElementPatch` merges are deep** (`utils/deepMerge.ts`, used by `stores/element.ts`'s
  `updateElement`) — a panel can send a partial nested patch (`update({ style: { radius: {...} }
  })`) and it merges onto existing state rather than replacing the whole object. Exception:
  `layout` uses a shallower `mergeLayout` (spread + special-cased `transform` merge) — sending a
  full per-side object (e.g. margin) each time is the safe pattern, not a partial one.
- **No working build in the assistant's sandbox.** `vue-tsc`/`vite build` cannot run there
  (Windows/Bun `node_modules/.bin` binaries, Linux sandbox). Every fix this session is
  logically verified, not build-verified. Whoever picks this up should run a real type-check and
  click through affected panels before trusting anything marked done without a build check.

## Current status (as of this handoff)

Just finished a deep pass on the right-panel Styles system: curated per-property panels
(Layout/Transform/Text/Fills&Strokes/Geometry/Opacity/Radius/Padding/Margin/Shadow/Blur/Auto
Layout/Page Settings), replacing an old generic auto-labeling system. Along the way, found and
fixed several real rendering bugs, not just missing UI — worth knowing because it means "the
panel doesn't show a control" and "the control does nothing" were both live bug classes here,
not just gaps:

- `resolver.ts` (Element → CSS) was dropping most text formatting (family/italic/underline/
  strikethrough/case/line-height/letter-spacing) and **all** transform (rotate/scale/flip) —
  panels updated state correctly, canvas never reflected it.
- A container's own `display` field (a second, disconnected data model — see below) was
  unconditionally overriding the CSS `display` property *after* `layout.mode` (what the new Auto
  Layout panel edits) had already set it — so flex/grid had zero effect on any container.
- Buttons had no `background`/`border`/`radius`/`padding` in their style type at all (plain
  `TextStyle`) — fixed with a new `ButtonStyle` type extending `TextStyle`.
- Margin editing was broken two ways: a unit-string ("8px") was bound into a `type=number` input
  (renders blank), and even correct values produced invalid CSS (`"8pxpx"`) downstream.

Full detail, with file:line-level reasoning, is in `CLEANUP_TODO.md` Phases 3.5 through 3.9.
**Read that file's Phase 3.x sections in full before starting new panel work** — several of
these bugs look like "just add a panel" until you trace them into the resolver.

**Just discovered (Phase 3.10 in CLEANUP_TODO.md):** a full variable/binding engine already
exists (`stores/variables.ts`, `utils/bindings.ts`, `types/variables.ts`,
`VariablesRegistry.vue` — the "Variables" tab in the Terminal, alongside Scripts/Triggers/
Output) but is **completely disconnected from the element/render pipeline** —
`BaseElement` has no `bindings` field, `resolver.ts` never calls `resolveBindings()`. The
binding *design* is solid; the implementation has real bugs (see the assessment below and in
CLEANUP_TODO.md Phase 3.10) that should be fixed as part of wiring it up, not left for later.

**Two separate DSLs — do not conflate them:**
- **Trigger DSL** (`utils/Trigger/` — lexer/parser/AST/validator/summarizer/codegen,
  `TRIGGER_DSL_SPEC.txt`) — in-workspace, authoring/validation works, but `codegen.ts` doesn't
  yet call into the variable store, so triggers can't actually read/write variables at runtime.
- **Simulation DSL** (for Animate mode) — a completely separate tool the user is building
  *outside* mava_studio, to be adopted later as a dependency. Not in scope here. Do not design
  or scope Animate-mode work from inside this codebase.

## Known bugs to fix (not yet fixed — see chat/CLEANUP_TODO for full detail)

In `stores/variables.ts` / `utils/bindings.ts` / `VariablesRegistry.vue`:
1. `updateVariable()` resets a variable's live value to its default on every rename keystroke
   instead of carrying the value forward (delete-then-reseed instead of migrate).
2. `applyWriteTransform`'s `'toBoolean'` case doesn't invert (re-coerces to boolean instead of
   converting back to the source variable's real type) — any two-way binding using it will fail
   `setVar`'s type check on every write.
3. `upsertVariable` cleans up stale `globalVars` on a global→page scope change but not the
   reverse (page→global leaves dangling entries in every page's `pageVars`).
4. `resolveBindings()`'s returned `twoWayMap` is keyed by leaf property name only, not full path
   — two two-way bindings with the same leaf name in different sections collide.
5. `parseJsExpression()` in `VariablesRegistry.vue` uses `new Function(...)` to parse list/object
   literals — an eval-equivalent. Low risk today (local single-user), but a real code-execution
   risk once project files can be shared/imported across the ecosystem (which is the whole point
   of CF Builder/Registry). Swap for a real, safe literal parser.

## Recommended next steps, in order

1. ✅ Done (2026-07-09) — fixed the 5 variables/bindings bugs above. See `CLEANUP_TODO.md`
   Phase 3.11 for what changed in each of `stores/variables.ts`, `utils/bindings.ts`, and
   `VariablesRegistry.vue` (including a new `utils/literalParser.ts` replacing the
   `new Function(...)` eval-equivalent).
2. ✅ Done (2026-07-09) — added `bindings?: BindingMap` to `BaseElement` (`types/element.ts`)
   and wired `resolveBindings()` into `resolver.ts` (new `resolveElementBindings()`, called at
   the top of `resolveElement()`). See `CLEANUP_TODO.md` Phase 3.12 for the known limitation
   (only single-level dot-paths resolve correctly — `'style.font.size'` won't nest) and what's
   still unconsumed (`twoWayMap`, `repeatList` — resolved but not wired to anything yet).
3. ✅ Done (2026-07-09) — built the "Properties" panel (`RightPanel/PropertiesPanel.vue`, was a
   literal empty stub). Also found and wired in two more built-but-orphaned panels
   (`FormPanel.vue`, `MediaPanel.vue`) along the way. See `CLEANUP_TODO.md` Phase 3.13 for the
   full breakdown — component props (`ComponentPropsPanel.vue`, schema-driven), image src/alt
   (extended `MediaPanel.vue`), input semantics (`FormPanel.vue`, already built, just unwired),
   element rename (new `ElementPatch.name`), and a bind-to-variable affordance
   (`BindingsPanel.vue`) scoped to the paths `resolver.ts` actually consumes
   (`layout.visible`/`effects.opacity`/`style.content`) — two-way write-back is shown disabled,
   not built, since nothing calls `applyWriteTransform` yet (that's step 4/5 below).
4. ✅ Done (2026-07-09) — built the Trigger DSL runtime bridge: new `utils/Trigger/context.ts`
   (`buildTriggerContext()`) and `utils/Trigger/runner.ts` (`compileDslTrigger`/
   `activateDslTrigger`/`activateDslTriggers`). Turns out `codegen.ts` already emitted
   `__var[...]` reads/writes — the real gap was that nothing built the injected context or ever
   called `codegen()` + executed the result. See `CLEANUP_TODO.md` Phase 3.15 for the full
   breakdown, including two things found and fixed along the way (`utils/scripts/context.ts`'s
   shared element proxy had no `disabled`/`highlighted`/no-arg-`play`/`finish` handling, which
   the DSL's `enable`/`disable`/`highlight`/`run`/`finish` actions need) and one thing **not**
   fixed (`registerScripts()` only runs on individual script edits, never on project load — an
   `execute <script>` trigger action will warn "no handler registered" until that script has
   been opened once this session).
   Related, still open: wire an actual two-way input listener into `render-bridge.ts` that calls
   `applyWriteTransform` + `setVar` on user input, using the `twoWayMap` `resolveBindings()`
   already returns (currently unconsumed) — needed before `BindingsPanel.vue`'s two-way toggle
   can be un-disabled.
4.5. ✅ Done (2026-07-09) — built Preview mode (the structural blocker step 4 surfaced): a real
   OS window (`src/PreviewApp.vue`, opened via `composables/usePreview.ts`'s `WebviewWindow`),
   reachable from the Project dropdown, running the full runtime (Trigger DSL + scripts +
   `ElementTrigger[]` + native DOM interaction) against the last **saved** state, with debug
   output bridged cross-window into the main app's existing Output tab
   (`utils/previewBridge.ts`, Tauri's `event` API). See `CLEANUP_TODO.md` Phase 3.16.
   **Not build-verified — the Rust/Tauri side specifically.** `src-tauri/capabilities/default.json`
   needed new ACL grants for a second window to create itself and call `invoke`; the permission
   identifiers are correct per Tauri v2 convention but unconfirmed against an actual build (no
   Rust toolchain in this sandbox). First thing to check when this can be built: does the preview
   window actually open, and is it not ACL-denied when it calls `load_project`/`load_page`.
6. **New top-priority gap, surfaced while building step 4.5:** `types/project.ts`'s `ProjectData`
   has no variable-definitions field at all — `stores/variables.ts`'s `initDefinitions()` is
   never called anywhere. Variable *definitions* (name/type/scope/default) aren't part of the
   persisted project schema, so they're lost on every project close/reopen, not just in Preview
   — Preview just made it visible because it's the first thing that round-trips through a real
   save→reload while variables are populated. Needs a Rust-side `ProjectData` struct change
   (`src-tauri/src/project.rs`) this sandbox can't compile, plus the matching
   `projectMetadata.ts` `_snapshot()`/`_hydrate()` wiring. Fix this before leaning on Preview for
   anything variable-driven, and before Phase 5's proto migration touches serialization again.
7. ✅ Done (2026-07-09), taken out of order at your request — canvas interaction: selection
   (click-to-select was fully dead code — fixed via event delegation in `createMode.vue`),
   multi-select (shift/ctrl-click, `useEditorSelection.ts`), drag-to-move and 8-handle resize
   (new `composables/useElementDragResize.ts`). Along the way, found and fixed a bigger bug:
   `data-eid` was never actually set on any live DOM node (`render-bridge.ts`'s
   `realizeElement()` never stamped it — only the dead `*Renderer.vue` files from Phase 2 did),
   which silently broke every `document.querySelector('[data-eid="..."]')` lookup in the app,
   including the Trigger DSL runtime (step 4) and the Scripts element proxy — fixed with one
   line. See `CLEANUP_TODO.md` Phase 3.19 for the full breakdown. **Corrected same-day in Phase
   3.20**: drag no longer promotes flow elements to `position: absolute` — this app models HTML's
   natural flow layout, not a freeform canvas, so dragging a `static`-positioned element (the
   default) now reorders it within its parent's children via new `composables/useElementReorder.ts`
   (drop-line indicator, orientation-aware for block/flex-row/grid), never touching x/y. Free x/y
   drag (`useElementDragResize.ts`) only applies to a lone element the author has already switched
   off static positioning. Resize likewise never touches position for static elements — only
   `width`/`height`, and only via the `e`/`s`/`se` handles, since shrinking from top/left would
   require a position shift flow can't express.
   **Explicitly not done:** `UnifiedToolbar.vue`'s align/distribute/group buttons — its handlers
   are all commented out and reference a `stores/project` module (`ungroupCollection`,
   `alignCollectionMembers`, `groupSelectedElements`, `selectedElementIds`, etc.) that doesn't
   exist anywhere in the current codebase. Wiring these isn't "connect the button" — it's
   designing and building a group/align/distribute feature against today's element model
   (container-based grouping, multi-select bounding-box math) from scratch. Next canvas-area
   priority once picked back up.
   **Not runtime-verified** (no build available) — see Phase 3.19/3.20's smoke-test checklists.
8. ✅ Done (2026-07-09), autonomous 4-phase run per your request ("work in the order you find
   professionally [right]... handle one after the other without my intervention"): element
   definitions audit → disable native interactivity in authoring → page-level padding/margin/
   layout → contentEditable text editing. Full detail in `CLEANUP_TODO.md` Phases 3.28–3.31;
   highlights: fixed a real bug where the "Text" insert silently produced a `<textarea>` instead
   of a paragraph (`buildText()` existed but was dead code), fixed a real bug where Code elements'
   typed content never rendered at all, disabled native form-control/button/iframe interactivity
   during authoring (readOnly not disabled — disabled inputs stop receiving pointer events in most
   browsers, which would have broken click-to-select), added page-level padding/margin/flex/grid
   layout (routed through Rust's pre-existing but previously-unused `Stage.display:
   serde_json::Value` passthrough field to avoid a repeat of the exact "missing field" save
   failure from Phase 3.16/3.17 — no Rust changes needed), and added double-click contentEditable
   for text/label/button/code plus a Plain Text inline (`<span>` vs `<p>`) toggle.
   **Not runtime-verified** (no build available) — see each phase's own smoke-test checklist in
   `CLEANUP_TODO.md`.

Deferred, explicitly not scoped yet: proto migration (sequenced after the above, see
`CLEANUP_TODO.md` §0.2), `.mcf` cross-repo import (§Phase 4 — scoped in detail, needs `rsa`
crate added to `mava-registry` and a shared crypto crate extracted from `cf-builder`), theme
system / light-dark project colors (brainstormed in §D4, not built), responsiveness (brainstormed
in §D5, not built — note `ResponsiveDelta` already exists on `BaseElement` but nothing reads it,
same "designed but not bridged" pattern as everything else here).

## Also worth knowing

- Two-different-things trap #2: `ContainerElement.display` (`+FlexDisplay`/`GridDisplay` in
  `types/project.ts`) vs `Layout.mode`/`direction`/`justify`/`align`/`wrap`/`gap`/`columns`
  (`types/element.ts`) used to both claim to control container flex/grid layout. Resolved this
  session — `Layout.*` is now the sole authority (`resolver.ts`'s `resolveContainerStyle` no
  longer touches `display`). The `ContainerElement.display` field and `FlexDisplay`/`GridDisplay`
  types are still on the type and still constructed by `buildContainer()` but are fully orphaned
  now — safe to formally remove, just not urgent.
- 9 files were deprecated (stubbed, not deleted — this sandbox couldn't delete from the mounted
  folder) in an earlier phase: `RightPanel/GroupRenderer.vue`, `RightPanel/styleMatrix.ts`, and
  everything under `RightPanel/controls/`. **If these still exist in your filesystem, delete
  them** — every stub file says so in its own header comment.
