# Implementation Plan: Alphabetical order of the hymnal list

**Branch**: `009-alphabetical-hymnal-list` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-alphabetical-hymnal-list/spec.md`

## Summary

Show the hymnals in alphabetical order of their name on the Recueils screen and in the two
hymnal filters (search screen, add-to-collection screen). The catalog gains one lookup,
`getHymnalsByName()`, computed once from the listed hymnals with a French collator
(`Intl.Collator('fr', { sensitivity: 'base' })`, ties broken by id). The three screens that show
a hymnal list switch to it. `getHymnals()` keeps the editorial `sortOrder`, so search priority,
the hymn page's other numbers and the start-screen examples do not change (FR-006).

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (static adapter, PWA)

**Primary Dependencies**: Existing only. `Intl.Collator` is built into browsers and Node.

**Storage**: N/A. The published `hymnals.json` and catalog format do not change.

**Testing**: Vitest (`unit` project), Playwright + axe (e2e on `tests/fixtures/sample-content`)

**Target Platform**: Mobile-first web app / PWA, offline-capable; desktop layout ≥ 1024 px

**Project Type**: Single SvelteKit web app (static), no backend

**Performance Goals**: No measurable change. A sort of about 10 names, done once per catalog load.

**Constraints**: Search ranking and primary-number choice unchanged (FR-006); list contents
unchanged (FR-007); same order on every device (FR-003)

**Scale/Scope**: 1 catalog lookup added, 3 screens switched to it, unit and e2e tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Recherche au cœur | Search results, ranking and primary hymnal unchanged: the engine still orders by `sortOrder`. Filter chips are only reordered. | ✅ |
| II. Design épuré | No new element; the same rows and chips, in an order a reader can predict. | ✅ |
| III. Fidélité et droits | Names shown exactly as today; no content change. | ✅ |
| IV. Modèle unifié | Applies to every hymnal with no per-hymnal setting; a new hymnal takes its place by name (FR-005). | ✅ |
| V. Simplicité | One derived list in the catalog, no data format change, no new dependency. | ✅ |
| VI. Accessibilité / hors ligne | DOM order = visual order, so screen readers and keyboard follow the new order; works offline (pure computation). | ✅ |
| Flux qualité | Reference query sets unaffected (search unchanged); unit test on the real hymnal names; e2e on both screens. | ✅ |

Post-design re-check (after Phase 1): unchanged, all ✅. No Complexity Tracking entry.

## Project Structure

### Documentation (this feature)

```text
specs/009-alphabetical-hymnal-list/
├── plan.md              # This file
├── research.md          # Phase 0: where to sort, collation rules, what keeps sortOrder
├── data-model.md        # Phase 1: derived list only, no stored data
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── catalog.md       # Phase 1: getHymnalsByName() and the screens using it
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── lib/data/catalog.ts                          # + getHymnalsByName() (collator, id tiebreak)
└── routes/
    ├── recueils/+page.svelte                    # HymnalList ← getHymnalsByName()
    ├── +page.svelte                             # HymnalFilter ← getHymnalsByName()
    └── repertoire/[collection]/ajouter/+page.svelte  # HymnalFilter ← getHymnalsByName()

tests/
├── unit/catalog.test.ts                         # order on the real names, accents, ties, empty hidden
└── e2e/us3-browse.spec.ts, us5-filter.spec.ts   # rows and chips in name order, same on all screens
```

**Structure Decision**: Single SvelteKit app, as for features 001–008. The order lives in the
catalog, next to the "listed hymnals" rule, so the three screens share one list and cannot drift
apart (SC-002). `getHymnals()` is not changed, because the search engine, `pickExamples` and the
hymn page rely on its priority order.

## Complexity Tracking

No violation; nothing to justify.
