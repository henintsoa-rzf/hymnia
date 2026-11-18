---

description: "Task list for the search-by-meaning mode (feature 012)"
---

# Tasks: Search-by-meaning mode

**Input**: Design documents from `/specs/012-meaning-search-mode/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R9), data-model.md,
contracts/search-mode.md, quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for search behaviour.
Write each test task before the code it covers and see it fail first.

**Organization**: Tasks are grouped by user story (spec.md):
- US1: notice and enter the search-by-meaning mode (P1);
- US2: return to word search (P1);
- US3: type without blinking (P1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1–US3)

## Path Conventions

Single SvelteKit project at the repository root (plan.md, "Project Structure").

Values used everywhere (research.md, contracts/search-mode.md):
- colour tokens: `--meaning` `#8a6510` (light) / `#d9b45a` (dark); `--meaning-soft` `#f7efd9`
  (light) / `#2e2614` (dark);
- field height: word 52 px (mobile) / 56 px (≥ 1024 px); meaning 104 px / 112 px; text 18 px;
  meaning mode shows 3 lines, then scrolls inside;
- animation: 160 ms `ease-out` on the height, none under `prefers-reduced-motion: reduce`;
- mode button: `aria-label` and `title` « Rechercher par le sens », `aria-pressed`;
- field accessible name: word « Rechercher par numéro, titre ou paroles »; meaning « Rechercher
  par le sens : décrivez ce que vous cherchez »;
- placeholder: word « Numéro, titre ou paroles »; meaning « Décrivez un thème, une idée, un
  passage… »;
- URL: `sens=1` means "meaning mode" (data-model.md).

---

## Phase 1: Setup

**Purpose**: Nothing to install. No new dependency (plan.md).

- [X] T001 Run `npm run check`, `npm test` and `npm run test:e2e -- us15-meaning-search` on the
  current `main` and note the baseline (all green expected) in the PR description draft; no file
  changes

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The pieces every story uses: colour tokens, the icon, knowing at first paint whether
search by meaning exists, the Enter rules, and the single textarea field.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Write failing unit tests in `tests/unit/meaning-mode.test.ts` for
  `decideSubmit({ mode, queryKind, meaningCurrent })` covering every row of research R6
  (word/any → `'open-first'`; meaning/empty → `'none'`; meaning/number and hymnal-number →
  `'open-first'`; meaning/short and text, not current → `'run-meaning'`; meaning/short and text,
  current → `'open-first'`) and for `singleLine(text)` ("Line breaks (typed or pasted) become one
  space": `'a\nb'` → `'a b'`, `'a \r\n  b'` → `'a b'`, `'a\n\nb'` → `'a b'`, text without breaks
  unchanged, leading/trailing spaces kept so typing a space at the end still works)
- [X] T003 Create `src/lib/meaning/mode.ts` exporting `type SearchMode = 'word' | 'meaning'`,
  `type SubmitAction = 'open-first' | 'run-meaning' | 'none'`, `decideSubmit` and `singleLine` as
  in contracts/search-mode.md; `queryKind` is `ParsedQuery['kind']` from
  `src/lib/search/query-parser.ts`; make T002 pass
- [X] T004 [P] Add the colour tokens `--meaning` and `--meaning-soft` in `src/app.css` in all
  three colour blocks (`:root` light, `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])`,
  `:root[data-theme='dark']`) with the values above
- [X] T005 [P] Replace the `meaning` glyph in `src/lib/components/Icon.svelte` (two overlapping
  circles) with a magnifying glass with sparkles (research R5): a lens (circle, about r=6) and
  handle lower-left of centre, a four-point star at the top right and a smaller one beside it,
  same 24 px viewBox and 1.5 px stroke as the other icons; update the comment
