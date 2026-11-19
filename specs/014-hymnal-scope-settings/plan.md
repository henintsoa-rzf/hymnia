# Implementation Plan: Choose the hymnals used by the app

**Branch**: `014-hymnal-scope-settings` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-hymnal-scope-settings/spec.md`

## Summary

The user chooses, in Réglages, which hymnals and which parts of a hymnal the app offers. The choice
is stored per device in the existing preferences as what was **left out** (`prefs.excluded`), so new
hymnals and parts are in by default (R1). One pure module, `src/lib/scope/scope.ts`, holds the
normal form (R2) and answers « is this entry / hymn / part in use? » (R3).

Search applies it inside the engine: the request carries `excluded`, the engine filters entries
wherever it applies the hymnal filter today, and search by meaning skips left-out hymns before
scoring (R4). A « JEM 800 » query on a hidden part says so instead of « introuvable ». Lists
(Recueils, hymnal page, filter chips, search examples) use the same module (R5). The hymn page,
collections, recent hymns and direct links are untouched.

The settings screen gets two `h2` subsections, « Affichage » (theme, text size: unchanged) and
« Recueils »: native checkboxes with a mixed state for partly used hymnals, parts folded under a
disclosure, the last item in use disabled, « Tout sélectionner » (R6).

No change to the content, the catalog, the search index, the meaning data or the worker messages'
types beyond two optional fields.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (`adapter-static`, SSR off)

**Primary Dependencies**: Existing only (MiniSearch, zod). No new dependency.

**Storage**: `localStorage` key `hymnia.prefs` (existing), new field `excluded`. Guarded access,
private-mode fallback already in `prefs.ts`.

**Testing**: Vitest unit (new `scope.test.ts`, `engine-scope.test.ts`; additions to `prefs`,
`meaning-rank`, `search-examples`), reference queries (`test:queries`, unchanged), perf
(`test:perf`, one case with a choice), Playwright e2e (new `us18-hymnal-scope.spec.ts`), axe on
`/reglages` with parts unfolded (`a11y.spec.ts`).

**Target Platform**: Mobile browsers first (iOS Safari, Android Chrome), desktop browsers; PWA,
offline-first.

**Project Type**: Static web app (SvelteKit PWA). The Cloudflare Worker is not touched.

**Performance Goals**: Lexical search < 200 ms on the full corpus with any choice (SC-004); the scope
check costs one set lookup and at most 15 part comparisons per hit. Meaning ranking: per-hymn cache,
same cost as the hymnal filter. Settings changes apply at once (FR-008).

**Constraints**: WCAG 2.2 AA light and dark; 44 px touch targets; nothing new on screens when no
choice is made (Principle II); default behaviour byte-identical (reference queries).

**Scale/Scope**: 10 hymnals, 34 parts. One new pure module, one new component
(`HymnalScope.svelte`), small changes to `prefs.ts`, `engine.ts`, `types.ts`, `meaning/rank.ts`,
`meaning/search.ts`, `search/examples.ts`, `HymnalList.svelte`, and five routes (`/reglages`, `/`,
`/recueils`, `/recueils/[recueil]`, `/repertoire/[collection]/ajouter`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Search at the heart | Search stays on the main screen and gets faster to use (fewer irrelevant hits). Lexical and meaning search keep their roles; filters by hymnal still combine. The 200 ms target is checked with a choice applied (perf test). | Pass |
| II. Clean design | One purpose per subsection; nothing added to the search or reading screens unless a choice is made, and then only on empty or hidden results. Parts folded by default. | Pass |
| III. Text fidelity | No text changes; references shown are real entries. Personal-use copy: only hymnals present are listed. | Pass |
| IV. Multi-hymnal model | The choice works on entries, so a hymn in several hymnals stays one hymn, shown through its hymnals in use. Stored with user preferences, apart from hymn data. A new hymnal needs no code change and is in by default. | Pass |
| V. Simplicity | No dependency, no new storage, no new worker message; one pure tested module used everywhere. Search changes covered by unit, reference and perf tests. | Pass |
| VI. Accessibility | Native checkboxes (keyboard, mixed state announced), disclosure with `aria-expanded`, disabled reason described, headings nested; offline unaffected (all on device). | Pass |
| Workflow: reference queries | Default path unchanged, proven by the existing reference set; new engine cases in `engine-scope.test.ts`. | Pass |
| Workflow: mobile, light and dark | Quickstart and e2e at phone width, both themes. | Pass |

Re-check after Phase 1: unchanged, all pass. No entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/014-hymnal-scope-settings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── scope.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── scope/
│   │   └── scope.ts                     # NEW: Exclusions, cleanExclusions, createScope, setHymnal, setPart
│   ├── prefs/prefs.ts                   # Prefs.excluded, sanitize, default
│   ├── search/
│   │   ├── types.ts                     # SearchRequest.excluded, SearchResponse.outOfScope
│   │   ├── engine.ts                    # scope in allowedEntries / isAllowed / searchNumber / hymnal-number / resultFor
│   │   └── examples.ts                  # pickExamples(catalog, scope)
│   ├── meaning/
│   │   ├── rank.ts                      # options.allow
│   │   └── search.ts                    # builds allow from the request scope; passes excluded on
│   └── components/
│       ├── HymnalScope.svelte           # NEW: Recueils subsection (checkboxes, parts, disclosure)
│       └── HymnalList.svelte            # optional count override for partly used hymnals
└── routes/
    ├── reglages/+page.svelte            # two subsections; h2 → h3 for existing settings
    ├── +page.svelte                     # chips, initial filter, excluded in requests, notices, examples
    ├── recueils/+page.svelte            # hymnals in use only
    ├── recueils/[recueil]/+page.svelte  # hidden parts, notices, go-to-number message
    └── repertoire/[collection]/ajouter/+page.svelte  # chips, filter, excluded in requests

tests/
├── unit/
│   ├── scope.test.ts                    # NEW
│   ├── engine-scope.test.ts             # NEW
│   ├── prefs.test.ts                    # excluded sanitising
│   ├── meaning-rank.test.ts             # allow predicate
│   └── search-examples.test.ts          # examples within the scope
├── perf/                                # one case with a choice
└── e2e/
    ├── us18-hymnal-scope.spec.ts        # NEW
    └── a11y.spec.ts                     # /reglages with parts unfolded
```

**Structure Decision**: The existing single SvelteKit app. Logic in a pure module under
`src/lib/scope/` (runs in the page, the worker and Node tests); components read `prefs.excluded`,
build a scope with the catalog's hymnals and only render.

## Complexity Tracking

No violations.
