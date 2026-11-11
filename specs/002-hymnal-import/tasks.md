---

description: "Task list for the hymnal import pipeline"
---

# Tasks: Import Hymnals from Source Sites

**Input**: Design documents from `/specs/002-hymnal-import/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (cli.md,
source-adapter.md, import-files.md), quickstart.md

**Tests**: Included. The constitution (Principle V) requires automated tests for import and
normalisation. The spec's success criteria (SC-002 to SC-005) and the quickstart rely on them.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

## Path Conventions

Single project at the repository root (see plan.md). Importer code is in `scripts/import/`,
import state in `import/`, and tests in `tests/import/`. It reuses feature 001's
`src/lib/domain/schema.ts` and `src/lib/search/normalize.ts`.

**Depends on feature 001**: Phases 1 and 2 of `specs/001-hymnal-browse-search/tasks.md`
(T001–T017) must be done first, because they create `package.json`, the Zod schemas,
`normalize.ts` and `scripts/build-data.ts` (npm script `data`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, configuration and import folders

- [ ] T001 Check that feature 001's foundation exists: `package.json`, `src/lib/domain/schema.ts`, `src/lib/search/normalize.ts`, `scripts/build-data.ts`, `vitest.config.ts`. If any is missing, stop and complete `specs/001-hymnal-browse-search/tasks.md` T001–T017 first
- [ ] T002 Add dependencies to `package.json`: runtime `cheerio`, `robots-parser`, `diff`; dev `@types/diff`. Add the npm script `"import": "tsx scripts/import/cli.ts"`
- [ ] T003 [P] Add a Vitest project `import` covering `tests/import/**/*.test.ts` in `vitest.config.ts`, so that `npm test -- tests/import` runs only the importer tests
- [ ] T004 [P] Check that `.gitignore` contains `.env` and `import/cache/` (both already added) and keep them when feature 001 T007 adds its own entries. Create `.env.example` with `HYMNIA_CONTACT=` and a comment explaining it is the contact address sent to source sites
- [ ] T005 [P] Create the import state skeleton following `specs/002-hymnal-import/contracts/import-files.md`: `import/decisions/rights.json` (`[]`), `import/decisions/merges.json` (`[]`), `import/decisions/source-priority.json` (`{}`), `import/state/links.json` (`[]`), `import/pending/.gitkeep`, `import/reports/.gitkeep`
- [ ] T006 [P] Create `import/sources.json` with the four sources, keys sorted. `cdl` "Conducteur de louange — conducteurdelouange.com" (`https://www.conducteurdelouange.com`, hymnals `adf`, `jem`, `exo`, `cd`, `atg`, `minDelayMs` 1000); `jemaf` "JEM — jemaf.fr" (`https://jemaf.fr`, hymnals `jem`, `adf`, `atg`, `minDelayMs` 1000); `psalmodie` "Chorale Psalmodie — psalmodie.ch" (`https://psalmodie.ch`, hymnal `psalmodie`, `minDelayMs` 10000); `ecriture` "Écritures — ecrituremusique.com" (`https://www.ecrituremusique.com`, hymnal `ecriture`, `minDelayMs` 1000). For all four: `permission: "unknown"` and `terms: { "url": null, "summary": "À vérifier", "checkedAt": "2026-11-11" }`
- [ ] T007 [P] Add the real hymnals to `content/hymnals.json` next to the sample ones, with `sortOrder` after them: `jem` "J'aime l'Éternel" [`JEM`]; `adf` "Ailes de la Foi" [`AdF`]; `atg` "À Toi la Gloire" [`ATG`]; `cd` "Célébrons Dieu" [`CD`]; `exo` "Exo" [`Exo`]; `ecriture` "Écritures" [`Écritures`]; `psalmodie` "Chorale Psalmodie" [`Psalmodie`]. Follow the rules "Unique, lowercase slug" and "Unique across all hymnals once normalised". Run `npm run data` to check the build still passes

**Checkpoint**: `npm run import` starts (even if it only prints usage) and `npm test -- tests/import` runs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks used by every story: stable files, state, fingerprint, polite
fetcher, adapter interface, CLI frame.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for the foundation

