---

description: "Task list for the Pasteur & Compagnie hymnal"
---

# Tasks: Pasteur & Compagnie Hymnal

**Input**: Design documents from `/specs/010-pasteur-compagnie-hymnal/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R11), data-model.md,
contracts/petc-adapter.md, quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for import, data
normalisation and numbering. Feature 002's adapter contract requires fixture tests for every
adapter. Write each test task before the code task it covers, and see it fail first.

**Organization**: Tasks are grouped by user story (US1–US4 of spec.md):
- US1: import the songs;
- US2: browse by album;
- US3: find the songs in the app;
- US4: keep the numbers stable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

This is a single project at the repository root:
- importer code is in `scripts/import/`;
- import data is in `import/`;
- content is in `content/`;
- tests are in `tests/import/` (adapter, pipeline) and `tests/queries/` (real content).

Nothing in `src/` changes.

Ids used everywhere:
- source id `petc`;
- hymnal id `pasteur-compagnie`;
- base URL `https://pasteuretcompagnie.com`.

Patterns to copy:
- **Pinned numbers and "not pinned yet" logs**: `EVANGILE21_NUMBERS` and `numberEntries()` in
  `scripts/import/sources/evangile21.ts`.
- **Fragment URLs on one shared page**: `scripts/import/sources/arc.ts`, where every entry is
  `…#anchor` and the fetcher requests the page once.
- **Adapter tests**: `tests/import/adapters/evangile21.test.ts`, with `fixturePage` and
  `fixtureContext` from `tests/import/helpers/fixtures.ts`.
- **Real-content query tests**: `tests/queries/exo.test.ts`.

**Network**: only the importer's fetcher, or a throwaway script that uses `createFetcher` from
`scripts/import/fetcher.ts`, may request pasteuretcompagnie.com. The fetcher follows
robots.txt, sends the User-Agent with `HYMNIA_CONTACT` and waits at least 1 s between requests.
Put any throwaway script in `~/9-scratch/`, never in the repository or directly in `~`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: fixtures for every page kind of the site (research R11)

- [X] T001 Write the throwaway script `~/9-scratch/petc-fixtures.ts`, run with `npx tsx`. It uses `createFetcher` from `scripts/import/fetcher.ts`, with a temporary `cacheDir`, `minDelayMs: 1500` and the source record of T005 (or an inline copy). It saves pages into `tests/import/fixtures/petc/` with `<script>` and `<style>` removed:
  - `list-page1.html` and `list-page9.html` from `/collections/partitions?page=1` and `?page=9`;
  - `albums.html` from `/collections/digital-albums`;
  - `album-dans-ses-mains.html`, `album-kids.html` and `album-kids-instrumental.html` from `/products/dans-ses-mains`, `/products/kids` and `/products/kids-album-pistes-instrumentales`;
  - `kids-lyrics.html` from `/pages/album-kids-paroles`;
  - `song-jesus-merci.html`, `song-lespoir.html`, `song-redempteur-adorable.html`, `song-coule-a-flots.html`, `song-noel-jesus-est-ne.html` and `song-papa.html` from `/products/jesus-merci-jesus-thank-you`, `/products/lespoir-1`, `/products/redempteur-adorable`, `/products/coule-a-flots-come-thou-fount`, `/products/noel-jesus-est-ne` and `/products/papa-cest-quoi-une-ame-partition`.

  Check that each song page still holds `.product-single__description`, and that `list-page1.html` has 8 product cards and `list-page9.html` has 4.
