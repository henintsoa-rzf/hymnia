---

description: "Task list for 001-hymnal-browse-search"
---

# Tasks: Browse and Search the Multi-Hymnal Collection

**Input**: Design documents from `/specs/001-hymnal-browse-search/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The constitution requires automated tests for search, data validation and
numbering (Principle V) and a versioned reference query suite for any search change. The spec
defines measurable criteria (SC-002, SC-003, SC-006) that the tests check.

**Design first**: You want to design the front of the app with Claude Design before building
the full app. Phase 3 is a **design gate**: no UI task (screens, components, styles) starts
before it is done. Work that has no UI (data, search engine, tests of the engine) does not
depend on the design and can go ahead in parallel.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story the task belongs to (US1–US5, see spec.md)
- **[MANUAL]**: Done by you, not by an agent

## Path Conventions

Single static project at the repository root (`/home/stan/1-projects/hymnia`): `src/`,
`content/`, `scripts/`, `tests/`, `design/`. See plan.md, "Project Structure".

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the project and its tooling.

- [X] T001 Initialize a SvelteKit 2 + Svelte 5 + TypeScript project at the repository root with `npx sv create` (minimal template, TypeScript, no demo), package name `hymnia`, without touching the existing `.specify/`, `.claude/` and `specs/` folders; result in `package.json`, `svelte.config.js`, `vite.config.ts`, `src/app.html`
- [X] T002 Install dependencies in `package.json`: runtime `minisearch`, `zod`; dev `@sveltejs/adapter-static`, `@vite-pwa/sveltekit`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `tsx`
- [X] T003 Configure `adapter-static` in single-page mode (`fallback: 'index.html'`) in `svelte.config.js`, and disable server rendering with `export const ssr = false;` in `src/routes/+layout.ts`
- [X] T004 [P] Add npm scripts in `package.json`: `data` (`tsx scripts/build-data.ts`), `dev` and `build` (both run `data` first), `preview`, `test`, `test:queries`, `test:perf`, `test:e2e`, `check`, `lint`, `format`
- [X] T005 [P] Create `vitest.config.ts` with three projects: `unit` (`tests/unit/**`), `queries` (`tests/queries/**`), `perf` (`tests/perf/**`)
- [X] T006 [P] Create `playwright.config.ts` with mobile projects (Pixel 7 and iPhone 13) and a `webServer` that runs `npm run build && npm run preview`; tests in `tests/e2e/`
- [X] T007 [P] Add `.gitignore` entries: `node_modules/`, `.svelte-kit/`, `build/`, `static/data/`, `test-results/`, `playwright-report/`
- [X] T008 [P] Configure ESLint (with the Svelte plugin) and Prettier in `eslint.config.js` and `.prettierrc`

---

## Phase 2: Foundational (Data and Search Core, No UI)

**Purpose**: Hymn data, its validation and build, and the search plumbing. Every user story
needs them. None of these tasks depends on the design.

**⚠️ CRITICAL**: No user story starts before this phase is complete.

### Tests (write first, check they fail)

- [X] T009 [P] Unit tests for normalisation in `tests/unit/normalize.test.ts`: case, accents ("Éternel" → "eternel"), `œ`→`oe`, `æ`→`ae`, punctuation, both apostrophes (`'` and `’`) split words, and the original string is never modified (FR-005, FR-020)
- [X] T010 [P] Unit tests for numbering in `tests/unit/numbering.test.ts`: `sortKey` orders "2" < "10" < "123" < "123a" < "123 bis" < "124"; the number is kept "as printed"
- [X] T011 [P] Unit tests for content validation in `tests/unit/build-data.test.ts` using fixtures in `tests/fixtures/content-valid/` and `tests/fixtures/content-invalid/`. Each rule from `data-model.md` must fail the build when broken: "Every `entries[].hymnal` matches an existing hymnal"; "No two entries share the same hymnal and number"; "Hymnal abbreviations are unique after normalisation"; "Every text field is in Unicode NFC"; "Every hymn has at least one section with at least one non-empty line". Also check that hymns with `rights: unconfirmed` are left out of the output and counted in the build report

### Implementation

- [X] T012 [P] Zod schemas and TypeScript types in `src/lib/domain/schema.ts` for Hymnal, Hymn, Section, HymnalEntry, Credit, Source, Correction, exactly as in `data-model.md` and `contracts/content-schema.md`. Enforce: hymnal `id` "Unique, lowercase slug"; `abbreviations` "At least one"; hymn `sections` "At least one, in source order"; `entries` "At least one"; `rights` enum `confirmed`, `public-domain`, `unconfirmed`; section `type` enum `verse`, `chorus`, `bridge`, `other`; section `number` integer or `null` ("`null` for chorus and bridge"); `lines` "At least one"; credit `role` enum `lyrics`, `music`, `translation`, `arrangement`; `retrievedAt` and correction `date` ISO date (YYYY-MM-DD); source `url` string or `null`
- [X] T013 [P] Normalisation function in `src/lib/search/normalize.ts` (Unicode NFD, remove combining accents, lowercase, `œ`→`oe`, `æ`→`ae`, split on spaces, punctuation and both apostrophes), used for both indexing and queries; makes T009 pass
- [X] T014 [P] Numbering helpers in `src/lib/domain/numbering.ts`: `sortKey(number)` (numeric part, then suffix) and `compareEntries`; makes T010 pass
- [X] T015 [P] Sample content in `content/hymnals.json` and `content/hymns/<hymn-id>.json`, following `contracts/content-schema.md`. Two sample hymnals: `ce` "Cantiques d'exemple" (abbreviation "CE") and `he` "Hymnes d'exemple" (abbreviation "HE"), with numbers made up for the sample. About 20 hymns each, **public-domain lyrics only** (e.g. *À toi la gloire*, Edmond Budry, 1884), with `rights: "public-domain"` and `source.name: "Domaine public"`. Include: at least 2 hymns present in both hymnals with different numbers; at least one number with a suffix ("12a") and one with "bis"; hymns with numbered verses, a chorus and a bridge; at least two hymns that share the same number in different hymnals; credits for authors, composers and translators. Text in NFC
- [X] T016 [P] Search index settings in `src/lib/search/index-config.ts`: MiniSearch fields `title` (boost 3), `firstLine` (boost 2), `lyrics` (boost 1); `processTerm` from `normalize.ts`; stored fields needed for results. Shared by the build script and the app
- [X] T017 Data build in `scripts/build-data.ts`. Steps: read `content/`; validate it with `schema.ts` and the five rules from `data-model.md`, stopping with a list of errors if any fail; leave out hymns with `rights: unconfirmed`; derive `firstLine`, entry `sortKey` and hymnal `hymnCount`. Write `static/data/catalog.<hash>.json`, `static/data/index.<hash>.json` (serialised MiniSearch) and `static/data/manifest.json`. Print hymnal and hymn counts and the number of hymns left out. Makes T011 pass (depends on T012–T016)
- [X] T018 Catalog loader in `src/lib/data/catalog.ts`: read `manifest.json`, load the catalog, and provide `getHymnals()`, `getHymn(id)`, `getEntry(hymnalId, number)`, `listEntries(hymnalId)` (sorted by `sortKey`), and `neighbours(hymnalId, number)` for next/previous
- [X] T019 [P] Reading preferences in `src/lib/prefs/prefs.ts`: Svelte store saved to `localStorage`, with every read and write in `try/catch` and defaults if storage is unavailable. Fields: `textScale` "0.85 to 2.0, default 1.0"; `theme` `system` (default), `light`, `dark`; `hymnalFilter` string[] (empty = all)
- [X] T020 Search worker and client in `src/lib/search/worker.ts` and `src/lib/search/client.ts`. The worker loads the serialised index and the catalog and answers `SearchRequest` with `SearchResponse` (types from `contracts/search.md`, in `src/lib/search/types.ts`); for now it only handles `kind: 'empty'`. The client sends the query and ignores any response whose `query` no longer matches the latest one

**Checkpoint**: `npm run data` succeeds on the sample content, and `npm test` passes T009–T011.

---

## Phase 3: Design with Claude Design (Design Gate) 🎨

**Purpose**: Decide how the app looks before building any screen. The data and search work
(Phase 2, and the non-UI tasks of Phases 4–8) can go on at the same time.

- [X] T021 Write the design brief in `design/brief.md` for use in Claude Design. Include:
  - the product promise and constitution Principles II and VI;
  - every screen from `contracts/routes.md`, with each state to design: search with empty query (hymnal list), search typing with number results, search with text results and highlighted excerpts, "no hymn with this number", hymnal filter active, hymnal list, hymnal with "go to number", hymn view (numbered verses, distinct chorus and bridge, credits, source, other references, next/previous, text-size control), settings, page not found;
  - constraints: mobile first (360–430 px wide), also tablet and desktop; light and dark modes; WCAG 2.2 AA contrast; text scale from 0.85 to 2.0; French copy;
  - real sample content taken from `content/` (titles, numbers, one full hymn with verses and chorus, an example result list);
  - expected outputs: colour tokens for light and dark, type scale and fonts, spacing, radius, component specs (search field, result row, hymnal reference badge, filter chips, lyrics view, text-size control, navigation) and one mockup per screen and state
- [X] T022 [MANUAL] Design the app in Claude Design from `design/brief.md`: screens and states listed in T021, in light and dark modes, at phone width and desktop width
- [X] T023 [MANUAL] Approve the design and save the Claude Design handoff in `design/handoff/` (export or handoff bundle, screenshots of every screen and state, any token file). Note the choices made and any departure from the brief in `design/decisions.md`
- [X] T024 Turn the design tokens from `design/handoff/` into CSS custom properties in `src/app.css`: light and dark colours (from `prefers-color-scheme` and a `data-theme` attribute), type scale, spacing, radius, a `--text-scale` variable; load the chosen fonts in `src/app.html`
- [X] T025 App shell in `src/routes/+layout.svelte`, following the design: navigation (Recherche, Recueils, Réglages), apply `theme` and `textScale` from `prefs.ts` to the root element, page structure
- [X] T026 [P] Shared components following the design: `src/lib/components/HymnRef.svelte` (hymnal abbreviation + number badge), `src/lib/components/EmptyState.svelte`, `src/lib/components/NotFound.svelte` (message + link back to search)
- [X] T027 Not-found page in `src/routes/+error.svelte` using `NotFound.svelte` ("not found" page, not an error page, per `contracts/routes.md`)

**Checkpoint**: The design is approved, saved in `design/`, and applied as tokens and an app
shell. Story screens can now be built.

---

## Phase 4: User Story 1 - Open a hymn by hymnal and number (Priority: P1) 🎯 MVP

**Goal**: Typing "CE 12", "ce12" or "CE n°12" opens that hymn; a number alone lists every
hymn with that number.

**Independent Test**: Run `npm run data && npm run dev`, type `ce12`, `CE n°12` and `12`, and
open the result; type `CE 9999` and see the "no hymn" message.

### Tests (write first)

- [X] T028 [P] [US1] Unit tests for the query parser in `tests/unit/query-parser.test.ts`, following "Query interpretation" in `contracts/search.md`: empty, hymnal + number (variants with/without space, `n°`, `no`, `#`, any case, full name), number alone with suffixes ("12a", "12 bis"), unknown hymnal part treated as text, 1–2 characters
- [X] T029 [P] [US1] Unit tests for number search in `tests/unit/engine-number.test.ts`: the exact entry is first (tier 1); `notFound: { hymnal, number }` for a missing number; a number alone lists every hymnal's entry, ordered by hymnal `sortOrder` (FR-002 to FR-004)
- [X] T030 [P] [US1] End-to-end test in `tests/e2e/us1-number.spec.ts` for the four acceptance scenarios of User Story 1 in spec.md

### Implementation

- [X] T031 [US1] Query parser in `src/lib/search/query-parser.ts`; makes T028 pass
- [X] T032 [US1] Number search in `src/lib/search/engine.ts` (lookup table: normalised abbreviation or full name + number → entry; `kind: 'hymnal-number' | 'number'`; `notFound`), called by `worker.ts`; makes T029 pass
- [X] T033 [P] [US1] `src/lib/components/SearchBox.svelte` following the design: focused on load, results while typing with no search button (FR-009), query kept in the URL `?q=` (works with the back button)
- [X] T034 [P] [US1] `src/lib/components/ResultList.svelte` following the design: title, `HymnRef` badges, link to the `primaryRef` URL, "no hymn with this number in <hymnal>" message
- [X] T035 [P] [US1] `src/lib/components/LyricsView.svelte` following the design: title, sections in source order, verse numbers, chorus and bridge visually distinct (FR-013), lines exactly as stored (FR-020)
- [X] T036 [US1] Search screen in `src/routes/+page.svelte` using `SearchBox`, `ResultList` and `client.ts` (search field reachable with no prior navigation, FR-001)
- [X] T037 [US1] Hymn screen in `src/routes/recueils/[recueil]/[numero]/+page.svelte` and `+page.ts`: load the entry with `getEntry`, show `LyricsView` and credits, and show `NotFound` for an unknown hymnal or number

**Checkpoint**: User Story 1 works and T028–T030 pass. This is the MVP.

---

## Phase 5: User Story 2 - Find a hymn by title or a lyric fragment (Priority: P1)

**Goal**: Find a hymn from its title or a line of lyrics, without accents and with a typo,
with the matched words highlighted.

**Independent Test**: `npm run test:queries` reaches the SC-003 targets; in the app,
`a toi la gloir o ressucite` shows the hymn in the top 3 with highlighted words.

### Tests (write first)

- [X] T038 [P] [US2] Unit tests for text search in `tests/unit/engine-text.test.ts`. Cover the "Text matching", "Ranking tiers" and "Output" sections of `contracts/search.md`: prefix match; one typo allowed for words of 5+ letters and none below (FR-006); tier order exact title > title > first line > lyrics (FR-007); one result per hymn, with all its references; the `primaryRef` rule; 1–2 character queries search title starts only
- [X] T039 [P] [US2] Unit tests for excerpts in `tests/unit/excerpt.test.ts`: excerpt is taken from the original text (accents kept), is at most about 120 characters or one line, and `highlights` ranges point at the matched words
- [X] T040 [P] [US2] Reference query suite: `tests/queries/reference-queries.json`, with at least 50 queries on the sample content. Each query has an expected hymn and either a maximum rank or "must be first". Include numbers, titles, lyric fragments, queries without accents, one-typo queries and long pasted verses. Runner in `tests/queries/reference.test.ts` that checks: ≥ 95% in the top 3, and 100% of hymnal+number queries first (SC-003)
- [X] T041 [P] [US2] Performance test in `tests/perf/search.perf.test.ts`, with a synthetic 6,000-hymn collection generated by `tests/perf/generate-corpus.ts`; fails if any test query takes more than 200 ms (SC-002)
- [X] T042 [P] [US2] End-to-end test in `tests/e2e/us2-text.spec.ts` for the five acceptance scenarios of User Story 2 in spec.md

### Implementation

- [X] T043 [US2] Text search in `src/lib/search/engine.ts`: load the serialised MiniSearch index, prefix search, fuzzy limit (1 for words of 5+ letters, else 0), ranking tiers 2–5, one result per hymn with all its references, `primaryRef`; makes T038, T040, T041 pass
- [X] T044 [P] [US2] Excerpt builder in `src/lib/search/excerpt.ts` (find the best matching line in the original text, map normalised matches back to original character ranges); makes T039 pass
- [X] T045 [US2] Show excerpts in `src/lib/components/ResultList.svelte` following the design, with highlighted words in `<mark>` and no change to the original text

**Checkpoint**: User Stories 1 and 2 work on their own; T038–T042 pass.

---

## Phase 6: User Story 3 - Browse a hymnal (Priority: P2)

**Goal**: List hymnals, open one, scroll its hymns in number order, jump to a number.

**Independent Test**: Open `/recueils`, choose a hymnal, use "go to number", open a hymn.

- [X] T046 [P] [US3] End-to-end test in `tests/e2e/us3-browse.spec.ts` for the three acceptance scenarios of User Story 3 in spec.md
- [X] T047 [P] [US3] `src/lib/components/HymnalList.svelte` following the design: each hymnal with its name and hymn count (FR-011)
- [X] T048 [US3] Hymnals screen in `src/routes/recueils/+page.svelte` using `HymnalList`
- [X] T049 [US3] Hymnal screen in `src/routes/recueils/[recueil]/+page.svelte` and `+page.ts`: entries sorted by `sortKey` (number and title), and a "go to number" field that scrolls to that number (FR-012); unknown hymnal → `NotFound`
- [X] T050 [US3] Show `HymnalList` on the search screen when the query is empty, in `src/routes/+page.svelte` (spec edge cases)

**Checkpoint**: User Stories 1–3 work on their own.

---

## Phase 7: User Story 4 - Read a hymn comfortably (Priority: P2)

**Goal**: A comfortable reading view: adjustable text size, credits and source, other
references, next/previous, theme choice.

**Independent Test**: Open a hymn present in both sample hymnals: both references show;
increase text size, go to the next hymn: the size is kept; switch theme in Réglages.

- [X] T051 [P] [US4] End-to-end test in `tests/e2e/us4-read.spec.ts` for the five acceptance scenarios of User Story 4 in spec.md, plus the theme switch (FR-017) and text size kept after reload (FR-015)
- [X] T052 [P] [US4] `src/lib/components/TextSizeControl.svelte` following the design: changes `textScale` in steps, between 0.85 and 2.0, stored with `prefs.ts`
- [X] T053 [P] [US4] `src/lib/components/HymnCredits.svelte` following the design: authors, composers, translators with their role, and the source name, link and date (FR-014)
- [X] T054 [P] [US4] `src/lib/components/OtherRefs.svelte` following the design: every other hymnal + number where the hymn appears, each a link (FR-014, US4 scenario 3)
- [X] T055 [US4] Add `TextSizeControl`, `HymnCredits`, `OtherRefs` and next/previous (buttons and horizontal swipe, using `neighbours()`) to `src/routes/recueils/[recueil]/[numero]/+page.svelte` (FR-016)
- [X] T056 [US4] Settings screen in `src/routes/reglages/+page.svelte` following the design: theme (system, light, dark) and text size

**Checkpoint**: User Stories 1–4 work on their own.

---

## Phase 8: User Story 5 - Narrow search to one or more hymnals (Priority: P3)

**Goal**: Search only in chosen hymnals, with a visible filter that can be cleared in one tap.

**Independent Test**: Select only "CE", search a word found in both hymnals: only CE hymns
show; clear the filter.

- [X] T057 [P] [US5] Unit tests in `tests/unit/engine-filter.test.ts`: with `hymnals: ['ce']`, text, number and hymnal+number searches only return CE entries; `refs` only list the selected hymnals; `primaryRef` uses the first selected hymnal
- [X] T058 [P] [US5] End-to-end test in `tests/e2e/us5-filter.spec.ts` for the three acceptance scenarios of User Story 5 in spec.md
- [X] T059 [US5] Apply the `hymnals` filter in all search kinds in `src/lib/search/engine.ts`; makes T057 pass
- [X] T060 [P] [US5] `src/lib/components/HymnalFilter.svelte` following the design: chips for each hymnal, several can be selected, active filter always visible, one-tap clear (FR-010)
- [X] T061 [US5] Add `HymnalFilter` to `src/routes/+page.svelte`: kept in the URL as `?recueils=<id,id>` and in `prefs.hymnalFilter`, sent with each search

**Checkpoint**: All user stories work on their own.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Offline use, installation, accessibility, size limits, documentation.

- [X] T062 Configure `@vite-pwa/sveltekit` in `vite.config.ts`. Precache the app and `static/data/*` (hashed files). Write the web app manifest: name "Hymnia", `lang: "fr"`, theme colours and icons from `design/handoff/`, icons in `static/icons/`. Detect a new `static/data/manifest.json` and offer a reload (FR-018)
- [X] T063 [P] End-to-end offline test in `tests/e2e/offline.spec.ts`: visit once, go offline, reload, and redo one scenario from each user story (SC-006)
- [X] T064 [P] End-to-end accessibility test in `tests/e2e/a11y.spec.ts`: axe (WCAG 2.2 AA) on every screen in `contracts/routes.md`, in light and dark modes, at text scale 1.0 and 2.0; zero violations
- [X] T065 [P] Size check in `scripts/build-data.ts`: report the compressed size of the catalog plus the index, and fail above 5 MB (plan constraint)
- [X] T066 [P] Write `README.md` at the repository root: what the app is, how to run it (link to `specs/001-hymnal-browse-search/quickstart.md`), how to add content (link to `contracts/content-schema.md`), where the design lives (`design/`)
- [ ] T067 [MANUAL] Compare each screen with `design/handoff/` on a real phone in light and dark modes, and list any differences in `design/decisions.md`
- [X] T068 Run every check in `specs/001-hymnal-browse-search/quickstart.md` and fix any failure

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup. Blocks all user stories.
- **Design gate (Phase 3)**: T021 needs the sample content (T015). T022–T023 are yours.
  T024–T027 need T023. **Every UI task in Phases 4–9 needs Phase 3**.
- **User stories (Phases 4–8)**: after Phase 2 (non-UI tasks) and Phase 3 (UI tasks).
- **Polish (Phase 9)**: after the stories you want to ship.

### What can go ahead while you design (Phase 3)

These tasks have no UI and only need Phase 2:

- US1: T028, T029, T031, T032
- US2: T038, T039, T040, T041, T043, T044
- US5: T057, T059

These are already built when the design is approved, so building the screens is quick.

### User Story Dependencies

- **US1 (P1)**: after Phases 2 and 3. No dependency on other stories.
- **US2 (P1)**: after Phases 2 and 3. Reuses `ResultList.svelte` (T034) from US1 for the
  excerpt display (T045).
- **US3 (P2)**: after Phases 2 and 3. T050 changes the search screen built in US1 (T036).
- **US4 (P2)**: after Phases 2 and 3. Extends the hymn screen built in US1 (T037).
- **US5 (P3)**: after Phases 2 and 3. T061 changes the search screen built in US1 (T036).

### Within Each User Story

- Tests first; check that they fail.
- Engine (`engine.ts`, `query-parser.ts`, `excerpt.ts`) before the components that show its
  results.
- Components before the screens that use them.
- `engine.ts` is changed by T032, T043 and T059: do these one after the other.

### Link with feature 002 (hymnal import)

The import feature (`specs/002-hymnal-import/`) must write files in the format of
`contracts/content-schema.md`. Once real hymnals are imported, run `npm run data` and the
reference query suite again, and add real-content queries to
`tests/queries/reference-queries.json`.

---

## Parallel Examples

### Phase 2

```text
T009 tests/unit/normalize.test.ts    T010 tests/unit/numbering.test.ts    T011 tests/unit/build-data.test.ts
T012 src/lib/domain/schema.ts        T013 src/lib/search/normalize.ts     T014 src/lib/domain/numbering.ts
T015 content/                        T016 src/lib/search/index-config.ts  T019 src/lib/prefs/prefs.ts
```

### During the design gate

```text
T028 + T029 (US1 tests) → T031 → T032
T038 + T039 + T040 + T041 (US2 tests) → T044, then T043
```

### User Story 4

```text
T051 tests/e2e/us4-read.spec.ts
T052 TextSizeControl.svelte    T053 HymnCredits.svelte    T054 OtherRefs.svelte
then T055 (hymn screen)
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3: write the brief (T021), then design in Claude Design (T022–T023). Meanwhile, an
   agent builds the non-UI search engine tasks of US1 and US2.
3. Apply the design (T024–T027).
4. Phase 4, User Story 1. **Stop and check**: open a hymn by number on a phone.

### Incremental Delivery

1. Add US2 (text search). This completes the P1 scope: "find any hymn".
2. Add US3 (browse), then US4 (comfortable reading).
3. Add US5 (filter).
4. Phase 9: offline, install, accessibility, then deploy.

---

## Notes

- **[MANUAL]** tasks (T022, T023, T067) are yours. An agent running `/speckit-implement` must
  stop at T022 and wait for the design handoff in `design/handoff/`.
- "Following the design" means: use the tokens in `src/app.css` and match the screens and
  states in `design/handoff/`. When the design does not cover something, keep it minimal and
  note it in `design/decisions.md`.
- Commit after each task or group of related tasks.

## Implementation log

**2026-11-11, first run**: Phases 1–2, the brief (T021), and the search tasks without UI from
US1, US2 and US5 are done. The size check (T065) was built into the data build. Stopped at T022
(design in Claude Design).

Deviations from the tasks as written:

- **T001–T002**: SvelteKit 2 as planned, with Vite 8 and `@sveltejs/vite-plugin-svelte` 7
  (SvelteKit 2's current peers). `.npmrc` sets `legacy-peer-deps=true`, because npm 10.9
  crashes ("Cannot read properties of null (reading 'edgesOut')") while resolving optional peer
  dependencies of Vitest and the PWA plugin.
- **T015**: The sample has 12 hymns (10 in CE, 7 in HE, 5 shared), not about 20 per hymnal, and
  has no bridge. The lyrics are public domain but were typed from memory. Their source says
  "texte non vérifié", and they must not be published as they are.
- **T032 / contracts/search.md**: A hymnal + number query no longer runs a text search after the
  exact hit, because the extra results were noise. A hymnal typed explicitly is honoured even when
  the filter excludes it (T057 tests this).
- **T043 / contracts/search.md**: Tiers 3 and 4 need every query word to match the title or
  first line. Prefix matching starts at 3 letters (2 for the word being typed).
- **T041**: The budget is 50 ms per search in Node, taken as 200 ms on a phone 4× slower. On
  6,000 synthetic hymns: slowest search 30.5 ms, index load 238 ms, data 4.50 MB compressed.

**2026-11-11, second run**: The design handoff arrived (`design/handoff/`, `design/decisions.md`).
All tasks are done except T067 (comparison on a real phone, yours). Checks: lint and type check
clean; 97 unit tests, 70 reference queries and the performance test pass; 36 end-to-end tests
pass on the `android` project (Chromium, Pixel 7), including offline and axe (WCAG 2.2 AA, light
and dark, text at 100 % and 200 %).

Deviations:

- **T022–T023**: done in Claude Design; the PNG captures listed in `design/decisions.md` §12 were
  not exported, so the `*.dc.html` sources were the reference.
- **Engine (contracts/search.md)**: `sameNumber` ("Autres chants n° 7" under the exact hymn) and
  `unknownHymnal` ("Aucun recueil « JEM »") added for the design.
- **T025**: navigation is Recherche · Recueils · Répertoire, with Réglages behind an icon
  (design decision). `/repertoire` is a minimal bookmark list kept on the device (D1); it is
  added to `contracts/routes.md`.
- **Not built**: search by meaning ("Par le sens"), shown in the design but outside spec 001.
- **T062**: `@vite-pwa/sveltekit` 2 replaces `SvelteKitPWA()` by `withPwa()`, which runs the
  SvelteKit plugin with the options from `svelte.config.js` (hence the harmless "svelte.config.js
  is ignored" message). `magicast` is a required build dependency. `vite preview` does not serve
  `index.html`, so the service worker cannot install there: `npm run serve`
  (`scripts/serve-build.ts`) serves `build/` like a static host, and Playwright uses it.
- **T030–T064, iPhone**: the `iphone` (WebKit) project cannot run on this machine: WebKit needs
  system libraries (`sudo npx playwright install-deps webkit`). Only `android` was run.
- **Icons**: generated by `scripts/make-icons.ts` (Literata "H" on the rubric red).
