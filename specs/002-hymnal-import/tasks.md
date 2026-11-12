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

**Depends on features 001 and 003** (both implemented): this feature reuses `package.json`, the
Zod schemas, `normalizeText`/`tokenize` and `scripts/build-data.ts` (npm script `data`) from
001, and changes how 003 stores collection entries (Phase 2, "Protect saved collections").

**Updated 2026-11-11** after `/speckit-analyze` on features 001 and 003: test command (T003),
`.env.example` (T004), JSON format (T008, T014), strict schemas (T013), function names
(T015, T051), the "Protect saved collections" tasks (T023–T032), merge redirects (T049, T052),
the sample hymnals (T062) and `check` (T073). Tasks were renumbered.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, configuration and import folders

- [X] T001 Check that feature 001's foundation exists: `package.json`, `src/lib/domain/schema.ts`, `src/lib/search/normalize.ts`, `scripts/build-data.ts`, `vitest.config.ts`. If any is missing, stop and complete `specs/001-hymnal-browse-search/tasks.md` T001–T017 first
- [X] T002 Add dependencies to `package.json`: runtime `cheerio`, `robots-parser`, `diff`; dev `@types/diff`. Add the npm script `"import": "tsx scripts/import/cli.ts"`. *(Done: `diff` 9 ships its own types, so `@types/diff` was not added.)*
- [X] T003 Add a Vitest project `import` covering `tests/import/**/*.test.ts` in `vitest.config.ts`, with the same `$lib` alias as the `unit` project, and the npm script `"test:import": "vitest run --project import"` in `package.json`. Leave `"test"` (`--project unit`) unchanged: `npm test -- tests/import` would not run this project
- [X] T004 [P] Create `.env.example` with `HYMNIA_CONTACT=` and a comment explaining it is the contact address sent to source sites. `.gitignore` already ignores `.env`, `.env*` and `import/cache/`, with the exception `!.env.example`: check that `git check-ignore .env.example` prints nothing and `git check-ignore .env` prints `.env`
- [X] T005 [P] Create the import state skeleton following `specs/002-hymnal-import/contracts/import-files.md`: `import/decisions/rights.json` (`[]`), `import/decisions/merges.json` (`[]`), `import/decisions/source-priority.json` (`{}`), `import/state/links.json` (`[]`), `import/pending/.gitkeep`, `import/reports/.gitkeep`
- [X] T006 [P] Create `import/sources.json` with the four sources, in the format of `specs/002-hymnal-import/contracts/import-files.md` (tabs, keys in schema order). `cdl` "Conducteur de louange — conducteurdelouange.com" (`https://www.conducteurdelouange.com`, hymnals `adf`, `jem`, `exo`, `cd`, `atg`, `minDelayMs` 1000); `jemaf` "JEM — jemaf.fr" (`https://jemaf.fr`, hymnals `jem`, `adf`, `atg`, `minDelayMs` 1000); `psalmodie` "Chorale Psalmodie — psalmodie.ch" (`https://psalmodie.ch`, hymnal `psalmodie`, `minDelayMs` 10000); `ecriture` "Écritures — ecrituremusique.com" (`https://www.ecrituremusique.com`, hymnal `ecriture`, `minDelayMs` 1000). For all four: `permission: "unknown"` and `terms: { "url": null, "summary": "À vérifier", "checkedAt": "2026-11-11" }`
- [X] T007 [P] Add the real hymnals to `content/hymnals.json` next to the sample ones, with `sortOrder` after them: `jem` "J'aime l'Éternel" [`JEM`]; `adf` "Ailes de la Foi" [`AdF`]; `atg` "À Toi la Gloire" [`ATG`]; `cd` "Célébrons Dieu" [`CD`]; `exo` "Exo" [`Exo`]; `ecriture` "Écritures" [`Écritures`]; `psalmodie` "Chorale Psalmodie" [`Psalmodie`]. Follow the rules "Unique, lowercase slug" and "Unique across all hymnals once normalised". Run `npm run data` to check the build still passes. *(Done: hymnals with no published hymn are now left out of `getHymnals()` (lists, filter), but stay known to search and labels, so the app does not show "JEM · 0 chants"; tests in `tests/unit/catalog.test.ts` and `engine-number.test.ts`.)*

**Checkpoint**: `npm run import` starts (even if it only prints usage) and `npm test -- tests/import` runs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks used by every story: stable files, state, fingerprint, polite
fetcher, adapter interface, CLI frame.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for the foundation

> Write these tests first and make sure they fail before implementing.