- [X] T002 [P] Write `tests/import/fixtures/petc/index.json`: each file → `{ url, retrievedAt }`, with the same shape as `tests/import/fixtures/evangile21/index.json`.
- [X] T003 [P] Write `tests/import/fixtures/petc/README.md`. It describes the page structure:
  - the grid product-card selector, and that menus and scripts link to other `/products/…` pages (`/products/album`, `/products/albumimproslouange`, …) that are not in the grid;
  - the product `<h1>` title and `.product-single__description`;
  - the numbered tracklist lines (`^\d+\.\s*title`) in album descriptions;
  - the KIDS lyrics blocks (`<h1>n. title</h1>` then lyrics up to the next `<h1>`);
  - the layouts seen in descriptions: `<h2>` names, `<strong>/<em>` labels, `<p>` per line, `&nbsp;` spacers, and notes that are not lyrics (research R8 table).

  Keep the list of fixtures short. The pages are copyrighted.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: records, shared helpers and the import types that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add the hymnal to `content/hymnals.json` exactly as in research R3: `"id": "pasteur-compagnie"`, `"name": "Pasteur & Compagnie"`, `"abbreviations": ["P&C"]`, `"sortOrder": 12`, and the `parts` Hymnes21 2018 (100), Impros louange (200), Dans ses mains (300), KIDS (400), Plus haut encore (500), Hors album (1000). Respect the schema rules "the first abbreviation is the short code and has at most 3 characters" and "parts are listed in increasing `first` order". Run `npm run data` to check that the content still validates and the abbreviation conflicts with no other hymnal.
- [X] T005 [P] Add the source to `import/sources.json`, as in data-model "Source":
  - `"id": "petc"`, `"name": "Pasteur & Compagnie — pasteuretcompagnie.com"`, `"baseUrl": "https://pasteuretcompagnie.com"`, `"hymnals": ["pasteur-compagnie"]`, `"minDelayMs": 1000`, `"permission": "unknown"`, no `access` field;
  - `terms`: url `https://pasteuretcompagnie.com/pages/termes-et-conditions`, `checkedAt` `2026-11-16`, and the summary of research R2 in French, like the other sources (sales only, nothing on reusing lyrics, free leadsheets are not a right to republish, permission to ask philippeviguiermedias@gmail.com).
- [X] T006 [P] In `scripts/import/sources/evangile21.ts`, export the helpers that `petc` reuses (research R8), without changing their behaviour: `tokenize`, `LABEL`, `labelSection`, `addCredits`, `namesLine` and `CREDIT_START`, plus the `Token`/`Line` types. If a helper takes a Cheerio root, keep that signature. Run `npm run test:import -- evangile21` to confirm that nothing changed.
- [X] T007 [P] In `scripts/import/sources/types.ts`, add `warnings: z.array(z.string()).default([])` to `RawHymnSchema`, with the doc comment "Doubts for the maintainer, listed in the report's 'To check by hand' (specs/010 research R7)". Other adapters need no change, because the field defaults to `[]`.
- [X] T008 [P] In `scripts/import/report.ts`:
  - add `toCheck: { number: string; hymnId: string; title: string; warnings: string[] }[]` to `HymnalReport`, and `toCheck: []` to `emptyHymnalReport`;
  - add the section `['toCheck', 'À vérifier à la main']` to the markdown sections list, rendered by `rows()` as `| number | hymnId — title | warnings joined by "; " |`;
  - make `loadReport` fill a missing `toCheck` with `[]`, so older reports in `import/reports/` still load.
- [X] T009 In `scripts/import/pipeline/reconcile.ts`, push `{ number, hymnId, title, warnings }` to `r.toCheck` for each successful outcome with `raw.warnings.length > 0`, once the hymn id is known. That covers new, attached, unchanged and changed outcomes. This depends on T007 and T008.
- [X] T010 [P] Test T007–T009 in `tests/import/unit/reconcile.test.ts`:
  - a raw hymn with `warnings: ['x']` appears in `perHymnal[h].toCheck` with its hymn id;
  - a raw hymn with no warnings does not.

  No test covers `report.ts` yet, so create `tests/import/unit/report.test.ts`. Check that `renderMarkdown` prints the "À vérifier à la main" section with a `toCheck` row, and that `loadReport` on a temporary root fills a missing `toCheck` with `[]`. Use the workspace helper in `tests/import/helpers/workspace.ts` for the temporary root.