> Write these tests first and make sure they fail before implementing.

- [ ] T008 [P] Unit tests for file writing in `tests/import/unit/files.test.ts`: JSON output has sorted keys, 2-space indentation and a final newline; strings are NFC; writing the same value twice gives byte-identical files; an interrupted write (simulated by an error thrown after the temporary file is written) leaves the previous file intact and no temporary file behind
- [ ] T009 [P] Unit tests for the fingerprint in `tests/import/unit/fingerprint.test.ts`: same title and sections give the same fingerprint, even with different whitespace or NFD vs NFC; a one-word change, a section-type change or a verse-number change gives a different fingerprint; the output starts with `sha256:`
- [ ] T010 [P] Unit tests for import state in `tests/import/unit/state.test.ts`: valid fixtures load. Each of these is rejected: a source with `minDelayMs` < 1000; `permission` outside `unknown`, `requested`, `granted`, `refused`; a source `hymnals` id missing from `content/hymnals.json`; a rights decision whose `target` does not exist; two rights decisions for the same (scope, target); a merge decision with `a` not less than `b`; a link `status` outside `active`, `missing`; two links pointing to the same (hymnal, number) with different `hymnId`s ("a clash is a conflict")
- [ ] T011 [P] Unit tests for the polite fetcher in `tests/import/unit/fetcher.test.ts`, with a mocked `fetch` and clock: it fetches `robots.txt` once per host and refuses disallowed URLs; it waits `max(minDelayMs, Crawl-delay)` between requests to one host (10 s for `Crawl-delay: 10`); it sends `User-Agent: HymniaImporter/<version> (+contact: <HYMNIA_CONTACT>)`; it retries 429 and 5xx responses at most 3 times with exponential backoff and follows `Retry-After`; it writes `<sha1(url)>.html` and `.meta.json` (url, retrievedAt, status, etag, lastModified, sha256) under the cache folder; it sends `If-None-Match`/`If-Modified-Since` and uses the cached page on 304; in offline mode it reads only the cache and fails clearly on a cache miss; without `HYMNIA_CONTACT` it refuses to make any request
- [ ] T012 [P] Unit tests for hymn ids in `tests/import/unit/ids.test.ts`: `slug("À toi la gloire")` is `a-toi-la-gloire`; a taken id falls back to `<slug>-<hymnal>-<number>` (e.g. `a-toi-la-gloire-jem-245`); existing ids are never changed

### Implementation for the foundation

