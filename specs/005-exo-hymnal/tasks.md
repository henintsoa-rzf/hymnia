---

description: "Task list for the Exo hymnal"
---

# Tasks: Exo Hymnal

**Input**: Design documents from `/specs/005-exo-hymnal/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R8), data-model.md,
contracts/cdl-exo-listing.md, quickstart.md

**Tests**: Included. Principle V of the constitution requires automated tests for import and
numbering. Feature 002's adapter contract requires fixture tests for every adapter change.

**Organization**: Tasks are grouped by user story (US1–US3 of spec.md). The spec's edge case
"An Exo song already in another hymnal" is handled by feature 002's matching, which is checked
in US1 (T014) and US2 (T018).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US3)

## Path Conventions

This is a single project at the repository root:
- importer code is in `scripts/import/`;
- import state is in `import/`;
- tests are in `tests/import/` (adapter) and `tests/queries/` (real content).

Nothing in `src/` or in `scripts/import/pipeline/` changes. The whole code change is in
`scripts/import/sources/cdl.ts`.

Patterns to copy:
- **Pinned numbers**: `EVANGILE21_NUMBERS` and `numberEntries()` in
  `scripts/import/sources/evangile21.ts`, including the log wording "is not pinned yet".
- **Real-content query tests**: `tests/queries/evangile21.test.ts`.

**Network**: only the importer's fetcher, or a throwaway script that uses `createFetcher` from
`scripts/import/fetcher.ts`, may request conducteurdelouange.com. The fetcher follows
robots.txt, sends its User-Agent and waits at least 1 s between requests. Put any throwaway
script in `~/9-scratch/`, never in the repository root or `~`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: fixtures for the Exo list and Exo song pages

- [X] T001 Fetch the fixtures with a throwaway script `~/9-scratch/exo-fixtures.ts`, run with `npx tsx`. It uses `createFetcher` from `scripts/import/fetcher.ts`, with a temporary `cacheDir` and `minDelayMs: 1500`. Fetch:
  - `https://www.conducteurdelouange.com/chants/recueil/6`, `?page=2` and `?page=3`, saved as `tests/import/fixtures/cdl/listing-exo-page1.html`, `listing-exo-page2.html` and `listing-exo-page3.html`;
  - `/698` and `/1320`, saved as `tests/import/fixtures/cdl/hymn-698.html` and `hymn-1320.html`.

  Strip `<script>` and `<style>` as for the other cdl fixtures. Check that the three list pages really overlap: 60 rows, fewer distinct `/<id>` links. Then delete `tests/import/fixtures/cdl/listing-exo.html`.
- [X] T002 Update `tests/import/fixtures/cdl/index.json`:
  - add the 5 new files with their `url` and `retrievedAt`;
  - remove `listing-exo.html`.
- [X] T003 Look at how "(Refrain)" is rendered in `tests/import/fixtures/cdl/hymn-698.html` (research R4): either as a `.chordpro-comment` label or as a `.chordpro-verse` line. Write the answer in the README (T004). The answer decides T008.
- [X] T004 [P] Update `tests/import/fixtures/cdl/README.md`:
  - add table rows for the 5 new fixtures and say why each is there:
    - the overlapping Exo list pages, with their row and distinct counts;
    - `/698`: two authors and the "(Refrain)" marker;
    - `/1320`: one author, "Refrain" then "Couplet";
  - remove the `listing-exo.html` row;
  - in "Page structure", replace "Exo `/chants/recueil/6` (no numbers)" with: no numbers, overlapping pages, pinned ids (feature 005).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the `cdl` adapter keeps unnumbered rows for hymnals that have a pinned table. US1
and US3 both depend on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 In `scripts/import/sources/cdl.ts`:
  - add `export type PinnedId = { number: number; id: number }`;
  - add `export const CDL_PINNED: Record<string, PinnedId[]> = { exo: [] }` (it is filled in T011);
  - add `exo: [6]` to `CDL_VOLUMES`;
  - make `createCdlAdapter(volumes = CDL_VOLUMES, pinned = CDL_PINNED)` take the pinned tables as a second parameter, so tests can inject them.

  Update the header comment: unnumbered hymnals get pinned made-up numbers (specs/005-exo-hymnal research R2).
- [X] T006 In `scripts/import/sources/cdl.ts`, change `parseListing(html, hymnal, log, unnumbered: boolean)`:
  - when `unnumbered` is true, keep rows whose link is `/<digits>` even without `#number`, and return them as `{ id: number, url }`;
  - when it is false, behaviour is unchanged ("has no number in the listing: skipped").

  Keep the pagination detection (`.pagination a` → `lastPage`) as it is.