**Checkpoint**: The hymnal and the source exist. `npm run data` and `npm run test:import` pass.

---

## Phase 3: User Story 1 - Import the Pasteur & Compagnie songs (Priority: P1) 🎯 MVP

**Goal**: the maintainer runs the import. Every listed song page is fetched, parsed faithfully
(lyrics, sections, credits, title) and written under its pinned number. A song on two albums
is one hymn with two entries. Doubtful extractions are listed under "To check by hand".

**Independent Test**: `npm run test:import` on the fixtures, then a dry run against the site and
`npm run import -- check` after a real run. Every hymn passes validation and matches its cached
page.

### Tests for User Story 1 ⚠️

- [X] T011 [P] [US1] Write the parse tests in `tests/import/adapters/petc.test.ts`, one per row of the `parseHymn` table in `contracts/petc-adapter.md`:
  - `song-jesus-merci.html`: title "Jésus merci"; section types in order verse 1, chorus, verse 2, bridge…; credits `[{ name: 'Pat Sczebel', role: 'unspecified' }]`.
  - `song-lespoir.html`: credit Philippe Viguier as lyrics and music; no line containing "Violons" or "mastering"; `strippedMarkup['recording credit'] === 2`; a "Pré-refrain" section.
  - `song-redempteur-adorable.html`: no labels; one verse per blank-line stanza; the line "Allélu, alléluia (x4)" kept, after `cleanLine`.
  - `song-coule-a-flots.html`: credits John Wyeth (music), Robert Robinson (lyrics) and Philippe Viguier (translation); "Shayne Barnard" not a credit.
  - `song-noel-jesus-est-ne.html`: "Arrangement piano-violon et leadsheet." and "A Toi Gloire 116." absent from `sections`; "Decovert-Blochet. Air anglais" either in credits or in `warnings`, never in `sections`.
  - `song-papa.html`: title "Papa c'est quoi une âme ?".
  - `album-dans-ses-mains.html` parsed as a song → `{ ok: false }`.

  Every line is NFC. No section contains a label, a URL or "mp3".
- [X] T012 [P] [US1] Add a title-rule test in `tests/import/adapters/petc.test.ts` on the 68 current product titles, inlined as a constant array copied from the site's list on 2026-11-16 (research R9):
  - the English brackets and "(partition)" are removed, e.g. "Grâce infinie (Amazing Grace)" → "Grâce infinie" and "Psaume 42 - Je le louerai encore (I will praise Him again)" → "Psaume 42 - Je le louerai encore";
  - "Voici Noël (jazzy)" and "Là aussi (Psaume 139)" are unchanged.
- [X] T013 [P] [US1] Add a test in `tests/import/adapters/petc.test.ts` for the KIDS lyrics page. `parseHymn(kids-lyrics.html, ref 402 → …/pages/album-kids-paroles#2)` returns the title "L'évangile c'est de la bombe", with the chorus first and then verses 1–4 and the bridge. `#5` gives "Coeur cassé", spelled as in the heading.
- [X] T014 [P] [US1] Add a listing test in `tests/import/adapters/petc.test.ts` with `fixtureContext`. List pages 1 and 9 give 8 + 4 song handles, with no duplicate and no menu link. `parseListPage` returns an empty list for a page with no product card, which ends the paging.
- [X] T015 [P] [US1] Add the same-page tests in `tests/import/unit/reconcile.test.ts` (contract "Pipeline change"):
  - two outcomes for `pasteur-compagnie` 105 and 505 with the same URL, on a first run, give one hymn with both entries and two links, and the second is reported under `autoMerged`;
  - a second reconcile with the same input is all `unchanged`;
  - the hymn's `alternateSources` does not list the same source twice;
  - two outcomes with different URLs in the same hymnal are never attached to each other.

### Implementation for User Story 1

