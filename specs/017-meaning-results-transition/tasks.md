---

description: "Task list for the transition and color of results by meaning (feature 017)"
---

# Tasks: Transition and color for results by meaning

**Input**: Design documents from `/specs/017-meaning-results-transition/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R11), data-model.md,
contracts/meaning-reveal.md, quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for search behaviour.
Write each test task before the code it covers and see it fail first.

**Organization**: Tasks are grouped by user story (spec.md):
- US1: see the search by meaning happen — clear, transition, reveal (P1);
- US2: tell results by meaning at a glance — the marker (P1);
- US3: return to word results — cancel, error, leaving the mode (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1–US3)

## Path Conventions

Single SvelteKit project at the repository root (plan.md, "Project Structure").

Values used everywhere (research.md, contracts/meaning-reveal.md):
- phases: `'none' | 'clearing' | 'waiting' | 'revealing'` (data-model.md);
- timings: `CLEAR_MS = 180`, `MIN_WAIT_MS = 400` (from the last launch), `REVEAL_MS = 500`,
  `ROW_STAGGER_MS = 30`, `ROW_STAGGER_CAP = 10`;
- motion: clearing opacity 1 → 0 and translateY 0 → 4 px, 180 ms ease-in; placeholder sweep 1.2 s
  loop, rows 150 ms apart; reveal per row opacity 0 → 1 and translateY 6 px → 0, 160 ms ease-out,
  delay `min(i, 10) × 30 ms`, `animation-fill-mode: backwards`; only `opacity` and `transform`;
- reduced motion: same phases and timings, no animation (leaving list hidden at once, still
  placeholder rows, rows shown at once);
- colors: existing `--meaning` (`#8a6510` light / `#d9b45a` dark) and `--meaning-soft`
  (`#f7efd9` / `#2e2614`); no new token;
- DOM hooks: leaving wrapper `.is-leaving` + `inert`; placeholder `.meaning-transition` with
  `aria-hidden="true"`; meaning list `ul.hb-list--meaning`; revealing list `ul.is-revealing` with
  `style="--i: n"` on each `<li>`; heading `h2.hb-overline--meaning` with the `meaning` glyph;
- marker bar: 3 px, `--meaning`, `::before` of each `<li>`, `left: -10px`, inset 12 px top and
  bottom, radius 2 px; the row box, padding and text do not change.

---

## Phase 1: Setup

**Purpose**: Nothing to install. No new dependency (plan.md).

- [X] T001 Run `npm run check`, `npm test` and `npm run test:e2e -- us15-meaning-search
  us16-meaning-mode us20-bible-search` on the current `main` and note the baseline (all green
  expected); no file changes

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The pure module holding the sequence rules, used by US1 and US3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Write unit tests in `tests/unit/meaning-reveal.test.ts` for the module of
  contracts/meaning-reveal.md: `holdUntil(start, minMs, now)` resolves at once when `now() - start
  >= minMs` and after the remaining time otherwise (use Vitest fake timers and an injected `now`);
  `launchPhase(current, listOnScreen)` returns `current` for `clearing` and `waiting`, `clearing`
  for `none`/`revealing` with a list on screen, `waiting` without; `listView({ reveal, hasList })`
  returns `leaving-list` for `clearing` with a list, `placeholder` for `waiting` and for
  `clearing` without a list, `revealing-list` for `revealing` with a list, `list` for `none` with
  a list; the constants equal 180, 400, 500, 30, 10. Run them and see them fail
- [X] T003 Create `src/lib/meaning/reveal.ts` with `RevealPhase`, the five constants,
  `holdUntil`, `launchPhase` and `listView` exactly as in contracts/meaning-reveal.md, with a
  header comment pointing to `specs/017-meaning-results-transition/`; `holdUntil` defaults `now`
  to `performance.now`. Make T002 pass

**Checkpoint**: `npm test -- meaning-reveal` green.

---