- [ ] T013 Add the optional field `alternateSources: Source[]` (default `[]`) to the Hymn schema in `src/lib/domain/schema.ts`, and document it in `specs/001-hymnal-browse-search/contracts/content-schema.md` and `specs/001-hymnal-browse-search/data-model.md` ("Optional, default `[]`. Other sources that provide the same hymn after a merge"). Existing content must still pass `npm run data`
- [ ] T014 [P] Stable, atomic JSON writing in `scripts/import/store/files.ts`: `writeJsonStable(path, value)` (sorted keys, 2 spaces, final newline, NFC strings, write to `<path>.tmp-<pid>` then `rename`), `readJson(path)`, `removeFile(path)`. Makes T008 pass
- [ ] T015 [P] Fingerprint in `scripts/import/pipeline/fingerprint.ts`: SHA-256 of `normalize(title)` plus, for each section, type, number and normalised lines, returned as `sha256:<hex>`. Uses `src/lib/search/normalize.ts`. Makes T009 pass
- [ ] T016 [P] Hymn ids in `scripts/import/pipeline/ids.ts`: `slug(title)` and `newHymnId(title, hymnal, number, existingIds)`. Makes T012 pass
- [ ] T017 Zod schemas and loaders for the import records in `scripts/import/store/state.ts`, following `specs/002-hymnal-import/data-model.md`. **SourceConfig**: `id` slug; `minDelayMs` "≥ 1000"; `permission` enum `unknown`, `requested`, `granted`, `refused`; `terms` `{url, summary, checkedAt}`. **Link**: (`source`, `hymnal`, `number`) "Unique together"; `status` enum `active`, `missing`; `acceptedFingerprint`; `lastSeenAt` ISO date. **RightsDecision**: `scope` enum `source`, `hymnal`, `hymn`; `basis` enum `permission`, `licence`, `public-domain`, `refused`; "Only one decision is allowed per (scope, target)". **MergeDecision**: "The pair is stored with `a < b`"; `decision` enum `merge`, `distinct`. **SourcePriority**: map from hymnal id to source ids. **PendingChange**. Also `loadState()` / `saveState()` built on `files.ts`, and the cross-file validation rules 2 and 3 from data-model.md. Makes T010 pass
- [ ] T018 [P] Environment loading in `scripts/import/env.ts`: call `process.loadEnvFile('.env')` when the file exists; `getContact()` returns `HYMNIA_CONTACT` or throws "HYMNIA_CONTACT is not set (see .env.example)"
- [ ] T019 Polite cached fetcher in `scripts/import/fetcher.ts`, as described in research R3 and R4: robots.txt checks with `robots-parser` (cached per host), a per-host delay of `max(minDelayMs, Crawl-delay)`, the identifying User-Agent from `env.ts`, retries on 429/5xx (at most 3, exponential backoff, `Retry-After`), a disk cache under `import/cache/<source>/`, conditional requests, and an offline mode. Exposes `createFetcher({ source, offline, cacheDir, now })`. Makes T011 pass (depends on T014, T018)
- [ ] T020 [P] Adapter types and registry in `scripts/import/sources/types.ts` (`SourceAdapter`, `EntryRef`, `ParseResult`, `AdapterContext`, `RawHymn`, exactly as in `specs/002-hymnal-import/contracts/source-adapter.md` and data-model.md: RawHymn `title` "Non-empty", `sections` "≥ 1, chords removed, NFC", `credits` "May be empty", `strippedMarkup` counts) and `scripts/import/sources/index.ts` (`getAdapter(id)`, which throws on unknown ids)
- [ ] T021 [P] Shared text cleanup in `scripts/import/sources/clean.ts`: `cleanLine` (trim, collapse inner whitespace, turn non-breaking spaces into spaces, NFC; never reword), `stripChords(lines)` (remove `[Am]`-style tokens and lines made only of chord symbols, return the counts per kind for `strippedMarkup`), and `mapCreditRole(label)` to `lyrics`, `music`, `translation`, `arrangement` or `null` (unknown, reported). Add unit tests in `tests/import/unit/clean.test.ts`
- [ ] T022 CLI frame in `scripts/import/cli.ts`: load `env.ts`; parse with `node:util parseArgs`; dispatch subcommands (empty handlers that report "not implemented" for now); exit codes `0` success, `1` validation or run failure, `2` usage error; human output on stdout, errors on stderr, `--json` for machine output, following `specs/002-hymnal-import/contracts/cli.md`

**Checkpoint**: The foundation tests pass. `npm run import -- --help` lists the subcommands.

---

## Phase 3: User Story 1 - Import one hymnal from one source (Priority: P1) 🎯 MVP

**Goal**: Import one hymnal from conducteurdelouange.com (`cdl`) into `content/` files that are
faithful to the source, valid, traceable and unpublished (`rights: "unconfirmed"`).

**Independent Test**: An offline `run` against saved `cdl` pages writes schema-valid hymn files
whose text matches the pages, with source URL, date and `rights: "unconfirmed"`. A page that
cannot be parsed is skipped and reported.

### Tests for User Story 1