**Checkpoint**: the existing `npm run test:import` cdl tests still pass, except the old Exo test, which T007 replaces.

---

## Phase 3: User Story 1 - Import the Exo songs (Priority: P1) 🎯 MVP

**Goal**: the Exo hymnal holds the 50 songs of the site's Exo list. Each song has one pinned
number, faithful lyrics without chords or repeat markers, and its authors.

**Independent Test**: `npm run test:import` passes on the new fixtures. Then
`npm run import -- run --source cdl --hymnal exo --dry-run --yes` reports 50 songs, 0 failures
and no "not pinned yet" line.

### Tests for User Story 1

- [X] T007 [P] [US1] In `tests/import/adapters/cdl.test.ts`, replace the test "skips listing items with no number, and says so" with Exo listing tests. Map `${BASE}/chants/recueil/6`, `?page=2` and `?page=3` to the three `listing-exo-page*.html` fixtures, and use an injected pinned table. Assert that:
  - `createCdlAdapter({ exo: [6] }, { exo: table }).listEntries('exo', ctx)` returns one entry per distinct id, as `{ hymnal: 'exo', number: '<n>', url: \`${BASE}/<id>\` }`, sorted by number;
  - each id gets its pinned number;
  - the log contains `exo: 60 rows, <distinct> songs listed`, with the real counts from T001;
  - an id missing from the table gets `max(number) + 1`, and `exo <n>: /<id> is not pinned yet: add it to CDL_PINNED` is logged;
  - a JEM row without a number is still skipped (keep one assertion of the old behaviour on `listing-jem1-page1.html`, or on a row edited in memory).
- [X] T008 [P] [US1] In `tests/import/adapters/cdl.test.ts`, add parse tests for the Exo pages:
  - `hymn-698.html` with `ref('1', '698', 'exo')`:
    - title "Si tu veux le louer";
    - sections in source order, with "Couplet" verses numbered 1, 2…;
    - no line equal to `(Refrain)`;
    - credits `[{ name: 'CHRIS CHRISTENSEN' …}, { name: 'THIERRY OSTRINI' …}]` with role `unspecified` (use the exact casing found in T001);
    - `strippedMarkup['repeat-marker'] ≥ 1`, but only if T003 found a `.chordpro-verse` line;
  - `hymn-1320.html`: title "Dieu de l'impossible", a `chorus` section before the verses, 1 credit.
- [X] T009 [P] [US1] In `tests/import/adapters/cdl.test.ts`, update the test "knows the volumes of each hymnal it covers". Expect `CDL_VOLUMES` to equal `{ jem: [1, 3, 5, 44], adf: [19], cd: [11], exo: [6] }`, and `cdl.hymnals` in `import/sources.json` to equal its keys. Add a test on the shipped `CDL_PINNED.exo`:
  - numbers are unique and ≥ 1;
  - ids are unique;
  - when sorted by id, the numbers are exactly 1..N ("the initial table is in ascending id order, with numbers 1..N and no gap");
  - every hymnal key of `CDL_PINNED` is in `CDL_VOLUMES`.

### Implementation for User Story 1

- [X] T010 [US1] In `scripts/import/sources/cdl.ts`, change `listEntries`. For a hymnal with a `pinned` table:
  1. read all pages with `parseListing(…, true)`;
  2. deduplicate by id, the first row seen wins;
  3. log `<hymnal>: <rows> rows, <distinct> songs listed`;
  4. number the ids as in the contract: pinned number, otherwise `max(pinned) + k` in ascending id order, logging `<hymnal> <n>: /<id> is not pinned yet: add it to CDL_PINNED`;
  5. return the entries sorted by number.

  Hymnals without a table keep the current code path exactly. The union with pinned ids that are not listed comes in T020 (US3).
- [X] T011 [US1] Build `CDL_PINNED.exo` in `scripts/import/sources/cdl.ts` (research R3):
  1. run the Exo listing about 3 times with a throwaway `~/9-scratch/exo-ids.ts`, using `createFetcher` with an empty temporary cache each time, and `?page=1..3`. Also try `?sort=` / `?order=` parameters if the page offers them;
  2. take the union of the ids;
  3. write the table as `{ number, id }` rows in ascending id, numbered 1..N, with a comment giving the date and the number of distinct ids found.

  Record the final count in `tests/import/fixtures/cdl/README.md`.