- [X] T006 [P] Make the catalog report whether the data has meaning vectors: in
  `src/lib/data/catalog.ts`, have `fetchCatalog` return `{ catalog, meaningAvailable:
  Boolean(manifest.meaning) }` and `createCatalog(catalog, { meaningAvailable = false } = {})` add
  a `meaningAvailable: boolean` field to `CatalogApi` (doc comment: "The data has meaning vectors
  (feature 011): the search-by-meaning button is shown from the first paint (feature 012 R2)");
  update `loadCatalog` in `src/lib/data/store.ts` to pass it on; update any caller or test of
  `fetchCatalog`/`createCatalog` (`tests/unit/catalog.test.ts`) and add a test that
  `meaningAvailable` follows `manifest.meaning`
- [X] T007 Turn the field of `src/lib/components/SearchBox.svelte` into a single `<textarea>`
  (research R3), still in word mode only: `rows="1"`, `wrap="off"`, no resize, one line at 50 px
  (54 px from 1024 px) as today, same `aria-label`, placeholder, `enterkeyhint="search"`,
  `autocomplete/autocorrect/autocapitalize/spellcheck` and `autofocus`; on `keydown` Enter (with
  or without Shift, not during IME composition `event.isComposing`) call `preventDefault()` and
  `form.requestSubmit()`; on `input`, set `value = singleLine(textarea.value)` (keep the caret
  where it was); `input` prop type becomes `HTMLTextAreaElement`. Update `src/app.css` so the
  `.hb-search input` rules also apply to `.hb-search textarea` (resize: none, overflow hidden,
  white-space nowrap in word mode, line-height so the text is centred vertically)
- [X] T008 Update `tests/e2e/helpers.ts`: `searchField` uses `getByRole('textbox', { name:
  'Rechercher par numéro, titre ou paroles' })`; `meaningButton` uses `getByRole('button', {
  name: 'Rechercher par le sens' })`; add `meaningField` (`getByRole('textbox', { name: /^Rechercher
  par le sens/ })`); then run the whole e2e suite and fix any test that relied on the field
  being an `<input type="search">` (searchbox role, `fill` behaviour) without changing what it
  checks

**Checkpoint**: word search works as before with the textarea field, `npm test` passes, the
e2e suite passes except the us15 tests about when the button shows (rewritten in US1).

---

## Phase 3: User Story 1 - Notice and enter the search-by-meaning mode (Priority: P1) 🎯 MVP

**Goal**: An icon button is always beside the field; pressing it switches the field to the
enlarged, gold-framed meaning mode; Enter runs the search by meaning.

**Independent Test**: Open `/` with an empty field, see the button, press it, check the field is
about twice as tall with the gold frame, type a sentence, press Enter, see « Résultats par le
sens ».

### Tests for User Story 1

- [X] T009 [P] [US1] Write failing e2e tests in `tests/e2e/us16-meaning-mode.spec.ts` (use
  `mockEmbed` from `tests/e2e/helpers.ts`): (a) on `/` with an empty field, `meaningButton` is
  visible with `aria-pressed="false"` and `title` « Rechercher par le sens », and stays visible
  after `search(page, '245')` and `search(page, 'CE 1')`; (b) pressing it with an empty field sets
  `aria-pressed="true"`, the field's accessible name becomes the meaning one, the placeholder
  becomes « Décrivez un thème, une idée, un passage… », the field's bounding box height is at
  least 1.8× the word-mode height, its computed `border-color` differs from the word-mode
  focused border colour, the field keeps the focus, and the URL gets `sens=1`; (c) typing « un
  chant d'espérance pour des funérailles » posts nothing to the embed mock until Enter, then
  Enter shows « Résultats par le sens » and the mock received exactly that text; (d) with a text
  already typed in word mode, one press runs the search by meaning at once; (e) Enter with « 245 »
  in meaning mode posts nothing and opens the hymn page of the first result; (f) after results by
  meaning, editing the text hides « Résultats par le sens » and the word results show, `sens=1`
  stays; Enter runs it again; (g) a pasted text with a line break (`fill` with `'a\nb'`
  equivalent through the clipboard or `insertText`) ends up as one line in the field and the URL;
  (h) `/?q=la%20gloire%20de%20Dieu&sens=1` opens in meaning mode with « Résultats par le sens »
- [X] T010 [P] [US1] Rewrite the feature 011 tests in `tests/e2e/us15-meaning-search.spec.ts`
  that encode the old rules: "the button is offered for a text query only" becomes "the button is
  shown whatever the query" (or is removed as covered by T009 a); `searchByMeaning` presses the
  button then expects the results (one press still runs it); the "editing the query returns to
  word search" test now expects `sens=1` and `aria-pressed="true"` to stay while « Résultats par
  le sens » goes; keep every other check (offline, cancel, errors, filter, reload)

### Implementation for User Story 1

- [X] T011 [US1] Add the mode to `src/lib/components/SearchBox.svelte` per
  contracts/search-mode.md: props `mode = $bindable<SearchMode>('word')`, `meaningAvailable`,
  `onmodechange`; remove `meaningActive` and `onmeaning`; the form gets a `data-mode` attribute
  (or class) driving the styles; meaning mode: field `min-height` 104 px (112 px ≥ 1024 px), the
  textarea wraps (`wrap="soft"`, `white-space: normal`), shows 3 lines of text then scrolls inside
  (`overflow-y: auto`), aligned to the top; frame `--meaning`, and `--meaning` 2 px edge
  (`border-color` + `box-shadow: 0 0 0 1px`) when focused instead of `--focus`; leading icon
  `meaning` in `--meaning` aligned with the first line; clear button at the top right; mode-specific
  `aria-label` and placeholder (values above)
- [X] T012 [US1] Add the mode button to `src/lib/components/SearchBox.svelte`, rendered when
  `meaningAvailable` (never depending on `value`): `hb-icon-btn`-style square button the height of
  the field in word mode (52 px / 56 px, at least 44 px wide), icon `meaning`, `aria-label` and
  `title` « Rechercher par le sens », `aria-pressed={mode === 'meaning'}`, pressed look `--meaning`
  on `--meaning-soft` with a `--meaning` frame; `onpointerdown` → `preventDefault()` so the
  textarea keeps focus and caret on pointer press; `onclick` → toggle `mode`, call
  `onmodechange(mode)`, focus the textarea with the caret at the end if it was focused or the
  press came from a pointer; align the button to the top of the field so it does not move when
  the field grows; remove the old `.meaning-btn` text button and its styles; update the header
  comment
- [X] T013 [US1] Animate the height change in `src/lib/components/SearchBox.svelte`: 160 ms
  `ease-out` transition on the field's `min-height` and the textarea's `height`, disabled under
  `@media (prefers-reduced-motion: reduce)`; no transition on anything that changes while typing
- [X] T014 [US1] Wire the mode in `src/routes/+page.svelte`: `let mode = $state<SearchMode>(
  initialMeaning && data.catalog.meaningAvailable ? 'meaning' : 'word')`; pass
  `meaningAvailable={data.catalog.meaningAvailable}`, `bind:mode`, `onmodechange`; on entering
  meaning mode with a `short` or `text` query (`parseQuery` with the catalog's hymnal resolver,
  as the worker does) call `runMeaning()`; replace `onsubmit={openFirst}` by a handler using
  `decideSubmit({ mode, queryKind, meaningCurrent: meaningActive })` → `openFirst()` /
  `runMeaning()` / nothing; remove `meaningOffered` and its dependence on `response`
- [X] T015 [US1] Make `sens=1` follow the mode in `src/routes/+page.svelte` (research R7): the URL
  effect writes `sens=1` when `mode === 'meaning'` (drop `keepSens`, `initialQuery`-based logic that
  removed it on edit); `meaningActive` becomes `mode === 'meaning' && meaningFor !== null &&
  meaningFor.query === query`; on `client.ready` with `mode === 'meaning'` and a text query, run
  the search by meaning once (as today); in `runMeaning`, if `client.meaningConfig()` is still
  undefined because the worker is not ready, `await client.ready` first, then show the existing
  « indisponible » error if there is still no config; update the file's header comment
- [X] T016 [US1] Add to the keyboard help in the desktop aside of `src/routes/+page.svelte`:
  « En mode «&#8239;par le sens&#8239;», <kbd>Entrée</kbd> lance la recherche. » (keep the existing
  sentence)