## Phase 3: User Story 1 - See the search by meaning happen (Priority: P1) 🎯 MVP

**Goal**: Launching a search by meaning clears the list, shows the meaning placeholder while it
runs (at least 400 ms from launch), then reveals the results from the top.

**Independent Test**: With word results on screen in meaning mode, launch the search and check,
in order: the list empties and can't be clicked, the placeholder shows with « Recherche par le
sens… », then the results by meaning appear.

### Tests for User Story 1

- [X] T004 [P] [US1] Create `tests/e2e/us24-meaning-transition.spec.ts` (header comment: feature
  017, US1–US3) with a `describe('US1: see the search by meaning happen')` using `mockEmbed`,
  `search`, `launchMeaning`, `results` from `tests/e2e/helpers.ts`:
  (a) with `mockEmbed(page, { delayMs: 1500 })`, search « gloire », wait for word results, launch:
  `main .hy-result` count becomes 0 within 500 ms, `.meaning-transition` is visible, the text
  « Recherche par le sens… » is visible, then results show and `.meaning-transition` has count 0;
  (b) right after launch, the leaving wrapper `.is-leaving` has the `inert` attribute;
  (c) cached path: launch on « la gloire de Dieu », wait for results, launch again on the same
  text, and measure in the page (`performance.now()` at click vs. first `.hb-list--meaning .hy-result`
  visible, through `page.evaluate` with a `MutationObserver`) that results show between 400 and
  600 ms after the second click, with `.meaning-transition` seen in between (replay on same text);
  (d) slow path: with `delayMs: 1500`, results show less than 150 ms after the mocked reply is
  fulfilled (record the time in the route handler via `page.exposeFunction` or compare with
  `performance.now()` stamps);
  (e) during the sequence the search field's bounding box (`searchField(page).boundingBox()`) is
  the same before launch, during waiting and after reveal;
  (f) a page opened at `/?q=la%20gloire%20de%20Dieu&sens=1` shows `.meaning-transition`, then
  marked results, without `.is-leaving` ever appearing.
  Run and see them fail
- [X] T005 [P] [US1] Adapt `tests/e2e/us15-meaning-search.spec.ts` « a slow reply shows a waiting
  line that can be cancelled »: while « Recherche par le sens… » is visible, expect `results(page)`
  to have count 0 and `.meaning-transition` to be visible (word results no longer stay during the
  search, FR-001), and after « Annuler » expect `results(page).first()` visible again; keep the
  rest of the file unchanged

### Implementation for User Story 1

- [X] T006 [P] [US1] Create `src/lib/components/MeaningTransition.svelte`: a `div.meaning-transition`
  with `aria-hidden="true"`, the `<Icon name="meaning" />` glyph in `--meaning`, and three
  placeholder rows shaped like `.hy-result` rows (a title bar ~60 % wide and an excerpt bar ~85 %
  wide, 12 px vertical padding, `--line` bottom border, bars in `--meaning-soft`, radius
  `--radius-sm`), so it is about the height of three result rows; a sweep (`::after` gradient from
  transparent through `--meaning` at ~25 % opacity to transparent, `transform: translateX`) loops
  in 1.2 s, the three rows offset by 150 ms; under `@media (prefers-reduced-motion: reduce)` no
  animation. Scoped `<style>` only
- [X] T007 [US1] In `src/lib/components/ResultList.svelte`, add a prop `revealing = false`: when
  true, add class `is-revealing` to the meaning/text `<ul class="hb-list">` and set
  `style="--i: {index}"` on each `<li>` (use the `{#each}` index); no other markup change