- [X] T016 [US1] In `scripts/import/pipeline/reconcile.ts`, implement the same-page rule (research R5). Before `ownerOf`/matching, for an unlinked outcome, look for a link in `links` (the state plus links created in this run) with `source === source.id`, `url === raw.url`, and a hymn that has an entry in `raw.hymnal`. If one exists, call `attach(thatHymnId)`, but skip adding `otherSource` to `alternateSources` when `target.source.url === raw.url` or an alternate source already has that URL. Make T015 pass, and run all of `npm run test:import` to check that no other adapter's tests move.
- [X] T017 [US1] Create `scripts/import/sources/petc.ts` with the header comment, the constants `PETC_BASE = 'https://pasteuretcompagnie.com'`, `PETC_LIST_URL = \`${PETC_BASE}/collections/partitions\``, `PETC_ALBUMS_URL = \`${PETC_BASE}/collections/digital-albums\`` and `PETC_KIDS_LYRICS = \`${PETC_BASE}/pages/album-kids-paroles\``, and these types:
  - `PinnedNumber = { number: number; page: string }`;
  - `PetcAlbum = { handle: string; first: number; name: string } | { handle: string; skip: string }`.

  Add `import './petc';` to `scripts/import/sources/all.ts`.
- [X] T018 [US1] In `scripts/import/sources/petc.ts`, add `PETC_NUMBERS`, the 81 rows of data-model.md "Initial numbers". `page` is the song handle, `album-kids-paroles#<track>` for 402, 405 and 406, or `<album-handle>#track-<n>` for 201, 210, 214, 305, 310 and 504. Sort by number. Add the doc comment "Never change or reuse a number; a new song is pinned here in the same commit as its content (data-model 'Pinned number')".
- [X] T019 [US1] In `scripts/import/sources/petc.ts`, implement `cleanTitle(productTitle): { title: string; warning?: string }`, following research R9. It removes a trailing `( … )` when it holds a word from the English list or is `partition`, and keeps it otherwise. It returns a warning when the removed bracket is neither English nor `partition`, which cannot happen with today's titles. Make T012 pass.
- [X] T020 [US1] In `scripts/import/sources/petc.ts`, implement `parsePetcHymn(html, ref)` for `/products/<song>` (contract `parseHymn`, research R8):
  1. Load the page with Cheerio and take the title from the product `<h1>` through `cleanTitle`.
  2. Tokenize `.product-single__description` with the exported Evangile21 `tokenize`.
  3. Classify the prelude and postlude lines: credits through `addCredits`/`namesLine`/`CREDIT_START`, a names-only `<h2>`, known notes counted in `strippedMarkup` as `shop note` or `recording credit` (the R8 table), the repeated title or "Partition(s) <title>", or else a warning "unclassified line: …".
  4. Turn labels into sections through `labelSection`, with an unlabelled song split on stanza breaks into verses 1…n. When nothing splits, keep one section and add the warning "stanzas not split".
  5. Pass every line through `cleanLine` and NFC.

  Return `{ ok: false, reason: 'no lyrics' }` when the description is missing or empty. Make T011 pass.
- [X] T021 [US1] In `scripts/import/sources/petc.ts`, extend `parsePetcHymn` for `…/pages/album-kids-paroles#<n>`: take the `<h1>` whose text starts with `n.`, and its following siblings up to the next `<h1>`. The title is the heading without `n.` and trailing spaces. The lyrics go through the same section and line rules as T020. Make T013 pass.
- [X] T022 [US1] In `scripts/import/sources/petc.ts`, implement `parseListPage(html): string[]`, which returns the song handles of the grid's product cards only, and the first version of `listEntries('pasteur-compagnie', ctx)`:
  - read `?page=1`, `2`, … until a page has no card;
  - log `pasteur-compagnie: <rows> rows, <n> song pages`;
  - return one ref per `PETC_NUMBERS` row whose page is a listed handle, a KIDS lyrics fragment, or an album track fragment, with URLs `${PETC_BASE}/products/<handle>`, `${PETC_KIDS_LYRICS}#<n>` and `${PETC_BASE}/products/<album>#track-<n>`;
  - throw for any other hymnal;
  - register the adapter with `registerAdapter({ id: 'petc', listEntries, parseHymn: parsePetcHymn })`.

  For now, an `<album>#track-<n>` URL makes `parseHymn` return `{ ok: false, reason: 'no lyrics on the site: album track <n>' }`; US2 completes it. Make T014 pass.