- [ ] T023 [US1] Save `cdl` test fixtures in `tests/import/fixtures/cdl/`: one hymnal listing page, plus at least 5 hymn pages, including one with numbered verses and a chorus, one with no credits, one with chord markings in the text, and one page that must fail to parse (for example a non-hymn page). Fetch them by hand, one at a time, at least 1 s apart, with the User-Agent from research R3. Add `tests/import/fixtures/cdl/README.md` listing each file's source URL and retrieval date. Inspect the HTML and note in that README the selectors to use for the title, number, sections and credits
- [ ] T024 [P] [US1] Adapter tests in `tests/import/adapters/cdl.test.ts`: `listEntries` on the listing fixture returns the expected (number, URL) pairs; `parseHymn` returns the exact title, sections in source order with `type`/`number` ("`null` for chorus and bridge"), credits with mapped roles, chords removed and counted; the failure fixture returns `{ ok: false, reason }` with a short, stable reason; no output line differs from the source text except for whitespace and NFC
- [ ] T025 [P] [US1] Integration test in `tests/import/integration/run-import.test.ts`, run offline on a temporary copy of `content/` and `import/` with the `cdl` fixtures as cache. Checks: one file per parsed hymn in `content/hymns/` that passes the feature 001 schema; each has `entries` [{hymnal, number}], `source` {name, url, retrievedAt}, `rights: "unconfirmed"`, and empty `corrections`; a link is written for each hymn in `import/state/links.json`; the failing page is listed under `skipped` with its reason and URL; `--dry-run` writes only the report; when more than 20% of pages fail, nothing is written for the source and its status is `aborted`; a source with `permission: "refused"` makes no request; `permission: "unknown"` without `--yes` stops after a warning

### Implementation for User Story 1

- [ ] T026 [US1] `cdl` adapter in `scripts/import/sources/cdl.ts`, following `specs/002-hymnal-import/contracts/source-adapter.md` and the selectors noted in T023: `listEntries(hymnal, ctx)` lists the hymnal's (number, URL) pairs using `ctx.fetch` only; `parseHymn(html, ref)` is a pure function built with `cheerio` and `clean.ts`. Register it in `scripts/import/sources/index.ts`. Makes T024 pass
- [ ] T027 [US1] First version of reconciliation in `scripts/import/pipeline/reconcile.ts`: for a parsed RawHymn with no link, create the hymn (`ids.ts`), its entry, source, empty credits/corrections and `rights: "unconfirmed"`, and add a Link (`status: "active"`, `acceptedFingerprint`, `lastSeenAt`). Return the planned writes without writing them
- [ ] T028 [P] [US1] Report generation in `scripts/import/report.ts`: build the run report following data-model.md (`runId` `YYYYMMDD-HHMMSS`, `startedAt`, `finishedAt`, `args`, `perSource.status` one of `ok`, `aborted`, `unreachable`, `skipped-permission`, `perHymnal` counts and lists) and write `import/reports/<runId>.json` plus a readable `import/reports/<runId>.md` in French
- [ ] T029 [US1] Run orchestration in `scripts/import/pipeline/run.ts`, guaranteeing points 1–6 of the `run` section of contracts/cli.md: check permission (`refused` stops; `unknown` warns and needs `--yes`); list entries; fetch and parse every page, keeping results in memory; apply the 20% failure threshold for each source; plan writes with `reconcile.ts`; validate each hymn against the feature 001 schema and never write one that fails; write with `files.ts` (unless `--dry-run`); always write the report, even when the run is aborted. Supports `--source`, repeatable `--hymnal`, `--offline`, `--dry-run` and `--yes`. Makes T025 pass
- [ ] T030 [US1] Implement the `run` and `report [<runId>]` subcommands in `scripts/import/cli.ts`; `report` prints the latest report by default
- [ ] T031 [US1] Record the terms of use of conducteurdelouange.com in `import/sources.json` (`terms.url`, `terms.summary`, `terms.checkedAt`). This is done by the maintainer after reading the site's legal page; set `permission` to `requested` once a request has been sent

**Checkpoint**: Quickstart step 2 works. A real `npm run import -- run --source cdl --hymnal jem --yes` imports JEM, unpublished.

---

## Phase 4: User Story 2 - Re-run an import safely (Priority: P1)

**Goal**: Re-runs are byte-identical when nothing changed. They add new hymns, turn changed
source text into pending changes, flag hymns missing at the source, and never overwrite manual
work.

**Independent Test**: Import, make a manual correction, then re-run twice (unchanged source,
then one modified page). Check: no file changes, then a pending change with a diff, and the
correction kept.

### Tests for User Story 2