- [X] T008 [P] Unit tests for file writing in `tests/import/unit/files.test.ts`: JSON output uses tab indentation, keeps keys in the order of the value given (the schema order), and ends with a newline, matching the existing `content/*.json` files byte for byte when re-written unchanged; strings are NFC; writing the same value twice gives byte-identical files; an interrupted write (simulated by an error thrown after the temporary file is written) leaves the previous file intact and no temporary file behind
- [X] T009 [P] Unit tests for the fingerprint in `tests/import/unit/fingerprint.test.ts`: same title and sections give the same fingerprint, even with different whitespace or NFD vs NFC; a one-word change, a section-type change or a verse-number change gives a different fingerprint; the output starts with `sha256:`
- [X] T010 [P] Unit tests for import state in `tests/import/unit/state.test.ts`: valid fixtures load. Each of these is rejected: a source with `minDelayMs` < 1000; `permission` outside `unknown`, `requested`, `granted`, `refused`; a source `hymnals` id missing from `content/hymnals.json`; a rights decision whose `target` does not exist; two rights decisions for the same (scope, target); a merge decision with `a` not less than `b`; a link `status` outside `active`, `missing`; two links pointing to the same (hymnal, number) with different `hymnId`s ("a clash is a conflict")
- [X] T011 [P] Unit tests for the polite fetcher in `tests/import/unit/fetcher.test.ts`, with a mocked `fetch` and clock: it fetches `robots.txt` once per host and refuses disallowed URLs; it waits `max(minDelayMs, Crawl-delay)` between requests to one host (10 s for `Crawl-delay: 10`); it sends `User-Agent: HymniaImporter/<version> (+contact: <HYMNIA_CONTACT>)`; it retries 429 and 5xx responses at most 3 times with exponential backoff and follows `Retry-After`; it writes `<sha1(url)>.html` and `.meta.json` (url, retrievedAt, status, etag, lastModified, sha256) under the cache folder; it sends `If-None-Match`/`If-Modified-Since` and uses the cached page on 304; in offline mode it reads only the cache and fails clearly on a cache miss; without `HYMNIA_CONTACT` it refuses to make any request
- [X] T012 [P] Unit tests for hymn ids in `tests/import/unit/ids.test.ts`: `slug("À toi la gloire")` is `a-toi-la-gloire`; a taken id falls back to `<slug>-<hymnal>-<number>` (e.g. `a-toi-la-gloire-jem-245`); existing ids are never changed

### Implementation for the foundation

- [X] T013 In `src/lib/domain/schema.ts`: add `alternateSources: z.array(SourceSchema).default([])` to `HymnSchema` ("Optional, default `[]`. Other sources that provide the same hymn after a merge"), and switch every content schema (`HymnalSchema`, `SectionSchema`, `HymnalEntrySchema`, `CreditSchema`, `SourceSchema`, `CorrectionSchema`, `HymnSchema`) from `z.object` to `z.strictObject`, so unknown or misspelt fields fail the build. `buildCatalog` in `scripts/build-data.ts` does **not** copy `alternateSources` (not shown in the app), so `PublishedHymn` is unchanged. Add to `tests/unit/build-data.test.ts`: a hymn with an unknown field (`"credit"`) is rejected; a hymn with `alternateSources` is accepted. Document both changes in `specs/001-hymnal-browse-search/contracts/content-schema.md` and `specs/001-hymnal-browse-search/data-model.md`. Existing content must still pass `npm run data` *(Done: `alternateSources` is `.optional()` rather than `.default([])`, so files the importer does not need to change stay byte-identical.)*
- [X] T014 [P] Stable, atomic JSON writing in `scripts/import/store/files.ts`: `writeJsonStable(path, value)` (`JSON.stringify(value, null, '\t')` on a value already parsed by its Zod schema, so keys follow the schema order; final newline; NFC strings; write to `<path>.tmp-<pid>` then `rename`), `readJson(path)`, `removeFile(path)`. Makes T008 pass
- [X] T015 [P] Fingerprint in `scripts/import/pipeline/fingerprint.ts`: SHA-256 of `normalizeText(title)` plus, for each section, type, number and `normalizeText` of each line, returned as `sha256:<hex>`. Uses `normalizeText` from `src/lib/search/normalize.ts`. Makes T009 pass *(Done differently: the fingerprint ignores only whitespace and NFC/NFD, not punctuation, case or accents, so a source correcting "Eternel" → "Éternel" becomes a pending change. Recorded in data-model.md and research R6.)*
- [X] T016 [P] Hymn ids in `scripts/import/pipeline/ids.ts`: `slug(title)` and `newHymnId(title, hymnal, number, existingIds)`. Makes T012 pass
- [X] T017 Zod schemas and loaders for the import records in `scripts/import/store/state.ts`, following `specs/002-hymnal-import/data-model.md`. **SourceConfig**: `id` slug; `minDelayMs` "≥ 1000"; `permission` enum `unknown`, `requested`, `granted`, `refused`; `terms` `{url, summary, checkedAt}`. **Link**: (`source`, `hymnal`, `number`) "Unique together"; `status` enum `active`, `missing`; `acceptedFingerprint`; `lastSeenAt` ISO date. **RightsDecision**: `scope` enum `source`, `hymnal`, `hymn`; `basis` enum `permission`, `licence`, `public-domain`, `refused`; "Only one decision is allowed per (scope, target)". **MergeDecision**: "The pair is stored with `a < b`"; `decision` enum `merge`, `distinct`. **SourcePriority**: map from hymnal id to source ids. **PendingChange**. Also `loadState()` / `saveState()` built on `files.ts`, and the cross-file validation rules 2 and 3 from data-model.md. Makes T010 pass
- [X] T018 [P] Environment loading in `scripts/import/env.ts`: call `process.loadEnvFile('.env')` when the file exists; `getContact()` returns `HYMNIA_CONTACT` or throws "HYMNIA_CONTACT is not set (see .env.example)"
- [X] T019 Polite cached fetcher in `scripts/import/fetcher.ts`, as described in research R3 and R4: robots.txt checks with `robots-parser` (cached per host), a per-host delay of `max(minDelayMs, Crawl-delay)`, the identifying User-Agent from `env.ts`, retries on 429/5xx (at most 3, exponential backoff, `Retry-After`), a disk cache under `import/cache/<source>/`, conditional requests, and an offline mode. Exposes `createFetcher({ source, offline, cacheDir, now })`. Makes T011 pass (depends on T014, T018) *(Done: `createFetcher` returns `fetchPage(url)` → `{ body, meta, fromCache }` and `fetch(url)` → body, for adapters.)*
- [X] T020 [P] Adapter types and registry in `scripts/import/sources/types.ts` (`SourceAdapter`, `EntryRef`, `ParseResult`, `AdapterContext`, `RawHymn`, exactly as in `specs/002-hymnal-import/contracts/source-adapter.md` and data-model.md: RawHymn `title` "Non-empty", `sections` "≥ 1, chords removed, NFC", `credits` "May be empty", `strippedMarkup` counts) and `scripts/import/sources/index.ts` (`getAdapter(id)`, which throws on unknown ids)
- [X] T021 [P] Shared text cleanup in `scripts/import/sources/clean.ts`: `cleanLine` (trim, collapse inner whitespace, turn non-breaking spaces into spaces, NFC; never reword), `stripChords(lines)` (remove `[Am]`-style tokens and lines made only of chord symbols, return the counts per kind for `strippedMarkup`), and `mapCreditRole(label)` to `lyrics`, `music`, `translation`, `arrangement` or `null` (unknown, reported). Add unit tests in `tests/import/unit/clean.test.ts`
- [X] T022 CLI frame in `scripts/import/cli.ts`: load `env.ts`; parse with `node:util parseArgs`; dispatch subcommands (empty handlers that report "not implemented" for now); exit codes `0` success, `1` validation or run failure, `2` usage error; human output on stdout, errors on stderr, `--json` for machine output, following `specs/002-hymnal-import/contracts/cli.md` *(Done: subcommands are registered in `scripts/import/registry.ts` and `scripts/import/commands.ts`, so the entry point has no import cycle.)*