- [X] T023 [US1] Run `npm run import -- run --source petc --hymnal pasteur-compagnie --dry-run --yes`, then `npm run import -- report`. You should see 81 refs, 75 parsed and 6 skipped, with no listing error. Read every `toCheck` row against its page on the site. Where a rule is wrong, fix it in `scripts/import/sources/petc.ts` and add the case to `tests/import/adapters/petc.test.ts`. Repeat until `toCheck` holds only real doubts.
- [X] T024 [US1] Run the real import (same command without `--dry-run`), then `npm run import -- duplicates`. For each possible duplicate with Evangile21, JEM, ATG, AdF, CD or Arc, record `merge` or `distinct` with the existing CLI, following feature 002, after comparing the texts. Then run `npm run import -- check`. It must pass: schemas, the parts, and text equal to the cached pages.

**Checkpoint**: 71 songs are imported or merged, and the 6 album tracks with no lyrics are reported. "Coule à flots", "Sois seul ma vision", "Viens suis-moi" and "Mon âme éveille-toi" each have two P&C entries on one hymn.

---

## Phase 4: User Story 2 - Browse the hymnal by album (Priority: P1)

**Goal**: the hymnal's numbers come from the album tracklists read live, and are checked against
the pinned table. Tracks with no lyrics, instrumental tracks and the instrumental album are
handled and reported. The hymnal page shows the 6 parts.

**Independent Test**: adapter tests on the album fixtures, the parts invariant test, then the
hymnal page in the personal-use build.

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Add album tests in `tests/import/adapters/petc.test.ts`, following the `listEntries` table of `contracts/petc-adapter.md`:
  - `parseAlbumList(albums.html)` gives the 6 album handles;
  - `parseTracklist(album-dans-ses-mains.html)` gives 10 tracks, with track 7 "Il me gardera (Alicia Roehrig & Philippe Viguier)";
  - `resolveTrack` maps that track to `il-me-gardera-he-will-hold-me-fast`, "A l'Agneau" to `a-l-agneau-sur-son-trone` (prefix match), "Les cieux proclament (Tendry)" to no song page, and "L'espoir (instrumental)" to `instrumental`;
  - `parseHymn` of `…/products/dans-ses-mains#track-5` returns `{ ok: false, reason: 'no lyrics on the site: album track 5 "Les cieux proclament (Tendry)"' }`.
- [X] T026 [P] [US2] Add invariant tests in `tests/import/adapters/petc.test.ts`, reading `content/hymnals.json`:
  - every non-skipped `PETC_ALBUMS` entry has a part with the same `name` and `first` in `pasteur-compagnie.parts`, and the only other part is `{ name: 'Hors album', first: 1000 }`;
  - each album `first` is a multiple of 100 below 1000, with no two equal;
  - `PETC_NUMBERS` numbers are unique;
  - every number below 1000 is `first + track` of a known album;
  - every number from 1001 is a song handle;
  - only the handles of the 4 songs on two albums appear twice.

### Implementation for User Story 2

- [X] T027 [US2] In `scripts/import/sources/petc.ts`, add `PETC_ALBUMS`, with data-model "Album":
  - `hymnes21-2018` (100, "Hymnes21 2018"), `impros-louange` (200, "Impros louange"), `dans-ses-mains` (300, "Dans ses mains"), `kids` (400, "KIDS") and `plus-haut-encore-album` (500, "Plus haut encore");
  - `{ handle: 'kids-album-pistes-instrumentales', skip: 'same tracklist as KIDS' }`.

  Make T026 pass.
