# Implementation Plan: Collections in the Répertoire

**Branch**: `003-repertoire-collections` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-repertoire-collections/spec.md`

## Summary

The Répertoire becomes a set of named collections: create, rename, delete (with undo), fill
from a search run inside the collection, order the hymns, and read them in order. The bookmark
on a hymn opens a sheet to toggle the hymn in any collection or create one on the spot.

Approach: no new dependency and no server. Collections are user data kept on the device in
`localStorage` as one versioned, validated document, behind a small pure module (create, rename,
add, move, remove) that is unit-tested, and a Svelte store that saves it and follows
changes from other tabs. The search of feature 001 (worker, engine, `SearchBox`,
`HymnalFilter`) is reused unchanged; only the result rows differ (an "add" toggle instead of a
link). The screens follow the `Lists` and `Playlist` mockups of the Claude Design handoff. See
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x, Svelte 5 (runes), as in feature 001

**Primary Dependencies**: the existing stack only: SvelteKit 2 (`adapter-static`), Zod (validation
of stored data), the 001 search worker. No new package.

**Storage**: `localStorage`, key `hymnia.repertoire.v2`: one JSON document holding all
collections ([contracts/storage.md](./contracts/storage.md)). The 001 single list (key
`hymnia.repertoire`) is not migrated: the Répertoire starts empty. Kept apart from hymn data
(constitution, Principle IV).

**Testing**: Vitest (model: every operation, validation, loading, name rules, unavailable
hymns); Playwright + axe (the four user stories, offline, accessibility in light and dark, text
at 200 %)

**Target Platform**: same as 001: current mobile browsers and desktop, installed PWA, offline

**Project Type**: offline-first static web app, single project (extends 001)

**Performance Goals**: Répertoire and a collection render in under 1 s with 50 collections of
100 hymns (SC-003); adding a hymn is reflected immediately (no wait on storage)

**Constraints**: fully offline; WCAG 2.2 AA; one-handed on a phone; French interface; stored
data ≤ ~1 MB for the reference size (50 × 100 entries ≈ 400 KB)

**Scale/Scope**: 3 screens (Répertoire, collection, collection search), 1 sheet (choice of
collections), changes to the hymn reader (bookmark, reading in collection order)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Status |
|-----------|-----------------------|--------|
| I. Advanced search at the core | Adding hymns uses the full 001 search (number, title, lyrics, filter) inside the collection; search behaviour is not changed, so the reference query suite still applies unchanged. | ✅ |
| II. Clean, text-centred design | Screens follow the existing mockups (`Lists`, `Playlist`); the reader only gains the bookmark sheet and, when reading a collection, its name and position. Nothing is added to the lyrics. | ✅ |
| III. Faithful text and rights | No hymn content stored in collections, only references (hymnal + number); an unpublished hymn shows as "Chant indisponible", never a cached copy of its text. | ✅ |
| IV. Unified multi-hymnal model | Collections are user data, stored apart from hymn data; entries point to the unique hymn through its reference; "already added" compares hymns, not references. A data update never rewrites user data. | ✅ |
| V. Simplicity, incremental delivery | No dependency, no server, no account. Stories delivered in order P1 → P3. The model and loading are pure and unit-tested. | ✅ |
| VI. Accessibility, real-world use | Native `<dialog>` for the sheet and confirmations (focus, Escape), up/down buttons for ordering (no drag-only interaction), 44 px targets, offline, axe checks. | ✅ |
| Workflow and quality | Spec Kit flow; end-to-end tests on mobile in light and dark mode. No search change, so no new reference queries needed. | ✅ |

**Result**: Passed before research and after design. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-repertoire-collections/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and alternatives
├── data-model.md        # Phase 1: entities, rules, operations
├── quickstart.md        # Phase 1: how to validate
├── contracts/
│   ├── storage.md       # stored document format, versions, loading
│   └── ui.md            # routes, screens, sheet, reader in collection mode
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/lib/repertoire/
├── model.ts             # pure operations: create, rename, delete/restore, add, remove,
│                        # move, load, name rules (unit-tested)
├── schema.ts            # Zod schema of the stored document
└── store.ts             # Svelte store: load, save, cross-tab sync, storage-unavailable flag
                         # (replaces src/lib/repertoire.ts from 001)

src/lib/components/
├── CollectionSheet.svelte      # bookmark sheet: toggle per collection + new collection
├── CollectionNameDialog.svelte # create / rename, with validation messages
├── ConfirmDialog.svelte        # delete confirmation
├── UndoToast.svelte            # "Collection supprimée · Annuler"
└── AddResultList.svelte        # search results with an add/added toggle per hymn

src/routes/repertoire/
├── +page.svelte                     # list of collections (mockup Lists)
└── [collection]/
    ├── +page.svelte                 # one collection (mockup Playlist)
    └── ajouter/+page.svelte         # search inside the collection

src/routes/recueils/[recueil]/[numero]/+page.svelte   # bookmark → sheet; ?collection=<id>
                                                       # → previous/next in the collection

tests/unit/repertoire-model.test.ts
tests/e2e/us6-collections.spec.ts … (one file per story of this feature)
```

**Structure Decision**: single project, extending feature 001. The 001 file
`src/lib/repertoire.ts` becomes the `src/lib/repertoire/` module; its only users (the hymn
screen and `/repertoire`) are updated.

## Complexity Tracking

No violations.
