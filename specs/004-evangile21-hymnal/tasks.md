---

description: "Task list for the Evangile21 hymnal"
---

# Tasks: Evangile21 Hymnal

**Input**: Design documents from `/specs/004-evangile21-hymnal/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R10), data-model.md, contracts/
(cli-add-pages.md, evangile21-adapter.md), quickstart.md

**Tests**: Included. The constitution (Principle V) requires automated tests for import,
normalisation and numbering. The adapter contract of feature 002 (rule 5) requires fixture tests
for every adapter.

**Organization**: Tasks are grouped by user story (US1–US4 of spec.md) so each story can be
built and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single project at the repository root. Importer code is in `scripts/import/`, import state in
`import/`, tests in `tests/import/`. Nothing in `src/` changes. Copy the patterns of the
existing `ecriture` adapter (`scripts/import/sources/ecriture.ts`,
`tests/import/adapters/ecriture.test.ts`, `tests/import/fixtures/ecriture/`), which is also an
unnumbered source with a pinned number table.

**Manual steps**: some tasks need the maintainer's browser (marked **[manual]**). The site
answers `403` to the importer (research R1); never request it from code or from the shell.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: folders and ignore rules

- [X] T001 Add `import/inbox/` to `.gitignore` under the "Raw pages downloaded by the importer" comment, so saved pages (copyrighted) are never committed
- [X] T002 [P] Create `tests/import/fixtures/evangile21/` with an empty `index.json` (`{}`) and a `README.md` stub titled "evangile21.thegospelcoalition.org fixtures" stating that pages are saved from a browser because the site blocks the importer (research R1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the `access` field and the `add-pages` subcommand. Every story needs the pages in
the cache, and nothing reaches the cache without these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for the foundation

- [X] T003 [P] Unit tests for saved pages in `tests/import/unit/saved-pages.test.ts`, using small HTML strings written in a temporary folder (see `tests/import/helpers/workspace.ts`). Cover:
  - the URL is read from `<!-- saved from url=(0065)https://… -->`, else `<link rel="canonical">`, else `<meta property="og:url">`;
  - the fragment is dropped;
  - refusals `no url`, `other host`, `challenge page` (`<title>Just a moment...</title>`) and `empty`;
  - outcomes `added`, `unchanged` (cache file mtime untouched) and `replaced`;
  - `*_files/` sub-folders are ignored;
  - `--dry-run` writes nothing;
  - the written `.meta.json` has `status: 200`, `etag: null`, `lastModified: null`, the `sha256` of the body, and a `retrievedAt` equal to the file's modification time as an ISO timestamp;
  - `createFetcher({ offline: true })` then reads the page back for that URL.
- [X] T004 [P] Schema test in `tests/import/unit/saved-pages.test.ts`: a source with `access: "saved-pages"` and one without `access` both pass `SourceConfigSchema`; `access: "browser"` fails ("`"fetch"` (default) or `"saved-pages"`. Any other value fails validation")
- [X] T005 [P] CLI test in `tests/import/unit/cli.test.ts`. For `add-pages`:
  - a missing `--source` exits `2`;
  - an unknown source exits `2`;
  - a missing folder exits `2`;
  - a folder where every file is refused exits `1`;
  - a usable folder exits `0` and prints the counts `added / replaced / unchanged / refused`.

### Implementation for the foundation

- [X] T006 Add the optional `access: z.enum(['fetch', 'saved-pages']).optional()` field to `SourceConfigSchema` in `scripts/import/store/state.ts`, documented as "absent = fetch". Keep key order stable so existing `import/sources.json` stays byte-identical.
- [X] T007 In `scripts/import/fetcher.ts`, export what `add-pages` needs to write the cache in the exact fetcher format: the `<sha1(url)>.html` / `.meta.json` path helpers for a cache folder, a `sha256` helper identical to the one the fetcher uses for `CachedMeta.sha256`, and `pageUrl` (already exported). Do not change fetcher behaviour.
- [X] T008 Create `scripts/import/saved-pages.ts` with `addSavedPages({ root, source, folder, dryRun })`, returning per-file outcomes and counts (contracts/cli-add-pages.md):
  - URL detection in order: comment, canonical, og:url. Parse the comment with `/<!-- saved from url=\(\d+\)(\S+?) -->/`.
  - Host check against the source `baseUrl`, and the refusal reasons.
  - Atomic writes with `writeTextAtomic` / `writeJsonStable` from `scripts/import/store/files.ts`.
  - `retrievedAt` = file mtime as an ISO timestamp.
  - A cached page with the same body is left `unchanged`.
  - No network access.