- [X] T028 [US2] In `scripts/import/sources/petc.ts`, implement:
  - `parseAlbumList(html)`, which returns the album handles of the grid's product cards only;
  - `parseTracklist(html)`, which returns `{ track: number; title: string }[]` from the album description's numbered lines, with `&nbsp;` and spaces trimmed;
  - `resolveTrack(title, songs)`, which matches with `normalizeText`, ignores every `( … )`, and accepts an equal title or a word-prefix either way. It returns `{ kind: 'song', handle } | { kind: 'kids', track } | { kind: 'none' } | { kind: 'several', handles } | { kind: 'instrumental' }`, where `kind: 'kids'` is used when the album links to `PETC_KIDS_LYRICS` and the track has no song page.
- [X] T029 [US2] In `scripts/import/sources/petc.ts`, make `listEntries` read the album list, each album page in `PETC_ALBUMS` order and the KIDS lyrics page. It skips albums with `skip` and instrumental tracks, logging `skipped: <reason>` for each. It logs `pasteur-compagnie: <a> albums, <t> tracks, <m> matched`. Each resolved track gives `first + track`, and the result is checked against `PETC_NUMBERS`:
  - a pinned number whose page differs from the live track is logged `album <name> track <n>: pinned <page>, site says <page>: keep the pinned number, decide by hand`, and the pinned row wins;
  - `none` and `several` tracks become `<album>#track-<n>` refs.

  Complete `parseHymn` for `#track-<n>` URLs: it re-reads the track title from the album page and returns the reason `no lyrics on the site: album track n "…"` or `album track n "…" matches several song pages`. Make T025 pass.
- [X] T030 [US2] Run the dry run again. The log must show `6 albums, 66 tracks`, the 2 `skipped` lines and no pinned/site difference. The report's skipped list must hold exactly 201, 210, 214, 305, 310 and 504 with their reasons. Run the real import, which should give no content change compared with T024, then `npm run import -- check`.
- [ ] T031 [US2] Check the hymnal page in the personal-use build: set `HYMNIA_PERSONAL_USE=1` in `.env`, then run `npm run dev` and open `/recueils/pasteur-compagnie`, at mobile width, in light and dark mode. Check that:
  - the 6 parts appear in order, with "Hors album" last;
  - "Dans ses mains" runs 301–310 with 305 and 310 missing;
  - "Coule à flots" appears under 105 and 505, and both open the same song;
  - the "go to number" field finds 307.

**Checkpoint**: the albums drive the numbers live, and the hymnal page matches the tracklists.

---

## Phase 5: User Story 3 - Find Pasteur & Compagnie songs in the app (Priority: P1)

**Goal**: search by "P&C n", "PC n", title and lyrics; filter by the hymnal; shared songs show
both references; and nothing appears in a public build.

**Independent Test**: `npm run test:queries` on the real content.

- [X] T032 [P] [US3] Create `tests/queries/pasteur-compagnie.test.ts`, modelled on `tests/queries/exo.test.ts`. It builds with `personalUse: true` and checks:
  - `rank('P&C 307', <id of Il me gardera P&C hymn>) === 1` and `rank('PC 307', same) === 1`, together with 8 more hymnal-plus-number queries taken from data-model "Initial numbers" (SC-003);
  - `rank('Sa grâce est plus grande', id) === 1`;
  - a lyrics fragment query from one P&C song;
  - the hymn of "Coule à flots" has entries `pasteur-compagnie` 105 and 505;
  - one song merged with Evangile21 has both a `pasteur-compagnie` and an `evangile21` entry;
  - a build with `personalUse: false` publishes no hymn with a `pasteur-compagnie` entry whose rights are unconfirmed (SC-006).

  Use the hymn ids produced by T024; read them from `content/hymns/`.