**Checkpoint**: The foundation tests pass. `npm run import -- --help` lists the subcommands.

### Protect saved collections (FR-026 to FR-028, research R12)

These tasks change features 001 and 003 so that later imports can never make a saved
collection entry open a different hymn. Rules: `specs/003-repertoire-collections/data-model.md`
("Resolving an entry") and `specs/002-hymnal-import/data-model.md` ("Hymn redirects").

- [X] T023 [P] Unit tests for redirects in `tests/unit/build-data.test.ts`: an absent `content/redirects.json` is the same as `{}`; the build fails when a redirect source "must not be the id of an existing hymn file", when a target is not an existing hymn id, and when a target is itself a redirect (chain); a valid map is published in the catalog as `redirects`
- [X] T024 [P] Unit tests for entry resolution in `tests/unit/repertoire-resolve.test.ts`, with a small catalog: an entry whose reference points to its `hymnId` is available as is; an entry whose reference now points to another hymn opens its saved hymn under that hymn's entry in the same hymnal (or its first entry) and is reported as a repair; a `hymnId` merged away is followed through `redirects`; an entry whose saved hymn is not published is unavailable, even when its reference now points to another hymn; an entry without `hymnId` resolves by reference and reports the id to store
- [X] T025 [P] Unit tests in `tests/unit/repertoire-model.test.ts` and `tests/unit/repertoire-storage.test.ts`: `addEntry` stores `hymnId` when the catalog knows the hymn; `sameHymn` uses the stored `hymnId` when present; a version 2 document without any `hymnId` still loads unchanged; a document with `hymnId` loads and saves it back
- [X] T026 Redirects in the data build: add `RedirectsSchema` (`z.record(slug, slug)`) and `redirects: Record<string, string>` on `Catalog` in `src/lib/domain/schema.ts`; read `content/redirects.json` in `loadContent`, check the three rules in `validateContent`, and publish the map in `buildCatalog` (`scripts/build-data.ts`). Document the file in `specs/001-hymnal-browse-search/contracts/content-schema.md` and `data-model.md`. Makes T023 pass
- [X] T027 Add `resolveHymnId(id)` to `src/lib/data/catalog.ts` (`redirects[id] ?? id`, then `getHymn`), exposed on `CatalogApi`
- [X] T028 Add the optional `hymnId: z.string().min(1).optional()` to `CollectionEntrySchema` in `src/lib/repertoire/schema.ts` (the document stays `version: 2`). In `src/lib/repertoire/model.ts`, `addEntry` stores `hymnId` from `hymnIdOf(ref)` when known, and `sameHymn` compares stored `hymnId`s first. Makes T025 pass
- [X] T029 Entry resolution in `src/lib/repertoire/resolve.ts`, following "Resolving an entry" in `specs/003-repertoire-collections/data-model.md`: `resolveEntries` returns, for each entry, the hymn, the reference to open, `available`, and a `repair` (new `hymnal`, `number`, `hymnId`) when the stored entry must change. Makes T024 pass
- [X] T030 Apply repairs: add `applyRepairs(repairs)` to `src/lib/repertoire/store.ts`, which saves once and does not change `updatedAt` (a repair is not a user change). Call it once each time a catalog version is loaded, from `src/routes/+layout.svelte`, so the collection list, the bookmark sheet and "Lire dans l'ordre" all see repaired entries
- [X] T031 [P] End-to-end test in `tests/e2e/collections-data-update.spec.ts`: seed `localStorage` with an entry whose `hymnId` is a sample hymn but whose number now points to another hymn, then check the collection shows and opens the saved hymn under its current reference and that the stored entry was repaired; seed an entry whose `hymnId` is unknown and check it shows "Chant indisponible" even though its number points to an existing hymn
- [X] T032 Run `npm test`, `npm run test:e2e -- --project=android`, `npm run check` and `npm run lint`. All must pass before Phase 3