- [X] T009 Register the `add-pages --source <id> <folder> [--dry-run]` subcommand in `scripts/import/commands.ts` (positionals `[1, 1]`, `UsageError` for a missing or unknown source or a missing folder). Print one line per refused file, then the counts. Exit `0` if at least one file was usable, `1` if all were refused. `--json` prints the outcomes.
- [X] T010 In `scripts/import/pipeline/run.ts` (and the `run` command in `scripts/import/commands.ts`), make a source with `access: "saved-pages"` always run offline:
  - log `source <id>: saved pages only, no request is sent`;
  - do not require `HYMNIA_CONTACT` for it;
  - map the fetcher's "Page not in the cache (offline)" error to the failure reason `page not saved` (keep the URL in the report entry).
- [X] T011 Integration test in `tests/import/integration/saved-pages-run.test.ts`, with a stub adapter registered for a test source `access: "saved-pages"`, pages loaded with `addSavedPages`, and a `fetchImpl` that throws if called. Check that:
  - `run` without `--offline` sends no request and imports the hymns;
  - a page missing from the cache is skipped with reason `page not saved`;
  - more than 20% missing pages aborts the source and writes nothing;
  - a second run changes no file (byte-identical).
- [X] T012 Update `specs/002-hymnal-import/contracts/cli.md` (add the `add-pages` row and the `access` rule to "Behaviour guaranteed by `run`") and `specs/002-hymnal-import/contracts/import-files.md` (document the `access` field in the `sources.json` example), linking to `specs/004-evangile21-hymnal/contracts/cli-add-pages.md`
- [X] T013 Add a section "A site that blocks the importer: saved pages" to `scripts/import/sources/README.md`: set `access: "saved-pages"`, save pages from a browser into `import/inbox/<id>/`, run `npm run import -- add-pages --source <id> import/inbox/<id>`, then `run` as usual

**Checkpoint**: `npm run test:import` passes. Any source can now be fed from saved pages.

---

## Phase 3: User Story 1 - Import the Evangile21 hymnal (Priority: P1) 🎯 MVP

**Goal**: the Evangile21 songs are imported from the saved pages, with faithful lyrics, credits,
source URL and a stable number.

**Independent Test**: run the adapter tests on the fixtures, then `run --source evangile21` on
the saved pages. Every listed entry is imported or reported with a reason, and `check` passes.

### Pages and fixtures

- [X] T014 [US1] **[manual]** Save into `import/inbox/evangile21/`, from a browser:
  - the series page `https://evangile21.thegospelcoalition.org/series/chants-hymnes21/` (and any further list page);
  - all 44 song pages listed on it (the list is in the attached archive, and in research R4).

  Then run `npm run import -- add-pages --source evangile21 import/inbox/evangile21` (after T020/T021 exist) and resave any page refused as `challenge page`.
- [X] T015 [US1] Inspect the saved song pages and write the page structure and selectors in `tests/import/fixtures/evangile21/README.md`:
  - title element;
  - lyrics container;
  - download-link block and "Paroles :" header;
  - stanza labels in use ("Couplet N", "Refrain", "Pont", others);
  - credit lines and their labels;
  - what ends the lyrics (credits, embed, "Partager", commentary);
  - where the publication date is (`article:published_time`).

  List which entries hold no lyrics (articles about a song), and whether `/article/psaume-150/` and `/video/psaume-150/` have the same lyrics (research R6, R7).
- [X] T016 [US1] Copy into `tests/import/fixtures/evangile21/`, stripping `<script>`, `<style>`, inline SVG and `data:` URIs:
  - the series page as `listing-series.html`;
  - at least five song pages as `hymn-<slug>.html`: `roc-des-ages`, one with a chorus, one with credits, one with no credits if any exists, and both `psaume-150` pages as `hymn-psaume-150-article.html` and `hymn-psaume-150-video.html`;
  - one page that must fail, as `not-a-hymn.html` (an article about a song with no lyrics, or a song page with its lyrics removed by hand, saying so in the README).

  Fill `index.json` (file → `{ url, retrievedAt }`). Also keep one unstripped copy as `hymn-<slug>-full.html`, for the stripping test.