**Checkpoint**: T009 and T010 pass; US1 is usable on its own (enter the mode, search by meaning).

---

## Phase 4: User Story 2 - Return to word search (Priority: P1)

**Goal**: Pressing the button again returns to the one-line word field, with the text kept and
word results shown.

**Independent Test**: In meaning mode with results by meaning, press the button: one-line field,
usual frame, same text, word results, no `sens=1`.

### Tests for User Story 2

- [X] T017 [P] [US2] Add failing e2e tests to `tests/e2e/us16-meaning-mode.spec.ts`: (a) from
  meaning mode with results by meaning, pressing the button sets `aria-pressed="false"`, the
  field's accessible name and placeholder are the word ones, its height is back to the word-mode
  height (±2 px), the text is kept, « Résultats par le sens » is gone, word results show, and the
  URL has no `sens=1`; (b) leaving the mode while « Recherche par le sens… » shows (a delayed
  `mockEmbed`) removes the status line and never shows results by meaning afterwards; (c) the
  clear button in meaning mode empties the field and keeps `aria-pressed="true"` and the meaning
  height

### Implementation for User Story 2

- [X] T018 [US2] In `src/routes/+page.svelte`, on leaving meaning mode (`onmodechange('word')`)
  call `cancelMeaning()` (abort, `meaningFor = null`, phase idle, truncated false) so the word
  results show and `sens=1` goes; check the clear button in `src/lib/components/SearchBox.svelte`
  does not touch `mode`

