---

description: "Task list for feature 008: reorder a collection by drag-and-drop"
---

# Tasks: Reorder a collection by drag-and-drop

**Input**: Design documents from `/specs/008-drag-reorder-collection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: Included. The constitution (Principle V) requires automated tests, and features 001–007 write tests first. Write each test task before its implementation and check that it fails.

**Organization**: US1 (P1, drag-and-drop) is the MVP. US2 (P2) keeps the arrows working, muted, next to the handle; the arrows already exist, so US2 is mostly styling and regression checks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 = drag a hymn to its place; US2 = reorder without dragging (arrows)

## Path Conventions

Single SvelteKit app: `src/`, `tests/` at the repository root. E2E tests run on `tests/fixtures/sample-content`, with two Playwright projects (`android` = Pixel 7, `iphone` = iPhone 13; the iPhone project cannot launch on this machine). Useful fixture hymns (entry → title): `ce 1` « À toi la gloire », `ce 2` « C’est un rempart que notre Dieu », `ce 3` « Torrents d’amour et de grâce », `ce 5` « Plus près de toi, mon Dieu », `ce 7` « Quel ami fidèle et tendre », `ce 8` « Tel que je suis », `ce 12` « Debout, sainte cohorte », `ce 20` « Il est né le divin Enfant », `ce 23` « Minuit, chrétiens », `he 12` « Les anges dans nos campagnes », `he 13` « Douce nuit, sainte nuit ». Helpers in `tests/e2e/helpers.ts`: `seedCollections(page, [{ name, entries: [[hymnal, number], …] }])` (ids `c1`, `c2`…), `collectionTitles(page)` (titles of `ol.collection__list`).

---

## Phase 1: Setup

**Purpose**: Branch

- [ ] T001 Create and switch to branch `008-drag-reorder-collection` from `main` (git), with `specs/008-drag-reorder-collection/` and the `.specify/feature.json` update committed as the first commit

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure drop maths and the grip icon, needed by the drag.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Write unit tests in `tests/unit/repertoire-reorder.test.ts` for the pure functions of `src/lib/repertoire/reorder.ts` (contract in `specs/008-drag-reorder-collection/data-model.md`). Rows are `{ top: number; height: number }[]`.
  - `dropIndex(from, rows, centerY)`: with 4 rows of height 50 at tops 0, 50, 100, 150 and `from = 0`: centre 25 → 0; centre 76 (past row 1's midpoint 75) → 1; centre 174 → 3; centre −100 → 0; centre 999 → 3. With `from = 3`: centre 124 (above row 2's midpoint 125) → 2; centre 20 → 0. Uneven rows (heights 50, 90, 50; tops 0, 50, 140), `from = 0`: centre 94 → 0, centre 96 → 1. A single row → 0. Midpoints are compared with the other rows only (row `from` is ignored).
  - `shiftOf(i, from, to)`: `from = 1, to = 3` → rows 2 and 3 give `-1`, rows 0 and 1 give `0`; `from = 3, to = 1` → rows 1 and 2 give `+1`, row 3 and row 0 give `0`; `from === to` → `0` for every row.
  Run `npm test` and confirm they fail.
- [ ] T003 Implement `src/lib/repertoire/reorder.ts` (no `$app` or DOM import), with a header comment "Feature 008: where a dragged hymn lands, and how the other rows slide (pure, unit-tested)":
  - `export type RowBox = { top: number; height: number }`
  - `export function dropIndex(from: number, rows: RowBox[], centerY: number): number` — count the rows `i ≠ from` whose midpoint (`top + height / 2`) is above `centerY`; that count is the landing index, clamped to `0 … rows.length - 1`.
  - `export function shiftOf(i: number, from: number, to: number): -1 | 0 | 1` — `-1` when `from < i ≤ to`, `+1` when `to ≤ i < from`, else `0`.
  `npm test` passes T002.
- [ ] T004 [P] Add a `'grip'` icon to `src/lib/components/Icon.svelte`: extend the `IconName` union and add an `{:else if name === 'grip'}` branch drawing six dots (two columns at x = 9 and 15, rows at y = 6, 12, 18, `r="1.25"`, `fill="currentColor"`, like the `more` icon's dots). Stays `aria-hidden` like every icon.

**Checkpoint**: `npm test` green; maths and icon ready.

---

## Phase 3: User Story 1 - Drag a hymn to its place (Priority: P1) 🎯 MVP

**Goal**: In « Modifier l'ordre », pressing a row's handle and moving drags the hymn; the others slide to show the landing place; release saves the order through `repertoire.move`; Escape, interrupted gesture, release far outside the list or « Terminé » cancel.

**Independent Test**: In a collection of 5 hymns, enter ordering mode, drag the 5th hymn above the 1st, check the new order on screen, after a reload, and with « Lire dans l'ordre ».

### Tests for User Story 1 ⚠️

> Write these first and check that they FAIL before implementation.

- [ ] T005 [US1] Write `tests/e2e/us14-collection-drag.spec.ts` (header comment: "Feature 008, User Story 1: reorder a collection by drag-and-drop (spec.md, US1; contracts/ui.md)"). `beforeEach`: `seedCollections` one collection « Culte » with entries `ce 1, ce 2, ce 3, ce 5, he 13`; open `/repertoire/c1`, click « Plus d’options », then « Modifier l’ordre ». Helpers in the file: `handle(page, n)` = `page.locator('ol.collection__list li[data-row="' + n + '"] .collection__handle')`; `mouseDrag(page, from, toY)` = hover the handle's centre, `page.mouse.down()`, `page.mouse.move(x, toY, { steps: 12 })`, `page.mouse.up()`; `touchDrag(page, from, toY)` = `evaluate` on the handle dispatching `PointerEvent`s `pointerdown` → several `pointermove` → `pointerup` with `pointerType: 'touch'`, `pointerId: 7`, `isPrimary: true`, `bubbles: true`, `clientX` at the handle centre (approach of the swipe test in `tests/e2e/us9-collection-order.spec.ts`). Scenarios:
  1. Every row in ordering mode has a `.collection__handle` with `aria-hidden="true"` that is not focusable (no `tabindex`, not a button), and the « Monter » / « Descendre » buttons are still present.
  2. Mouse: drag row 4 (« Douce nuit, sainte nuit ») above row 0 (target Y = row 0's top + 5); `collectionTitles` becomes `Douce nuit…, À toi la gloire, C’est un rempart…, Torrents…, Plus près…`; the `p.hb-sr[aria-live]` status reads `« Douce nuit, sainte nuit » déplacé en position 1`; click « Terminé », reload, same order.
  3. Touch (synthetic pointer events): drag row 0 to below row 2 → order `C’est un rempart…, Torrents…, À toi la gloire, Plus près…, Douce nuit…`.
  4. While dragging (mouse down and moved past row 1, not released): row 0 has class `is-dragging`; row 1 has a non-`none` `transform`; then `page.keyboard.press('Escape')`, `page.mouse.up()` → order unchanged, no row has `is-dragging` and no row keeps a transform.
  5. Drop at the starting place (move 30 px and back) → order unchanged, status unchanged.
  6. Release far outside the list (mouse moved to y = list bottom + 3 × row height, after clamping no auto-scroll on this short list) → order unchanged.
  7. A tap (down/up without moving) on a handle does nothing; releasing a drag over a hymn's title link does not navigate (URL stays `/repertoire/c1`).
  8. « Lire dans l’ordre » after a drag (click « Terminé » first) opens the hymn now in first place (`/recueils/he/13?collection=c1`).
  9. Long list at phone size: seed a second collection with all 11 fixture entries listed in Path Conventions, open `/repertoire/c2`, ordering mode, set viewport 390 × 500; mouse-drag row 0's handle to y = 480 and hold (repeated small `mouse.move`s for ~1.5 s) until `window.scrollY` grows, then move to the last row and release → « À toi la gloire » is last.
  10. Swipe on a title in ordering mode (synthetic touch `pointerdown/move/up` on `.hb-item__title` of row 1) → order unchanged.
  Run `npm run test:e2e -- us14` and confirm it fails.

### Implementation for User Story 1

- [ ] T006 [US1] Create the Svelte attachment `src/lib/repertoire/drag-reorder.ts` (header comment: "Feature 008: drag a collection row by its handle (Pointer Events, no dependency); research.md R1–R6"). `export function dragReorder(opts: { onmove: (from: number, to: number) => void }): Attachment<HTMLOListElement>` (type from `svelte/attachments`). Behaviour, per `specs/008-drag-reorder-collection/contracts/ui.md` and `data-model.md`:
  - Listen to `pointerdown` on the list, delegated to `.collection__handle`; ignore non-primary pointers and mouse buttons other than 0. Read `from` from the closest `li[data-row]`, capture the pointer on the handle (`setPointerCapture`), store `startY`, `startScroll = window.scrollY`, and every row's `{ top, height }` (from `getBoundingClientRect`, page coordinates = `top + scrollY`). State `pressed`; `preventDefault()` so no text selection or click starts.
  - `pointermove`: until the pointer moved 4 px vertically, stay `pressed`. Then `dragging`: add `is-dragging` to the row and `is-sorting` to the list; on each animation frame (one `requestAnimationFrame` per frame, no layout reads), `delta = clientY - startY + (scrollY - startScroll)`; dragged row `style.transform = translateY(delta px)`; compute `centerY` (row's start centre + `delta`, clamped to the list's first row top … last row bottom), `to = dropIndex(from, rows, centerY)`, and for every other row `i` set `translateY(shiftOf(i, from, to) * draggedHeight px)`.
  - Auto-scroll (R5): while dragging, if `clientY < 56` or `clientY > innerHeight - 56`, `window.scrollBy(0, speed)` each frame with `speed` proportional to the depth into the band, max 12 px, then recompute as above.
  - `pointerup`: if `dragging` and the pointer is within one dragged-row height above the first row / below the last row and `to !== from`, call `opts.onmove(from, to)`; in every case reset (remove classes and inline `transform`s, cancel the frame and scroll loop, release capture). If `pressed` only, just reset.
  - Cancel = reset without `onmove`, on: `keydown` Escape (listen on `window` while active), `pointercancel`, `lostpointercapture` without a prior `pointerup`, and the attachment's cleanup (ordering mode left, page destroyed).
  - Swallow the `click` that may follow a drag on the handle (`addEventListener('click', …, { capture: true, once: true })` when a drag ended) so nothing navigates.
- [ ] T007 [US1] In `src/routes/repertoire/[collection]/+page.svelte`: import `dragReorder` from `$lib/repertoire/drag-reorder`; on the `<ol class="hb-list collection__list">` add `{@attach ordering && dragReorder({ onmove: drop })}` (attachments accept a falsy value, so the drag is only active in ordering mode). Add `function drop(from: number, to: number)` that calls `repertoire.move(collection.id, from, to)` and sets `status = frenchSpaces(\`« ${titleOf(rows[from])} » déplacé en position ${to + 1}\`)` (same message as `move()`); focus is not moved after a drag. Inside `{#if ordering}`, after the two arrow buttons, add `<span class="collection__handle" aria-hidden="true"><Icon name="grip" /></span>`. Update the header comment with "Feature 008: drag-and-drop by the handle in ordering mode; the arrows stay, muted."
- [ ] T008 [US1] Style in the same file's scoped `<style>`: `.collection__handle` 44 × 44 px (`var(--tap-target)` if it is 44 px), centred icon, `color: var(--ink)`, `cursor: grab`, `touch-action: none`, `user-select: none`, `flex: none`; `:global(.collection__list.is-sorting) .collection__handle { cursor: grabbing }`; `.hb-item.is-dragging { position: relative; z-index: 5; background: var(--paper-raised); box-shadow: var(--shadow-float); }`; `.collection__list.is-sorting .hb-item:not(.is-dragging) { transition: transform 150ms ease; }` wrapped in `@media (prefers-reduced-motion: no-preference)`. Classes added from the attachment are not seen by Svelte's scoping: use `:global(...)` for `is-dragging` / `is-sorting` selectors.
- [ ] T009 [US1] Run `npm run test:e2e -- us14` and `npm test`; fix until green.

**Checkpoint**: User Story 1 complete; drag-and-drop works with mouse and touch; arrows untouched.

---

## Phase 4: User Story 2 - Reorder without dragging (Priority: P2)

**Goal**: The up and down arrows keep working next to the handle, in a lighter style with AA contrast and 44 px targets; every move is announced.

**Independent Test**: Keyboard only, in ordering mode: move the 3rd hymn to the 1st place with « Monter »; check order, focus and the status line.

### Tests for User Story 2 ⚠️

- [ ] T010 [P] [US2] Extend `tests/e2e/us9-collection-order.spec.ts` (keep tests 1–3 as they are): add test 4 "arrows stay, muted, next to the handle": in ordering mode, each row shows `Monter`, `Descendre` and then `.collection__handle` in this DOM order; the arrows' computed `color` differs from the handle's; each arrow's bounding box is at least 44 × 44; keyboard only (`Tab` until « Monter « Debout, sainte cohorte » » is focused, `Enter` twice) moves it first, keeps focus on its « Descendre » (at the top, « Monter » is disabled) and the status reads `« Debout, sainte cohorte » déplacé en position 1`.
- [ ] T011 [P] [US2] In `tests/e2e/a11y.spec.ts`, add a scan of the collection page in ordering mode: after the `SCREENS` loop (same light/dark × text 100/200 % matrix), `seedCollections` a « Culte » with `ce 1, ce 2, he 13`, open `/repertoire/c1`, click « Plus d’options » then « Modifier l’ordre », run the same `AxeBuilder` tags and expect no violations (label `'/repertoire/c1 (ordre)'`). Check how the existing tests in that file already seed collections and follow the same pattern.

### Implementation for User Story 2

- [ ] T012 [US2] In `src/routes/repertoire/[collection]/+page.svelte`: add `class="hb-icon-btn collection__move"` to both arrow buttons (keep `data-move`, labels, `disabled` and `move()` unchanged), and style `.collection__move { color: var(--ink-muted); }` in the scoped `<style>` (`--ink-muted` is AA on `--paper` in both themes); keep the existing disabled rule (`--line-strong`). Make sure the arrows keep their 44 px box.
- [ ] T013 [US2] Run `npm run test:e2e -- us9 a11y`; fix until green (axe in ordering mode, light and dark; FR-008–FR-010, SC-004).

**Checkpoint**: User Stories 1 and 2 both work; the feature is shippable.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T014 Run `npm run check && npm run lint` and fix any type or lint issue (notably the `Attachment` type import and unused variables in `src/lib/repertoire/drag-reorder.ts`).
- [ ] T015 Run the full suites `npm test` and `npm run test:e2e`; confirm no other e2e test broke (`tests/e2e/offline.spec.ts` uses « Monter » in ordering mode; `tests/e2e/us7-collections-manage.spec.ts` touches the same page).
- [ ] T016 Walk through `specs/008-drag-reorder-collection/quickstart.md` manual scenarios 1–9 on a real phone (touch) and on desktop (mouse), in light and dark modes, with `npm run dev`; note any deviation in the commit message. Needs a person: real touch feel, auto-scroll speed and the absence of accidental moves while scrolling (SC-002, SC-003) cannot be judged by the agent.
- [ ] T017 Commit on `008-drag-reorder-collection` with a message like "Reorder a collection by drag-and-drop (feature 008)", and mark tasks done in `specs/008-drag-reorder-collection/tasks.md`.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → **US1 (T005–T009)** → **US2 (T010–T013)** → **Polish (T014–T017)**.
- T002 → T003 (test first). T004 is independent of T002/T003.
- T005 can be written as soon as Phase 2 starts; it runs green only after T006–T008.
- T006 → T007 → T008 (T007 imports T006; T008 styles what T007 adds, same file as T007).
- US2 does not depend on US1's logic, but T012 edits the same file as T007/T008, so do it after them. T010 and T011 touch different files and can be written in parallel with US1.

## Parallel Example

```text
# Phase 2, together:
T002 tests/unit/repertoire-reorder.test.ts
T004 src/lib/components/Icon.svelte

# While US1 is implemented (T006–T008):
T005 tests/e2e/us14-collection-drag.spec.ts
T010 tests/e2e/us9-collection-order.spec.ts
T011 tests/e2e/a11y.spec.ts
```

## Implementation Strategy

- **MVP = User Story 1**: Phases 1–3 give drag-and-drop with the arrows still working as today (unstyled), so it is already shippable and AA-conformant.
- **Increment = User Story 2**: Phase 4 makes the arrows discreet and locks in their behaviour and accessibility with tests.
- Phase 5 is verification, manual check by a person, and commit.