- [X] T008 [P] [US1] In `src/app.css`, add next to the `.hy-result` rules: `@keyframes
  meaning-leave` (opacity 1 → 0, translateY 0 → 4 px), `.is-leaving { animation: meaning-leave
  180ms ease-in forwards; }`; `@keyframes meaning-reveal` (opacity 0 → 1, translateY 6 px → 0),
  `.hb-list.is-revealing > li { animation: meaning-reveal 160ms ease-out backwards;
  animation-delay: calc(min(var(--i, 0), 10) * 30ms); }`; and under `@media
  (prefers-reduced-motion: reduce)`: `.is-leaving { animation: none; opacity: 0; }` and
  `.hb-list.is-revealing > li { animation: none; }`. Comment the block with feature 017,
  research R2/R5/R9
- [X] T009 [US1] In `src/routes/+page.svelte`, import `reveal.ts` and `MeaningTransition`, and add
  `let reveal = $state<RevealPhase>('none')`, `let launchedAt = 0`, and timers for clearing and
  revealing (cleared on each change and in `onDestroy`). Change `runMeaning(q = query)` to
  `runMeaning(q = query, { sequence = true } = {})`: when `sequence`, set `launchedAt =
  performance.now()`, set `reveal = launchPhase(reveal, listOnScreen)` where `listOnScreen` is
  true when the list area renders a `ResultList` right now (`!idle && !unavailable && !!shown`,
  or `reveal` is already `revealing`/`none` with results by meaning shown), and also capture
  `leaving = shown` for T010; then when it is `clearing` start a `CLEAR_MS` timer to `waiting`. After a successful
  answer and before setting `meaningResponse`, when `sequence` is true `await holdUntil(launchedAt,
  MIN_WAIT_MS)` then re-check `stale()`; then set the response, `reveal = 'revealing'`, and start
  a `REVEAL_MS` timer back to `none`. The filter `$effect` calls `runMeaning(current.query, {
  sequence: false })`; the `?sens=1` restore and `submit()` keep the default (`sequence: true`)
- [X] T010 [US1] In the `.search__results` block of `src/routes/+page.svelte`, render from
  `listView({ reveal, hasList })`: `leaving-list` → the current `ResultList` wrapped in `<div
  class="is-leaving" inert>`; `placeholder` → `<MeaningTransition />` (and no `ResultList`);
  `revealing-list` → `ResultList` with `revealing`; `list` → `ResultList` as today. Keep `idle`
  and `unavailable` branches first and unchanged. Freeze the leaving list: keep the `shown`
  value captured at launch in a `leaving` variable so word results that update while it fades
  don't replace it. Make T004 (a)–(f) and T005 pass

**Checkpoint**: US1 works alone: the sequence plays on launch; markers not yet present
(T004 assertions on `.hb-list--meaning` may use `.hy-result` until US2 lands, then tighten).

---

## Phase 4: User Story 2 - Tell results by meaning at a glance (Priority: P1)

**Goal**: Results by meaning carry a lasting marker in the meaning color (heading + bar per row);
word results never do.

**Independent Test**: Show word results, then results by meaning for the same text: only the
second has the gold heading with the sparkle and the gold bar on each row, and row text sits at the
same place in both.

### Tests for User Story 2

