# Mava Studio — Codebase Audit & Readiness Assessment

**Date:** 2026-03-10
**Branch:** `staging`
**Last Commit:** `13dc064 Style panel UI polish`

---

## 1. Project Identity

Mava Studio is a **desktop-native academic course authoring tool** built on **Tauri v2 + Vue 3 Vapor + Pinia**. Its purpose is to let authors construct courses through a visual canvas—laying out markup, wiring interactions, linking to competence frameworks, and publishing to web-standard output or a controlled ecosystem outlet.

**Core authoring loop:**
`Create Mode (markup/layout)` → `Interactions & Triggers` → `Scene Simulations/Animations` → `CF Mapping & Inspector` → `Publish (web output / .mava archive)`

---

## 2. Architecture Overview

```
Tauri (Rust backend)
 └── Vue 3 Vapor (no virtual DOM)
      ├── Pinia stores (persisted to Tauri Store plugin)
      ├── Imperative DOM mounter (bypasses Vue for canvas elements)
      ├── Store-driven navigation (no vue-router)
      └── Tailwind CSS
```

**File structure:**
```
src/
├── App.vue                          Shell (grid layout, mode switching)
├── main.ts                          Entry (createVaporApp + Pinia)
├── mods/                            Mode views (create, template, animate, empty)
├── components/
│   ├── AppHeader.vue                Top bar (nav, publish, context)
│   ├── SideNav.vue                  Left icon bar (7 nav keys)
│   ├── NavAssociates.vue            Contextual side panel router
│   ├── RightUtilities.vue           Right panel router
│   ├── SideNavigation/              Explorer, Elements, Structure trees
│   └── RightPanel/                  Style/property editing panels
├── stores/                          7 Pinia stores
├── types/                           Element, Project, StyleInspector
├── utils/                           DOM mounter, builders, disk I/O, archive
└── composables/                     useActiveElement
```

**Data hierarchy:**
```
ProjectData → Course → Module[] → Lesson[] → Page[] → Element[]
                                                        ├── FlatHtml (text, image, video, audio, button, input...)
                                                        ├── Container (div, section, form, list, group...)
                                                        ├── Component (reusable with slots/props)
                                                        └── SVG (rect, circle, polygon, star, path, hotspot...)
```

---

## 3. What's Complete & Done Right

### 3.1 Type System & Data Modeling ✓
| Item | Assessment |
|------|------------|
| `types/element.ts` — Full element union type (FlatHtml, Container, Component, SVG) | **Solid.** Well-separated by kind with discriminated unions. |
| `types/project.ts` — Hierarchical Course → Module → Lesson → Page model | **Solid.** Includes CF node ID slots (`cfNodeIds`), lesson types (activity/assessment), prerequisites, metadata timestamps. |
| Responsive delta system (`ResponsiveDelta<TStyle>`) | **Defined** but not wired into any UI or rendering. |
| Interaction model (triggers + animations) | **Well-designed.** Event-driven with open action registry. |
| Schema versioning (`CURRENT_PROJECT_VERSION`) | **Present.** No migration logic yet. |

### 3.2 Project Persistence & Disk I/O ✓
| Item | Assessment |
|------|------------|
| `createProjectAndPersist()` — scaffolds full directory structure | **Complete.** Creates modules/, lessons/, pages/, scripts/, triggers/, assets/ on disk. |
| Page load/save cycle (`pages.ts`) | **Complete.** Load from JSON, cache in memory, normalize stage defaults, save back. |
| `.mava` archive pack/extract via Rust backend | **Complete.** Rust ZIP handler works. |
| Pinia persistence via Tauri Store plugin | **Complete.** Custom storage adapter wired. |

