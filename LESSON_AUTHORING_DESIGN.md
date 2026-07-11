# Lesson Authoring — Quiz/Assessment Grading + Feature Backlog

Status: **design notes, not implemented.** Captures the grading/marking model for
quizzes and assessments (firm direction) plus a backlog of other lesson-author
features to revisit. Nothing here is built yet — see `CLEANUP_TODO.md` for what is.

Grounded in primitives that already exist in the codebase:

- The **10 canonical quiz types** are already declared (and CF-validated) in
  `src/types/cf-alignment.types.ts` → `EVIDENCE_COMPONENT_MAP`:
  `quiz.mcq.single`, `quiz.mcq.multi`, `quiz.truefalse`, `quiz.shortanswer`,
  `quiz.fillblank`, `quiz.matching`, `quiz.ordering`, `quiz.hotspot`,
  `quiz.dragdrop`, `quiz.code`. No `ComponentDefinition` with these ids exists
  yet — the socket is there, the plug isn't.
- `cf_proof` on a `ComponentElement` already links a quiz instance to a competency
  (PROVEN / CLAIMED / MISSING). Grading feeds this.
- The **`mava` script namespace** (`src/utils/scripts/context.ts`) is a Proxy —
  `mava.<var>` reads/writes author variables, with reserved methods (`mava.watch`).
  The escape-hatch grading API (§A6) extends this.
- The **Trigger DSL ("Cue")** and scripts already fire on interactions in Preview;
  "submit → grade" rides on that, no new runtime.
- `ComponentPropSchema` (`src/types/project.ts`) authors per-instance config; it
  needs a `list` type (see §A7) for options/pairs/statements.

---

# Part A — Grading & Marking

## A1. Three correctness classes

Every question type falls into one of three buckets. **This split is the core of
the design and must exist from the first implementation** — everything auto-gradable
should grade itself; only genuinely fuzzy input needs heuristics.

| Class | Types | How correctness is decided |
|---|---|---|
| **Deterministic** | mcq.single, mcq.multi, truefalse, matching, ordering, fillblank, hotspot, dragdrop | Author configures the correct answer; **everything else is wrong.** Pure comparison, 100% reliable. |
| **Heuristic** | shortanswer (multi-word / free text), sometimes code | No exact answer; scored by algorithm (§A4). Result is **provisional** (see §A4.7). |
| **Manual / ungraded** | reflection, essay, or any type the author flags "human review" or "not graded" | Not scored automatically. Feeds evidence as CLAIMED, awaits mentor/peer sign-off (already modelled: `evidence.reflection.*`, `evidence.peer.*`, `evidence.mentor.signoff`). |

## A2. Per-type correctness configuration

The authoring panel for each type writes a `correctness` block onto the instance
(§A7). Deterministic types:

| Type | `correctness` shape | Default scoring |
|---|---|---|
| `quiz.truefalse` | `{ answer: boolean }` | all-or-nothing |
| `quiz.mcq.single` | `{ correctId: string }` | all-or-nothing |
| `quiz.mcq.multi` | `{ correctIds: string[] }` | partial credit (§A3) |
| `quiz.matching` | `{ pairs: Record<leftId, rightId> }` | partial credit per pair |
| `quiz.ordering` | `{ order: string[] }` | partial credit (§A3) |
| `quiz.fillblank` | per blank: `{ accept: string[], normalize: {...}, fuzzy?: n }` | all blanks must pass, or partial |
| `quiz.hotspot` | `{ regions: Rect[] }` (a click inside any → correct) | all-or-nothing |
| `quiz.dragdrop` | `{ placement: Record<itemId, bucketId> }` | partial credit per item |
| `quiz.code` | `{ tests: [...] }` or `keywords` or author script | run-and-compare, else script |
| `quiz.shortanswer` | heuristic — see §A4 | banded (§A4) |

## A3. Scoring modes for deterministic types

Two knobs the author picks per question:

