---

description: "Task list for highlighting the matching stanza (feature 013)"
---

# Tasks: Highlight the matching stanza

**Input**: Design documents from `/specs/013-meaning-stanza-highlight/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R7), data-model.md,
contracts/stanza-mark.md, quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for search behaviour.
Write each test task before the code it covers and see it fail first.

**Organization**: Tasks are grouped by user story (spec.md):
- US1: see the stanza that matched (P1);
- US2: the mark belongs to the search, not to the hymn (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Single SvelteKit project at the repository root (plan.md, "Project Structure").

Values used everywhere (research.md, contracts/stanza-mark.md):
- URL parameter: `passage=<n>`, `n` = 0-based index in `hymn.sections` of the **first section of
  the stanza group** (`group.sections[0]`, equal to the meaning row's `section`);
- result field: `SearchResult.matchedSection?: number`, "Set only when the result's `excerpt` is
  that group's excerpt";
- mark class: `hb-stanza--match`: background `var(--meaning-soft)`, 3 px left bar
  `var(--meaning)`, text does not move horizontally, no animation,
  `scroll-margin-top: var(--space-6)`;
- screen reader prefix, first marked stanza only:
  `<span class="hb-sr">Passage correspondant à votre recherche : </span>`;
- grouping threshold: `MEANING_CONFIG.minSectionChars` (40).

---

## Phase 1: Setup

Nothing to set up: no dependency, no config, no data rebuild. Check the baseline is green.

- [X] T001 Run `npm run check`, `npm test` and `npm run test:e2e -- us15-meaning-search` from the repository root and note any failure that exists before this feature

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The shared grouping function and the result field, needed by both stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [X] T002 [P] In tests/unit/meaning-stanzas.test.ts, add tests for a new exported `stanzaGroups(sections, minSectionChars?)` returning `{ sections: number[]; lines: string[] }[]`: (a) one group per distinct section, `sections` = `[i]`; (b) a chorus repeated after each verse appears once, with the index of its first occurrence; (c) a short section (< 40 chars) after a verse joins that verse's group (`sections` = `[verse, short]`, lines concatenated); (d) a short first section is carried into the next one (`sections` = `[0, 1]`); (e) a trailing carry with no next section still forms a group. Keep every existing `indexedStanzas` test unchanged so they prove its output did not move
- [X] T003 [P] In tests/unit/meaning-fuse.test.ts, extend `cand()` so a candidate can carry `matchedSection` (default e.g. `2`), and add one test per row of the `matchedSection` table in specs/013-meaning-stanza-highlight/contracts/stanza-mark.md: meaning only → set; both with meaning winning → set; both with words winning and a word excerpt → absent; both with words winning and no word excerpt → set (meaning excerpt kept); words only → absent

### Implementation

- [X] T004 In src/lib/meaning/stanzas.ts, extract steps 1–2 of `indexedStanzas` (distinct sections, short ones joined to a neighbour) into an exported `stanzaGroups(sections: { lines: string[] }[], minSectionChars = MEANING_CONFIG.minSectionChars): StanzaGroup[]` with `export type StanzaGroup = { sections: number[]; lines: string[] }`. Every join must append the joined section's index to `sections`. Make `indexedStanzas` call it and emit `section: g.sections[0]`; its rows and texts must stay byte for byte the same (T002 and the existing tests pass)
- [X] T005 In src/lib/search/types.ts, add to `SearchResult` the optional field `matchedSection?: number` with a doc comment: "Search by meaning: index in hymn.sections of the first section of the stanza group that ranked the hymn. Set only when `excerpt` is that group's excerpt (specs/013-meaning-stanza-highlight)"
- [X] T006 In src/lib/meaning/fuse.ts, add `matchedSection: number` to `MeaningCandidate`; in `build()`, set `matchedSection` on the result only when the excerpt kept is `m.excerpt` (meaning-only results; `both` results where `meaningWins`, or where `w.excerpt` is undefined); never on words-only results. T003 passes
- [X] T007 In src/lib/meaning/search.ts, fill `matchedSection: hit.section` on each `MeaningCandidate` pushed in `searchByMeaning`

**Checkpoint**: `npm test` green; meaning results carry `matchedSection`; the meaning data is unchanged (no `npm run data` needed).

---

## Phase 3: User Story 1 - See the stanza that matched (Priority: P1) 🎯 MVP

**Goal**: Opening a hymn from a search-by-meaning result marks the stanza that ranked it and
brings it into view when it is not fully visible.

**Independent Test**: Run a search by meaning whose best match for a hymn is not its first
stanza; tap it; that stanza is marked, fully visible without scrolling, no other stanza is marked.

### Tests for User Story 1

- [X] T008 [P] [US1] Create tests/unit/meaning-passage.test.ts for `markedSections(sections, param, minSectionChars?)` from src/lib/meaning/passage.ts: a group start returns all of that group's `sections` (including a joined short section); `null`, `''`, `'abc'`, `'-1'`, `'1.5'`, `' 2'`, an index ≥ `sections.length`, and an index that is inside a group but not its first section all return `[]`
- [X] T009 [P] [US1] Create tests/e2e/us17-stanza-mark.spec.ts using `mockEmbed`, `search` and `launchMeaning` from tests/e2e/helpers.ts. Pick, from the e2e data, a hymn with at least 3 verses and use the text of a later verse as the query so the fake embedder ranks that verse first (assert it is the first result and its excerpt starts with that verse). Cover: (1) the result link has `?passage=`; after the tap, exactly the stanza(s) of that group have class `hb-stanza--match` and contain the excerpt's first line; (2) at 360×640 the marked stanza is inside the viewport and above `.hy-readbar`; (3) a result whose excerpt is the first verse opens with `window.scrollY === 0` and the first verse marked; (4) a matching chorus repeated after each verse is marked once; (5) `/recueils/<hymnal>/<number>?passage=999` and `?passage=abc` show no `.hb-stanza--match` and `scrollY === 0`; (6) the marked stanza contains the hidden text « Passage correspondant à votre recherche »; (7) axe (`@axe-core/playwright`) shows no violation on a marked hymn, in light and in dark (`data-theme`)

### Implementation for User Story 1

- [X] T010 [US1] Create src/lib/meaning/passage.ts exporting `markedSections(sections: { lines: string[] }[], param: string | null, minSectionChars = MEANING_CONFIG.minSectionChars): number[]`: return `[]` unless `param` matches `^\d+$`, is `< sections.length`, and equals `sections[0]` of a group from `stanzaGroups(sections, minSectionChars)`; otherwise return that group's `sections`. Header comment pointing to specs/013-meaning-stanza-highlight/contracts/stanza-mark.md. T008 passes
- [X] T011 [US1] In src/lib/components/ResultList.svelte, in the text-results row (the `<a class="hy-result" href={hymnUrl(...)}>` around line 147), append `?passage=${result.matchedSection}` to the href when `result.matchedSection !== undefined`; do not change the exact-hymn card or the number rows
- [X] T012 [US1] In src/lib/components/LyricsView.svelte, make `blocks` keep each printed section's source index (`{ section, index }` with `index` in `hymn.sections`), add a prop `marked: number[] = []`, add class `hb-stanza--match` to a block whose `index` is in `marked`, and put `<span class="hb-sr">Passage correspondant à votre recherche : </span>` first inside the first marked block only (before the number or label). Lines, numbers and labels stay exactly as today (FR-007); update the header comment
- [X] T013 [P] [US1] In src/app.css, after `.hb-stanza--bridge`, add `.hb-stanza--match`: `background: var(--meaning-soft)`; a 3 px left bar in `var(--meaning)` drawn inside the existing left padding (for example `box-shadow: inset 3px 0 0 var(--meaning)` or a `::before`), so the text does not move horizontally; a small radius and vertical padding with an equal negative margin so the stanza spacing does not change; `scroll-margin-top: var(--space-6)`; no transition or animation. It must work with `.hb-stanza--refrain` and `.hb-stanza--bridge`
- [X] T014 [US1] In src/routes/recueils/[recueil]/[numero]/+page.svelte, compute `const marked = $derived(data.found ? markedSections(data.found.hymn.sections, page.url.searchParams.get('passage')) : [])` and pass `marked` to `<LyricsView>`
- [X] T015 [US1] In the same file, import `afterNavigate` and `tick`; in `afterNavigate(async ({ type }) => …)`, return when `type === 'popstate'`; after `await tick()`, take the first `.hb-stanza--match` (none → return); compute `bottomLimit = innerHeight - (height of a visible .hy-readbar, else 0)`; if its `getBoundingClientRect().top < 0` or `.bottom > bottomLimit`, call `scrollIntoView({ block: 'start' })` (instant); otherwise do not scroll (FR-003, research R5)
- [X] T016 [US1] Run `npm run test:e2e -- us17-stanza-mark` and fix until scenarios 1–7 of T009 pass

**Checkpoint**: US1 works on its own: a meaning result opens with its stanza marked and in view.

---

## Phase 4: User Story 2 - The mark belongs to the search, not to the hymn (Priority: P2)

**Goal**: No mark on a hymn reached any other way; the mark comes back when the same result is
opened again.

**Independent Test**: Open a hymn from a meaning result (marked), go next then previous: no mark.

### Tests for User Story 2

- [X] T017 [US2] In tests/e2e/us17-stanza-mark.spec.ts, add a `US2` describe: (1) from a marked hymn, next (reading bar on phone, or the arrow key) then previous → no `.hb-stanza--match` and no `passage` in the URL; (2) browser back to the results, tap the same result → marked again; (3) the same hymn opened from its hymnal list (`/recueils/<hymnal>`) and from « Récemment consultés » on `/` → no mark; (4) a word-mode search result (`search(page, 'Noël')` without launching meaning) → link without `passage`, no mark; (5) back/forward onto a marked hymn keeps the scroll position the browser restored (no jump)

### Implementation for User Story 2

- [X] T018 [US2] Check that every other hymn link (previous/next and the desktop index in src/routes/recueils/[recueil]/[numero]/+page.svelte, src/lib/components/OtherRefs.svelte, src/lib/components/RecentHymns.svelte, hymnal and collection pages) is built with `hymnUrl`/`hymnInCollectionUrl` and never copies `page.url.search`; fix any that would carry `passage`. Check that `hymnHistory.record` in the hymn page stores hymnal and number only. T017 passes

**Checkpoint**: US1 and US2 both pass `npm run test:e2e -- us17-stanza-mark`.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T019 [P] Update the result and reading-view comments that describe meaning results (header comment of src/lib/components/ResultList.svelte, `SearchResult.excerpt` doc in src/lib/search/types.ts) to mention the `passage` link
- [X] T020 Run the full suite: `npm run check`, `npm run lint`, `npm test`, `npm run test:e2e`; all green (us15 unchanged)
- [ ] T021 Walk through the manual scenarios 1–8 of specs/013-meaning-stanza-highlight/quickstart.md at 360 px and on desktop, in light and dark, and note any gap

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; blocks both stories (`stanzaGroups`, `matchedSection`).
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: after US1 (it checks that the US1 mark does not leak; without US1 there is
  nothing to see).
- **Polish (Phase 5)**: after the stories.

### Within Phases

- T002 → T004; T003 → T006; T005 → T006 → T007.
- T008 → T010; T010 → T014; T012 → T014 → T015; T011, T013 independent of T012; T009 written
  first, passes at T016.
- T017 → T018.

### Parallel Opportunities

- T002 and T003 (different test files).
- T008 and T009 (different test files).
- T011 (ResultList), T012 (LyricsView) and T013 (app.css) touch different files once T010 is done;
  T013 can start any time.
- T019 alongside T020's first runs.

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "T008 unit tests for markedSections in tests/unit/meaning-passage.test.ts"
Task: "T009 e2e scenarios in tests/e2e/us17-stanza-mark.spec.ts"

# Then, in parallel after T010:
Task: "T011 ?passage= on result links in src/lib/components/ResultList.svelte"
Task: "T012 marked prop and sr prefix in src/lib/components/LyricsView.svelte"
Task: "T013 .hb-stanza--match in src/app.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (baseline) and Phase 2 (grouping + result field).
2. Phase 3: the mark and the scroll.
3. **Stop and validate**: quickstart scenarios 1, 2, 3, 6, 7, 8.

US2 holds mostly by construction (no other link carries `passage`); Phase 4 locks it with tests.

### Incremental Delivery

1. Phases 1–2 → results carry `matchedSection` (invisible).
2. Phase 3 → the mark ships (MVP).
3. Phase 4 → leak-proof, tested.
4. Phase 5 → full suite and manual pass.

---

## Notes

- The meaning data, its version and the ranking do not change; do not run `npm run data` for this
  feature unless T001 shows the e2e data is missing.
- Keep the lyrics exactly as stored (Principle III): the mark is a class and a hidden prefix only.
- Commit after each phase.