### 3.3 Canvas & Element Rendering ✓
| Item | Assessment |
|------|------------|
| Imperative DOM mounter (`element.mounter.ts`) | **Complete.** Creates HTML/SVG/Container nodes, applies all style types, patches in-place, handles recursive children. |
| Element builder factory (`element.builder.ts`) | **Complete.** Builder functions for all major element types. |
| Element store — add, remove, update with surgical DOM sync | **Complete.** Insertion logic handles root, sibling, child positions. Update merges partial patches and applies to live DOM without remounting. |
| SVG geometry rendering (rect, circle, ellipse, line, polygon, star, arrow, path, hotspot) | **Complete.** All 9 geometry types generate proper SVG markup. |
| Canvas rulers (H/V) with DPI-aware ticks | **Complete.** 100px major, 10px minor, drawn to HTML canvas. |
| Dot-grid background | **Complete.** |

### 3.4 Style Panel Ecosystem ✓
| Item | Assessment |
|------|------------|
| `LayoutPanel` — X/Y/W/H with flow/absolute awareness | **Complete.** |
| `TransformPanel` — ScaleX, ScaleY, Rotation | **Complete.** |
| `EffectsPanel` — Opacity slider, Blur slider | **Complete.** |
| `TextPanel` — Font, size, weight, color, alignment, decoration, transform, line-height, letter-spacing | **Complete.** Full text editing. |
| `ImagePanel` — Fit mode, brightness, contrast, grayscale, blur | **Complete.** |
| `FillStroke` — Fill color, stroke color/width/style | **Complete.** |
| `RadiusPanel` — Per-corner border radius with linked toggle | **Complete.** |
| `PaddingPanel` — Per-side padding with linked toggle | **Complete.** |
| `StylePanel` (container) — Conditional panel routing by element kind/type | **Complete.** |
| `useActiveElement` composable — clean access to selected element + update function | **Complete.** |

### 3.5 Project Structure (Explorer) ✓
| Item | Assessment |
|------|------------|
| `StructurePanel` — Full file tree (course > modules > lessons > pages) | **Complete.** Reads from disk, builds tree, supports CRUD. |
| Create lesson/page on disk with JSON persistence | **Complete.** |
| Rename, delete, copy, cut with Tauri FS | **Complete.** |
| `ExplorerItem` — context menu, inline rename, kind-based color badges | **Complete.** |
| `OutlineTree` — DOM-like element tree for the active page | **Complete.** |
| Page tabs in CreateMode (VS Code-style) | **Complete.** |

### 3.6 Animation & Interaction Engine ✓
| Item | Assessment |
|------|------------|
| `element.animations.ts` — Web Animations API driver | **Complete.** Plays keyframe animations, supports from/to, delay, easing, loop, concurrent playback, per-element cancellation. |
| `element.actions.ts` — Open action registry with async dispatcher | **Complete.** `registerAction()` / `dispatchActions()` pattern ready. |
| Trigger wiring on mount (event → actions pipeline) | **Complete.** Auto-wired on element mount, cleanup on unmount. |
| Autoplay vs trigger-bound animation separation | **Complete.** |

### 3.7 Notification System ✓
| Item | Assessment |
|------|------------|
| `NotificationsTray` + `notification.ts` store | **Complete.** Info/warn/error toasts with auto-dismiss. |

---

## 4. What's Partially Built (In Progress)

### 4.1 Create Mode Canvas
| Gap | Current State | Work Remaining |
|-----|---------------|----------------|
| **Element selection UX** | Click-to-select works; no visual selection handles (resize grips, rotation handle) | Need selection overlay with resize/rotate handles, bounding box |
| **Drag to move** | Pointer events wired but `moveElement` is commented out (`console.log` placeholder) | Wire actual position update on drag end |
| **Drag-and-drop reparenting** | Drop target highlighting exists, actual DOM move commented out | Complete reparenting logic |
| **Multi-select** | `UnifiedToolbar` UI built for `multiselect` mode but all alignment/group/distribute functions are stubbed (empty bodies) | Implement alignment, distribution, grouping logic |
| **Text inline editing** | Not implemented — text content only editable via style panel input | Need contenteditable or overlay editor on double-click |
| **Image source picker** | ImagePanel has `src` field but no file picker or asset browser integration | Wire Tauri file dialog or asset panel |
| **Copy/Paste elements** | Not implemented on canvas | Need clipboard CRUD |
| **Undo/Redo** | Commented out in App.vue; `HistoryMeta` type exists in project.ts | Need command history stack |
| **Keyboard shortcuts** | Delete shortcut commented out; no others | Need shortcut manager |

