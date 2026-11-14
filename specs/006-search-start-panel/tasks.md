---

description: "Task list for feature 006: recent hymns on the search screen"
---

# Tasks: Recent hymns on the search screen

**Input**: Design documents from `/specs/006-search-start-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/storage.md, contracts/ui.md, quickstart.md

**Tests**: Included. The constitution (Principle V) requires automated tests for critical behaviour, the spec sets SC-005 (examples checked by an automated test), and features 001–005 write tests first. Write each test task before its implementation and check that it fails.

**Organization**: Tasks are grouped by user story so each story can be built, tested and shipped on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 = recent hymns (P1), US2 = recent collections (P2), US3 = example searches (P3)

## Path Conventions

Single SvelteKit app: `src/`, `tests/` at the repository root. E2E tests run on `tests/fixtures/sample-content` (hymnals `ce` « CE » and `he` « HE », 12 hymns). Unit tests use `MemoryStorage`-style fakes as in `tests/unit/repertoire-storage.test.ts` and the sample catalog from `tests/helpers/sample.ts`.

---

## Phase 1: Setup

**Purpose**: Branch and shared groundwork

- [ ] T001 Create and switch to branch `006-search-start-panel` from `main` (git), with `specs/006-search-start-panel/` committed as the first commit

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove the duplicated hymnal list and leave the search screen with an empty-field slot that the three stories fill. Every story builds on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Replace the e2e test "with an empty query, the search screen lists the hymnals" in `tests/e2e/us3-browse.spec.ts` with "the search screen no longer lists the hymnals": on `/` with an empty field, no heading « Recueils » and no hymnal row (`a[href$="/recueils/ce"]`) in `main`, at phone width and at 1280 px; `/recueils` still lists both hymnals (FR-001, SC-002)
- [ ] T003 In `src/routes/+page.svelte`, remove the `HymnalList` import and both « Recueils » blocks (mobile under the help text, desktop in `.search__aside`). Keep the desktop `<aside class="search__aside desktop-only">` with only the keyboard tips, and give it `aria-label="Raccourcis"` instead of `aria-labelledby="aside-hymnals-title"`. Leave `src/lib/components/HymnalList.svelte` untouched (still used by `/recueils`)
- [ ] T004 Export the single-entry resolution from `src/lib/repertoire/resolve.ts`: rename `resolveOne` to `resolveEntry(catalog, entry: HymnRef & { addedAt?: string }, index = 0): ResolvedEntry`, export it, and keep `resolveEntries` calling it. Run `npm test` — `tests/unit/repertoire-resolve.test.ts` must still pass unchanged

**Checkpoint**: Search screen shows only the field, filter, help text and (desktop) keyboard tips when empty; all existing tests green.

---

## Phase 3: User Story 1 - Reopen a recently viewed hymn (Priority: P1) 🎯 MVP

**Goal**: The hymns opened on this device appear under « Récemment consultés » on the empty search screen, newest first, once each, and can be cleared.

**Independent Test**: Open three different hymns, return to `/`, check they are listed newest first with reference and title, reopen one in one tap; « Effacer » empties the list and leaves collections intact.

### Tests (write first, check they fail)

- [ ] T005 [P] [US1] Unit tests for the history model in `tests/unit/history-model.test.ts`: `parseHistory` returns `{ version: 1, entries: [] }` for `null`, invalid JSON, `version: 2`, a missing field, a non-ISO `openedAt`; `record` puts the new entry first; recording a `hymnId` already present removes the old entry ("at most one entry per `hymnId`") and keeps the new reference; recording the top hymn again only updates `openedAt`, `hymnal`, `number`; a 21st distinct hymn drops the oldest ("at most 20"); `record` never mutates its input; `clearHistory` returns an empty v1 doc
- [ ] T006 [P] [US1] Unit tests for history storage in `tests/unit/history-storage.test.ts` (copy the `MemoryStorage` fake from `tests/unit/repertoire-storage.test.ts`): loads an existing `hymnia.history.v1` document; an unreadable value loads as empty with no other key written; `record` writes the whole document under `hymnia.history.v1`; `clear` writes an empty document and does not touch `hymnia.repertoire.v2` or `hymnia.prefs`; with `getItem`/`setItem` throwing, `record` and `clear` still update the in-memory value and never throw (FR-012)
- [ ] T007 [P] [US1] Unit tests for resolution in `tests/unit/history-resolve.test.ts` with the sample catalog: entries resolve to `{ hymnal, number, hymn, hymnalInfo }` in stored order; an entry whose `hymnId` is not published is skipped and does not count toward the limit; an entry whose `hymnId` is redirected resolves to the current hymn; a renumbered hymn resolves to its current reference in the same hymnal; two entries resolving to the same hymn give one row; `limit` (default 8) caps the rows
- [ ] T008 [P] [US1] E2E tests in `tests/e2e/us10-recent-hymns.spec.ts` (sample content): (1) open `CE 1`, then `CE 2` from `/recueils/ce`, then go back to `/` → section « Récemment consultés » lists CE 2 then CE 1 with titles, and clicking CE 1 opens `/recueils/ce/1`; (2) reopen CE 1 → it is first and listed once; (3) open 10 distinct hymns → 8 rows; (4) opening via « suivant » on a hymn page records the next hymn; (5) typing in the field hides the section, clearing the field shows it again; (6) with a seeded collection (`seedCollections`), « Effacer les chants récents » removes the section, focus is in the search field, « Historique effacé » is announced, and `/repertoire` still lists the collection; (7) a not-found URL `/recueils/ce/999` records nothing; (8) at 1280 px the section is in the side column above the keyboard tips; (9) with `localStorage` blocked (`page.addInitScript` making `localStorage.setItem` throw), opening a hymn works and `/` shows no error

### Implementation

- [ ] T009 [P] [US1] Create `src/lib/history/schema.ts`: zod `HistoryEntrySchema` = `{ hymnal: string min(1), number: string min(1), hymnId: string min(1), openedAt: z.string().datetime() }`, `HistoryDocSchema` = `{ version: z.literal(1), entries: z.array(HistoryEntrySchema).max(20) }`, exported types `HistoryEntry`, `HistoryDoc`, constant `HISTORY_MAX = 20`, `EMPTY_HISTORY` frozen `{ version: 1, entries: [] }`. Header comment pointing to `specs/006-search-start-panel/contracts/storage.md` and Principle IV (user data apart from hymn data)
- [ ] T010 [US1] Create `src/lib/history/model.ts` with pure functions `parseHistory(raw: string | null): HistoryDoc` (empty doc on any error), `recordOpened(doc, ref: { hymnal, number }, hymnId, now: string): HistoryDoc` (remove same `hymnId`, prepend, trim to `HISTORY_MAX`), `clearHistory(): HistoryDoc` — makes T005 pass
- [ ] T011 [US1] Create `src/lib/history/store.ts`: `STORAGE_KEY = 'hymnia.history.v1'`; `createHistoryStore({ storage?, now? })` reads once at creation, exposes `subscribe`, `record(ref, hymnId)`, `clear()`; each write saves the whole doc; every storage access in try/catch, failures ignored silently (no notice, no `storage` listener — research R8). Export the app instance `history` built with a guarded `localStorage` like `browserStorage()` in `src/lib/repertoire/store.ts` — makes T006 pass
- [ ] T012 [US1] Create `src/lib/history/resolve.ts`: `recentHymns(catalog: CatalogApi, doc: HistoryDoc, limit = 8)` using `resolveEntry` from `src/lib/repertoire/resolve.ts` (T004); skip unavailable entries and repeats of an already listed hymn id; return rows `{ hymnal, number, hymn: PublishedHymn, hymnalInfo?: PublishedHymnal }` — makes T007 pass
- [ ] T013 [US1] Record the shown hymn in `src/routes/recueils/[recueil]/[numero]/+page.svelte`: an `$effect` that, when `data.found` is set, calls `history.record({ hymnal: data.found.entry.hymnal, number: data.found.entry.number }, data.found.hymn.id)`; nothing when `data.found` is undefined. Must run on first load and on every previous/next/swipe navigation (the effect depends on `data.found`)
- [ ] T014 [US1] Create `src/lib/components/RecentHymns.svelte` (props: `rows` from `recentHymns`, `onclear`): a `section` labelled by an `h2.hb-overline` « Récemment consultés » with, in the heading row, a quiet button « Effacer » with `aria-label="Effacer les chants récents"`; a `ul.hb-list` (`aria-labelledby` the heading) of `a.hy-row` links to `hymnUrl(hymnal, number)` showing the reference tile (`hymnalInfo.abbreviations[0]` + number, same look as `HymnalList`/`HymnRef`) and the title via `titleIn(hymn, hymnal, number)` with `frenchSpaces`. Renders nothing when `rows` is empty
- [ ] T015 [US1] Wire US1 into `src/routes/+page.svelte`: derive `recent = recentHymns(data.catalog, $history)`; with an empty field, render `RecentHymns` in the main column inside `.mobile-only` after the help text, and in `.search__aside` above the keyboard tips; `onclear` calls `history.clear()`, focuses `input`, and sets a polite live message « Historique effacé » (reuse the existing `p.hb-sr[aria-live]` or add a second one). Adjust `.search__aside` spacing so the tips sit 24px below the list — makes T008 pass

**Checkpoint**: US1 complete and shippable on its own (MVP).

---

## Phase 4: User Story 2 - Jump to a recent collection (Priority: P2)

**Goal**: Up to 3 most recently changed collections on the empty search screen, plus « Tout le Répertoire ».

**Independent Test**: Seed four collections, open `/`, check three appear newest change first with name and count, then a link to `/repertoire`; with none, no block.

### Tests (write first)

- [ ] T016 [P] [US2] E2E tests in `tests/e2e/us11-recent-collections.spec.ts`: (1) `seedCollections` with four collections whose `updatedAt` differ (extend the helper in `tests/e2e/helpers.ts` with an optional `updatedAt` per collection if needed) → section « Collections » lists the three most recent, each with « n chants », then « Tout le Répertoire » linking to `/repertoire`; (2) clicking a row opens `/repertoire/<id>`; (3) with no collection, no « Collections » heading; (4) at 1280 px the section is in the side column, below « Récemment consultés » and above the keyboard tips

### Implementation

- [ ] T017 [US2] Create `src/lib/components/RecentCollections.svelte` (prop: `collections: Collection[]`): `section` labelled by `h2.hb-overline` « Collections »; `ul.hb-list` of `a.hy-row` to `resolve('/repertoire/[collection]', { collection: c.id })` with the bookmark icon, name and `hymnCountLabel(c.entries.length)` (same row as `src/routes/repertoire/+page.svelte`); then a link « Tout le Répertoire » to `resolve('/repertoire')`. Renders nothing when empty
- [ ] T018 [US2] Wire US2 into `src/routes/+page.svelte`: `recentCollections = byUpdatedDesc($repertoire.collections).slice(0, 3)` (from `src/lib/repertoire/model.ts` and `src/lib/repertoire/store.ts`); render `RecentCollections` after `RecentHymns` in both the mobile block and the desktop aside — makes T016 pass

**Checkpoint**: US1 and US2 work independently and together.

---

## Phase 5: User Story 3 - Learn how to search on a first visit (Priority: P3)

**Goal**: With no history and no collection, three example searches derived from the loaded catalog; tapping one runs it.

**Independent Test**: On a fresh browser with the sample content, `/` shows « Essayez » with three buttons; each fills the field and shows results.

### Tests (write first)

- [ ] T019 [P] [US3] Unit tests for `pickExamples` in `tests/unit/search-examples.test.ts` with the sample catalog: returns 3 examples `{ kind: 'number' | 'title' | 'lyrics', query }`, in that order; the number is `« <first abbreviation of the first hymnal by sortOrder that has hymns> <its first number> »` (e.g. `CE 1`); the title comes from a different hymn and is 2–5 words; the lyrics query is the first 3 words of the first verse of a third hymn, from a line that is not the title; the result is the same on every call; a catalog with 0 hymns gives `[]`, with 1 hymn gives only the number example; each query, run through `createEngine(catalog, indexJson).search({ query })`, returns at least one result
- [ ] T020 [P] [US3] Queries test in `tests/queries/examples.test.ts`: build `content/` with `buildData(CONTENT, { personalUse: true })` (as in `tests/queries/exo.test.ts`), run `pickExamples`, assert 3 examples and that each returns at least one result, with the expected hymn in the top 3 (SC-005)
- [ ] T021 [P] [US3] E2E tests in `tests/e2e/us12-search-examples.spec.ts`: (1) fresh browser → section « Essayez » with 3 buttons; (2) clicking each fills the search field with its text, focus stays in the field, results appear and the URL has `?q=`; browser back returns to the empty screen; (3) after opening one hymn, « Essayez » is gone; (4) with one seeded collection and no history, « Essayez » is gone; (5) the help sentence's example reference is `CE 1`, not hard-coded

### Implementation

- [ ] T022 [US3] Create `src/lib/search/examples.ts`: `export type SearchExample = { kind: 'number' | 'title' | 'lyrics'; query: string }` and pure `pickExamples(catalog: CatalogApi): SearchExample[]` following research R5 (deterministic; hymnals by `sortOrder`; three different hymns; skip what cannot be made) — makes T019 and T020 pass
- [ ] T023 [US3] Create `src/lib/components/SearchExamples.svelte` (props: `examples`, `onpick(query)`): `section` labelled by `h2.hb-overline` « Essayez »; one `button.hb-btn hb-btn--quiet` per example, text = query, `aria-label="Rechercher <query>"`; wraps on narrow screens. Renders nothing when empty
- [ ] T024 [US3] Wire US3 into `src/routes/+page.svelte`: `examples = pickExamples(data.catalog)`; show `SearchExamples` under the help text (main column, mobile and desktop) only when `recent.length === 0 && $repertoire.collections.length === 0`; `onpick` sets `query` and focuses `input` (the existing effect updates `?q=` and runs the search). Replace the hard-coded « CE 12 » in the help sentence with the number example's query when there is one, else keep the sentence without an example — makes T021 pass

**Checkpoint**: All three stories work; every device state shows at least one block (SC-003).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Extend `tests/e2e/a11y.spec.ts`: run axe on `/` in three states — fresh (examples), with history and collections (mobile and 1280 px), and in dark mode — no violations (SC-006, FR-014)
- [ ] T026 [P] Update the screen comment at the top of `src/routes/+page.svelte` (feature 006: start content replaces the hymnal list) and the `src/lib/history/` file headers to reference `specs/006-search-start-panel/`
- [ ] T027 Run `npm run check`, `npm run lint`, `npm test`, `npm run test:queries`, `npm run test:e2e`; fix any failure
- [ ] T028 Walk through `specs/006-search-start-panel/quickstart.md` manual scenarios 1–9 (phone width and desktop, light and dark, private window) and note the result in an « Implementation log » section at the end of this file

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks all stories
- **US1 (Phase 3)**: after Phase 2 (needs T003, T004)
- **US2 (Phase 4)**: after Phase 2 only. T018 edits the same file as T015; if US1 is not done, place `RecentCollections` where the contract says and add `RecentHymns` later
- **US3 (Phase 5)**: after Phase 2. Its visibility rule reads `recent` (US1) and collections (US2); without US1, treat `recent` as empty
- **Polish (Phase 6)**: after the stories you ship

### Within Each Story

- Tests first, failing; then schema → model → store → resolve → component → page wiring
- T009 → T010 → T011; T010 + T004 → T012; T011 → T013; T012 + T014 → T015
- T022 → T023 → T024

### Same-file constraints

- `src/routes/+page.svelte`: T003, T015, T018, T024, T026 — in that order, never in parallel

## Parallel Examples

### User Story 1

```text
T005 tests/unit/history-model.test.ts
T006 tests/unit/history-storage.test.ts
T007 tests/unit/history-resolve.test.ts
T008 tests/e2e/us10-recent-hymns.spec.ts
T009 src/lib/history/schema.ts
```

### Across stories, after Phase 2

```text
US1: T009–T014 (history module, RecentHymns)
US2: T016–T017 (e2e, RecentCollections)
US3: T019–T023 (pickExamples, SearchExamples)
then the page wiring T015 → T018 → T024 one after the other
```

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2: the duplicated list is gone.
2. Phase 3 (US1): recent hymns. Stop and validate with T008 and quickstart scenarios 2–4, 6–8. Shippable.

### Incremental Delivery

1. + US2: collections shortcut (small, independent).
2. + US3: examples for first visits; the help sentence stops hard-coding « CE 12 ».
3. Polish: a11y, full test run, manual pass in both themes and widths.

## Notes

- Tasks marked [P] touch different files and do not depend on unfinished tasks.
- Commit after each task or logical group; keep `main` untouched until the branch is reviewed.
- History is device-only; never send it anywhere (FR-010).
- Sample content facts used by the e2e tasks: CE has numbers 1, 2, 3, 5, 7, 8, 12, 12a, 20, 23; HE has 1, 2, 3, 3 bis, 7, 12, 13; 12 hymns in all, all public-domain. The hymn page's next button is labelled « Chant suivant : … ».