- **All-or-nothing** — any mistake = 0. Best for truefalse, single MCQ, hotspot.
- **Partial credit** — score = correct parts / total parts. Needed for multi-select,
  matching, ordering, drag-drop where "mostly right" is meaningful.
  - multi-select: `(correctlyChecked − incorrectlyChecked) / totalCorrect`,
    floored at 0 (penalise guessing-everything).
  - ordering: don't score raw position equality — score **adjacent-pair
    correctness** (how many neighbouring items are in the right relative order).
    A single item dropped one slot off shouldn't zero the whole sequence.
  - matching / drag-drop: fraction of items placed correctly.

## A4. Free-text scoring pipeline (the hard case)

Only `quiz.shortanswer` (and optionally `quiz.code` in keyword mode) needs this.
The pipeline is a sequence of stages; the author configures which stages apply.

### A4.1 Normalize
Lowercase · trim · collapse whitespace · strip punctuation (toggle) · optional
stemming/lemmatization · optional stopword removal. All toggles, sane defaults on.

### A4.2 Concept coverage — *recommended primary model, better than flat keywords*
Instead of a flat keyword list, the author defines **concepts**, each a set of
acceptable surface forms (synonyms/phrasings):

```
concepts:
  - id: dns-resolves
    any_of: ["ip address", "internet protocol address", "ip", "numeric address"]
    weight: 2
    essential: true            # missing an essential concept can cap/fail the answer
  - id: lookup-role
    any_of: ["directory", "phone book", "address book", "lookup", "translates"]
    weight: 1
```

Score = Σ(weight of concepts hit) / Σ(total weight). A concept is "hit" if **any**
of its forms match. This captures *"the pupil expressed the idea, however they
worded it"* — the single biggest quality win over raw keyword counting, and cheap.

### A4.3 Phrase / n-gram matching
Match multi-word phrases as units, not just single tokens ("client server" as a
bigram carries more signal than "client" + "server" apart). Concept forms above are
already phrases, so this falls out naturally.

### A4.4 Fuzzy matching (important for the target audience)
Tolerate spelling errors via Levenshtein distance (configurable threshold, e.g.
edit distance ≤2 or ≥85% similarity). Ugandan / ESL learners shouldn't lose marks
for "recieve" vs "receive". Applies per-token within concept-form matching.

### A4.5 Forbidden / misconception flags
Author lists terms whose **presence** signals a wrong idea (the worksheets test
exactly these misconceptions — "a server is always expensive hardware"). A flagged
term can: deduct points, cap the band, or route to review. Distinct from "keyword
absent" — this is "wrong keyword present".

### A4.6 Threshold → feedback bands
Map the final percentage to authored feedback bands:

```
bands:
  - min: 0.8   label: "Excellent"  feedback: "You covered it clearly."
  - min: 0.5   label: "Partial"    feedback: "You missed: {missing_concepts}."
  - min: 0.0   label: "Revisit"    feedback: "Re-read the DNS section."
```

`{missing_concepts}` etc. are placeholders the runtime fills — the feedback can
name exactly which concepts were absent.

### A4.7 Confidence & the CLAIMED/PROVEN tie-in *(recommended, architecturally important)*
Auto-graded free text is **never asserted as certain**:

- If the score lands within a margin (e.g. ±10%) of the passmark, flag
  **needs-review** rather than silently deciding pass/fail.
- Free-text results should feed CF evidence as **CLAIMED, not PROVEN**, until a
  human (mentor/peer) confirms — reusing the existing `cf_proof` status model.
  Deterministic types (§A1) *can* auto-assert PROVEN because they're reliable.
  This keeps a fuzzy keyword match from ever silently "proving" a competency.

## A5. Quiz vs Assessment — two grading units

Same question components; different **aggregation + lifecycle wrappers**.

| | **Quiz** | **Assessment** |
|---|---|---|
| Mental model | there-and-then attempt & mark | an exam |
| Feedback | immediate (per-question or on submit) | deferred — results at the end |
| Composition | one or more questions, usually one topic | many questions / mixed types, graded as **one unit** |
| Attempts | **configurable N** (1, N, unlimited) | usually 1 (configurable) |
| Scoring | per-question → quiz score; passmark optional (can be purely formative) | weighted sections → single score vs **one passmark** |
| Output | best/last score, feedback | single pass/fail that **gates the lesson viewer** |
| Progression | optional | pass gates next lesson/section |