### 4.2 AppHeader / Publish
| Gap | Current State | Work Remaining |
|-----|---------------|----------------|
| **Publish flow** | Button exists; `publishProject()` call is commented out | Need full build pipeline: validate → bundle static HTML/CSS/JS → pack archive → optional upload |
| **Project menu** | Button exists, does nothing | Need open/close/save/save-as/recent |

### 4.3 Right Panel
| Gap | Current State | Work Remaining |
|-----|---------------|----------------|
| **PropertiesPanel** | Empty `<div>` | Need element metadata editor (name, semantic role, accessibility props, CF links) |
| **DSLActionsPanel** | Visual scaffold only — hardcoded data, all buttons disabled | Need trigger/variable CRUD, DSL editor, action binding UI |
| **ColorPicker** | Chip renders but `openPicker` body is commented out | Need palette picker or full color picker popup |
| **Device/responsive preview** | Dropdown in StylePanel "no element" state, mostly commented out | Need breakpoint switcher + responsive preview resizing |

### 4.4 Side Navigation
| Gap | Current State | Work Remaining |
|-----|---------------|----------------|
| **Components panel** | Placeholder text | Need component library: create, edit, instantiate reusable components |
| **CF Map panel** | Placeholder text | Need competence framework mapper (see Section 5) |
| **Assets panel** | Placeholder text | Need asset manager: import/organize images, videos, audio, documents |
| **Inspector panel** | Placeholder text | Need course-level inspector/validator (see Section 5) |
| **Animations panel** | Placeholder text | Need timeline editor for animation sequencing |

### 4.5 Template Mode & Animate Mode
| Gap | Current State | Work Remaining |
|-----|---------------|----------------|
| **TemplateMode** | Stub — heading only | Full template system design needed |
| **AnimateMode** | Stub — heading only; not wired into App.vue v-if chain | Full animation workspace design needed |

### 4.6 ElementsPanel Visual Polish
| Gap | Current State | Work Remaining |
|-----|---------------|----------------|
| Element insert items | Text labels in grid cells ("Rectangle", "Text", etc.) | Replace with SVG icons or thumbnail previews |

---

## 5. What Wasn't Thought Of But Is Necessary

These are capabilities the codebase doesn't address at all — no types, no stubs, no placeholders — but are essential for the described product.

### 5.1 Critical for MVP

#### A. Competence Framework (CF) Integration
The types have `cfNodeIds: string[]` on Course, Module, and Lesson, but there is:
- **No CF data model** — no type for `CompetenceFramework`, `CFNode`, or `CFEdge`
- **No CF import/parse** — no way to load externally developed frameworks (JSON-LD, CASE, ASN, CSV)
- **No CF Mapper UI** — the `cf_map` side nav is a placeholder
- **No mapping validation** — nothing checks whether authored content covers required competencies
- **No coverage visualization** — no way to see "which competencies are covered/missing"

#### B. Inspector / Course Validator
- **No validation engine** — no rules that check:
  - Every competence node has at least one lesson mapped
  - Lessons have required assessments
  - Prerequisites form a valid DAG (no cycles)
  - Pages have accessible content (alt text, heading structure)
  - Estimated durations are plausible
- **No inspector UI** — the `inspector` side nav is a placeholder
- **No validation report** — no exportable coverage/quality report