- [X] T011 [P] [US2] In `tests/e2e/us24-meaning-transition.spec.ts`, add `describe('US2: tell
  results by meaning at a glance')`: (a) word results for « gloire »: no `.hb-list--meaning`, no
  `.hb-overline--meaning`; (b) after launching, `ul.hb-list--meaning` and `h2.hb-overline--meaning`
  exist, the heading contains an `svg` and the text « Résultats par le sens », and
  `getComputedStyle(li, '::before').backgroundColor` of the first row equals the computed
  `--meaning` color; (c) the first row's `.hy-result__title` has the same `x` in word results and in
  results by meaning for « la gloire de Dieu » (no reflow, FR-010); (d) typing « 245 » after
  results by meaning removes both classes (marker follows the list, FR-011); (e) at 320 px width,
  `document.documentElement.scrollWidth <= 320`; (f) a meaning query with no match (« zzzz qqqq
  wwww » with the fake embedder, or a hymnal filter that leaves nothing) shows the empty state with
  an `svg` glyph before « Aucun chant trouvé par le sens » (not automated: the fake embedder of the
  tests always ranks some hymns, so this state can't be reached; checked by reading the markup); (g) AxeBuilder on `main` with marked
  results, once with `colorScheme: 'light'` and once `'dark'` (`page.emulateMedia`), no violations.
  Run and see them fail
- [X] T012 [P] [US2] In `tests/e2e/us20-bible-search.spec.ts`, add one assertion to the test that
  shows hymns found from verses: the list is `ul.hb-list--meaning` (same marker on every list by
  meaning, research R6) and no `.meaning-transition` ever shows on that page

### Implementation for User Story 2

- [X] T013 [US2] In `src/lib/components/ResultList.svelte`, when `response.kind === 'meaning'`: add
  class `hb-overline--meaning` to the `<h2>` and render `<Icon name="meaning" />` (16 px,
  `aria-hidden`) before its text; add class `hb-list--meaning` to the `<ul>`; in the « Aucun chant
  trouvé par le sens » `EmptyState`, show the glyph before the title (pass it through a new
  optional `icon` snippet prop of `src/lib/components/EmptyState.svelte`, rendered inside
  `.hy-message__title` before the text). Update the comment « Feature 011: one blended list, no
  badge per result » to say feature 017 adds one shared marker for the whole list (research R6)
- [X] T014 [P] [US2] In `src/app.css`, add `.hb-overline--meaning { display: flex; align-items:
  center; gap: 6px; color: var(--meaning); }` with its `svg` at 16 × 16, and `.hb-list--meaning >
  li { position: relative; }` with `.hb-list--meaning > li::before { content: ''; position:
  absolute; left: -10px; top: 12px; bottom: 12px; width: 3px; border-radius: 2px; background:
  var(--meaning); }`; nothing that changes the row's box, padding or text. Comment: feature 017,
  same sign as the feature 013 stanza mark, ≥ 3:1 contrast (≈ 5.0:1 light, ≈ 9.6:1 dark). If
  `.hb-list > li` already sets `position`, keep it. Check the bar stays inside the page gutter at
  320 px (`--gutter` ≥ 13 px). Make T011 and T012 pass

**Checkpoint**: US1 + US2 deliver the whole request.

---

## Phase 5: User Story 3 - Return to word results (Priority: P2)

**Goal**: Cancel, error or leaving the mode stops the sequence at once and the word results come
back; the filter re-run never plays the sequence.

**Independent Test**: Launch with a slow reply and cancel; launch with a 503; launch offline;
change the filter with results by meaning shown: each time, no empty screen and no placeholder
left behind.

### Tests for User Story 3

- [X] T015 [P] [US3] In `tests/e2e/us24-meaning-transition.spec.ts`, add `describe('US3: return to
  word results')`: (a) `delayMs: 15_000`, launch, click « Annuler » during the placeholder: within
  500 ms `.meaning-transition` count 0 and `results(page).first()` visible, no `.hb-list--meaning`;
  (b) same, then press the mode button to leave the mode: same expectations; (c) `status: 503`:
  the error line of `MEANING_MESSAGES.unavailable` is visible and word results are visible below
  it within 500 ms of the reply; (d) offline (`context.setOffline(true)`): the offline message and
  word results; (e) with results by meaning shown, click a hymnal chip: `.meaning-transition` never
  appears (poll with `expect(...).toHaveCount(0)` over 1 s) and `.hb-list--meaning` stays;
  (f) emptying the field during the placeholder: placeholder gone, idle screen shown.
  Run and see them fail where the code doesn't yet reset `reveal`

### Implementation for User Story 3

- [X] T016 [US3] In `src/routes/+page.svelte`, add a `resetReveal()` that clears the clearing and
  revealing timers and sets `reveal = 'none'`; call it from `cancelMeaning()` (which covers
  « Annuler », leaving the mode and emptying the field) and from every early return of
  `runMeaning` that ends without results (no `meta`, `embedded.ok === false`, `'error' in
  answer`). A stale return (`stale()` true) must not reset a newer launch's phase: only reset when
  `controller === meaningController`. Make T015 pass

**Checkpoint**: All stories pass `us24`, `us15`, `us16`, `us20`.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] In `tests/e2e/us24-meaning-transition.spec.ts`, add a reduced-motion test:
  `page.emulateMedia({ reducedMotion: 'reduce' })`, launch with `delayMs: 1000`, and assert during
  clearing, waiting and revealing that `document.getAnimations().length === 0` (sampled with
  `page.evaluate` at each phase) while the order (list gone, placeholder, results) is unchanged
  (FR-012, SC-005)