**Checkpoint**: A saved entry follows its hymn through renumbering and merges, and is never
re-pointed to another hymn.

---

## Phase 3: User Story 1 - Import one hymnal from one source (Priority: P1) 🎯 MVP

**Goal**: Import one hymnal from conducteurdelouange.com (`cdl`) into `content/` files that are
faithful to the source, valid, traceable and unpublished (`rights: "unconfirmed"`).

**Independent Test**: An offline `run` against saved `cdl` pages writes schema-valid hymn files
whose text matches the pages, with source URL, date and `rights: "unconfirmed"`. A page that
cannot be parsed is skipped and reported.

### Tests for User Story 1

- [X] T033 [US1] Save `cdl` test fixtures in `tests/import/fixtures/cdl/`: one hymnal listing page, plus at least 5 hymn pages, including one with numbered verses and a chorus, one with no credits, one with chord markings in the text, and one page that must fail to parse (for example a non-hymn page). Fetch them by hand, one at a time, at least 1 s apart, with the User-Agent from research R3. Add `tests/import/fixtures/cdl/README.md` listing each file's source URL and retrieval date. Inspect the HTML and note in that README the selectors to use for the title, number, sections and credits *(Done: 9 pages in `tests/import/fixtures/cdl/` with `index.json` and `README.md`. Found on the site: JEM is split in 4 volumes with continuous numbering; Exo has no numbers; À Toi la Gloire is not on the site, so `cdl` now covers `jem`, `adf`, `cd` only; chords are never shown on public pages and no page without credits was found, so those two cases are derived from a fixture in the tests.)*
- [X] T034 [P] [US1] Adapter tests in `tests/import/adapters/cdl.test.ts`: `listEntries` on the listing fixture returns the expected (number, URL) pairs; `parseHymn` returns the exact title, sections in source order with `type`/`number` ("`null` for chorus and bridge"), credits with mapped roles, chords removed and counted; the failure fixture returns `{ ok: false, reason }` with a short, stable reason; no output line differs from the source text except for whitespace and NFC
- [X] T035 [P] [US1] Integration test in `tests/import/integration/run-import.test.ts`, run offline on a temporary copy of `content/` and `import/` with the `cdl` fixtures as cache. Checks: one file per parsed hymn in `content/hymns/` that passes the feature 001 schema; each has `entries` [{hymnal, number}], `source` {name, url, retrievedAt}, `rights: "unconfirmed"`, and empty `corrections`; a link is written for each hymn in `import/state/links.json`; the failing page is listed under `skipped` with its reason and URL; `--dry-run` writes only the report; when more than 20% of pages fail, nothing is written for the source and its status is `aborted`; a source with `permission: "refused"` makes no request; `permission: "unknown"` without `--yes` stops after a warning

### Implementation for User Story 1

- [X] T036 [US1] `cdl` adapter in `scripts/import/sources/cdl.ts`, following `specs/002-hymnal-import/contracts/source-adapter.md` and the selectors noted in T033: `listEntries(hymnal, ctx)` lists the hymnal's (number, URL) pairs using `ctx.fetch` only; `parseHymn(html, ref)` is a pure function built with `cheerio` and `clean.ts`. Register it in `scripts/import/sources/index.ts`. Makes T034 pass *(Done: credits on this site have no role (composer and author share the same class), so they are stored with the new role `unspecified`, shown as "Auteurs"; the verse number written at the start of a verse ("1. …") is removed as markup and counted.)*
- [X] T037 [US1] First version of reconciliation in `scripts/import/pipeline/reconcile.ts`: for a parsed RawHymn with no link, create the hymn (`ids.ts`), its entry, source, empty credits/corrections and `rights: "unconfirmed"`, and add a Link (`status: "active"`, `acceptedFingerprint`, `lastSeenAt`). Return the planned writes without writing them
- [X] T038 [P] [US1] Report generation in `scripts/import/report.ts`: build the run report following data-model.md (`runId` `YYYYMMDD-HHMMSS`, `startedAt`, `finishedAt`, `args`, `perSource.status` one of `ok`, `aborted`, `unreachable`, `skipped-permission`, `perHymnal` counts and lists) and write `import/reports/<runId>.json` plus a readable `import/reports/<runId>.md` in French
- [X] T039 [US1] Run orchestration in `scripts/import/pipeline/run.ts`, guaranteeing points 1–6 of the `run` section of contracts/cli.md: check permission (`refused` stops; `unknown` warns and needs `--yes`); list entries; fetch and parse every page, keeping results in memory; apply the 20% failure threshold for each source; plan writes with `reconcile.ts`; validate each hymn against the feature 001 schema and never write one that fails; write with `files.ts` (unless `--dry-run`); always write the report, even when the run is aborted. Supports `--source`, repeatable `--hymnal`, `--offline`, `--dry-run` and `--yes`. Makes T035 pass *(Done: also stops with status `invalid` if the planned content would not build; hooks for matching (US3) and rights (US4) are passed in by `scripts/import/pipeline/hooks.ts`.)*
- [X] T040 [US1] Implement the `run` and `report [<runId>]` subcommands in `scripts/import/cli.ts`; `report` prints the latest report by default
- [ ] T041 [US1] Record the terms of use of conducteurdelouange.com in `import/sources.json` (`terms.url`, `terms.summary`, `terms.checkedAt`). This is done by the maintainer after reading the site's legal page; set `permission` to `requested` once a request has been sent *(In progress: terms read and recorded in `import/sources.json` on 2026-11-11 — no public use without permission. Left to the maintainer: send the permission request, then set `permission` to `requested`.)*

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