#### C. Content Editing Beyond Layout
- **No rich text editor** — text is set via a single input field; no WYSIWYG, no inline formatting, no lists/headings within text blocks
- **No markdown or HTML source editor** — content authors need to write structured prose, not just positioned labels
- **No media asset pipeline** — no way to import, reference, or manage images/videos/audio from disk with proper relative paths and bundling

#### D. Save & Auto-Save
- **No auto-save** — pages are loaded into memory but there's no periodic write-back; the `savePage()` function exists but is never called automatically
- **No "unsaved changes" indicator** — no dirty state tracking
- **No save-before-close guard** — closing the window could lose all work

#### E. Open Existing Project
- **"Open workspace" shows "coming soon" toast** — can't re-open a saved `.mava` project
- **No recent projects persistence** — the list on the welcome page is hardcoded

#### F. Publish Pipeline
- **No static HTML/CSS/JS exporter** — the "web standard output" requires a build step that flattens Page JSON into standalone HTML documents with embedded styles and scripts
- **No SCORM/xAPI packaging** — academic courses typically need LMS-compatible packaging
- **No preview server** — no way to preview the published course in-app or via dev server
- **No "map outlet" renderer** — the online preview/delivery endpoint is entirely unbuilt

### 5.2 Necessary for V1.0 (Post-MVP)

#### G. Collaboration & Authoring Roles
- `Author` type exists with `role: 'owner' | 'editor' | 'supervisor'` but:
  - No authentication/user system
  - No concurrent editing or conflict resolution
  - No review/approval workflow for supervisors
  - No comment/annotation system on pages or elements

#### H. Assessment Authoring
- `Lesson.type` can be `"assessment"` but:
  - No question types (MCQ, fill-blank, matching, drag-drop, short answer)
  - No scoring/rubric model
  - No correct answer data structure
  - No assessment preview/test-run mode
  - No result tracking schema

#### I. Scene Simulations
- The interaction/trigger/animation engine is a foundation, but:
  - No state machine or branching logic for scenario simulations
  - No variable system (the DSL panel has "Variables" placeholder but no data model)
  - No conditional logic (if/then/else for branching paths)
  - No simulation playback/test mode

#### J. Scripting & DSL
- `DSLTriggerDocument` and `ScriptDef` types exist in `project.ts` but:
  - No DSL parser or interpreter
  - No script editor (terminal console is a stub)
  - No TypeScript compilation pipeline for `ScriptDef.codeTs`
  - No sandbox for script execution

#### K. Accessibility
- No ARIA attributes on authored content
- No accessibility checker/audit tool
- No keyboard navigation within the canvas
- No screen reader considerations for the authoring UI itself

#### L. Internationalization (i18n)
- `Course.metadata.languages` field exists but:
  - No translation workflow
  - No locale-aware content switching
  - No RTL layout support
  - No string externalization in the authoring UI

### 5.3 Necessary for V2.0+

#### M. Version Control & History
- `HistoryMeta` type defined, `CURRENT_PROJECT_VERSION` exists, but:
  - No version history (no undo stack, no revision log, no diffs)
  - No branching/forking of course versions
  - No schema migration system for project file format changes
  - No rollback capability

#### N. Marketplace / Publishing Ecosystem
- `Course.metadata` has `pricing`, `licensing`, `visibility` fields but:
  - No account/auth system
  - No upload/publish API
  - No course catalog/discovery
  - No access control for published courses
  - No analytics on course consumption

#### O. AI-Assisted Authoring
- No content generation assistance
- No auto-CF-mapping suggestions
- No quality/completeness scoring

#### P. Plugin/Extension System
- `ComponentElement` supports a `componentId` reference, but:
  - No component registry or marketplace
  - No plugin API for extending element types
  - No custom action type registration UI (only programmatic `registerAction()`)

---

## 6. Risk & Technical Debt