- [X] T012 [US1] In `parseCdlHymn` in `scripts/import/sources/cdl.ts`, add repeat markers (research R4). A label or line that matches `/^\(\s*(refrain|chorus|bis)(\s*x?\s*\d+)?\s*\)$/iu` after `cleanLine` is not lyrics:
  - if it is a `.chordpro-verse` line: skip it, close the open section (`open = null`) and `count('repeat-marker')`;
  - if it is a `.chordpro-comment` label: set no label and `count('repeat-marker')`.

  Run the JEM/AdF/CD parse tests to confirm that their output is unchanged.
- [X] T013 [US1] In `import/sources.json`, add `"exo"` to the `hymnals` of the `cdl` source, keeping `terms`, `permission: "unknown"` and `minDelayMs` unchanged. Add one line to `scripts/import/sources/README.md` under cdl: "Unnumbered hymnals (Exo): made-up numbers pinned in `CDL_PINNED` by site id, oldest first; pinned ids are always listed."
- [X] T014 [US1] Run `npm run import -- run --source cdl --hymnal exo --dry-run --yes`, then `npm run import -- report`. Check:
  - the rows and distinct count;
  - 0 failures;
  - no "not pinned yet" line;
  - the new and merged counts (most merges are expected with JEM; research R6).

  Fix any parse problem found, then run for real: `npm run import -- run --source cdl --hymnal exo --yes`. Review the possible duplicates with `npm run import -- duplicates` and record decisions as feature 002 describes. Commit `content/hymns/`, `import/state/links.json` and `import/reports/` together.
- [X] T015 [US1] Run `npm run import -- check` (text matches the cache, schemas are valid). Spot-check 10 Exo songs against the site for SC-002: lyrics identical, no chord or "(Refrain)" line, authors and source URL present.

**Checkpoint**: Exo is filled; US1 is done and can be shown in the personal-use build.

---

## Phase 4: User Story 2 - Find Exo songs in the app (Priority: P1)

**Goal**: "Exo 12", titles and lyrics find Exo songs; the hymnal filter offers Exo; Exo songs
that are also in JEM show both references.

**Independent Test**: `npm run test:queries` passes with the new Exo query file.

- [X] T016 [P] [US2] Create `tests/queries/exo.test.ts` on the real content, mirroring `tests/queries/evangile21.test.ts`:
  - search `Exo <n>` for 5 numbers taken from `CDL_PINNED.exo`, plus `Dieu de l'impossible`, `Si tu veux le louer` and 3 lyric fragments copied from imported Exo hymns: the expected hymn id comes first (SC-003, 10 queries);
  - with `hymnals: ['exo']`, every result has an `exo` reference;
  - at least one hymn has both an `exo` and a `jem` entry.

  Use the hymn ids produced by T014.
- [X] T017 [US2] Rights check in `tests/queries/exo.test.ts` (SC-005): every Exo hymn has rights status `unconfirmed`, and none is in a non-personal build. Follow the matching assertion in `tests/queries/evangile21.test.ts`.
- [ ] T018 [US2] Run `npm run test:queries`. Then, in the personal-use build (`HYMNIA_PERSONAL_USE=1`, `npm run data`, `npm run dev`), check:
  - the hymnal filter offers Exo;
  - an Exo + JEM song shows both references;
  - an Exo song can be added to a collection and reopened.

  Check on a mobile viewport, in light and dark modes (constitution, workflow).

**Checkpoint**: US1 + US2 make Exo fully usable.

---

## Phase 5: User Story 3 - Keep Exo numbers stable over time (Priority: P2)

**Goal**: re-runs change nothing; a reordered or partial list does not shift or drop numbers;
new songs take the next free number.

**Independent Test**: the adapter tests below pass. A second real run leaves `content/` and
`import/state/` unchanged.

- [X] T019 [P] [US3] In `tests/import/adapters/cdl.test.ts`, add stability tests with an injected table:
  - **reordered list**: map page 1 to `listing-exo-page3.html` and page 3 to `listing-exo-page1.html`. Every id keeps the same number as in the normal order;
  - **pinned id not listed**: add `{ number: 99, id: 9999 }` to the table. It is returned as `{ hymnal: 'exo', number: '99', url: \`${BASE}/9999\` }`, and `exo 99: /9999 pinned but not in the list this run` is logged;
  - **new id**: one id removed from the table gets `max + 1`, and no other number changes.