- [X] T042 [P] [US2] Unit tests for reconciliation in `tests/import/unit/reconcile.test.ts`: same fingerprint means no write; new fingerprint means a PendingChange and no content write; an entry no longer listed means link `status: "missing"` and no deletion; a missing entry listed again means `active`; a (hymnal, number) linked to a different hymn means a conflict and no write
- [X] T043 [P] [US2] Integration test in `tests/import/integration/rerun.test.ts`, offline on temporary copies. Checks: a second run on the same cache leaves `content/` and `import/state/` byte-identical (SC-003); a hymn page added to the listing is created and reported as `new`; changing one word in a cached page creates `import/pending/<hymnId>--cdl.json` with a unified diff and leaves `content/` unchanged; `accept` writes the new text and updates `acceptedFingerprint`; `reject` keeps the text and updates the fingerprint; a manual correction (edited line plus a `corrections` entry) on another hymn survives all of this (SC-004); a page removed from the listing is reported as `missing` and its hymn file still exists

### Implementation for User Story 2

- [X] T044 [US2] Extend `scripts/import/pipeline/reconcile.ts` with the linked cases from research R6: unchanged (no write, update `lastSeenAt` only if the date changed, otherwise nothing), changed (create a PendingChange), missing (set link `status: "missing"`), back (`active`), and conflicts. Never rewrite `title`, `sections`, `credits` or `corrections` of an existing hymn outside `accept`. Makes T042 pass *(Done: also drops a pending change when the source goes back to the accepted text, and links a hymn already in content with the same text (left by an interrupted run) instead of reporting a conflict.)*
- [X] T045 [US2] Pending changes in `scripts/import/pipeline/pending.ts`: write `import/pending/<hymnId>--<source>.json` (`hymnId`, `source`, `hymnal`, `number`, `detectedAt`, `oldFingerprint`, `newFingerprint`, a unified `diff` of the title and section lines made with `diff`, and the `proposed` RawHymn); `accept(hymnId, source?)` updates the hymn's title, sections and credits, sets `source.retrievedAt`, keeps `corrections`, updates the link fingerprint and deletes the pending file; `reject` updates only the link fingerprint and deletes the pending file *(Done: when the change comes from a source that is not the hymn's reference text (after a merge), `accept` only updates the fingerprint.)*
- [X] T046 [US2] Implement the `pending`, `accept <hymnId> [--source <id>]` and `reject <hymnId> [--source <id>]` subcommands in `scripts/import/cli.ts`; `pending` prints each diff in colour when stdout is a terminal
- [X] T047 [US2] Add `new`, `changed`, `unchanged`, `missing` and `conflicts` to the report in `scripts/import/report.ts`, and add the reconciliation steps to `scripts/import/pipeline/run.ts`. Makes T043 pass

**Checkpoint**: Quickstart step 3 works. Re-running the import is safe.

---

## Phase 5: User Story 3 - Recognise the same hymn across hymnals and sources (Priority: P2)

**Goal**: A hymn found in several hymnals or on several sites is stored once with several
entries. Doubtful pairs are proposed for review, never merged silently.

**Independent Test**: Import two hymnals that share hymns. Each shared hymn exists once with
both entries, and a pair with the same title but different lyrics is listed, not merged.

### Tests for User Story 3