**Checkpoint**: T017 passes; US1 + US2 make a complete toggle.

---

## Phase 5: User Story 3 - Type without blinking (Priority: P1)

**Goal**: While typing, the field and its buttons never appear, disappear, move or change size.

**Independent Test**: Type « 245 grâce infinie de Dieu » one key at a time in each mode; the
field's and the button's boxes never change.

### Tests for User Story 3

- [X] T019 [P] [US3] Add failing-first e2e tests to `tests/e2e/us16-meaning-mode.spec.ts`
  (research R9): before typing, run in the page a script that observes the search form with a
  `ResizeObserver` (record every size change of the form, the field label and the mode button
  after the first callback) and a `MutationObserver` on the form subtree (record added or removed
  elements other than the clear button); then `pressSequentially('245 grâce infinie de Dieu')`
  with no delay, wait for the last word results, delete it with Backspace, and expect 0 recorded
  changes; run it in word mode and in meaning mode, at 360 px and at 1280 px wide; also check the
  mode button's bounding box is identical before and after; add a test with the page load slowed
  (route `**/data/*.idx*` or the search index file delayed by 1 s) that types before the worker
  is ready and still records 0 changes. On the current `main` the word-mode test must fail
  (the old button flickers)
- [X] T020 [P] [US3] Add an e2e test to `tests/e2e/us16-meaning-mode.spec.ts`: with a data
  manifest without `meaning` (route `**/data/manifest.json` and delete the `meaning` key from the
  JSON), the mode button is absent, the field's right edge lines up with the hymnal filter's
  right edge, typing records 0 layout changes, and `/?q=grâce&sens=1` opens in word mode

### Implementation for User Story 3