- [X] T033 [US3] Add 3 Pasteur & Compagnie cases (hymnal + number, title, lyrics fragment) to `tests/queries/reference-queries.json`, in the format already used there. Then run `npm run test:queries` and fix any regression in the other hymnals' expectations caused by new titles. That means adjusting the expectation, never the engine, unless a real bug shows. *(Done differently: `reference-queries.json` runs on the sample hymnals only, so the real-content cases are in `tests/queries/pasteur-compagnie.test.ts`, like Exo's.)*
- [ ] T034 [US3] In the personal-use build, check that the hymnal filter offers "Pasteur & Compagnie" and shows only its songs, and that a P&C song can be added to a collection (feature 003). Check on mobile, in light and dark mode.

**Checkpoint**: P&C songs are found like those of any other hymnal.

---

## Phase 6: User Story 4 - Keep the numbers stable over time (Priority: P2)

**Goal**: re-runs change nothing. New songs and albums get free numbers with a clear "not
pinned yet" log. Songs that are no longer listed keep their numbers.

**Independent Test**: adapter tests with altered listings, plus a re-run integration test.

### Tests for User Story 4 ⚠️

- [X] T035 [P] [US4] Add stability tests in `tests/import/adapters/petc.test.ts` with an in-memory `fixtureContext`, built from the fixtures with small changes. Each changed case must log one line and move no existing number:
  - the list pages in another order or split differently give the same refs;
  - an extra song card on no album gets the next number above the highest pinned "Hors album" one and logs `is not pinned yet: add it to PETC_NUMBERS`;
  - an extra album handle not in `PETC_ALBUMS`, with a tracklist, gets the next free hundred below 1000 for its tracks and logs `add it to PETC_ALBUMS and to the parts in content/hymnals.json`;
  - a pinned song missing from every list page is still returned with its number;
  - a "Hors album" song that appears on a new album keeps its 10xx number and gains the album number.
- [X] T036 [P] [US4] Create `tests/import/integration/petc-rerun.test.ts`, modelled on `tests/import/integration/evangile21-rerun.test.ts`. Using the workspace helper, the fixtures and the `petc` adapter with a fixture fetch:
  - a first run writes the hymns, including one hymn with entries 105 and 505;
  - a second run writes no file and reports everything `unchanged`;
  - a third run, with one song card removed, reports it `missing`, keeps the file and keeps the number.

  Limit the fixture refs to the songs that have fixtures, by injecting a reduced `PETC_NUMBERS` through a `createPetcAdapter(numbers, albums)` factory (T037).

### Implementation for User Story 4

- [X] T037 [US4] In `scripts/import/sources/petc.ts`, refactor into `createPetcAdapter(numbers = PETC_NUMBERS, albums = PETC_ALBUMS)`, like `createEvangile21Adapter`, and register `export const petc = createPetcAdapter()`. Then implement the unpinned rules of research R4 in `listEntries`:
  - a known-album track that is not pinned gets `first + track`;
  - a no-album song that is not pinned gets the next free number above the highest pinned one from 1001;
  - an unknown album gets the next free hundred below 1000 not used by `albums`;
  - every pinned row whose page is still a listed handle, a KIDS fragment or an album fragment is returned even if no list shows it;
  - a song page that is pinned but no longer listed is still returned, so that feature 002 reports it as missing only when its page fails.

  Every unpinned case logs the wording of T035. Make T035 and T036 pass.
- [X] T038 [US4] Run the real import a second time and check that `git status content/ import/state/` shows no change (SC-005).

**Checkpoint**: numbers are frozen, and future songs and albums have a documented path.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] Update `scripts/import/sources/README.md` with a section "A hymnal split by albums (Pasteur & Compagnie)". It explains:
  - albums as parts at hundreds;
  - track numbers;
  - "Hors album" from 1001;
  - the two pinned tables, and keeping `PETC_ALBUMS` in step with `content/hymnals.json` parts;
  - tracks with no lyrics reported as skipped `#track-<n>` refs;
  - the same-page rule for a song on two albums;
  - the warnings / "To check by hand" channel, which any adapter may use.