| Risk | Severity | Detail |
|------|----------|--------|
| **Vue 3.6.0-beta.1** | High | Production-critical app on a beta framework. Vapor mode is experimental — API may change. |
| **No tests** | High | Zero test files. No unit, integration, or e2e tests. No test runner configured. |
| **No CI/CD** | High | No GitHub Actions, no automated builds, no deployment pipeline. |
| **No linting/formatting** | Medium | No ESLint or Prettier. Code style will drift across contributors. |
| **No error boundaries** | Medium | Unhandled exceptions in stores or mounter could crash the app silently. |
| **`modulesById` / `lessonsById` persist as `{ id } as any`** | Medium | `projectMetadata.ts:226-228` writes hollow objects. If these are ever read expecting full Module/Lesson shape, runtime errors will occur. |
| **Imperative DOM bypasses Vue reactivity** | Medium | Element mutations don't trigger Vue watchers. Any future feature that needs reactive element data (e.g., computed element counts) will need explicit signaling. |
| **No data backup or recovery** | Medium | Crash during write could corrupt JSON files. No journaling, no temp-file-then-rename pattern. |
| **Hardcoded resource links** | Low | Welcome page links point to VS Code docs (placeholder URLs). |
| **Typo in store key** | Low | `outlineExpaded` in layout store (missing 'n'). |

---

## 7. Versioning Roadmap Summary

### MVP (Current → Usable Alpha)
1. **Open existing project** (extract .mava, hydrate stores)
2. **Auto-save** with dirty tracking and save-before-close
3. **Selection handles** (resize + rotate grips on canvas)
4. **Drag-to-move** elements on canvas
5. **Rich text editing** (inline contenteditable or embedded editor)
6. **Asset manager** (import images/video/audio, relative path resolution)
7. **CF import** (load external framework — at minimum JSON)
8. **CF Mapper UI** (map lessons/modules to CF nodes)
9. **Inspector/validator** (basic coverage check: which CF nodes are mapped, which are missing)
10. **Static HTML export** (flatten pages to standalone HTML/CSS/JS bundles)
11. **Preview mode** (render published output in a webview)
12. **Undo/redo** (command stack for element operations)
13. **Keyboard shortcuts** (delete, copy, paste, undo, redo, select-all)

### V1.0 (Feature-Complete Product)
14. Assessment authoring (question types, scoring, rubrics)
15. DSL / scripting engine (variables, conditions, branching)
16. Scene simulation mode (state machine, scenario playback)
17. Template mode (reusable page templates)
18. Animate mode (timeline-based animation editor)
19. Component library (create, manage, instantiate reusable components)
20. Collaboration roles (auth, permissions, review workflow)
21. SCORM/xAPI export
22. Accessibility checker
23. Test suite (unit + e2e) and CI/CD pipeline

### V2.0 (Ecosystem & Scale)
24. Version history with rollback
25. Online publish endpoint ("map outlet")
26. Course marketplace (catalog, pricing, access control)
27. Multi-language / i18n authoring workflow
28. AI-assisted content generation and CF mapping
29. Plugin/extension architecture
30. Analytics dashboard for published courses

---

## 8. Component Status Matrix

