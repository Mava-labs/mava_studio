# Cue — the Mava interaction DSL

**Cue** is Mava Studio's small language for authoring interactions: *when something
happens, do something.* A "cue" is the trigger — an event on the page (a click, a page
mounting, a variable changing) — and each cue runs one or more actions in response.

> **Name.** This document calls the language **Cue**. The word fits what it is: in
> theatre, film, and e-learning a *cue* is the signal that sets an action in motion —
> which is exactly a trigger. It's short, non-technical, and reads naturally in the UI
> ("add a cue", "this cue fires on click"). Alternatives considered: *Pulse* (ties to the
> BitPulse ecosystem), *Flow*, *Weave*. Cue is the recommendation; the runtime is
> registered internally as the `mava-trigger` Monaco language, which can stay as the
> implementation id.

Everything you reference in Cue — elements, pages, lessons, variables, scripts — is named
by **the name you gave it in the editor**, never an internal id. Names can't contain
spaces or punctuation, so a multi-word name like "Continue Button" is written with
underscores: `[Continue_Button]`. Autocomplete inserts the right form for you.

**Where cues run:** in **Preview**. In the authoring canvas a click selects and edits an
element, so cues stay dormant there; open Preview to see them fire.

---

## 1. The two shapes of a cue

**Short form** — actions run immediately when the event fires:

```
on click [start_button]
  show [intro_panel]
  hide [start_button]
end
```

**Full form** — actions are gated behind a condition:

```
on variable.change attempts
when attempts > 3
then
  disable [submit_button]
  show [too_many_tries] after 1s
end
```

Every cue starts with `on`, lists one or more events, and closes with `end`. The full form
adds `when <condition>` / `then`. Each statement is on its own line.

---

## 2. Events

Written after `on`. A namespaced event uses a dot, e.g. `media.play`.

| Group | Events |
|---|---|
| Pointer / keyboard | `click`, `dblclick`, `hover`, `focus`, `blur`, `keydown`, `keyup`, `keypress` |
| Page lifecycle | `mount`, `before.mount`, `unmount`, `before.unmount`, `enter`, `leave` |
| Media | `media.play`, `media.pause`, `media.resume`, `media.stop`, `media.complete`, `media.progress` |
| Animation | `animation.start`, `animation.complete`, `animation.loop` |
| Form | `form.submit`, `form.reset` |
| Variables | `variable.change` |
| Timeline | `timeline.start`, `timeline.stop`, `timeline.pause`, `timeline.resume`, `timeline.reaches` — *warns; timeline is not built yet* |
| Quiz | `quiz.start`, `quiz.complete`, `quiz.fail` — *warns; quizzes are not built yet* |

### Multiple events

Either one of several events:

```
on either click [next], click [skip]
  navigate next
end
```

All of several events (fires once every listed event has occurred):

```
on all of media.complete [intro_video], click [i_am_ready]
  show [quiz]
end
```

### Special subjects

- `variable.change` takes a **plain** variable name, no brackets:
  `on variable.change score`
- `timeline.reaches` takes a time literal or a variable: `on timeline.reaches 45s`
- Page lifecycle events optionally target a page: `on mount [Intro_Page]` (omit to match
  the current page).

---

## 3. Subjects and targets

What an event applies to, and what an action acts on:

| Form | Meaning |
|---|---|
| `[element_name]` | one element |
| `[a, b, c]` | several elements |
| `group_name` | a declared group (see §7) |
| `{\p Page_Name}` | a page (for `navigate`) |
| `{\l Lesson_Name}` | a lesson — resolves to its first page for `navigate` |
| `next` / `prev` | the next/previous page in the lesson (for `navigate`) |

If two elements share a name, a cue targeting that name acts on **all** of them (with a
warning) — rename to disambiguate.

---

## 4. Actions

One per line, inside a short-form body or a `then` block.

| Action | Target | Does |
|---|---|---|
| `show` / `hide` | element(s) | toggle visibility |
| `enable` / `disable` | interactive element(s) | toggle disabled state |
| `highlight` | element(s) | apply a highlight outline |
| `play` / `pause` / `resume` / `stop` | media (video/audio) | control playback (`stop` resets to start) |
| `run` / `finish` | animation element | play an animation / jump it to its end |
| `navigate` | page / `next` / `prev` / `{\p …}` | change page |
| `submit` | form | submit it |
| `lock` / `unlock` | page or section | *no-op for now — locking isn't built yet* |
| `execute` | script name | run a Script (from the Scripts tab) |
| `trigger` | named-trigger name | invoke a named trigger (see §8) |
| `wait` | — | pause the sequence, e.g. `wait 500ms` |