- [X] T048 [P] [US3] Unit tests for matching in `tests/import/unit/match.test.ts`: equal normalised titles with lyrics Jaccard on word 3-grams ≥ 0.85 means `merge`; equal titles with low similarity, or similarity ≥ 0.5 alone, means `possible duplicate`; anything else means distinct; a `distinct` decision in `merges.json` overrides an automatic merge; a `merge` decision forces a merge; candidates come from the title index and the first-line 3-gram index (not every pair)
- [X] T049 [P] [US3] Integration test in `tests/import/integration/duplicates.test.ts`, offline with small fixture caches for two hymnals and two sources. Checks: a shared hymn becomes one file with two `entries`; the reference text comes from the source ranked first in `import/decisions/source-priority.json`, and the other source is in `alternateSources`; a same-title, different-lyrics pair stays as two files and is listed under `possibleDuplicates`; after `distinct a b`, a re-run no longer proposes the pair; after `merge a b`, `b`'s entries move to `a`, `b`'s links point to `a`, `b`'s file is removed, and `content/redirects.json` gains `b → a` (any redirect that pointed to `b` now points to `a`); `npm run data` still passes
- [X] T050 [US3] Reference list for SC-005 in `tests/import/reference-duplicates.json`: at least 30 hymns known to appear in several hymnals (with their hymnal + number pairs) and at least 10 known distinct pairs with similar titles. Built by the maintainer from the JEM and ATG imports. Add `tests/import/reference-duplicates.test.ts`, which runs matching on the cached pages and checks that ≥ 90% are auto-merged and that no known distinct pair is merged *(In progress: the harness is in place — `tests/import/reference-duplicates.json` (empty) and `tests/import/reference-duplicates.test.ts`, which runs on the real page cache and is skipped until the list holds ≥ 30 shared hymns and ≥ 10 distinct pairs.)* *(Done 2026-11-11 from the first real import: 38 shared groups and 16 distinct pairs, each read and judged by hand, including 3 groups the importer does not merge. The test skips when import/cache is absent.)*

### Implementation for User Story 3

- [X] T051 [US3] Matching in `scripts/import/pipeline/match.ts`, following research R7: normalise with `normalizeText` and `tokenize` from `src/lib/search/normalize.ts`; build an index of normalised titles and an index of first-line 3-grams; compute Jaccard on lyric word 3-grams; return `merge`, `possible`, or `distinct`, applying `merges.json` decisions first. Keep the thresholds (0.85, 0.5) as named constants. Makes T048 pass *(Done: hymns that only exist in the sample hymnals `ce`/`he` are never matched, so an imported hymn cannot be merged into a sample hymn that will leave content/; a recorded `merge` decision applies even when titles differ.)*
- [X] T052 [US3] Merge operation in `scripts/import/pipeline/merge.ts`: `mergeHymns(a, b)` merges entries into `a`, adds `b`'s source to `a.alternateSources`, keeps `a`'s text unless `source-priority.json` ranks `b`'s source higher for the hymnal, re-points `b`'s links to `a`, deletes `content/hymns/<b>.json`, writes `b → a` to `content/redirects.json` and rewrites any redirect whose target was `b` (no chains, FR-026), and records the decision in `import/decisions/merges.json` (stored with `a < b`)
- [X] T053 [US3] Call matching in `scripts/import/pipeline/reconcile.ts` for RawHymns with no link: on `merge`, attach a new entry (and the alternate source) to the existing hymn instead of creating one; on `possible`, create the hymn and record the pair; add `autoMerged` and `possibleDuplicates` to `scripts/import/report.ts`. Makes T049 pass *(Done: also, when a second source lists a hymnal number already imported, its text is checked against the existing hymn: the same hymn becomes an alternate source (reference text by source priority), a different text is a conflict.)*
- [X] T054 [US3] Implement the `duplicates`, `merge <hymnIdA> <hymnIdB>` and `distinct <hymnIdA> <hymnIdB>` subcommands in `scripts/import/cli.ts`; `duplicates` lists undecided pairs with title, hymnal + number and the similarity score
- [X] T055 [US3] Tune the thresholds against `tests/import/reference-duplicates.json` (T050). Record the final values and the measured scores in `specs/002-hymnal-import/research.md` under R7 *(Done: containment rule with size ratio; 35/38 shared groups merged (92 %), 0 distinct pairs merged. Values and scores in research R7.)*

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

- [X] T056 [P] [US4] Unit tests for rights computation in `tests/import/unit/rights.test.ts`: no decision gives `unconfirmed`; a hymnal `permission` or `licence` decision gives `confirmed` for its hymns; a hymn `public-domain` decision gives `public-domain` even if the hymnal has no decision; precedence is hymn, then hymnal, then source; a `refused` decision gives `unconfirmed` even with a broader `permission`; a hymn in two hymnals is `confirmed` if either hymnal is covered
- [X] T057 [P] [US4] Integration test in `tests/import/integration/rights.test.ts`: `rights set --scope hymnal --target jem --basis permission` updates only the `rights` field of JEM hymns (other fields byte-identical); `npm run data` on that content publishes JEM hymns and excludes the others (SC-006); a later run that adds a JEM hymn writes it as `confirmed` and lists it under `rightsInherited`; a `--target` that does not exist exits with code `1`

### Implementation for User Story 4