- [ ] T032 [P] [US2] Unit tests for reconciliation in `tests/import/unit/reconcile.test.ts`: same fingerprint means no write; new fingerprint means a PendingChange and no content write; an entry no longer listed means link `status: "missing"` and no deletion; a missing entry listed again means `active`; a (hymnal, number) linked to a different hymn means a conflict and no write
- [ ] T033 [P] [US2] Integration test in `tests/import/integration/rerun.test.ts`, offline on temporary copies. Checks: a second run on the same cache leaves `content/` and `import/state/` byte-identical (SC-003); a hymn page added to the listing is created and reported as `new`; changing one word in a cached page creates `import/pending/<hymnId>--cdl.json` with a unified diff and leaves `content/` unchanged; `accept` writes the new text and updates `acceptedFingerprint`; `reject` keeps the text and updates the fingerprint; a manual correction (edited line plus a `corrections` entry) on another hymn survives all of this (SC-004); a page removed from the listing is reported as `missing` and its hymn file still exists

### Implementation for User Story 2

- [ ] T034 [US2] Extend `scripts/import/pipeline/reconcile.ts` with the linked cases from research R6: unchanged (no write, update `lastSeenAt` only if the date changed, otherwise nothing), changed (create a PendingChange), missing (set link `status: "missing"`), back (`active`), and conflicts. Never rewrite `title`, `sections`, `credits` or `corrections` of an existing hymn outside `accept`. Makes T032 pass
- [ ] T035 [US2] Pending changes in `scripts/import/pipeline/pending.ts`: write `import/pending/<hymnId>--<source>.json` (`hymnId`, `source`, `hymnal`, `number`, `detectedAt`, `oldFingerprint`, `newFingerprint`, a unified `diff` of the title and section lines made with `diff`, and the `proposed` RawHymn); `accept(hymnId, source?)` updates the hymn's title, sections and credits, sets `source.retrievedAt`, keeps `corrections`, updates the link fingerprint and deletes the pending file; `reject` updates only the link fingerprint and deletes the pending file
- [ ] T036 [US2] Implement the `pending`, `accept <hymnId> [--source <id>]` and `reject <hymnId> [--source <id>]` subcommands in `scripts/import/cli.ts`; `pending` prints each diff in colour when stdout is a terminal
- [ ] T037 [US2] Add `new`, `changed`, `unchanged`, `missing` and `conflicts` to the report in `scripts/import/report.ts`, and add the reconciliation steps to `scripts/import/pipeline/run.ts`. Makes T033 pass

**Checkpoint**: Quickstart step 3 works. Re-running the import is safe.

---

## Phase 5: User Story 3 - Recognise the same hymn across hymnals and sources (Priority: P2)

**Goal**: A hymn found in several hymnals or on several sites is stored once with several
entries. Doubtful pairs are proposed for review, never merged silently.

**Independent Test**: Import two hymnals that share hymns. Each shared hymn exists once with
both entries, and a pair with the same title but different lyrics is listed, not merged.

### Tests for User Story 3

- [ ] T038 [P] [US3] Unit tests for matching in `tests/import/unit/match.test.ts`: equal normalised titles with lyrics Jaccard on word 3-grams ≥ 0.85 means `merge`; equal titles with low similarity, or similarity ≥ 0.5 alone, means `possible duplicate`; anything else means distinct; a `distinct` decision in `merges.json` overrides an automatic merge; a `merge` decision forces a merge; candidates come from the title index and the first-line 3-gram index (not every pair)
- [ ] T039 [P] [US3] Integration test in `tests/import/integration/duplicates.test.ts`, offline with small fixture caches for two hymnals and two sources. Checks: a shared hymn becomes one file with two `entries`; the reference text comes from the source ranked first in `import/decisions/source-priority.json`, and the other source is in `alternateSources`; a same-title, different-lyrics pair stays as two files and is listed under `possibleDuplicates`; after `distinct a b`, a re-run no longer proposes the pair; after `merge a b`, `b`'s entries move to `a`, `b`'s links point to `a`, and `b`'s file is removed
- [ ] T040 [US3] Reference list for SC-005 in `tests/import/reference-duplicates.json`: at least 30 hymns known to appear in several hymnals (with their hymnal + number pairs) and at least 10 known distinct pairs with similar titles. Built by the maintainer from the JEM and ATG imports. Add `tests/import/reference-duplicates.test.ts`, which runs matching on the cached pages and checks that ≥ 90% are auto-merged and that no known distinct pair is merged

