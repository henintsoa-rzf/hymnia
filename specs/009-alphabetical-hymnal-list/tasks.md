---

description: "Task list for feature 009: alphabetical order of the hymnal list"
---

# Tasks: Alphabetical order of the hymnal list

**Input**: Design documents from `/specs/009-alphabetical-hymnal-list/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/catalog.md, quickstart.md

**Tests**: Included. The constitution (Principle V) requires automated tests, SC-001, SC-002 and SC-004 are checkable automatically, and features 001–008 write tests first. Write each test task before its implementation and check that it fails.

**Organization**: US1 (P1) = Recueils screen in alphabetical order, the MVP. US2 (P2) = same order in the two hymnal filters. Both use one catalog lookup built in Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 = Recueils screen; US2 = hymnal filters

## Path Conventions

Single SvelteKit app: `src/`, `tests/` at the repository root. E2E tests run on `tests/fixtures/sample-content`, which has two hymnals: `ce` « Cantiques d’exemple » (`sortOrder` 1, 10 hymns) and `he` « Hymnes d’exemple » (`sortOrder` 2, 7 hymns). Their name order already matches `sortOrder`, so the e2e tests cannot tell the two orders apart: the unit test in T002 is the one that proves the alphabetical sort (research.md §4). Do not change the fixture's `sortOrder`: other e2e tests rely on `ce` being the primary hymnal.

---

## Phase 1: Setup

**Purpose**: Branch

- [ ] T001 Create and switch to branch `009-alphabetical-hymnal-list` from `main` (git), with `specs/009-alphabetical-hymnal-list/` and the `.specify/feature.json` update committed as the first commit

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared, sorted list both stories display (contracts/catalog.md).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Add a `describe('hymnals by name (feature 009)')` block to `tests/unit/catalog.test.ts`. Build a catalog with `createCatalog` from a `structuredClone(catalogData)` whose `hymnals` are replaced by the real hymnals, in their real `sortOrder` (all with `hymnCount: 1`): `jem` « J’aime l’Éternel » 3, `adf` « Ailes de la Foi » 4, `atg` « À Toi la Gloire » 5, `cd` « Célébrons Dieu » 6, `exo` « Exo » 7, `ecriture` « Écritures » 8, `psalmodie` « Chorale Psalmodie » 9, `evangile21` « Evangile21 » 10, `arc` « Arc-en-ciel » 11 (abbreviations as in `content/hymnals.json`). Tests:
  1. `getHymnalsByName().map((h) => h.name)` equals `['À Toi la Gloire', 'Ailes de la Foi', 'Arc-en-ciel', 'Célébrons Dieu', 'Chorale Psalmodie', 'Écritures', 'Evangile21', 'Exo', 'J’aime l’Éternel']` (SC-001, FR-001, FR-002).
  2. `getHymnals().map((h) => h.id)` is still `['jem', 'adf', 'atg', 'cd', 'exo', 'ecriture', 'psalmodie', 'evangile21', 'arc']` (FR-006).
  3. Same members: the sorted ids of both lists are equal; a hymnal with `hymnCount: 0` appears in neither (FR-007, data-model invariant).
  4. Ties: two hymnals named « Écho » (id `b`) and « echo » (id `a`) come out as `a` then `b`, whatever their order in the input (FR-003, "then id").
  5. A name starting with a digit (« 1000 chants ») sorts before the names starting with a letter (spec edge cases).
  6. Two calls return the same array (`toBe`), per contracts/catalog.md.
  Run `npm test -- tests/unit/catalog.test.ts` and confirm it fails (no `getHymnalsByName`).
- [ ] T003 In `src/lib/data/catalog.ts`: add to `CatalogApi`, after `getHymnals`, `/** Listed hymnals (at least one published hymn), in French alphabetical order of name, then id (feature 009). */ getHymnalsByName(): PublishedHymnal[];`. In `createCatalog`, right after `const listed = …`, compute once: `const collator = new Intl.Collator('fr', { sensitivity: 'base' });` and `const byName = [...listed].sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));`, and return `getHymnalsByName: () => byName`. Keep `getHymnals: () => listed` and its doc comment ("in sortOrder") unchanged. `npm test` passes T002 and every existing unit test (`engine-*`, `search-examples`, `catalog`).

**Checkpoint**: `npm test` green; the sorted list exists, nothing displays it yet.

---

## Phase 3: User Story 1 - Find a hymnal in the Recueils screen (Priority: P1) 🎯 MVP

**Goal**: `/recueils` lists the hymnals in alphabetical order of their name.

**Independent Test**: Open `/recueils` and check the rows are in name order, with the same content as before.

### Tests for User Story 1 ⚠️

- [ ] T004 [P] [US1] In `tests/e2e/us3-browse.spec.ts`, add a test `'the hymnal list is in alphabetical order of name (feature 009)'`: on `/recueils`, read `main .hy-row .hy-row__title` with `allTextContents()`, and expect it to equal a copy sorted with `new Intl.Collator('fr', { sensitivity: 'base' }).compare`, and to equal `['Cantiques d’exemple', 'Hymnes d’exemple']`. Keep test 1 (counts) as is: row content does not change (FR-007). This test already passes on the fixture (see Path Conventions); it guards against a regression in row content or order, while T002 proves the sort.

### Implementation for User Story 1

- [ ] T005 [US1] In `src/routes/recueils/+page.svelte`, pass `hymnals={data.catalog.getHymnalsByName()}` to `<HymnalList>` instead of `getHymnals()`. Update the header comment: "Hymnals `/recueils` (T048, FR-011, decisions §5). Feature 009: in alphabetical order of name."
- [ ] T006 [US1] Run `npm run test:e2e -- us3-browse a11y` and `npm test`; fix until green.

**Checkpoint**: User Story 1 complete; shippable on its own.

---

## Phase 4: User Story 2 - Same order in the hymnal filter (Priority: P2)

**Goal**: The filter chips on the search screen and on the add-to-collection screen follow the same order as `/recueils`; selecting a chip does not move it; « Tous les recueils » stays last.

**Independent Test**: Open `/` and `/repertoire/c1/ajouter`, check the chips are in the same order as the rows on `/recueils`.

### Tests for User Story 2 ⚠️

- [ ] T007 [P] [US2] In `tests/e2e/us5-filter.spec.ts`, add (header of the new tests: "Feature 009, User Story 2"):
  1. `'the hymnal chips follow the Recueils screen order'`: read the row titles on `/recueils` (`main .hy-row .hy-row__title`); on `/`, read the chip names (`page.getByRole('group', { name: 'Filtrer par recueil' }).getByRole('button')`, `allTextContents()`, trimmed) and expect them to equal the row titles. Then `seedCollections(page, [{ name: 'Dimanche' }])` (from `./helpers`), open `/repertoire/c1/ajouter`, and expect the same chip names there (SC-002).
  2. `'a selected chip keeps its place and the clear chip is last'`: on `/`, click « Hymnes d’exemple »; the chip names are now the row titles followed by « Tous les recueils » (US2 scenario 3).
  Note in a comment that the fixture's name order equals its `sortOrder`, so these tests check consistency between screens, not the sort itself (T002 does).

### Implementation for User Story 2

- [ ] T008 [P] [US2] In `src/routes/+page.svelte`, add `const filterHymnals = $derived(data.catalog.getHymnalsByName());` next to `const hymnals = …` and pass it to the filter: `<HymnalFilter hymnals={filterHymnals} bind:selected />`. Keep `hymnals` (from `getHymnals()`) for `hymnalMap`, the `known` set and the `{#if hymnals.length > 1}` check, as listed in contracts/catalog.md.
- [ ] T009 [P] [US2] Same change in `src/routes/repertoire/[collection]/ajouter/+page.svelte`: add `const filterHymnals = $derived(data.catalog.getHymnalsByName());` and pass `hymnals={filterHymnals}` to `<HymnalFilter>`; keep `hymnals`, `hymnalMap` and `known` on `getHymnals()`.
- [ ] T010 [US2] Run `npm run test:e2e -- us5-filter us6-collection-create a11y` and `npm test`; fix until green. `src/lib/components/HymnalFilter.svelte` needs no change (it renders chips in the order received, clear chip last); if a test shows otherwise, fix it there.

**Checkpoint**: Both stories complete; the three screens share one order.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T011 Run `npm run check && npm run lint` and fix any type or lint issue.
- [ ] T012 Run the full suites `npm test`, `npm run test:queries` and `npm run test:e2e`; confirm search results are unchanged (SC-004): the reference query sets and `engine-number`, `engine-text`, `search-examples` pass without edits.
- [ ] T013 Walk through `specs/009-alphabetical-hymnal-list/quickstart.md` manual steps 1–5 on the real catalog with `npm run dev` (needs `npm run data` if the build output is missing); note any deviation in the commit message. If not done by the agent, say so in this task.
- [ ] T014 Commit on `009-alphabetical-hymnal-list` with a message like "Order the hymnal list alphabetically (feature 009)", and mark tasks done in `specs/009-alphabetical-hymnal-list/tasks.md`.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002 → T003)** → **US1 (T004–T006)** and **US2 (T007–T010)** → **Polish (T011–T014)**.
- US1 and US2 are independent of each other once T003 is done; both only need `getHymnalsByName()`.
- T004 and T007 can be written any time after T001; they need T003 + their screen change to run green.
- T008 and T009 touch different files.

## Parallel Example

```text
# After T003, together:
T004 tests/e2e/us3-browse.spec.ts
T005 src/routes/recueils/+page.svelte
T007 tests/e2e/us5-filter.spec.ts
T008 src/routes/+page.svelte
T009 src/routes/repertoire/[collection]/ajouter/+page.svelte
```

## Implementation Strategy

- **MVP = User Story 1**: T001–T006 put the Recueils screen in alphabetical order.
- **Increment = User Story 2**: T007–T010 align the filters, so the user meets one order everywhere.
- The feature is small enough to ship both stories together after Phase 5.