| Component | File | Status | Version Target |
|-----------|------|--------|----------------|
| App.vue | `src/App.vue` | Partial — undo/redo, terminal, lazy-load commented out | MVP |
| AppHeader | `src/components/AppHeader.vue` | Partial — publish/project stubbed | MVP |
| SideNav | `src/components/SideNav.vue` | Partial — project guard commented out | MVP |
| NavAssociates | `src/components/NavAssociates.vue` | Partial — 5 of 7 panels are placeholders | MVP–V1.0 |
| RightUtilities | `src/components/RightUtilities.vue` | Partial — Properties, Actions commented out | MVP |
| NotificationsTray | `src/components/NotificationsTray.vue` | **Complete** | ✓ |
| TerminalConsole | `src/components/TerminalConsole.vue` | Stub | V1.0 |
| GlobalPalette | `src/components/GlobalPalette.vue` | Stub — debug overlay | V1.0 |
| CreateMode | `src/mods/createMode.vue` | Partial — move/reparent stubbed | MVP |
| TemplateMode | `src/mods/templateMode.vue` | Stub | V1.0 |
| AnimateMode | `src/mods/animateMode.vue` | Stub | V1.0 |
| EmptyProject | `src/mods/emptyProject.vue` | Partial — "Open" not working, hardcoded recents | MVP |
| StructurePanel | `src/components/SideNavigation/StructurePanel.vue` | **Complete** | ✓ |
| ElementsPanel | `src/components/SideNavigation/ElementsPanel.vue` | Partial — text labels, no icons | MVP |
| ExplorerTree/Item | `src/components/SideNavigation/Structure/` | **Complete** | ✓ |
| OutlineTree/Item | `src/components/SideNavigation/Structure/` | **Complete** | ✓ |
| StylePanel | `src/components/RightPanel/StylePanel.vue` | **Complete** (container/router) | ✓ |
| LayoutPanel | `src/components/RightPanel/panels/LayoutPanel.vue` | **Complete** | ✓ |
| TransformPanel | `src/components/RightPanel/panels/TransformPanel.vue` | **Complete** | ✓ |
| EffectsPanel | `src/components/RightPanel/panels/EffectsPanel.vue` | **Complete** | ✓ |
| TextPanel | `src/components/RightPanel/panels/TextPanel.vue` | **Complete** | ✓ |
| ImagePanel | `src/components/RightPanel/panels/ImagePanel.vue` | **Complete** | ✓ |
| FillStroke | `src/components/RightPanel/panels/FillStroke.vue` | **Complete** | ✓ |
| RadiusPanel | `src/components/RightPanel/panels/RadiusPanel.vue` | **Complete** | ✓ |
| PaddingPanel | `src/components/RightPanel/panels/PaddingPanel.vue` | **Complete** | ✓ |
| UnifiedToolbar | `src/components/RightPanel/UnifiedToolbar.vue` | Partial — UI built, logic stubbed | MVP |
| ColorPicker | `src/components/RightPanel/ColorPicker.vue` | Stub | MVP |
| DSLActionsPanel | `src/components/RightPanel/DSLActionsPanel.vue` | Stub | V1.0 |
| PropertiesPanel | `src/components/RightPanel/PropertiesPanel.vue` | Stub | MVP |
| element.mounter.ts | `src/utils/element.mounter.ts` | **Complete** | ✓ |
| element.builder.ts | `src/utils/element.builder.ts` | **Complete** | ✓ |
| element.actions.ts | `src/utils/element.actions.ts` | **Complete** | ✓ |
| element.animations.ts | `src/utils/element.animations.ts` | **Complete** | ✓ |
| pages store | `src/stores/pages.ts` | **Complete** | ✓ |
| element store | `src/stores/element.ts` | **Complete** | ✓ |
| projectMetadata store | `src/stores/projectMetadata.ts` | **Complete** (minor: hollow sub-docs) | ✓ |
| layout store | `src/stores/layout.ts` | **Complete** (minor: typo `outlineExpaded`) | ✓ |
| notification store | `src/stores/notification.ts` | **Complete** | ✓ |

---

## 9. Summary Counts

| Category | Count |
|----------|-------|
| Vue components (total) | 31 |
| **Complete** | 17 (55%) |
| **Partial** | 10 (32%) |
| **Stub** | 4 (13%) |
| Pinia stores | 7 (all operational) |
| Utility modules | 8 (all operational) |
| Test files | 0 |
| CI/CD configs | 0 |

**Bottom line:** The visual authoring canvas and its style-editing ecosystem are well-built. The gap to MVP is primarily in (a) the CF integration and inspector that make this an *academic* tool rather than a generic design tool, (b) the export pipeline that gives the authored content a life outside the editor, and (c) the basic UX essentials (save, undo, open, select handles) that make it usable for sustained authoring work.
