# Implementation Plan: Recent hymns on the search screen

**Branch**: `006-search-start-panel` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-search-start-panel/spec.md`

## Summary

Remove the hymnal list from the search screen (`/`), which repeats the Recueils screen, and show
in its place what the user most likely wants next: the hymns they opened recently, their recent
Répertoire collections and, on a first visit, three example searches. History is a new
device-only store (`hymnia.history.v1`) recorded from the hymn page and resolved with the
Répertoire's existing entry resolution, so renumbered and merged hymns follow. Examples are
derived from the loaded catalog, because the public build may publish few or no hymns while
rights are unconfirmed (research R5).

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (static adapter, PWA)

**Primary Dependencies**: Existing only — zod (schema), svelte/store. No new dependency.

**Storage**: `localStorage`, new key `hymnia.history.v1` ([contracts/storage.md](contracts/storage.md))

**Testing**: Vitest (`unit`, `queries` projects), Playwright + axe (e2e on `tests/fixtures/sample-content`)

**Target Platform**: Mobile-first web app / PWA, offline-capable; desktop layout ≥ 1024 px

**Project Type**: Single SvelteKit web app (static), no backend

**Performance Goals**: No change to search speed (< 200 ms); start content renders with the page
(≤ 20 entries resolved synchronously against the in-memory catalog)

**Constraints**: Works offline and with storage blocked; WCAG 2.2 AA; light and dark modes

**Scale/Scope**: 1 screen changed (`/`), 1 screen touched (hymn page records history),
3 new small components, 1 new module (`src/lib/history/`), 1 helper (`pickExamples`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Recherche au cœur | Field stays focused on load; results unchanged; reopening a recent hymn takes one tap; examples teach number / title / lyrics search. | ✅ |
| II. Design épuré | Removes a duplicated list; each block appears only when it has content; reading view untouched. | ✅ |
| III. Fidélité et droits | No text changes. Examples come only from hymns the current build publishes, so a public build never surfaces unconfirmed hymns. | ✅ |
| IV. Modèle unifié | History is user data under its own key, apart from hymn data and collections; stores `hymnId` and follows redirects; no per-hymnal code (examples derived from data). | ✅ |
| V. Simplicité | No new dependency; reuses Répertoire patterns and `resolveEntry`; no tab sync, no undo, no repairs written back. Model, resolution and examples covered by unit tests. | ✅ |
| VI. Accessibilité / hors ligne | Device-only data, works offline; headings label lists; « Effacer » has an explicit name; keyboard and screen-reader checks in e2e (axe). | ✅ |
| Flux qualité | Search behaviour itself unchanged, so the reference query sets stay as they are; a `queries` test checks examples on real content; mobile + light/dark verified (quickstart). | ✅ |

Post-design re-check (after Phase 1): unchanged, all ✅. No Complexity Tracking entry.

## Project Structure

### Documentation (this feature)

```text
specs/006-search-start-panel/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── storage.md       # History document and storage rules
│   └── ui.md            # Search screen start content, placement, interactions
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── history/                     # NEW — device-only history of opened hymns
│   │   ├── schema.ts                # zod: HistoryEntry, HistoryDoc (v1)
│   │   ├── model.ts                 # pure: parse, record, clear (cap 20, one per hymn)
│   │   ├── resolve.ts               # recentHymns(catalog, doc, limit) via resolveEntry
│   │   └── store.ts                 # Svelte store, guarded localStorage, record()/clear()
│   ├── repertoire/
│   │   └── resolve.ts               # CHANGED — export resolveEntry (single entry)
│   ├── search/
│   │   └── examples.ts              # NEW — pickExamples(catalog): number, title, lyrics
│   └── components/
│       ├── RecentHymns.svelte       # NEW — « Récemment consultés » + Effacer
│       ├── RecentCollections.svelte # NEW — 3 collections + « Tout le Répertoire »
│       └── SearchExamples.svelte    # NEW — « Essayez » buttons
└── routes/
    ├── +page.svelte                 # CHANGED — drop HymnalList, place the new blocks
    └── recueils/[recueil]/[numero]/
        └── +page.svelte             # CHANGED — record the shown hymn

tests/
├── unit/
│   ├── history-model.test.ts        # NEW
│   ├── history-storage.test.ts      # NEW
│   ├── history-resolve.test.ts      # NEW
│   └── search-examples.test.ts      # NEW (sample content)
├── queries/
│   └── examples.test.ts             # NEW — examples return results on real content (SC-005)
└── e2e/
    ├── us3-browse.spec.ts           # CHANGED — hymnal list no longer on the search screen
    ├── us10-recent-hymns.spec.ts    # NEW
    ├── us11-recent-collections.spec.ts # NEW
    ├── us12-search-examples.spec.ts # NEW
    └── a11y.spec.ts                 # CHANGED — axe on the start content states
```

**Structure Decision**: Single SvelteKit app, existing layout. The history module mirrors
`src/lib/repertoire/` (schema / model / store) at a smaller size; UI pieces are components in
`src/lib/components/`, composed by the search route.

## Complexity Tracking

None.