- [X] T020 [US3] In `listEntries` in `scripts/import/sources/cdl.ts`, add the union (research R3, contract rule 4): after numbering the listed ids, add every pinned id that was not listed, with its pinned number, and log `<hymnal> <n>: /<id> pinned but not in the list this run`. Then sort by number.
- [X] T021 [US3] Run `npm run import -- run --source cdl --hymnal exo --yes` a second time, then `git status --short content/ import/state/`. Nothing should change (SC-004). Also run `npm run import -- run --source cdl --hymnal jem --dry-run --yes`: no change to JEM hymns, so numbered hymnals are unaffected.

**Checkpoint**: all stories are done.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] Fill in the real figures in `specs/005-exo-hymnal/quickstart.md`, section 2: rows, distinct songs, new and merged counts, and duplicates decided.
- [X] T023 [P] Add a line to `specs/002-hymnal-import/research.md` R13: "Exo has no numbers" → "Exo: made-up numbers pinned by site id (feature 005)".
- [X] T024 Run the full suites: `npm run test:import`, `npm run test:queries`, `npm test` and `npm run lint`. Then run `npm run build`. Delete the throwaway scripts in `~/9-scratch/` (done: `exo-fixtures.mts`, `exo-ids.mts` and the probing helpers).

---

## Implementation notes (2026-11-13)

- **T003/T012**: "(Refrain)" is a `.chordpro-verse` line, but it is a section **label**, not a
  repeat marker. T012 was implemented as `section-marker`: the line labels or retypes its
  section (research R4). T008 tests that.
- **T011**: the site has **60** Exo songs. The listing shows 50; 10 were found by checking page
  ids (research R3). All 60 are pinned. The union in T020 is what imports the hidden 10.
- **T021**: the JEM/AdF/CD listings are not in the cache, so the offline dry run could not run.
  Instead, `check` re-parsed every cached JEM/AdF/CD page with the new parser, and all 2,200
  texts are unchanged.
- **Emmanuel**: JEM 260 and JEM 1179 (Exo 4) were an older possible-duplicate pair. Exo 4 has the
  lyrics of JEM 1179 ("Reçois l'adoration… Emmanuel"), and JEM 260 is another song, so the pair
  was recorded as `distinct`.
- **T018**: the manual browser check (filter, Exo + JEM references, collection, mobile, light
  and dark) is **not done**. `tests/queries/exo.test.ts` covers the data side.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T004)**: T001 → T002, T003. T004 can run in parallel once T001 and T003 are done.
- **Foundational (T005–T006)**: T005 → T006. These block every story.
- **US1 (T007–T015)**: the tests T007–T009 come first and fail; then T010 → T011 → T012 → T013 → T014 → T015.
- **US2 (T016–T018)**: needs the imported content from T014.
- **US3 (T019–T021)**: T019 and T020 need only Phase 2 and T010, so they can run in parallel with US2. T021 needs T014.
- **Polish (T022–T024)**: after all stories.

### Story dependencies

- US1 is the MVP and depends on nothing but Phase 2.
- US2 depends on US1's data (it is a check of features 001 and 003 on the new content).
- US3's code (T019–T020) is independent of US1's import. Its verification (T021) re-runs the import from US1.

### Within each story

- Write the tests before the code and make sure they fail.
- `CDL_PINNED.exo` (T011) must be final before the first real run (T014). After that, numbers never change.

## Parallel Example: User Story 1

```text
# After Phase 2, write the three test tasks together (same file, separate describe blocks):
T007 Exo listing tests          tests/import/adapters/cdl.test.ts
T008 Exo page parse tests       tests/import/adapters/cdl.test.ts
T009 Volumes / pinned table     tests/import/adapters/cdl.test.ts

# While US1's real import runs (T014), US3's code can be written:
T019 Stability tests            tests/import/adapters/cdl.test.ts
T020 Union with pinned ids      scripts/import/sources/cdl.ts
```

## Implementation Strategy

### MVP first (US1)

1. Phase 1: fixtures.
2. Phase 2: adapter accepts unnumbered rows.
3. US1: tests, numbering, pinned table, repeat markers, source entry, import.
4. **Stop and validate**: `check`, 10 songs compared by hand, Exo visible in the personal-use build.

### Incremental delivery

1. US1: Exo songs in the app.
2. US2: search and rights checks locked in by `tests/queries/exo.test.ts`.
3. US3: stability against the site's paging. Do it before the hymnal is used in collections.
   T020 should land before or with the first real run when possible, so that a second run
   cannot mark songs as missing.

### Notes

- Commit after each phase. Commit messages end with the project's co-author line.