### Implementation for User Story 3

- [ ] T041 [US3] Matching in `scripts/import/pipeline/match.ts`, following research R7: normalise with `src/lib/search/normalize.ts`; build an index of normalised titles and an index of first-line 3-grams; compute Jaccard on lyric word 3-grams; return `merge`, `possible`, or `distinct`, applying `merges.json` decisions first. Keep the thresholds (0.85, 0.5) as named constants. Makes T038 pass
- [ ] T042 [US3] Merge operation in `scripts/import/pipeline/merge.ts`: `mergeHymns(a, b)` merges entries into `a`, adds `b`'s source to `a.alternateSources`, keeps `a`'s text unless `source-priority.json` ranks `b`'s source higher for the hymnal, re-points `b`'s links to `a`, deletes `content/hymns/<b>.json`, and records the decision in `import/decisions/merges.json` (stored with `a < b`)
- [ ] T043 [US3] Call matching in `scripts/import/pipeline/reconcile.ts` for RawHymns with no link: on `merge`, attach a new entry (and the alternate source) to the existing hymn instead of creating one; on `possible`, create the hymn and record the pair; add `autoMerged` and `possibleDuplicates` to `scripts/import/report.ts`. Makes T039 pass
- [ ] T044 [US3] Implement the `duplicates`, `merge <hymnIdA> <hymnIdB>` and `distinct <hymnIdA> <hymnIdB>` subcommands in `scripts/import/cli.ts`; `duplicates` lists undecided pairs with title, hymnal + number and the similarity score
- [ ] T045 [US3] Tune the thresholds against `tests/import/reference-duplicates.json` (T040). Record the final values and the measured scores in `specs/002-hymnal-import/research.md` under R7

**Checkpoint**: Quickstart step 4 works. Shared hymns are not duplicated.

---

## Phase 6: User Story 4 - Review an import and confirm rights (Priority: P2)

**Goal**: The maintainer reads a complete report and records rights decisions per source,
hymnal or hymn. Hymn `rights` fields follow those decisions, and only covered hymns are
published.

**Independent Test**: After an import, record a `permission` decision for one hymnal, run
`npm run data`, and check that exactly that hymnal's hymns (plus any `public-domain` hymn) are
published.

### Tests for User Story 4

- [ ] T046 [P] [US4] Unit tests for rights computation in `tests/import/unit/rights.test.ts`: no decision gives `unconfirmed`; a hymnal `permission` or `licence` decision gives `confirmed` for its hymns; a hymn `public-domain` decision gives `public-domain` even if the hymnal has no decision; precedence is hymn, then hymnal, then source; a `refused` decision gives `unconfirmed` even with a broader `permission`; a hymn in two hymnals is `confirmed` if either hymnal is covered
- [ ] T047 [P] [US4] Integration test in `tests/import/integration/rights.test.ts`: `rights set --scope hymnal --target jem --basis permission` updates only the `rights` field of JEM hymns (other fields byte-identical); `npm run data` on that content publishes JEM hymns and excludes the others (SC-006); a later run that adds a JEM hymn writes it as `confirmed` and lists it under `rightsInherited`; a `--target` that does not exist exits with code `1`

### Implementation for User Story 4

- [ ] T048 [US4] Rights computation in `scripts/import/pipeline/rights.ts`, following the "Derived values" section of data-model.md: `computeRights(hymn, links, decisions)` returns `confirmed`, `public-domain` or `unconfirmed`; `applyRights(content, decisions)` rewrites only the `rights` field of the hymns whose value changes. Makes T046 pass
- [ ] T049 [US4] Use `rights.ts` in `scripts/import/pipeline/reconcile.ts` and `scripts/import/pipeline/run.ts`, so that new hymns get the inherited value (FR-006) and are listed under `rightsInherited` in the report
- [ ] T050 [US4] Implement `rights set --scope <source|hymnal|hymn> --target <id> --basis <permission|licence|public-domain|refused> [--date YYYY-MM-DD] --note "<text>"` (the date defaults to today; it replaces any decision with the same scope and target; it then calls `applyRights`) and `rights list` (decisions with the number of hymns each one covers) in `scripts/import/cli.ts`. Makes T047 pass
- [ ] T051 [US4] Complete the Markdown report in `scripts/import/report.ts` with all FR-018 sections, one table per hymnal (imported, new, changed, unchanged, skipped with reason and URL, missing, possible duplicates, conflicts, no credits, rights inherited, removed chord markings), plus a summary of the rights status (published / not published) per hymnal