### Tests for User Story 1

- [X] T017 [P] [US1] Adapter tests in `tests/import/adapters/evangile21.test.ts`, on the fixtures (contracts/evangile21-adapter.md, "Tests"). Check that:
  - `listEntries` returns exactly the 44 song cards' paths, and none of the `featured_article_card` / `title_article_card` / `podcast_article_card` items;
  - `parseHymn` gives, for each fixture: the title, the section types and numbers, the first and last line, and the credits with their roles;
  - no extracted line contains "Téléchargements", "Partitions", "Accords", "Paroles :" or "Partager";
  - a trailing "(chant)" is removed from the title and counted in `strippedMarkup`;
  - an English original title in parentheses is kept;
  - the page author (e.g. "Philippe Viguier" from the card) is not a credit unless a labelled credit line names them;
  - `not-a-hymn.html` fails with reason `no lyrics`;
  - the stripped and full copies of the same page give the same result;
  - a challenge page fails with reason `challenge page`.
- [X] T018 [P] [US1] Numbering tests in `tests/import/adapters/evangile21.test.ts`, with small injected tables (`createEvangile21Adapter(numbers, skipped)`) and the listing fixture. Check that:
  - a pinned path gets its pinned number;
  - a skipped path yields no entry and logs its reason;
  - an unpinned path gets `max(number) + k` in list order, oldest first, and logs "not pinned yet";
  - removing a path from the listing leaves every other number unchanged;
  - asking for another hymnal throws.

### Implementation for User Story 1

- [X] T019 [US1] Add the hymnal to `content/hymnals.json`: `{ "id": "evangile21", "name": "Evangile21", "abbreviations": ["Evangile21", "E21"], "sortOrder": 10 }` ("Never reused", "First one is shown in results", "After the existing hymnals"). Keep the file's formatting.
- [X] T020 [US1] **[manual + edit]** Read Evangile 21's terms of use in a browser (legal notice / "À propos" / footer links). Add the source to `import/sources.json`:
  - `id: "evangile21"`;
  - `name: "Evangile 21 — evangile21.thegospelcoalition.org"`;
  - `baseUrl: "https://evangile21.thegospelcoalition.org"`;
  - `hymnals: ["evangile21"]`;
  - `minDelayMs: 1000`;
  - `terms`: url, French summary as for the other sources, `checkedAt` = date read;
  - `permission: "unknown"`;
  - `access: "saved-pages"`.
- [X] T021 [US1] Create `scripts/import/sources/evangile21.ts`, per contracts/evangile21-adapter.md and research R4–R7:
  - a header comment describing the site and the saved-pages access;
  - `EVANGILE21_BASE`, `EVANGILE21_SERIES_URL`;
  - `EVANGILE21_NUMBERS: { number: number; path: string }[]` and `EVANGILE21_SKIPPED: { path: string; reason: string }[]` (filled in T023);
  - `listEntries`: song cards only, follows `a.next.page-numbers`, path de-duplication, the numbering rules of data-model.md;
  - `parseHymn`, pure, using `cleanLine` and `mapCreditRole` from `./clean`:
    - title from `h1`, trailing "(chant)" removed;
    - stanzas after the download links / "Paroles :";
    - labels mapped: "Couplet N" → verse N; "Refrain"/"Chœur" → chorus; "Pont" → bridge; others → other. Labels are removed and counted;
    - repeated lines kept;
    - labelled credits; unknown labels go to `unknownCredits`;
    - reasons `no title`, `no lyrics`, `challenge page`;
  - `createEvangile21Adapter(numbers?, skipped?)`, then `registerAdapter(evangile21)`.
- [X] T022 [US1] Add `import './evangile21';` to `scripts/import/sources/all.ts`
- [X] T023 [US1] Fill `EVANGILE21_NUMBERS` and `EVANGILE21_SKIPPED` in `scripts/import/sources/evangile21.ts` from the 44 saved pages:
  - numbers 1…n follow the series list bottom to top (oldest first), with no gaps;
  - pages with no lyrics (T015) go to `EVANGILE21_SKIPPED` with the reason "no lyrics: article about the song";
  - `/video/psaume-150/` goes there with "same song as /article/psaume-150/" if T015 found the same lyrics; otherwise it keeps its own number (research R6).

  Add a comment that numbers are never changed or reused.
