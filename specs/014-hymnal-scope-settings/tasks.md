---

description: "Task list for choosing the hymnals used by the app (feature 014)"
---

# Tasks: Choose the hymnals used by the app

**Input**: Design documents from `/specs/014-hymnal-scope-settings/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R6), data-model.md, contracts/scope.md,
quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for search behaviour, and
the workflow requires the reference queries to stay green. Write each test task before the code it
covers and see it fail first.

**Organization**: Tasks are grouped by user story (spec.md):
- US1: leave out a whole hymnal (P1);
- US2: keep only some parts of a hymnal (P2);
- US3: a tidier settings screen, two subsections (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single SvelteKit project at the repository root (plan.md, "Project Structure").

Values used everywhere (data-model.md, contracts/scope.md):
- stored field: `prefs.excluded: Exclusions = { hymnals: string[]; parts: Record<string, number[]> }`,
  default `{ hymnals: [], parts: {} }` (exported as `NO_EXCLUSIONS`), under the existing
  `hymnia.prefs` key; it holds **what is left out**;
- a part is keyed by its `first` number (`HymnalPart.first`);
- normal form (`cleanExclusions`): "unknown hymnal ids and unknown part `first` values are dropped;
  a hymnal in `hymnals` has no `parts` entry; a hymnal whose every part is listed in `parts` moves
  to `hymnals`; if no hymnal is left in use, the result is the default (everything in use)";
- hymnal state: `all` (checked) / `some` (indeterminate) / `none` (unchecked);
- which part holds a number: the part with the greatest `first` ≤ `sortKey[0]`, as in
  `groupByPart` (src/lib/domain/parts.ts); `NO_NUMBER` or below the first part → in no part,
  follows its hymnal;
- request field: `SearchRequest.excluded?: Exclusions`; response field:
  `SearchResponse.outOfScope?: { hymnal: string; number: string }`;
- French strings: « Affichage », « Recueils », « Tout sélectionner », « Gardez au moins un
  recueil. », « N parties sur M », « <Nom> est masqué dans les Réglages. », « Certains recueils
  sont masqués dans les Réglages. », « Ce recueil est masqué dans les Réglages. »,
  « N parties masquées », « Le n° X est dans « <partie> », masqué dans les Réglages. ».

---

## Phase 1: Setup

No dependency, no config. Check the baseline and give the test data a hymnal with parts.

- [X] T001 Run `npm run check`, `npm test`, `npm run test:queries` and `npm run test:e2e` from the repository root and note any failure that exists before this feature
- [X] T002 In tests/fixtures/sample-content/hymnals.json, add `"parts": [{ "name": "Louange", "first": 1 }, { "name": "Noël", "first": 10 }]` to the `he` hymnal (he 1, 2, 3, 3 bis, 7 → Louange; he 12, 13 → Noël). Re-run `npm test` and `npm run test:e2e -- us3-browse`; fix only assertions that depended on `he` having no parts (e.g. headed groups on `/recueils/he`)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The pure scope module, the stored preference and the search contract, used by every
story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [X] T003 [P] Create tests/unit/scope.test.ts for src/lib/scope/scope.ts, with an in-memory hymnal list: `a` (no parts), `b` (no parts), `p` with parts `first` 1, 10, 20. Cover: (a) `sanitizeExclusions` drops non-strings, non-positive-integer part numbers, duplicates and empty `parts` arrays, and returns `NO_EXCLUSIONS` for a non-object; (b) `cleanExclusions` drops unknown hymnal ids and unknown `first` values, removes the `parts` entry of a hymnal listed in `hymnals`, moves `p` to `hymnals` when parts 1, 10 and 20 are all listed, and returns `NO_EXCLUSIONS` when `a`, `b` and `p` are all left out; (c) `createScope(undefined)` and `createScope(NO_EXCLUSIONS)` have `isEmpty === true` and include everything; (d) `hymnalState` gives `all` / `some` / `none`; (e) `includesEntry` for `p` with part 10 left out: numbers 10 and 15 out, 9 and 20 in, a number below 1 (sortKey 0) in, `NO_NUMBER` in; with `p` fully left out all its entries out; (f) `includesHymn` true when one entry of several is in use; (g) `setHymnal(…, true)` from `some` or `none` gives `all`; `setHymnal(…, false)` gives `none`; `setPart` moves through `all` → `some` → `none` and back; (h) `canLeaveOut` is false for the last hymnal in use and for the last part in use when nothing else is in use, and `setHymnal`/`setPart` with `inUse: false` on it return the input unchanged; (i) a hymnal unknown to the list is `all`
- [X] T004 [P] In tests/unit/prefs.test.ts, add: `DEFAULT_PREFS.excluded` equals `{ hymnals: [], parts: {} }`; `sanitizePrefs` keeps a valid `excluded`, repairs an invalid one through `sanitizeExclusions`, and fills it when missing (prefs saved before this feature); update the existing expectations that list every `Prefs` field
- [X] T005 [P] Create tests/unit/engine-scope.test.ts using `loadSample()` (tests/helpers/sample) and `createEngine`, following tests/unit/engine-filter.test.ts. Cover the table of contracts/scope.md §2: (a) with `excluded` absent or `{ hymnals: [], parts: {} }`, responses for « gloire », « 12 », « CE 12 », « HE 7 » equal those without the field; (b) `excluded.hymnals = ['he']`: « gloire » returns no ref to `he`, « douce nuit » (only he 13) returns nothing, `a-toi-la-gloire` keeps only its `ce` ref and `ce` primaryRef; (c) « 12 » with `he` left out lists only `ce 12`; (d) « HE 13 » with `he` left out returns `results: []` and `outOfScope: { hymnal: 'he', number: '13' }` (no `notFound`), « HE 99 » still returns `notFound`; (e) `parts: { he: [10] }` (Noël left out): « HE 12 » gives `outOfScope`, « HE 7 » is found, « les anges » returns nothing; (f) the per-search filter `hymnals: ['he']` with `he` left out behaves as no filter; (g) `resultFor(id, [], excluded)` returns `undefined` for a hymn with no entry in use and limits refs otherwise

### Implementation

- [X] T006 Create src/lib/scope/scope.ts with the API of contracts/scope.md §1: `Exclusions`, `NO_EXCLUSIONS`, `sanitizeExclusions`, `cleanExclusions`, `HymnalState`, `Scope`, `createScope`, `setHymnal`, `setPart`. Types only from src/lib/domain/schema.ts (`Hymnal`, `SortKey`) and `NO_NUMBER` from src/lib/domain/numbering.ts, so it runs in the page, the worker and Node. `createScope` cleans its input, precomputes a `Set` of left-out hymnals and a per-hymnal sorted list of parts, and short-circuits every check when `isEmpty`. Make T003 pass
- [X] T007 In src/lib/prefs/prefs.ts, add `excluded: Exclusions` to `Prefs` ("Hymnals and parts left out (feature 014); empty means all"), `excluded: NO_EXCLUSIONS` to `DEFAULT_PREFS`, and `excluded: sanitizeExclusions(v.excluded)` in `sanitizePrefs`. Make T004 pass
- [X] T008 In src/lib/search/types.ts, add `excluded?: Exclusions` to `SearchRequest` ("Feature 014: what the user left out in Settings; absent = nothing") and `outOfScope?: { hymnal: string; number: string }` to `SearchResponse` ("`hymnal-number` only: the entry exists but is left out in Settings; `results` is empty")
- [X] T009 In src/lib/search/engine.ts, build `const scope = createScope(request.excluded, hymnals)` in `search()` and pass it down: reduce `selected` to ids whose `scope.hymnalState(id) !== 'none'` before building `allowed`; `allowedEntries(hymn, allowed, scope)` also requires `scope.includesEntry(e)`; `isAllowed` becomes "at least one allowed entry"; `searchNumber` skips an entry when `!scope.includesEntry(found.entry)`; in `hymnal-number`, when the entry exists but is out of scope return `{ kind: 'hymnal-number', outOfScope: { hymnal, number }, results: [], sameNumber }` with `sameNumber` from `searchNumber` in scope, otherwise keep today's code with `allowedEntries` in scope (do not push back an out-of-scope `found.entry`). Change `resultFor(hymnId, hymnalIds = [], excluded?)` the same way. Skip all scope work when `scope.isEmpty`. Make T005 pass, then run `npm test` and `npm run test:queries` unchanged
- [X] T010 [P] In tests/unit/meaning-rank.test.ts, add a test for a new `options.allow?: (hymnIndex: number) => boolean`: hymns it rejects are never returned, and it combines (AND) with `options.hymnals`
- [X] T011 In src/lib/meaning/rank.ts, add `allow` to the options and check it inside `isAllowed` (cached per hymn like the filter). In src/lib/meaning/search.ts, build `const scope = createScope(request.excluded, …hymnals)` (take the hymnal list from `engine.catalog` — add `hymnals` to what `searchByMeaning` can read if needed, without changing its callers' other arguments), pass `allow: scope.isEmpty ? undefined : (h) => scope.includesHymn(hymns[h])`, call `engine.resultFor(hymn.id, hymnals, request.excluded)` and `engine.search({ …, excluded: request.excluded })`. Widen `SearchEngineHymns` entries to include `sortKey`. Make T010 pass; run `npm test` and `npm run test:perf`
- [X] T012 [P] In tests/unit/search-examples.test.ts add, then in src/lib/search/examples.ts implement, an optional second argument `pickExamples(catalog, scope?)`: `refs` keep only entries with `scope.includesEntry(ref.entry)`; without it, output unchanged

**Checkpoint**: `npm test`, `npm run test:queries` and `npm run test:perf` green; nothing visible
has changed yet.

---

## Phase 3: User Story 1 - Leave out a whole hymnal (Priority: P1) 🎯 MVP

**Goal**: A hymnal unchecked in Réglages disappears from searches, the Recueils list and the search
filter, and the choice survives a reload.

**Independent Test**: Uncheck « Hymnes d’exemple » in Réglages; « douce nuit » finds nothing; « HE 13 »
says « Hymnes d’exemple est masqué dans les Réglages. »; `/recueils` lists only « Cantiques
d’exemple »; reload: still unchecked.

### Tests for User Story 1

- [X] T013 [P] [US1] Create tests/e2e/us18-hymnal-scope.spec.ts (helpers from tests/e2e/helpers.ts) with a `US1` describe: on a fresh page, `/reglages` lists both sample hymnals checked; uncheck « Hymnes d’exemple »; on `/`, no « Hymnes d’exemple » chip, « douce nuit » shows no result and the « Certains recueils sont masqués dans les Réglages. » line, « HE 13 » shows « Hymnes d’exemple est masqué dans les Réglages. » with a link to `/reglages`, « gloire » results show no `HE` reference; `/recueils` lists one hymnal; reload `/reglages`: still unchecked; the « Cantiques d’exemple » checkbox is disabled with « Gardez au moins un recueil. »; « Tout sélectionner » brings both back and `/recueils` lists two again. Add a test that `/?recueils=he` with `he` left out runs with no filter (FR-014), and one that a collection holding `douce-nuit-sainte-nuit` still lists and opens it, and `/recueils/he/13` opens the hymn (FR-015, FR-016)

### Implementation for User Story 1

- [X] T014 [US1] Create src/lib/components/HymnalScope.svelte (contracts/scope.md §3 `/reglages`), props `hymnals: PublishedHymnal[]` (in `getHymnalsByName()` order). Reads and writes `$prefs.excluded` through `setHymnal` (always the normal form, at once, no confirm). For this story render one row per hymnal: native `<input type="checkbox">` labelled with the hymnal name, `checked` when state is `all`, `indeterminate` when `some`; `disabled` with `aria-describedby` pointing to « Gardez au moins un recueil. » when `!scope.canLeaveOut({ hymnal })` and the hymnal is in use; a caption « Choisissez les recueils proposés dans la recherche et les listes. Vos collections et les liens vers un chant ne changent pas. »; a text button « Tout sélectionner » shown only when `!scope.isEmpty`, setting `NO_EXCLUSIONS`. Rows at least 44 px high, existing tokens only (`--line`, `--paper-raised`…), light and dark
- [X] T015 [US1] In src/routes/reglages/+page.svelte, add a `<section aria-labelledby="scope-title">` after the existing settings with `<h2 id="scope-title">Recueils</h2>` and `<HymnalScope hymnals={catalog.getHymnalsByName()} />`; load the catalog for the page (add src/routes/reglages/+page.ts using `loadCatalog(fetch)` from src/lib/data/store.ts, as src/routes/recueils/+page.ts does)
- [X] T016 [US1] In src/routes/+page.svelte: derive `scope = createScope($prefs.excluded, data.catalog.getHymnals())`; `filterHymnals` keeps hymnals whose state is not `none`; the initial `selected` (URL or saved filter) and the `known` set keep only ids in use; every `client.search` and `client.searchMeaning` request adds `excluded: $prefs.excluded`; `examples = pickExamples(data.catalog, scope)`; when `response.outOfScope` is set, show « <hymnal name> est masqué dans les Réglages. » with a link to `resolve('/reglages')` instead of the not-found state; when a `text` or `meaning` response is empty and `!scope.isEmpty`, add « Certains recueils sont masqués dans les Réglages. » with the same link to the empty state
- [X] T017 [P] [US1] In src/routes/repertoire/[collection]/ajouter/+page.svelte, apply the same chips, initial filter and `excluded` in requests as T016 (no examples, same `outOfScope` and empty-state lines)
- [X] T018 [P] [US1] In src/routes/recueils/+page.svelte, pass only hymnals whose state is not `none` to `HymnalList`
- [X] T019 [P] [US1] In src/routes/recueils/[recueil]/+page.svelte, when the hymnal's state is `none`, show above the list a notice « Ce recueil est masqué dans les Réglages. » with a link to `/reglages` (list kept, FR-017)
- [X] T020 [US1] Run `npm run test:e2e -- us18-hymnal-scope` until the US1 tests pass; run `npm run check`

**Checkpoint**: US1 works on its own: whole hymnals can be left out and come back.

---

## Phase 4: User Story 2 - Keep only some parts of a hymnal (Priority: P2)

**Goal**: Parts listed under their hymnal in Réglages; a left-out part disappears from searches and
from its hymnal page; the hymnal shows a mixed state.

**Independent Test**: Unfold « Hymnes d’exemple », uncheck « Noël »; the hymnal shows « 1 partie sur
2 » and a mixed checkbox; « les anges » finds nothing, « HE 12 » says it is hidden, « HE 7 » is
found; `/recueils/he` has no « Noël » group and shows « 1 partie masquée ».

### Tests for User Story 2

- [X] T021 [P] [US2] In tests/e2e/us18-hymnal-scope.spec.ts add a `US2` describe: the « Hymnes d’exemple » row has a disclosure button « Afficher les parties de Hymnes d’exemple » with `aria-expanded="false"`; after a click, checkboxes « Louange » and « Noël » appear; uncheck « Noël »: the hymnal checkbox is indeterminate (`el.indeterminate === true`) and its caption reads « 1 partie sur 2 »; « les anges » finds nothing; « HE 12 » shows the hidden message; « HE 7 » is found; `/recueils/he` shows « Louange » but no « Noël » heading, and « 1 partie masquée » with a link to Réglages; « Aller au numéro » 12 says « Le n° 12 est dans « Noël », masqué dans les Réglages. »; unchecking « Louange » too is refused only if it is the last item in use (with « Cantiques d’exemple » unchecked first, « Louange » is disabled); checking the hymnal row selects both parts again

### Implementation for User Story 2

- [X] T022 [US2] In src/lib/components/HymnalScope.svelte, for a hymnal with `parts`: a caption « N parties sur M » (parts in use / total; singular « 1 partie sur M »); a disclosure button (`aria-expanded`, `aria-controls`, label « Afficher les parties de <nom> » / « Masquer les parties de <nom> », folded by default) that shows an indented list of part checkboxes in hymnal order, labelled with `part.name`, toggled through `setPart`, disabled with the same « Gardez au moins un recueil. » description when `!scope.canLeaveOut({ hymnal, part: first })`. Clicking the hymnal checkbox when `some` or `none` selects all, when `all` leaves it out
- [X] T023 [P] [US2] In src/routes/recueils/[recueil]/+page.svelte, when the state is `some`: drop the groups whose `part` is left out (and their jump links), keep groups with no part; show « N parties masquées » (singular « 1 partie masquée ») with a link to `/reglages` under the count; in `go()`, when the entry exists but `!scope.includesEntry(found.entry)`, set the message « Le n° X est dans « <part name> », masqué dans les Réglages. »
- [X] T024 [P] [US2] In src/lib/components/HymnalList.svelte add an optional `counts?: Map<string, number>` prop used instead of `hymnal.hymnCount` when present; in src/routes/recueils/+page.svelte pass, for hymnals in state `some`, the number of entries from `catalog.listEntries(id)` with `scope.includesEntry`
- [X] T025 [US2] Run `npm run test:e2e -- us18-hymnal-scope` until US1 and US2 pass; run `npm run check`

**Checkpoint**: US1 and US2 work together; parts can be left out and come back.

---

## Phase 5: User Story 3 - A tidier settings screen (Priority: P3)

**Goal**: Réglages shows two headed subsections, « Affichage » then « Recueils »; theme and text
size behave as before.

**Independent Test**: Open `/reglages`: headings « Réglages » (h1), « Affichage » (h2) with « Thème »
and « Taille du texte » (h3), « Recueils » (h2).

### Tests for User Story 3

- [X] T026 [P] [US3] In tests/e2e/us18-hymnal-scope.spec.ts add a `US3` describe checking the heading outline above (`getByRole('heading', { level })`), that « Thème » and « Taille du texte » come before « Recueils », and that changing the theme to « Sombre » still sets the dark theme (as in tests/e2e/us4-read.spec.ts)

### Implementation for User Story 3

- [X] T027 [US3] In src/routes/reglages/+page.svelte, wrap the theme and text size sections in `<section aria-labelledby="display-title">` with `<h2 id="display-title">Affichage</h2>`; turn their `h2` into `h3` (keep ids `theme-title`, `size-title` and their classes so labelling and the look stay); give both subsection headings one shared style distinct from the `hy-overline` setting labels, using existing type tokens; update the file's header comment (feature 014). Run `npm run test:e2e -- us18-hymnal-scope us4-read`

**Checkpoint**: All three stories pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 [P] In tests/e2e/a11y.spec.ts, add an axe check of `/reglages` with the « Hymnes d’exemple » parts unfolded and one part unchecked, in light and dark
- [X] T029 [P] In tests/perf/search.perf.test.ts, add a case running the lexical searches with a non-empty `excluded` (one hymnal and one part left out) under the same 200 ms budget
- [X] T030 [P] In design/decisions.md §8 « Réglages », add the two subsections and the « Recueils » choice (checkboxes, mixed state, folded parts, last item kept, « Tout sélectionner »)
- [X] T031 Run `npm run check`, `npm run lint`, `npm test`, `npm run test:queries`, `npm run test:perf` and `npm run test:e2e`; all green
- [X] T032 Walk through the manual scenarios 1–8 of specs/014-hymnal-scope-settings/quickstart.md at 390 px and on desktop, in light and dark, with the real data (`npm run dev`), and note any gap

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T002 before any test that uses `he` parts.
- **Foundational (Phase 2)**: after Setup; blocks every story (scope module, prefs, engine).
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: after US1 (it extends `HymnalScope.svelte` and the hymnal page).
- **US3 (Phase 5)**: after US1 (needs the « Recueils » section to exist); independent of US2.
- **Polish (Phase 6)**: after the stories.

### Within Phases

- T003 → T006; T004 → T007 (T007 needs T006); T005 → T009 (needs T006, T008); T010 → T011 (needs
  T009); T012 needs T006.
- T013 written first, passes at T020. T014 → T015; T016 → T017 (same pattern); T018, T019
  independent.
- T021 written first, passes at T025. T022 needs T014; T023 needs T019 (same file); T024 needs T018.
- T026 → T027.

### Parallel Opportunities

- T003, T004, T005 (different test files); then T010 and T012 alongside T009.
- T017, T018, T019 once T016's pattern is set (different routes).
- T023 and T024 alongside T022.
- US3 (T026–T027) alongside US2 once US1 is done.
- T028, T029, T030.

---

## Parallel Example: Foundational tests

```bash
Task: "T003 scope.test.ts"
Task: "T004 prefs.test.ts"
Task: "T005 engine-scope.test.ts"
```

## Parallel Example: User Story 1

```bash
Task: "T017 repertoire/[collection]/ajouter/+page.svelte"
Task: "T018 recueils/+page.svelte"
Task: "T019 recueils/[recueil]/+page.svelte notice"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 and Phase 2: scope module, prefs, engine and meaning search, all tested.
2. Phase 3: whole hymnals can be left out in Réglages and disappear everywhere.
3. **Stop and validate** with `us18-hymnal-scope` (US1) and quickstart scenarios 2, 4, 5, 6, 7.

### Incremental Delivery

1. MVP (US1) → usable: hide hymnals you never sing.
2. US2 → parts (JEM volumes, Arc-en-ciel sections).
3. US3 → the settings screen split into « Affichage » / « Recueils ».
4. Polish → accessibility, performance, design notes, full suite.