**Checkpoint**: Quickstart step 5 works. Publishing is controlled by recorded decisions only.

---

## Phase 7: User Story 5 - Add a new source or hymnal (Priority: P3)

**Goal**: The three remaining sources are added the same way, each as one adapter, one config
entry and fixtures, with no change in `src/`. A broken source does not affect the others.

**Independent Test**: Each new adapter passes its fixture tests, and an offline run imports its
hymnal. `git diff --stat src/` is empty for this phase.

### Tests for User Story 5

- [ ] T052 [P] [US5] Integration test in `tests/import/integration/isolation.test.ts`: with one adapter forced to fail on every page, a run over two sources writes the healthy source's hymns and marks only the broken one `aborted`; an unknown `--source` exits with code `2`
- [ ] T053 [P] [US5] Save `jemaf` fixtures in `tests/import/fixtures/jemaf/` (listing page plus at least 5 hymn pages, the same kinds as T023, and a `README.md` with URLs, dates and selectors), then write `tests/import/adapters/jemaf.test.ts` with the same checks as T024
- [ ] T054 [P] [US5] Save `psalmodie` fixtures in `tests/import/fixtures/psalmodie/`, waiting at least 10 s between requests (`Crawl-delay: 10`), with a `README.md`; then write `tests/import/adapters/psalmodie.test.ts` with the same checks as T024
- [ ] T055 [P] [US5] Save `ecriture` fixtures in `tests/import/fixtures/ecriture/` (do not use `/search` or `/api/`, which robots.txt disallows), with a `README.md`; then write `tests/import/adapters/ecriture.test.ts` with the same checks as T024

### Implementation for User Story 5

- [ ] T056 [P] [US5] `jemaf` adapter in `scripts/import/sources/jemaf.ts` (chords and MP3 links on the pages are ignored, per FR-007), registered in `scripts/import/sources/index.ts`. Makes T053 pass
- [ ] T057 [P] [US5] `psalmodie` adapter in `scripts/import/sources/psalmodie.ts`, registered in `scripts/import/sources/index.ts`. Makes T054 pass
- [ ] T058 [P] [US5] `ecriture` adapter in `scripts/import/sources/ecriture.ts`, registered in `scripts/import/sources/index.ts`. Makes T055 pass
- [ ] T059 [US5] Make sure `scripts/import/pipeline/run.ts` catches each source's errors (unreachable, adapter exception) and marks that source `unreachable` or `aborted` without stopping the others. Makes T052 pass
- [ ] T060 [P] [US5] "How to add a source" guide in `scripts/import/sources/README.md`: add an entry to `import/sources.json` (with terms and permission), save fixtures politely, write the adapter following `specs/002-hymnal-import/contracts/source-adapter.md`, register it, run the tests, and do a dry-run import. Target: under 30 minutes for a source already understood (SC-007)
- [ ] T061 [US5] Set the default source order for shared hymnals in `import/decisions/source-priority.json` (e.g. `jem`: [`jemaf`, `cdl`]; `adf`: [`jemaf`, `cdl`]; `atg`: [`jemaf`, `cdl`]), after comparing a few hymns from both sources

**Checkpoint**: All four sources import. Adding a source does not change `src/`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T062 `check` subcommand in `scripts/import/check.ts`, wired into `scripts/import/cli.ts`. It works with no network: it validates `import/` with `state.ts`, validates `content/` with the feature 001 schema, checks validation rules 1–4 from data-model.md, and checks that each linked hymn's lyrics match the cached source after re-parsing, apart from whitespace and NFC, unless a `corrections` entry explains the difference (FR-004). Add `tests/import/integration/check.test.ts`
- [ ] T063 [P] Mention `.env` / `HYMNIA_CONTACT` loading and the exit codes in `specs/002-hymnal-import/contracts/cli.md`, and add an "Importing hymnals" section to the project `README.md` pointing to `specs/002-hymnal-import/quickstart.md`
- [ ] T064 [P] Performance check in `tests/import/integration/perf.test.ts`: processing 1,000 cached hymns (synthetic fixtures; extraction, matching and writing) takes under 1 minute (plan, Performance Goals)
- [ ] T065 After the first real import of JEM and ATG, run feature 001's reference queries (`npm run test:queries`) and the build (`npm run data`) on the new content, and record any search regression in `specs/002-hymnal-import/research.md`
- [ ] T066 Run every step of `specs/002-hymnal-import/quickstart.md` and fix any difference between what the guide says and what happens