An **Assessment** is essentially a container component that owns a set of question
instances plus: weights, a passmark, a submit-once lifecycle, a results summary, and
a pass/fail signal exposed to lesson navigation/gating. A **Quiz** is a lighter
wrapper (or a single question) with attempts + immediate feedback.

### A5.1 Remediation (decided — author config, CF-informed)

Remediation on failure is **not** a fixed behaviour; it's a per-assessment config
option whose *necessity* is driven by how critical the assessment is:

```
remediation:
  enabled: true
  trigger: below-passmark        # below-passmark | fail | never
  target:  page-ref | auto       # where a failing learner is routed
  criticality:
    source: author | cf-derived  # who decides it matters this much
```

- **`source: author`** — the author judges the stakes and sets whether a fail must
  route to remediation before the learner can proceed.
- **`source: cf-derived`** — criticality comes from the aligned Competence Framework:
  a gateway/high-proficiency competency, or a required evidence demand, can *mandate*
  remediation on failure. The CF model already carries proficiency levels and
  required evidence types (`cf-alignment.types.ts`), so the assessment can read its
  criticality from its `cf_proof` link rather than the author hard-coding it.

Remediation routing itself is a **flow/branching** concern (fail → which page), which
belongs in a dedicated editor surface, not the right panel — see §A8.

## A6. The escape hatch — `mava` grading API

Built-in grading is **declarative and optional**. Any of it can be disabled so the
author writes their own logic. That requires the quiz/assessment components to expose
a manipulation API. Because `mava` is already a Proxy (bare `mava.x` = variable `x`),
these are **reserved namespaced accessors** alongside `mava.watch`:

```js
// Handle to an instance by author name (like element("..."))
const q = mava.quiz("DNS Question")

q.response            // learner's current answer(s)
q.config              // correctness/grading config (read)
q.grade()             // run built-in grading → returns { score, passed, band, missing }
q.score               // last computed score (0..1)
q.passed              // boolean vs passmark
q.attemptsUsed / q.attemptsLeft
q.reset()
q.onSubmit(fn)        // hook fired when learner submits

// Manual override — for fully custom logic (built-in grading disabled):
q.setScore(0.75)
q.markCorrect() / q.markWrong()
q.showFeedback("Close — you missed the lookup role.")

// Assessment unit:
const exam = mava.assessment("Unit 1 Exam")
exam.questions        // handles to member questions
exam.submit()
exam.score / exam.passmark / exam.passed
exam.onComplete(fn)

// Reusable grading helpers, so custom scripts get the same algorithms:
mava.grade.keywords(text, conceptConfig)   // → { score, hits, missing }
mava.grade.fuzzy(a, b)                       // → similarity 0..1
mava.grade.normalize(text, opts)             // → string
```

Default path: author fills config → submit trigger calls `q.grade()` implicitly.
Advanced path: author disables built-in grading, wires `q.onSubmit(...)`, computes a
score with `mava.grade.*` helpers, calls `q.setScore()`. Heavy lifting is theirs, but
they never lose the built-in algorithms.

## A7. Data-model additions

- **`ComponentPropSchema` gains a `list` type** (needed for options/pairs/statements
  edited inline in the RightPanel, not via a separate list variable). Reuse
  `ListItemField[]` (already in `src/types/variables.ts`) as `itemShape`.
- **A `grading` block on the quiz/assessment `ComponentElement`** — parallel to
  `cf_proof`, not a visual prop: `{ correctness, mode, algorithm?, attempts,
  passmark?, feedback, autoGrade: boolean }`. `autoGrade:false` = escape hatch.