- [X] T024 [US1] Run `npm run import -- run --source evangile21 --hymnal evangile21 --dry-run --yes`, read `npm run import -- report`, and fix the adapter until:
  - every numbered entry is imported;
  - no "not pinned yet" line remains;
  - `strippedMarkup` and `unknownCredits` look right.

  Then run without `--dry-run`, and run `npm run import -- check`.
- [X] T025 [US1] Spot-check 10 imported hymns in `content/hymns/` against their saved pages (SC-002): lyrics identical, no download text, source URL and date present. Record the result in the fixtures README.

**Checkpoint**: `npm run test:import` and `npm run import -- check` pass; the Evangile21 hymns are
in `content/`.

---

## Phase 4: User Story 2 - Find Evangile21 songs in the app (Priority: P1)

**Goal**: the app finds, filters and shows Evangile21 songs like any other hymnal.

**Independent Test**: after `npm run data` in the personal-use build, number, title and lyrics
queries return the right Evangile21 song first. The hymnal filter offers Evangile21, and a song
can be added to a collection.

### Tests for User Story 2

- [X] T026 [P] [US2] Add Evangile21 queries — done in `tests/queries/evangile21.test.ts` instead of `tests/queries/reference-queries.json`, because that file runs on the sample hymnals only; the new test builds the real `content/` in personal-use mode:
  - `Evangile21 1` and `E21 1` → the hymn numbered 1;
  - `Evangile 21 1` → the same hymn;
  - the title `Sois seul ma vision` → its hymn;
  - one line of its lyrics → its hymn.

  Use the real hymn ids from T024, and the existing format of that file.
- [X] T027 [P] [US2] Add a query-parser case to `tests/unit/query-parser.test.ts`:
  - `Evangile21 12` resolves to `{ kind: 'hymnal-number', hymnal: 'evangile21', number: '12' }`, with a resolver built from the new hymnal entry;
  - `Evangile21` alone gives `kind: 'text'` (the known quirk of research R9; documents it, no fix).

### Implementation for User Story 2

- [X] T028 [US2] Run `HYMNIA_PERSONAL_USE=1 npm run test:queries` (it runs `npm run data` first) and `npm run test`; fix data issues only (no change in `src/`).
- [ ] T029 [US2] **[manual]** Check in the running personal-use app (mobile width, light and dark):
  - search `Evangile21 1`;
  - filter by Evangile21;
  - open "Roc des âges" (Evangile21) and check sections, credits and the source link;
  - add the song to a collection and reopen it.

  Note the result in `specs/004-evangile21-hymnal/quickstart.md` under step 4.

**Checkpoint**: Evangile21 is fully usable in the personal-use build.

---

## Phase 5: User Story 3 - Keep the hymnal stable over time (Priority: P2)

**Goal**: re-runs change nothing when the source is unchanged. A new song gets the next number
and existing numbers never move. Changed text goes through review, and removed songs are
flagged, not deleted.

**Independent Test**: the integration test below, then a real re-run with `git status content/`
clean.

### Tests for User Story 3

- [X] T030 [P] [US3] Integration test in `tests/import/integration/evangile21-rerun.test.ts`, in a temporary workspace, using the evangile21 fixtures loaded with `addSavedPages`:
  1. Import, then run again: no content file changes.
  2. Add a listing variant with one extra song card at the top (newest), plus its page: it gets `max + 1`, and every other hymn keeps its entry number.
  3. Change one line in a saved song page and reload it with `add-pages` (`replaced`): a pending change is created and content is unchanged.
  4. Remove a song card from the listing: that hymn is reported "missing at source" and its file is kept.

### Implementation for User Story 3

- [X] T031 [US3] Run `npm run import -- run --source evangile21 --hymnal evangile21 --yes` a second time on the real cache and confirm `git status content/ import/state/` shows no change (SC-004). Fix any instability (key order, dates) in the adapter only.
- [X] T032 [US3] Add a "Re-running Evangile21" note to `tests/import/fixtures/evangile21/README.md`:
  1. Save the new song pages and the series page again.
  2. Run `add-pages`.
  3. Run `run`.
  4. Pin each "not pinned yet" song in `EVANGILE21_NUMBERS` in the same commit as its content.

**Checkpoint**: re-runs are safe; numbers are pinned.