- [X] T058 [US4] Rights computation in `scripts/import/pipeline/rights.ts`, following the "Derived values" section of data-model.md: `computeRights(hymn, links, decisions)` returns `confirmed`, `public-domain` or `unconfirmed`; `applyRights(content, decisions)` rewrites only the `rights` field of the hymns whose value changes. Makes T056 pass *(Done: only imported hymns (with a link) and hymns with a decision of their own are ever changed, so hymns written by hand, like the public-domain samples, keep their rights; `merge` also recomputes rights from the decisions.)*
- [X] T059 [US4] Use `rights.ts` in `scripts/import/pipeline/reconcile.ts` and `scripts/import/pipeline/run.ts`, so that new hymns get the inherited value (FR-006) and are listed under `rightsInherited` in the report
- [X] T060 [US4] Implement `rights set --scope <source|hymnal|hymn> --target <id> --basis <permission|licence|public-domain|refused> [--date YYYY-MM-DD] --note "<text>"` (the date defaults to today; it replaces any decision with the same scope and target; it then calls `applyRights`) and `rights list` (decisions with the number of hymns each one covers) in `scripts/import/cli.ts`. Makes T057 pass
- [X] T061 [US4] Complete the Markdown report in `scripts/import/report.ts` with all FR-018 sections, one table per hymnal (imported, new, changed, unchanged, skipped with reason and URL, missing, possible duplicates, conflicts, no credits, rights inherited, removed chord markings), plus a summary of the rights status (published / not published) per hymnal

- [X] T062 [US4] Before the first real hymnal is published: move the sample hymnals `ce` and `he` and their hymns from `content/` to `tests/fixtures/sample-content/` (with an empty `redirects.json`), and point everything that uses them at that folder: `tests/helpers/sample.ts`, the reference queries in `tests/queries/`, the perf test if it reads them, and the e2e build (`playwright.config.ts` / `scripts/serve-build.ts`, which call `scripts/build-data.ts [contentDir] [outDir]`). Add a check in `validateContent` (`scripts/build-data.ts`) that rejects the reserved hymnal ids `ce` and `he` when building from `content/` (FR-028), with a unit test. All 001 and 003 tests must still pass *(Done 2026-11-11 with the first real import (published locally through HYMNIA_PERSONAL_USE): samples in tests/fixtures/sample-content/, e2e built from it, `ce`/`he` rejected when building from content/.)*

**Checkpoint**: Quickstart step 5 works. Publishing is controlled by recorded decisions only.

---

## Phase 7: User Story 5 - Add a new source or hymnal (Priority: P3)

**Goal**: The three remaining sources are added the same way, each as one adapter, one config
entry and fixtures, with no change in `src/`. A broken source does not affect the others.

**Independent Test**: Each new adapter passes its fixture tests, and an offline run imports its
hymnal. `git diff --stat src/` is empty for this phase.

### Tests for User Story 5

- [X] T063 [P] [US5] Integration test in `tests/import/integration/isolation.test.ts`: with one adapter forced to fail on every page, a run over two sources writes the healthy source's hymns and marks only the broken one `aborted`; an unknown `--source` exits with code `2` *(Done: a run handles one source, so isolation is checked by running a broken source then a healthy one.)*
- [X] T064 [P] [US5] Save `jemaf` fixtures in `tests/import/fixtures/jemaf/` (listing page plus at least 5 hymn pages, the same kinds as T033, and a `README.md` with URLs, dates and selectors), then write `tests/import/adapters/jemaf.test.ts` with the same checks as T034
- [X] T065 [P] [US5] Save `psalmodie` fixtures in `tests/import/fixtures/psalmodie/`, waiting at least 10 s between requests (`Crawl-delay: 10`), with a `README.md`; then write `tests/import/adapters/psalmodie.test.ts` with the same checks as T034
- [X] T066 [P] [US5] Save `ecriture` fixtures in `tests/import/fixtures/ecriture/` (do not use `/search` or `/api/`, which robots.txt disallows), with a `README.md`; then write `tests/import/adapters/ecriture.test.ts` with the same checks as T034

### Implementation for User Story 5

