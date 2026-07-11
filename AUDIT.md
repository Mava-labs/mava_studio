# Mava Studio — Codebase Audit & Readiness Assessment (Refresh)

**Date:** 2026-07-08
**Supersedes:** the 2026-03-10 audit in this same file (that version is preserved in git history / `staging` commit `13dc064`)
**Method:** direct source read of `src/` and `src-tauri/src/`, cross-checked against the prior audit's claims rather than trusting them. Several March claims are now wrong — corrected below and marked ⟲.

---

## 1. Project Identity

Unchanged: Mava Studio is a desktop-native academic course authoring tool (Tauri v2 + Vue 3 Vapor + Pinia). Core loop is still `Create Mode → Interactions & Triggers → Scene Simulations/Animations → CF Mapping & Inspector → Publish`.

What's changed since March: the CF (Competence Framework) leg of that loop went from "not started" to genuinely implemented end to end, and a full interaction-DSL toolchain (lexer/parser/validator/Monaco integration) was built, though not yet connected to runtime execution.

---

## 2. Architecture Overview

```
Tauri (Rust backend)
 └── Vue 3 Vapor (no virtual DOM)
      ├── Pinia stores (persisted to Tauri Store plugin) — 11 stores, up from 7
      ├── render-bridge.ts / resolver.ts — imperative Vapor renderer
      │    (replaces the old element.mounter.ts, which no longer exists)
      ├── Store-driven navigation (no vue-router)
      └── Tailwind CSS
```

**File structure (current):**
```
src/
├── App.vue                          Shell (grid layout, mode switching)
├── mods/                            create, template (stub), animate (stub), empty
├── components/
│   ├── AppHeader.vue                Top bar (nav, publish [fake], context)
│   ├── SideNav.vue / NavAssociates.vue / RightUtilities.vue
│   ├── SideNavigation/
│   │   ├── Structure/, ElementsPanel.vue         (unchanged, complete)
│   │   └── cf/                      NEW — mapper/ + inspector/ (9 files, real)
│   ├── RightPanel/                  Style/property panels (mostly unchanged)
│   ├── Terminal/                    NEW — TriggersEditor, ScriptEditor,
│   │                                 VariablesRegistry, OutputLog, TerminalPanel
│   └── renderers/                   render-bridge/resolver (live) +
│                                     Container/FlatHtml/Svg/ComponentRenderer.vue
│                                     (dead — see §6)
├── stores/                          11: + palette, terminal, variables,
│                                     useCfStore, useCfMapperStore
├── composables/                     14, up from 1: useAutosave, useUndoRedo,
│                                     useProjectLifecycle, useEditorSelection,
│                                     useMonaco, useElementTriggers, useCfStore
│                                     helpers, useComponentEditor, usePageSwitcher,
│                                     etc. (two of these are orphaned — see §6)
├── utils/
│   ├── Trigger/                     NEW — lexer.ts, parser.ts, ast.ts,
│   │                                 validator.ts, summarizer.ts, codegen.ts
│   │                                 (~4200 lines, implements TRIGGER_DSL_SPEC.txt)
│   └── scripts/                     NEW — runner.ts (real `new Function(...)`
│                                     execution), compiler worker
└── types/                           + cf.types.ts, cf-alignment.types.ts, variables.ts

src-tauri/src/
├── cf/                              types, validation, cache, mapper, inspector,
│                                     commands — real, tested (8 unit tests)
├── commands/                        project, pages, history (WAL), undo
├── db/                              mod.rs (2 SQLite pools, WAL mode),
│                                     migrations.rs (versioned schema)
└── proto/mava.proto                 596-line schema, compiled, UNUSED at runtime
```

**Data hierarchy:** unchanged (`Course → Module[] → Lesson[] → Page[] → Element[]`).

---

## 3. What's Complete & Done Right

Everything the March audit marked complete is still complete (type system, disk I/O scaffolding, `.mava` archive, canvas rendering primitives, the full style-panel ecosystem, structure/explorer/outline trees, animation engine, notifications). New since March:

| Item | Assessment |
|------|------------|
| **⟲ Open existing project** | **Complete.** `mods/emptyProject.vue` has working "New blank project" / "Open project" actions via `useProjectLifecycle`, a real recent-projects list with reopen/remove, backed by `get_recent_projects`/`remove_recent_project`. March said this showed a "coming soon" toast — no longer true. |
| **⟲ Auto-save + dirty tracking (backend + wiring)** | **Complete as data flow.** `useAutosave.ts` debounces (2s) and calls `autosave_scope`; wired into `useProjectLifecycle` on create/open/close. `dirtyScopes`/`markDirty` in `projectMetadata.ts` is real and called from dozens of mutators. **Missing:** no "unsaved changes" UI indicator anywhere. |
| **⟲ Undo/redo data layer** | **Complete but disconnected.** `stores/projectMetadata.ts` has a real undo/redo stack (`pushUndo`, `undo()`, `redo()`), `stores/element.ts` pushes onto it on every mutation, and `composables/useUndoRedo.ts` is a fully built dispatcher. All of `flush_undo_entry`, `load_undo_entry`, `commit_snapshot`, `reconstruct_version` are actually called from the frontend. The stack **is being populated correctly as the user works** — see §4 for why it's not usable yet. |
| **⟲ CF (Competence Framework) integration — backend** | **Complete, real, tested.** `src-tauri/src/cf/` — types, checksum validation (SHA-256 over canonicalized JSON), filesystem cache, `mapper.rs` (real `CourseBrief` computation: indexed competencies/indicators/evidence, domain map, prerequisite graph, cross-framework dependency detection), `inspector.rs` (real 4-section report: compatibility, coverage, assessment quality, integrity posture, publish-readiness). 8 genuine unit tests. |
| **⟲ CF integration — frontend** | **Complete for local workflow.** `useCfStore.ts` / `useCfMapperStore.ts` drive real `MapperPanel.vue` / `InspectorPanel.vue` UIs (health bar, strictness selector, coverage list, quality/compatibility sections) off live store state. Local framework import (file picker → `readTextFile` → `importFramework()`) works end to end. Only the *hosted registry browse/search* is stubbed (`STUB_REGISTRY` local arrays, explicitly commented as such). |
| **Trigger DSL — authoring toolchain** | **Complete as an editor feature.** Real lexer (407 lines), parser (1003 lines), AST, validator (841 lines) implementing the full `TRIGGER_DSL_SPEC.txt` grammar including its ~23 error codes; a real Monarch tokenizer registered in `useMonaco.ts` gives live syntax highlighting + diagnostics in `TriggersEditor.vue`. Authors can write and get validated DSL today. **Not yet connected to execution** — see §4. |
| **TypeScript script execution** | **Complete.** `utils/scripts/runner.ts` genuinely compiles and runs author scripts (`new Function('stage','project','element','fetch', compiledJs)`), registered into the action registry — separate from and unrelated to the DSL trigger system. |
| **Rust project lifecycle** | **Complete.** All 8 commands in `commands/project.rs` are fully implemented, including OS-specific `reveal_in_explorer`, WAL checkpoint-before-copy on Save As, and backward-compat auto-migration of old project hierarchies on load. |
| **SQLite schema + migrations** | **Complete.** Two WAL-mode pools (project + app-state), a real versioned migration system (`meta.schema_version`), tables for `document`, `pages`, `history`, `snapshots`, `undo_log`, `recent_projects`. |

---

## 4. What's Partially Built (In Progress)

### 4.1 Undo/Redo — the one item where "data layer done" ≠ "feature usable"
The entire pipeline works except the last step: `App.vue`'s keydown handler still literally reads `// TODO: implement undo logic` / `// TODO: implement redo logic` and never calls `useUndoRedo()` or `project.undo()/redo()`. **This is now a small, well-scoped task** — wire an existing, working composable to an existing keyboard handler — not the ground-up feature the March audit implied.

### 4.2 History/WAL reconstruction — real but naive
`reconstruct_version` and `autosave_scope` (`commands/history.rs`) work and are exercised by real callers, but both explicitly punt on field-level merging (their own code comments: *"For now we store the full document blob... when proto is fully wired, apply field-level merging here"*). Today, reconstructing a version returns whichever single WAL row is last-in-range (or the base snapshot) — whole-blob last-write-wins, not a true diff-apply. Fine for current usage, will not scale to concurrent/partial scope edits.