---

## Phase 6: User Story 4 - Link Evangile21 songs to the same hymn in other hymnals (Priority: P3)

**Goal**: Evangile21 songs with the same text as a hymn of another hymnal are merged into it.
New translations stay separate and are proposed as possible duplicates.

**Independent Test**: after the import alongside the existing hymnals, the duplicates list and
the merges match a short list of known pairs.

### Tests for User Story 4

- [X] T033 [P] [US4] Add Evangile21 pairs to `tests/import/reference-duplicates.json`, in its existing format, after reading `npm run import -- duplicates`:
  - at least one pair that must stay distinct: a new translation of a classic hymn found in another hymnal, e.g. "Roc des âges" or "Mon Dieu plus près de toi";
  - any pair that is truly the same text.

### Implementation for User Story 4

- [X] T034 [US4] Review `npm run import -- duplicates` for Evangile21 and record each decision with `npm run import -- merge <a> <b>` or `npm run import -- distinct <a> <b>` (stored in `import/decisions/merges.json`). Then rerun `npm run test:import` (reference duplicates).

**Checkpoint**: no duplicate Evangile21 hymn in search results; decisions recorded.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T035 [P] Run the full checks: `npm run test:import`, `npm run test`, `npm run test:queries`, `npm run check`, `npm run lint`. Also `npm run import -- check` and `npm run data`. Fix any failure.
- [X] T036 [P] Confirm that a non-personal build publishes 0 Evangile21 hymns (SC-005): run `npm run data` without `HYMNIA_PERSONAL_USE` and check that no `evangile21` entry is published.
- [ ] T037 [P] Update the source list in the constitution's "Contenu et sources" section with Evangile 21 (evangile21.thegospelcoalition.org, Evangile21, saved pages). Do it through `/speckit-constitution` as a PATCH-level clarification, if the maintainer agrees.
- [X] T038 Run the quickstart (`specs/004-evangile21-hymnal/quickstart.md`) end to end and fix any step that does not match reality (folder names, counts, messages)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks all stories: the pages reach the cache only
  through `add-pages`.
- **US1 (Phase 3)**: after Foundational. T014 (saving pages) can start as soon as T001 is done,
  but loading them needs T009 and T020.
- **US2 (Phase 4)**: after US1 (needs imported hymns and their ids).
- **US3 (Phase 5)**: after US1 (T030 can be written in parallel with T024–T025, using the
  fixtures).
- **US4 (Phase 6)**: after US1. Independent of US2 and US3.
- **Polish (Phase 7)**: after the stories you deliver.

### Within each phase

- Tests (T003–T005, T017–T018, T030, T033) are written before or alongside the code they cover,
  and must fail first.
- T006 before T008/T010; T007 before T008; T008 before T009 and T011.
- T015 → T016 → T017; T021 → T022 → T023 → T024 → T025.

### Parallel Opportunities

- T001 ∥ T002.
- T003 ∥ T004 ∥ T005 (test files), then T006 ∥ T007.
- T017 ∥ T018 (same file, but independent describe blocks; split if working in parallel), and
  ∥ T019 ∥ T020.
- T026 ∥ T027; T030 ∥ T026; T033 ∥ T030.
- T035 ∥ T036 ∥ T037.

## Parallel Example: User Story 1

```text
# After T016 (fixtures saved):
Task: "Adapter extraction tests in tests/import/adapters/evangile21.test.ts"      (T017)
Task: "Add the evangile21 hymnal to content/hymnals.json"                          (T019)
Task: "Add the evangile21 source to import/sources.json"                           (T020)
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 and Phase 2: `add-pages` and saved-pages runs, tested on stubs.
2. Phase 3: save the pages, write the adapter, pin the numbers, import.
3. **Stop and validate**: `check`, a spot check of 10 hymns. Evangile21 is in `content/`.

### Incremental Delivery

1. US1 → the hymnal exists (MVP).
2. US2 → verified in the app; search reference queries extended.
3. US3 → re-run safety proven and documented.
4. US4 → cross-hymnal duplicates decided.

## Notes

- Never send a request to evangile21.thegospelcoalition.org from code or the shell (research R1).
- Commit the content, `import/state/links.json` and the pinned table together.
- Pages in `import/inbox/` and `import/cache/` are copyrighted and stay out of git; fixtures are
  stripped and kept minimal.