- [X] T040 [P] Update `specs/002-hymnal-import/contracts/source-adapter.md` with two notes: the optional `RawHymn.warnings`, and the reconcile rule that two refs of one source with the same URL in one hymnal are one hymn. Each note links to `specs/010-pasteur-compagnie-hymnal/contracts/petc-adapter.md`.
- [X] T041 Fill in the "Record the counts of the first real run" section at the end of `specs/010-pasteur-compagnie-hymnal/quickstart.md`, using the reports from T024 and T030:
  - pages, failures, new, merged with Evangile21 and others;
  - possible duplicates and the decisions taken;
  - `toCheck` rows;
  - the second run unchanged.
- [X] T042 Run `npm run lint`, `npm run check`, `npm test`, `npm run test:import` and `npm run test:queries`. All must pass. Fix the formatting with `npm run format` if needed.
- [X] T043 Run the whole of `specs/010-pasteur-compagnie-hymnal/quickstart.md` once more from a clean cache (`import/cache/petc/` removed). Tick each check.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 and T003 follow T001.
- **Foundational (Phase 2)**: depends on Phase 1 only for T005 (source record used by T001; T001 may use an inline copy). It blocks every story.
- **US1 (Phase 3)**: depends on Phase 2. It is the MVP.
- **US2 (Phase 4)**: depends on US1 (T022 `listEntries`, T020 parsing). It replaces the pinned-only listing with live albums.
- **US3 (Phase 5)**: depends on the content written in US1 (T024). It can run in parallel with US2 and US4.
- **US4 (Phase 6)**: depends on US2 (T029), because the unpinned rules extend the album-driven listing.
- **Polish (Phase 7)**: after the stories you deliver.

### Within Each User Story

- Tests come first and must fail before the implementation.
- In `petc.ts`, the order is constants and tables, then title, then page parsing, then listing.
- Live runs (T023, T024, T030, T038) come only after their tests pass.

### Parallel Opportunities

- T002 ∥ T003.
- T005 ∥ T006 ∥ T007 ∥ T008, all in different files, while T004 runs first or alongside.
- US1 tests T011–T015 are written together. T011–T014 share `petc.test.ts`, so write them as separate `describe` blocks in one sitting. T015 is in another file.
- T016 (pipeline) ∥ T017–T022 (adapter).
- US3 (T032–T034) ∥ US2/US4 once T024 is done.
- T039 ∥ T040.

---

## Parallel Example: User Story 1

```bash
# Tests, in two files at once:
Task: "T011–T014 petc adapter tests in tests/import/adapters/petc.test.ts"
Task: "T015 same-page reconcile tests in tests/import/unit/reconcile.test.ts"

# Then the implementation, in two files at once:
Task: "T016 same-page rule in scripts/import/pipeline/reconcile.ts"
Task: "T017–T022 adapter in scripts/import/sources/petc.ts"
```

## Parallel Example: after US1

```bash
Task: "T025–T031 albums drive the numbers (US2)"
Task: "T032–T034 search tests on real content (US3)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (fixtures), then Phase 2 (records, helpers, warnings). Stop at the checkpoint.
2. Phase 3. The pinned table alone gives correct numbers and parts on today's site, because the
   parts are data from T004.
3. **Stop and validate**: `check` passes, and the hymnal page already shows the albums.

### Incremental Delivery

1. US1 imports the songs, with numbers from the pinned table. This is the MVP.
2. US2 makes the albums read live, reports tracks with no lyrics properly, and verifies the pins.
3. US3 adds the search guarantees and the public-build check.
4. US4 hardens the import for future songs and albums.
5. Polish covers the docs, the counts and a full green run.

---

## Notes

- Never change or reuse a number in `PETC_NUMBERS`. A change there is a content change and is
  reviewed with the content.
- Keep the lyrics faithful. Fix a parsing rule, never a hymn file by hand. A hand correction goes
  through feature 002's `corrections`.
- Hymns stay `unconfirmed` until a rights decision is recorded with the existing CLI. Do not
  record one in this feature.
- Commit after each phase checkpoint, with the content written by real runs in the same commit
  as the adapter state that produced it.