### 4.3 Trigger DSL — authored but not executable
`codegen.ts` (759 lines, compiles validated DSL AST → JS glue) exists but is **never called** from anywhere else in the codebase. The actual runtime trigger execution path (`useElementTriggers.ts`) still runs against the older structured `ElementTrigger[]` model, not DSL output. Net state: authors can write, get syntax-highlighted, and get validated DSL in the Terminal panel — but it has no effect on the running project yet. Bridging `codegen()` output into `useElementTriggers` is the key remaining task here, not building a parser (that part's done).

### 4.4 Canvas UX — essentially unchanged from March
Selection is a plain outline ring (`EditorOverlay.vue`) — no resize/rotate grips. No drag-to-move, no drag-and-drop reparenting (grep confirms zero handlers). `UnifiedToolbar.vue`'s multi-select/align/distribute/group UI is complete but every handler body is commented out. No inline text editing, no canvas copy/paste, delete shortcut still commented out in `App.vue`.

### 4.5 CF Mapper marketplace
Local import/inspect is real; the hosted-registry browse/search UI (`MapperBrowseView.vue` et al.) runs against `STUB_REGISTRY`/`STUB_DETAILS` local arrays pending a real API — this is presumably meant to eventually call `mava-registry`'s `registry` module (see the sibling project), which already exists and is a real Axum service.

### 4.6 AppHeader / Publish — worse than "stubbed," it's actively misleading
`handleFileNav('Publish')` shows a **fake success sequence** ("Building publish bundle…" → "Publish bundle downloaded") with zero actual work behind it — no `invoke`, no bundler call, `publishProject()` doesn't exist anywhere. This is a UX risk: it currently tells the user something succeeded that never happened. Project menu (open/close/save/save-as/recent) is still a no-op button.

### 4.7 Right Panel stubs — unchanged from March
`PropertiesPanel.vue` is an empty div. `DSLActionsPanel.vue` is a hardcoded 4-row fake list, explicitly commented "shell... once stores are ported" — note this is a *different, dead* component from the real DSL system that now lives in `components/Terminal/`. `ColorPicker.vue`'s `openPicker()` is still commented out.

### 4.8 Side Navigation placeholders — narrower than March, not gone
Components, Assets, and Animations panels in `NavAssociates.vue` are still literal placeholder divs. Notably, **Assets has real backend-adjacent data (`mediaLibrary` CRUD in `projectMetadata.ts`) with zero UI on top of it** — the model is ready, only the panel is missing. CF Map and Inspector are no longer placeholders (see §3).

### 4.9 Template Mode & Animate Mode — unchanged, plus a new dangling reference
Both are still heading-only stubs. New finding: `AppHeader.vue`'s context dropdown lets a user select `chooseStage('animate')`, which sets `stage.currentStage = 'animate'` — but `App.vue`'s render chain has no `v-else-if` for `'animate'`, so the app silently falls through to `EmptyProject`. Small but real UX bug: a working-looking menu item leads nowhere.

---

## 5. What Wasn't Thought Of But Is Necessary

Mostly unchanged from March, with two items resolved (CF integration, DSL authoring) and one new addition:

**Still fully missing:** rich text editing (no contenteditable/WYSIWYG — text is still a single style-panel input), asset/media manager (no file picker anywhere for images/video/audio — `ImagePanel`/`MediaPanel` only take a raw URL string despite `mediaLibrary` existing in the store), a functional component library (`ComponentElement` resolves via `resolver.ts` but `createMode.vue` always provides an empty `componentLibrary`, so component instances can never resolve to anything), a real publish/export pipeline, SCORM/xAPI packaging, assessment authoring (question types/scoring/rubrics), a variable/state-machine engine for scene simulation, accessibility tooling, i18n, collaboration/auth, and a test suite + CI (still effectively zero: one `lexer.test.ts` with no assertions and no test runner configured; Rust has 8 real tests but only in the CF module — none for project/pages/history/undo/db).

**New finding — dead code cleanup needed before it compounds:**
- `useUndoRedo.ts`, `useComponentEditor.ts`, `usePageSwitcher.ts` are fully built composables that are **never imported/invoked anywhere** in the running app (orphaned — `usePageSwitcher` is only referenced by `useComponentEditor`, which is itself unreferenced).
- `components/renderers/ContainerRenderer.vue`, `FlatHtmlRenderer.vue`, `SvgRenderer.vue`, `ComponentRenderer.vue` are never imported by the live app — leftovers from before the `render-bridge.ts`/`resolver.ts` rewrite. `ComponentRenderer.vue` imports `../CanvasNode.vue`, which **doesn't exist in the repo at all** — this file would fail to compile if anything ever imported it.
- The 596-line `proto/mava.proto` schema is fully compiled (`prost-build`) and richer than the JSON currently persisted, but zero production code constructs a `proto::` type — everything still round-trips through `serde_json`. Either commit to the migration or drop it from the build to stop paying its compile cost for nothing.

---

## 6. Risk & Technical Debt

| Risk | Severity | Detail |
|------|----------|--------|
| **Vue 3.6.0-beta.1** | High | Still on a beta framework in Vapor mode; unchanged risk from March. |
| **No tests outside CF module** | High | Rust: 8 real tests, but only for `cf/`. Frontend: one non-asserting `console.log` "test" file, no runner configured. |
| **No CI/CD** | High | Unchanged — no `.github/workflows`, no automated builds. |
| **Publish button lies to the user** | High (new) | Shows a fake "bundle downloaded" success notification with no work performed — actively misleading, not just missing. |
| **Undo stack recorded but unreachable** | Medium (new, narrower than March's framing) | Data layer works; only the UI trigger is missing. Low effort, high visible impact to fix. |
| **`reconstruct_version` is whole-blob, not diff-based** | Medium (new) | Will not correctly reconstruct history once multiple scopes are edited between snapshots — works today mostly by luck of usage patterns. |
| **Dead/orphaned files** (`useUndoRedo` partially, `useComponentEditor`, `usePageSwitcher`, 4 renderer files, one importing a nonexistent file) | Medium (new) | Increases audit/onboarding confusion; `ComponentRenderer.vue` would break the build if ever wired up as-is. |
| **`animate` stage is selectable but unrenderable** | Low (new) | Dangling menu item, silent fallthrough to EmptyProject. |
| **Unused `proto` schema and `thiserror` dependency** | Low (new) | Both declared/compiled, neither used — dead weight in build times and mental model. |
| **No error boundaries / no data backup on crash** | Medium | Unchanged from March. |
| **Typo `outlineExpaded`, hollow `{id} as any` sub-docs** | Low | Unchanged from March — not yet cleaned up. |

---

## 7. Versioning Roadmap Summary (Refreshed)

### MVP — Current → Usable Alpha
Reordered by what's now actually left, not what was originally listed:

1. **Wire undo/redo to the UI** — small task, the hard part (data layer) is done. *(was previously scoped as a full feature; now it's a keyboard-handler fix)*
2. **Real publish flow, or remove the fake one** — at minimum stop showing a false-success notification; ideally build the static HTML/CSS/JS exporter.
3. **Selection handles** (resize + rotate grips on canvas) — unchanged gap.
4. **Drag-to-move / reparenting** — unchanged gap.
5. **Multi-select operations** — wire the already-built `UnifiedToolbar` UI to real align/distribute/group logic.
6. **Asset manager UI** — the data model (`mediaLibrary`) already exists; this is now "build the panel + file picker," not "design the whole feature."
7. **Bridge DSL codegen to runtime** — parser/validator/editor are done; connect `codegen.ts` output into `useElementTriggers.ts` so authored triggers actually run.
8. **Rich text editing** — unchanged gap.
9. **Unsaved-changes indicator** — small, the `dirtyScopes` state already exists to drive it.
10. **Undo/redo keyboard shortcuts + delete shortcut** — same effort as #1, bundle together.
11. **Component library** — wire `createMode.vue`'s empty `componentLibrary` provide to something real, or scope it out of MVP if not essential.
12. **Clean up dead code** — remove or finish the four orphaned renderer files and three orphaned composables before they cause a confusing bug (especially `ComponentRenderer.vue`'s missing import).
13. **Fix the `animate` stage dangling reference** — either wire `AnimateMode` into `App.vue`'s v-if chain or remove the menu entry until it's ready.

### V1.0 (Feature-Complete Product)
Largely unchanged from March, with CF mapper/inspector now done and removed from this list: assessment authoring, scene simulation/state-machine engine, template mode, animate mode (full build, not just the App.vue wire-up), collaboration roles, SCORM/xAPI export, accessibility checker, real test suite + CI, CF hosted-registry integration (connect to `mava-registry`'s existing Axum backend instead of `STUB_REGISTRY`).

### V2.0 (Ecosystem & Scale)
Unchanged: field-level history reconstruction (finish the proto migration to make this real), version history/rollback UI, online publish endpoint, course marketplace, i18n, AI-assisted authoring/CF-mapping, plugin/extension architecture, analytics.

---

## 8. Summary Counts (Refreshed)

| Category | March 2026 | July 2026 |
|----------|-----------|-----------|
| Pinia stores | 7 | 11 |
| Composables | 1 | 14 (2 fully orphaned, 1 partially orphaned) |
| CF module (Rust) | Nonexistent | 6 files, real logic, 8 tests |
| DSL toolchain (frontend) | Nonexistent | ~4200 lines (lexer/parser/AST/validator/codegen/summarizer), authoring works, execution not bridged |
| Rust unit tests | 0 | 8 (CF module only) |
| Frontend test files | 0 | 1 (non-asserting, not run by anything) |
| CI/CD configs | 0 | 0 |
| Known dead/orphaned files | 0 flagged | 3 composables + 4 renderer components |

**Bottom line:** the academic-tool differentiator (CF integration) that March called the biggest gap is now genuinely built and tested on both ends. The new center of gravity is: (a) a handful of small "just wire it up" tasks where real infrastructure already exists but isn't connected (undo/redo, DSL execution, asset manager UI, unsaved-changes indicator), (b) the canvas-interaction gaps that haven't moved since March (selection handles, drag-move, multi-select), (c) a publish flow that needs to either become real or stop lying to users, and (d) a small but growing pile of dead code worth cleaning up before the next contributor trips over it.