- [X] T021 [US3] Verify in `src/lib/components/SearchBox.svelte` and `src/routes/+page.svelte`
  that nothing in the search form depends on `response` or on the worker's answer: the mode
  button depends only on `meaningAvailable`, the clear button sits inside the field's padding
  (absolute or a fixed-width slot) so its appearance does not change the field's outer box or
  the textarea's width in a way that moves text (FR-015); fix whatever T019/T020 still catch
  (for example `min-width: 0`/fixed sizes on the button, `scrollbar-gutter: stable` on the meaning
  textarea so a scrollbar appearing does not reflow)

**Checkpoint**: T019 and T020 pass. All three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] Add both modes to the axe checks in `tests/e2e/a11y.spec.ts` (search screen in
  meaning mode, light and dark themes, at phone width) and fix any violation
- [X] T023 [P] Update the « UI states » table and the « When the action is offered » section of
  `specs/011-semantic-search/contracts/meaning-search.md` with a note that they are replaced by
  `specs/012-meaning-search-mode/contracts/search-mode.md`
- [X] T024 (temporary: the « Par le sens » label of the mode switch is replaced by the sparkle icon in `Main.dc.html` and `SearchDesktop.dc.html`; the two-tab layout stays until it is redone in the design tool) [P] Update the mock-up `design/handoff/maquette/SearchSemantic.dc.html` to show word
  mode with the icon button and meaning mode (tall field, gold frame, pressed button)
- [X] T025 Run `npm run check`, `npm run lint`, `npm test`, `npm run test:queries` and
  `npm run test:e2e`; all green
- [ ] T026 (partly done: screenshots at 360 and 1280 px, light and dark, checked; reduced motion and a real phone still to check) Walk through `specs/012-meaning-search-mode/quickstart.md` scenarios 1–8 at 360 px and
  on desktop, in light and dark themes, and on a real phone if available (keyboard stays open
  when switching mode, Enter key labelled "search"); note results in the PR description

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; blocks every story. T003 after T002; T007 after T003
  (uses `singleLine`); T008 after T007.
- **US1 (Phase 3)**: after Phase 2. T011 → T012 → T013 (same file); T014 → T015 → T016 (same
  file); T014 needs T011–T012 (props).
- **US2 (Phase 4)**: after US1 (it toggles back out of the mode US1 adds).
- **US3 (Phase 5)**: T019/T020 can be written right after Phase 2; T021 after US1 (the new
  button is the fix).
- **Polish (Phase 6)**: after the stories.

### Within each story

Tests first, seen failing; then components; then the page.

### Parallel opportunities

- Phase 2: T002, T004, T005, T006 together (four different files).
- US1: T009 and T010 together, while T011 starts.
- T019 and T020 can be written alongside US1.
- Phase 6: T022, T023, T024 together.

## Parallel Example: Phase 2

```text
Task: "Write failing unit tests for decideSubmit and singleLine in tests/unit/meaning-mode.test.ts"
Task: "Add --meaning and --meaning-soft tokens in src/app.css"
Task: "Draw the magnifier-with-sparkles glyph in src/lib/components/Icon.svelte"
Task: "Report meaningAvailable from the manifest in src/lib/data/catalog.ts and src/lib/data/store.ts"
```

## Parallel Example: User Story 1

```text
Task: "Write failing e2e tests for entering the mode in tests/e2e/us16-meaning-mode.spec.ts"
Task: "Rewrite the old button rules in tests/e2e/us15-meaning-search.spec.ts"
```

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 and Phase 2.
2. Phase 3 (US1). Stop and check: the button is always there, the mode looks different, Enter
   searches by meaning. The blinking is already gone in word mode at this point, since the old
   button is removed.
3. Phases 4 and 5 add the way back and lock the no-blinking rule with tests.

### Incremental delivery

All three stories are P1 and small; ship them together in one PR after Phase 6.

## Notes

- [P] tasks touch different files and do not depend on unfinished tasks.
- Commit after each phase.
- Do not change ranking, fusion, the embedding service or the meaning data (feature 011).