- Built-in quiz/assessment `ComponentDefinition`s must be **non-deletable / built-in**
  (`source: 'builtin'` or a `readonly` flag) — `componentLibrary` is currently pure
  user content and would let a user delete them away. This flag doesn't exist yet.

## A8. Authoring surfaces — right panel vs. editor tabs (cross-cutting)

Not all authoring fits the RightPanel. A concept/keyword grading matrix, an assessment
assembler (drag questions in, set weights/passmark/remediation routing), a question
bank, a rubric builder, or a branching/flow map would be cramped and hostile in a
narrow inspector. **Reuse the tab/surface mechanism that already hosts pages and
component definitions** — the same pattern VS Code extensions use to open custom
editors (webview panels) in the tab area instead of stuffing everything into a sidebar.

This is a small generalization of what exists. `pages.ts` already models editing
surfaces as tabs (`pagesCache`, `componentSurfaces`, `activeSurfaceScope()`), and the
`createMode.vue` tab strip renders them (with the ◈ marker distinguishing component
tabs — Phase 3.75). Today a tab is implicitly a **canvas surface** (an element tree).
Generalize the tab kind:

- **`page`** — canvas surface (element tree). *(exists)*
- **`component`** — canvas surface, a component definition. *(exists)*
- **`editor`** — a **non-canvas** surface: a dedicated Vue editor filling the canvas
  area instead of the stage. Hosts structured config that isn't an element tree. *(new)*

**The division of labour:**

| Right panel | Dedicated editor tab |
|---|---|
| Per-instance, visual, quick | Deep, structured, needs room |
| Options list, correct-answer toggle, attempts count, passmark number | Concept/keyword grading matrix; forbidden-term flags + feedback bands |
| "Attach CF competency" | Assessment assembler: member questions, weights, passmark, remediation routing |
| Live, next to the selected element | Question banks / pools; rubric builder; branching & remediation flow map |

Opened the same way component editing already is: a button in the right panel
("Edit grading…", "Open assessment builder", "Edit flow…") promotes the deep config
into its own tab — analogous to how selecting a component opens its definition tab.
The learner never sees these; they're authoring-only surfaces.

Applies to Part B too: a **branching/flow map** (B1), a **question bank** (B8), and a
**theme/master-page editor** (B8) are all editor-tab surfaces, not right-panel forms.

**New primitive needed:** a `kind: 'editor'` tab type in the surface model, rendering a
registered editor component keyed by id, with its own commit path (config → the target
instance/assessment, not `commitPageToCache`). Additive to the existing surface bridge.

## A9. Open decisions

- Ordering partial-credit metric: adjacent-pair vs Kendall-tau — pick one default.
- Fuzzy threshold default and whether it's per-question or global.
- Where learner responses persist for resume (ties to §B state/persistence).
- Whether assessment weighting is per-question or per-section.

---

# Part B — Other lesson-author features (backlog)

Brainstorm of what a real lesson author needs beyond questions. Each notes whether a
Mava primitive already exists. Priority is a rough first cut, not committed.

### B1. Navigation & structure
- **Lesson progression / gating** — lock a page/section until prior is complete or an
  assessment is passed. *(uses: variables + triggers; needs a completion model.)* **High**
- **Progress tracking & completion state** — per-page/per-lesson done state, a progress
  bar. *(needs persisted learner state.)* **High**
- **Resume / bookmarking** — reopen where the learner left off. *(needs storage.)* **High**
- **Table of contents / outline nav / lesson menu.** *(pages exist; needs a nav component.)* **Med**
- **Branching / adaptive paths** — fail a quiz → go to remediation page. *(triggers can
  navigate; needs a branch primitive + page-nav API.)* **Med**

### B2. Interactive content (non-graded)
- **Accordions / tabs / steppers** — progressive disclosure, process walkthroughs.
  *(buildable from components + slots + a bit of state.)* **High**
- **Flip cards / flashcards.** *(component + slot + toggle.)* **Med**
- **Clickable hotspots / image markers with popups.** *(shares the `quiz.hotspot`
  region primitive, ungraded mode.)* **Med**
