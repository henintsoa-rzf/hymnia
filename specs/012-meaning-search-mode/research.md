# Research: Search-by-meaning mode

All questions below come from reading the current search screen (`src/routes/+page.svelte`,
`src/lib/components/SearchBox.svelte`, `src/app.css`) on 2026-11-18. No unknowns remain.

## R1. Why the search bar blinks

**Finding**: the « Par le sens » button is shown when `meaningOffered || meaningActive`, and
`meaningOffered` requires `response.query === query`. `response` is set when the search worker
answers. So after each keystroke the button disappears until the worker answers, a few
milliseconds later, then shows again. The field has `flex: 1` beside it, so it gets wider by the
button's width (about 120 px), then narrower again. When typing, this repeats at every key,
which reads as blinking. It also happens when the query moves between a number and text.

A second, smaller jump: `meaningConfig()` is only known once the worker is `ready`, so the
button appears for the first time after the index has loaded. A user who starts typing before
then sees the field shrink once.

**Decision**: the button no longer depends on the query or on the worker's answer. It is shown
from the first paint whenever the data manifest has a `meaning` entry (R2), and never moves.

**Alternatives considered**: keep the old rule but reserve the button's space (an invisible
placeholder). That fixes the jump but keeps a hidden button, which is the other half of the
request. Debounce the button's visibility: hides the problem, still moves.

## R2. Knowing at first paint whether search by meaning exists

**Finding**: the page load (`src/routes/+page.ts`) already reads `manifest.json` through
`fetchCatalog` (`src/lib/data/catalog.ts`), then drops it. The worker reads the same manifest.

**Decision**: the catalog the page load already returns gets `meaningAvailable: boolean`, true
when `manifest.meaning` is set. `fetchCatalog` returns the manifest's `meaning` presence with the
catalog (the loader is cached per visit, so this costs nothing). The worker stays the source of
the configuration (`meaningConfig()`) used to run a search. If a search is asked before the
worker is ready, it waits for `client.ready`.

**Alternatives considered**: wait for the worker (`client.ready`): the late jump of R1. A
build-time constant: wrong for a personal build or a build without meaning data.

## R3. A field that grows and wraps: one textarea for both modes

**Finding**: an `<input>` cannot wrap text over lines. Swapping `<input>` for `<textarea>` when
the mode changes replaces the focused element: on phones the keyboard closes and reopens, and
the caret is lost. That is a new blink, at the moment the user switches.

**Decision**: the field is a single `<textarea>` in both modes.

- Word mode: one line, no wrapping (`wrap="off"`, `white-space: nowrap`, horizontal overflow
  hidden by scrolling, as an input does), same 50/54 px height as today.
- Meaning mode: about twice the height (field 104 px on mobile, 112 px from 1024 px), text wraps,
  three lines visible, then it scrolls inside the field.
- Enter (with or without Shift) never inserts a line break: it submits the form. Pasted line
  breaks are turned into spaces as the value is set, so `query` is always one line (the URL and
  the search engine never see `\n`).
- `enterkeyhint="search"`, `autocomplete`, `autocorrect`, `autocapitalize`, `spellcheck` and
  `autofocus` stay as today.

The textarea's role is `textbox` (a textarea takes no other role). The `role="search"` form
around it keeps the search landmark. The accessible name changes with the mode (contract).

**Alternatives considered**: swap elements (keyboard flicker, above). A `contenteditable`: no
native form, IME and undo behaviour to rebuild. An input that grows with a font change only: no
wrapping, does not invite a longer text.

## R4. The mode's frame color

**Finding**: `.hb-search:focus-within` already paints the frame `--focus` (= `--rubric`,
red-brown), and the field is focused on arrival. A rubric frame for the mode would look the same
as word search.

**Decision**: two new color tokens, an ochre gold that echoes the sparkles of the icon and the
`--mark` highlight already used in results:

| Token | Light | Dark | Contrast |
|-------|-------|------|----------|
| `--meaning` | `#8a6510` | `#d9b45a` | 5.3:1 on `--paper-raised` (light), 8.7:1 (dark) |
| `--meaning-soft` | `#f7efd9` | `#2e2614` | `--meaning` on it: 4.6:1 (light), 7.6:1 (dark) |

In meaning mode the frame is `--meaning`, focused or not (focused: the same 2 px edge as word
search, in `--meaning`, so keyboard focus stays visible). The leading icon and the pressed button
take `--meaning` on `--meaning-soft`. Color is never the only cue: the field's height, the
placeholder, the leading icon and the button's pressed state change too (WCAG 1.4.1).

**Alternatives considered**: blue (`#2f5d8a`): clear but foreign to the warm palette. Rubric with
a thicker frame: too close to the focused word field.

## R5. The icon

**Decision**: replace the `meaning` glyph in `Icon.svelte` (two overlapping circles, used only by
this button) with a magnifying glass and two sparkles: the same lens and handle as `search`,
slightly smaller and lower-left, a four-point star at the top right and a smaller one beside it,
drawn with the same 1.5 px stroke on a 24 px grid. The button is the existing `hb-icon-btn` size
(44 px tap target, 52/56 px tall to line up with the field), so it takes far less width than
« Par le sens ».

## R6. What Enter does

**Decision** (pure function, unit-tested, `src/lib/meaning/mode.ts`):

| Mode | Query (`parseQuery`) | Results by meaning current for this text and filter | Enter |
|------|----------------------|------------------------------------------------------|-------|
| word | any | — | open the first result (as today) |
| meaning | empty | — | nothing |
| meaning | number, hymnal + number | — | open the first result (word search answers numbers) |
| meaning | short, text | no | run the search by meaning |
| meaning | short, text | yes | open the first result |

`parseQuery` is synchronous, so the decision never waits on the worker's answer (unlike today's
`response.kind === 'text'`, part of R1's cause). A short query (1–2 characters) is accepted, as in
feature 011's edge case « grâce ».

## R7. The mode in the address

**Finding**: today `sens=1` means "results by meaning are shown", and any edit drops it.

**Decision**: `sens=1` now means "the field is in meaning mode". It stays while the user edits the
text and goes when they leave the mode. On load with `sens=1`: the field opens in meaning mode;
if it holds a text query, the search by meaning runs once the worker is ready (as today). The URL
is still written with `goto(…, { replaceState: true })`, so the back button behaves as today.
The mode is not a saved preference: a fresh visit starts in word mode.

## R8. Animation

**Decision**: the field's height changes with a 160 ms `ease-out` transition on the field's
`min-height` and the textarea's `height`. Under `prefers-reduced-motion: reduce` the transition is
off. Nothing animates while typing.

## R9. Checking "no blinking" automatically

**Decision**: a Playwright test installs a `ResizeObserver` on the search form and a
`MutationObserver` on its children before typing, types a 40-character text one key at a time
(`pressSequentially`), including the number → text switch (« 245 » → « 245 grâce »), in both
modes, and expects 0 size changes and 0 added or removed controls, except the clear button inside
the field (whose appearance must not change the field's outer box, FR-015).