### Delays

Append `after <time>` to defer a single action:

```
show [hint] after 2s
hide [hint] after 6s
```

Time literals: `500ms`, `1.5s`, `3m`.

### Variable assignment

Assign to a variable directly (no keyword):

```
score = 0
score += 10
attempts -= 1
```

Right-hand side can be a literal, another variable, or an expression.

---

## 5. Conditions (full form)

Between `when` and `then`:

```
when score >= 100 and not finished
```

- Comparisons: `>`, `>=`, `<`, `<=`, `==`, `!=`
- Logic: `and`, `or`, `not`, parentheses `( … )`

Multiple branches:

```
on variable.change score
when score >= 90
then
  show [grade_a]
elsewhen score >= 50
then
  show [grade_pass]
else
  show [grade_fail]
end
```

---

## 6. Values

- Strings: `"hello"`
- Numbers: `42`, `3.14`
- Booleans: `true`, `false`
- Time: `2s`, `500ms`, `3m`
- Lists: `[1, 2, 3]`, `["red", "green"]`
- Objects: `{ count: 2, active: true }`

---

## 7. Groups

Name a reusable set once, use it as a subject or target:

```
group nav_buttons = [back_button, next_button, skip_button]

on click any of nav_buttons
  highlight nav_buttons
end
```

Element groups use brackets (`= [a, b]`); variable groups omit them (`= a, b`).

---

## 8. Named triggers (reusable, global)

A cue that starts with `trigger <name>` is a **named trigger** — a reusable block you can
call from anywhere, like a function. It's **global**: it shows in the Triggers list on
every page and can be invoked by any cue on any page.

```
trigger reveal_answer
  on click [show_answer]
  then
    show [answer_panel]
    disable [show_answer]
  end
end
```

Invoke it from another cue:

```
on quiz.complete
  trigger reveal_answer
end
```

A named trigger also fires on its **own** event header (the `on click [show_answer]`
above), *and* is callable by name — both work. Names must be unique across the whole
project.

**Unnamed cues** (everything not starting with `trigger`) are **page-local**: they belong
to the page you created them on, show in the Triggers list only when that page is focused,
and run only on that page in Preview.

---

## 9. Comments

```
// line comment
/* block
   comment */
```

The first comment line also becomes the cue's display name in the Triggers list (unless
it's a named trigger, which uses its name).

---

## 10. Errors & hints

The editor checks your cue as you type and reports problems inline (Monaco diagnostics),
each with a code (`E###` errors, `W###` warnings, `I###` info) and, where possible, a
one-click quick-fix. Examples:

- `E047` — `Missing '[' before 'continue_btn'. Element lists are written like
  [continue_btn].` (quick-fix inserts the brackets)
- `W007` — `'continue_btn' looks like an element name. Did you mean [continue_btn]?`
- `E001` — element/page/lesson not found in the project
- `E004` — invoking a named trigger that isn't defined anywhere
- `W014` / `W015` — referencing a timeline/quiz event before those features exist

Warnings don't block; errors do (the cue won't run until they're fixed).

---

## Quick reference

```
group <name> = [<elements>]                 # or:  group <name> = <vars>

trigger <name>                              # named, global, reusable
  <cue body>
end

on <event> [<subject>]                      # unnamed, page-local
  <actions>
end

on <event> [<subject>]
when <condition>
then
  <actions>
elsewhen <condition>
then
  <actions>
else
  <actions>
end

# events   click dblclick hover focus blur keydown keyup keypress
#          mount before.mount unmount before.unmount enter leave
#          media.* animation.* form.submit form.reset variable.change
# actions  show hide enable disable highlight play pause resume stop
#          run finish navigate submit lock unlock execute trigger wait
# subjects [name]  [a,b]  group_name  {\p Page}  {\l Lesson}  next  prev
# qualify  either <e>, <e>     all of <e>, <e>
# assign   x = v    x += v    x -= v
# delay    <action> after <time>
```