- **Tooltips / glossary terms** — hover a term → definition (the worksheets shipped
  reference cards / glossaries). **Med**
- **Carousels / sliders / before-after image sliders.** **Low**
- **Timelines.** **Low**

### B3. Media
- **Audio narration per page** — big for accessibility & low-literacy learners.
  *(media element exists; needs per-page play/pause + optional autoplay.)* **High**
- **Interactive video** — pause at a marker and ask a question. *(video exists; needs
  cue points wired to triggers.)* **Med**
- **Captions / subtitles.** **Med**
- **Image zoom / lightbox.** **Low**

### B4. Feedback & assessment support
- **Feedback layers / modals** — correct/incorrect explanations. *(overlay + state.)* **High**
- **Progressive hints** on a question. **Med**
- **Try-again states** (ties to quiz attempts). **Med**
- **Results / score summary page** for a quiz or assessment. **High**
- **Certificates on completion.** **Low**
- **Rubrics** (peer/mentor) — evidence types already exist (`evidence.peer.rubric`). **Med**

### B5. Learner state & personalization
- **Learner name captured once, reused** — "Well done, Moses!" (worksheets had Name
  fields). *(variables + two-way input binding already support this.)* **High**
- **Score/progress variables** — *(variables system exists.)* **Done-ish**
- **Persisted learner state across sessions** — the storage layer that resume,
  progress, and attempt-counts all depend on. **High (foundational)**
- **Condition/trigger on state** — *(Trigger DSL exists.)* **Done**

### B6. Data, reporting & interop
- **xAPI / SCORM / cmi5 export** — the LMS-interop standard; statements like "answered
  X", "completed Y", "scored Z". Central to real delivery. **High (strategic)**
- **Completion & pass/fail reporting** to an LMS or to `mava-registry`. **High**
- **CF evidence emission** — quiz/assessment result → `cf_proof` → competency evidence.
  *(model exists; needs the grading→proof wiring.)* **High**
- **Engagement analytics** — time-on-page, interaction counts. **Low**

### B7. Accessibility & localization
- **Multi-language lesson content** — string tables / translation; possibly Ugandan
  local languages. **Med**
- **Text-to-speech / screen-reader support / keyboard nav.** **Med**
- **Learner display controls** — font-size / contrast. **Low**
- **Offline delivery** — matches the phone-first, low-connectivity context;
  cf-builder already has offline sync to draw from. **Med**

### B8. Authoring productivity
- **Templates / master pages / themes** — consistent look across a course. **Med**
- **Question banks / pools + randomization** — draw N random questions from a bank,
  shuffle options. Important for assessments (anti-cheating, retakes). **Med**
- **Reusable component library** — *(components + slots exist and are growing.)* **In progress**
- **Content variables / define-once-reference-many.** *(variables exist.)* **Done-ish**

### B9. Delivery / runtime — the "lesson viewer"
- **Lesson player/viewer** — the runtime that presents a lesson, tracks state, enforces
  gating, reports results. Preview is the seed of this. **High (foundational)**
- **Responsive / mobile delivery** — *(render pipeline is responsive.)* **In progress**
- **Print / PDF export** — the worksheets are literally print artifacts; a lesson may
  need to emit one. **Low**
- **Save / resume** — see B5 state. **High**

---

## Suggested first slice

1. `ComponentPropSchema` `list` type + inline rows editor (§A7) — unblocks every
   question type that has options/pairs/statements.
2. Built-in `ComponentDefinition` flag (§A7) so quiz components can ship undeletable.
3. Prototype `quiz.truefalse` + `quiz.mcq.single` end-to-end (config → submit trigger →
   `grade()` → score var → feedback), proving the deterministic path and the `mava.quiz`
   API (§A6) on the simplest cases.
4. Then the shared free-text pipeline (§A4) for `quiz.shortanswer`.
5. Assessment wrapper (§A5) once ≥2 question types grade cleanly.

Foundational cross-cutting dependency for much of Part B: **persisted learner state**
(B5) and the **lesson viewer** (B9).