- [X] T018 [P] In `tests/e2e/a11y.spec.ts`, add the search screen with results by meaning and the
  placeholder (with `delayMs`) to the axe runs, if not already covered by T011 (g); the
  placeholder must not appear in the accessibility tree (`aria-hidden`)
- [X] T019 [P] Update `design/handoff/maquette/SearchSemantic.dc.html` with the waiting
  placeholder and the marked list (light and dark), matching contracts/meaning-reveal.md
- [X] T020 Run `npm run check`, `npm run lint`, `npm test`, `npm run test:queries` (reference
  queries unchanged, ranking untouched) and `npm run test:e2e`; fix any failure
- [X] T021 Walk through quickstart.md manual scenarios 1–10 at 360 px and 320 px in light and dark,
  and with reduced motion; fix what doesn't match

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; blocks US1 and US3 (they use `reveal.ts`).
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: needs nothing from Phase 2 or US1 for its CSS and `ResultList` markup; its
  e2e test launches a search by meaning, which works before or after US1. Can run in parallel with
  US1 if `ResultList.svelte` edits (T007, T013) are done one after the other.
- **US3 (Phase 5)**: after US1 (it resets the state US1 adds).
- **Polish (Phase 6)**: after the stories it checks.

### Within Each Story

- Tests first, seen failing, then implementation.
- `ResultList.svelte` (T007, T013) and `+page.svelte` (T009, T010, T016) are each edited by one
  task at a time.
- `app.css` (T008, T014) edits are in separate blocks but the same file: do them one after the
  other.

### Parallel Opportunities

- T004 and T005 (different test files).
- T006 (new component) alongside T007 / T008.
- T011 and T012 (different test files); T014 alongside T013 once T008 is in.
- T017, T018, T019.

---

## Parallel Example: User Story 1

```bash
# Tests, together:
Task: "T004 Create tests/e2e/us24-meaning-transition.spec.ts (US1)"
Task: "T005 Adapt the slow-reply test in tests/e2e/us15-meaning-search.spec.ts"

# Independent pieces, together:
Task: "T006 Create src/lib/components/MeaningTransition.svelte"
Task: "T008 Add leave/reveal keyframes in src/app.css"
```

## Parallel Example: User Story 2

```bash
Task: "T011 US2 tests in tests/e2e/us24-meaning-transition.spec.ts"
Task: "T012 Marker assertion in tests/e2e/us20-bible-search.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 and Phase 2 (`reveal.ts` with its tests).
2. Phase 3: the clear → placeholder → reveal sequence.
3. Stop and check the independent test of US1 on a phone width.

### Incremental Delivery

1. US1: the sequence (the animation the user asked for).
2. US2: the lasting marker (the color the user asked for). US1 + US2 is the full request.
3. US3: clean returns on cancel, error and filter changes. Without it, a cancelled or failed
   search could leave the placeholder on screen, so ship US3 in the same release as US1.
4. Polish: reduced motion check, axe, mock-up, full test run, manual walkthrough.

## Notes

- Commit after each phase.
- Ranking, fusion, embedding and offline logic (feature 011) must not change; `npm run
  test:queries` guards this.