---

## Dependencies & Execution Order

### Phase Dependencies

- **Feature 001 Phases 1–2**: required before this feature starts (T001)
- **Setup (Phase 1)**: T001 first; T003–T007 in parallel after T002
- **Foundational (Phase 2)**: depends on Setup; blocks every story
- **US1 (Phase 3)**: depends on Foundational; the MVP
- **US2 (Phase 4)**: depends on US1 (it extends `reconcile.ts`, `run.ts`, `report.ts`)
- **US3 (Phase 5)**: depends on US1; can run in parallel with US2 if `reconcile.ts` edits are coordinated (T043 after T034)
- **US4 (Phase 6)**: depends on US1; independent of US2 and US3 apart from shared files (`reconcile.ts`, `report.ts`, `cli.ts`)
- **US5 (Phase 7)**: depends on US1. Its adapters (T053–T058) can start as soon as the foundation and one adapter example (T026) exist
- **Polish (Phase 8)**: after the desired stories. T065 needs real imports and T040 needs real data

### Within Each User Story

- Tests are written first and must fail before implementation
- Fixtures before adapter tests, and adapter tests before adapters
- `pipeline/*` before `run.ts`, and `run.ts` before CLI subcommands
- Tasks in the same file (`reconcile.ts`, `report.ts`, `cli.ts`) run one after another

### Parallel Opportunities

- Setup: T003, T004, T005, T006, T007
- Foundational tests: T008–T012; implementation: T014, T015, T016, T018, T020, T021
- US1: T024 and T025 (after T023); T028 alongside T026/T027
- US2: T032 and T033
- US3: T038 and T039
- US4: T046 and T047
- US5: the three adapters (T053+T056, T054+T057, T055+T058) are fully independent; T052 and T060 also run in parallel

---

## Parallel Example: User Story 5

```bash
# Three independent sources, one per worker:
Task: "T053 + T056 jemaf fixtures, tests and adapter in scripts/import/sources/jemaf.ts"
Task: "T054 + T057 psalmodie fixtures, tests and adapter in scripts/import/sources/psalmodie.ts"
Task: "T055 + T058 ecriture fixtures, tests and adapter in scripts/import/sources/ecriture.ts"
```

## Parallel Example: Foundational

```bash
Task: "T008 tests/import/unit/files.test.ts"
Task: "T009 tests/import/unit/fingerprint.test.ts"
Task: "T010 tests/import/unit/state.test.ts"
Task: "T011 tests/import/unit/fetcher.test.ts"
Task: "T012 tests/import/unit/ids.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Feature 001 Phases 1–2, then Phase 1 (Setup) and Phase 2 (Foundational)
2. Phase 3 (US1): import JEM from conducteurdelouange.com
3. **Stop and check**: quickstart step 2. The content is imported, valid and unpublished
4. Nothing is published yet. That is expected until rights are recorded (US4)

### Incremental Delivery

1. US1: one hymnal imported (MVP)
2. US2: re-runs are safe, so imports can be repeated
3. US4: rights recorded, so the first hymnal can be published
4. US3: second hymnal without duplicates
5. US5: remaining sources, one at a time

US4 may come before US3 if publishing one hymnal sooner matters more than adding the second.

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies
- Fixture pages are copyrighted: keep only the few needed for tests, and never commit
  `import/cache/`
- Every request to a source site goes through `scripts/import/fetcher.ts`, never `fetch`
  directly
- Commit after each task or logical group, and stop at any checkpoint to check the story on its
  own