- [X] T067 [P] [US5] `jemaf` adapter in `scripts/import/sources/jemaf.ts` (chords and MP3 links on the pages are ignored, per FR-007), registered in `scripts/import/sources/index.ts`. Makes T064 pass *(Done: jemaf.fr covers `jem` (1–1200), `adf` (677, incl. 22 lettered variants such as 309A) and `atg` (400) with credit roles; terms recorded. Decision pending: whether lettered AdF variants are separate entries — see research R13.)*
- [X] T068 [P] [US5] `psalmodie` adapter in `scripts/import/sources/psalmodie.ts`, registered in `scripts/import/sources/index.ts`. Makes T065 pass *(Done: psalmodie.ch is not a numbered hymnal but 7 concert programmes; numbers are assigned by blocks of 100 per programme, and the musical "Paul" is not imported, by the maintainer's decision — see research R13.)*
- [X] T069 [P] [US5] `ecriture` adapter in `scripts/import/sources/ecriture.ts`, registered in `scripts/import/sources/index.ts`. Makes T066 pass *(Done: ecrituremusique.com has 32 unnumbered songs on 3 albums; numbers are assigned by album blocks (1–12, 13–25, 26–32). Decision pending — see research R13. Fixtures trimmed of script/style contents (1.3 MB).)*
- [X] T070 [US5] Make sure `scripts/import/pipeline/run.ts` catches each source's errors (unreachable, adapter exception) and marks that source `unreachable` or `aborted` without stopping the others. Makes T063 pass
- [X] T071 [P] [US5] "How to add a source" guide in `scripts/import/sources/README.md`: add an entry to `import/sources.json` (with terms and permission), save fixtures politely, write the adapter following `specs/002-hymnal-import/contracts/source-adapter.md`, register it, run the tests, and do a dry-run import. Target: under 30 minutes for a source already understood (SC-007)
- [X] T072 [US5] Set the default source order for shared hymnals in `import/decisions/source-priority.json` (e.g. `jem`: [`jemaf`, `cdl`]; `adf`: [`jemaf`, `cdl`]; `atg`: [`jemaf`, `cdl`]), after comparing a few hymns from both sources *(Done: `jem` and `adf`: jemaf then cdl; `atg`: jemaf. Comparing JEM 17 on both sites: same lyrics; jemaf gives credit roles (music: Mélodie hébraïque, lyrics: Christian Glardon) where cdl gives one unlabelled name, and jemaf is the JEM publisher's site. This comparison also showed titles can differ between sites, so a hymnal number already provided by another source is now recognised by its lyrics alone.)*

**Checkpoint**: All four sources import. Adding a source does not change `src/`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T073 `check` subcommand in `scripts/import/check.ts`, wired into `scripts/import/cli.ts`. It works with no network: it validates `import/` with `state.ts`, validates `content/` with the feature 001 schema (including `content/redirects.json`), checks validation rules 1–4 from data-model.md, checks that every merge decision `merge a b` has a redirect `b → a`, and checks that each linked hymn's lyrics match the cached source after re-parsing, apart from whitespace and NFC, unless a `corrections` entry explains the difference (FR-004). Add `tests/import/integration/check.test.ts`
- [X] T074 [P] Mention `.env` / `HYMNIA_CONTACT` loading and the exit codes in `specs/002-hymnal-import/contracts/cli.md`, and add an "Importing hymnals" section to the project `README.md` pointing to `specs/002-hymnal-import/quickstart.md`
- [X] T075 [P] Performance check in `tests/import/integration/perf.test.ts`: processing 1,000 cached hymns (synthetic fixtures; extraction, matching and writing) takes under 1 minute (plan, Performance Goals) *(Done: 1,000 hymns in about 2.4 s.)*
- [X] T076 After the first real import of JEM and ATG, run feature 001's reference queries (`npm run test:queries`) and the build (`npm run data`) on the new content, and record any search regression in `specs/002-hymnal-import/research.md` *(Done: reference queries pass; two search regressions on real data recorded in research R13 (lyrics rank below titles; a hymnal's own title is lost on merge), for feature 001.)*
- [ ] T077 Run every step of `specs/002-hymnal-import/quickstart.md` and fix any difference between what the guide says and what happens

---

## Dependencies & Execution Order

### Phase Dependencies

- **Feature 001 Phases 1–2**: required before this feature starts (T001)
- **Setup (Phase 1)**: T001 first; T002 then T003 (both edit `package.json`); T004–T007 in parallel
- **Foundational (Phase 2)**: depends on Setup; blocks every story. Its "Protect saved
  collections" part (T023–T032) touches only `scripts/build-data.ts`, `src/` and `tests/`, and can
  run in parallel with the importer foundation (T008–T022). It must be done before any real
  hymnal is imported
- **US1 (Phase 3)**: depends on Foundational; the MVP
- **US2 (Phase 4)**: depends on US1 (it extends `reconcile.ts`, `run.ts`, `report.ts`)
- **US3 (Phase 5)**: depends on US1; can run in parallel with US2 if `reconcile.ts` edits are coordinated (T053 after T044)
- **US4 (Phase 6)**: depends on US1; independent of US2 and US3 apart from shared files (`reconcile.ts`, `report.ts`, `cli.ts`). T062 (moving the sample hymnals) must be done before the first real hymnal is published
- **US5 (Phase 7)**: depends on US1. Its adapters (T064–T069) can start as soon as the foundation and one adapter example (T036) exist
- **Polish (Phase 8)**: after the desired stories. T076 needs real imports and T050 needs real data

### Within Each User Story

- Tests are written first and must fail before implementation
- Fixtures before adapter tests, and adapter tests before adapters
- `pipeline/*` before `run.ts`, and `run.ts` before CLI subcommands
- Tasks in the same file (`reconcile.ts`, `report.ts`, `cli.ts`) run one after another

### Parallel Opportunities

- Setup: T004, T005, T006, T007
- Foundational tests: T008–T012; implementation: T014, T015, T016, T018, T020, T021
- Protect saved collections: tests T023, T024, T025 and T031 in parallel; T026–T030 in order
- US1: T034 and T035 (after T033); T038 alongside T036/T037
- US2: T042 and T043
- US3: T048 and T049
- US4: T056 and T057
- US5: the three adapters (T064+T067, T065+T068, T066+T069) are fully independent; T063 and T071 also run in parallel

---

## Parallel Example: User Story 5

```bash
# Three independent sources, one per worker:
Task: "T064 + T067 jemaf fixtures, tests and adapter in scripts/import/sources/jemaf.ts"
Task: "T065 + T068 psalmodie fixtures, tests and adapter in scripts/import/sources/psalmodie.ts"
Task: "T066 + T069 ecriture fixtures, tests and adapter in scripts/import/sources/ecriture.ts"
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
