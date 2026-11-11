---

description: "Task list for 003-repertoire-collections"
---

# Tasks: Collections in the Répertoire

**Input**: Design documents from `/specs/003-repertoire-collections/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/storage.md,
contracts/ui.md, quickstart.md. Feature 001 is built (search, hymn screen, single Répertoire).

**Tests**: Included. The constitution (Principle V) requires automated tests for critical
behaviour; here that is the stored data (operations, rules, loading). Each story also gets an
end-to-end test of its acceptance scenarios.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) so each can be built
and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story the task belongs to (US1–US4)

## Path Conventions

Single project at the repository root (`/home/stan/1-projects/hymnia`), extending feature 001:
`src/lib/repertoire/`, `src/lib/components/`, `src/routes/repertoire/`, `tests/unit/`,
`tests/e2e/`. Styles use the tokens and classes of `src/app.css` and follow the `Lists` and
`Playlist` mockups in `design/handoff/maquette/`.

---

## Phase 1: Setup

**Purpose**: Make room for the new module without breaking 001.

- [X] T001 Create the folder `src/lib/repertoire/` and move the 001 single-list store from `src/lib/repertoire.ts` to `src/lib/repertoire/legacy.ts` (keep exports `repertoire`, `toggleRepertoire`, `inRepertoire`); update its imports in `src/routes/repertoire/+page.svelte` and `src/routes/recueils/[recueil]/[numero]/+page.svelte`; `npm run check` and `npm run test:e2e -- --project=android` still pass. `legacy.ts` is deleted in T022 once nothing uses it
- [X] T002 [P] Add the sheet and dialog styles of the design to `src/app.css`: `.hy-sheet`, `.hy-handle`, `.hy-scrim` from `design/handoff/maquette/hymnia-app.css`, adapted to a native `<dialog>` (`dialog.hy-sheet` fixed at the bottom on phones with `env(safe-area-inset-bottom)`, centred with `max-width: 28rem` from 640 px; `::backdrop` uses `--scrim`, defined for light `rgba(30,28,25,0.36)` and dark `rgba(0,0,0,0.6)` like the other tokens); plus `.hy-toast` (fixed above the tab bar, `paper-raised`, `shadow-float`)

---

## Phase 2: Foundational (Data Model and Store, No UI)

**Purpose**: Stored document, pure operations and store. Every story needs them.

**⚠️ CRITICAL**: No user story starts before this phase is complete.

### Tests (write first, check they fail)

- [X] T003 [P] Unit tests for the model in `tests/unit/repertoire-model.test.ts`, following `data-model.md`, with a fake `hymnIdOf` (e.g. `ce 1` and `he 7` → `a-toi-la-gloire`, `xx 9` → undefined):
  - `createCollection`: trimmed name; errors `empty`, `too-long` (name rule "Trimmed, 1–60 characters"), `taken` ("unique among collections after normalisation (case, accents, punctuation ignored)": "Noël" vs "noel"); new collection has `createdAt` = `updatedAt` = now and no entries; id unique
  - `renameCollection`: same name errors, renaming to its own name in another case is allowed, `updatedAt` changes
  - `addEntry`: appended last with `addedAt`; "One hymn per collection": adding `he 7` when `ce 1` is there returns `already-there` and changes nothing; when `hymnIdOf` returns undefined for both, references are compared instead
  - `removeEntry`, `moveEntry` (to the top, to the end, out-of-range ignored), `toggleEntry` (`added` then `removed`)
  - `deleteCollection` + `restoreCollection` give back the same id, name, entries and position; other collections never change
  - `collectionsWith(doc, hymnId, hymnIdOf)` lists every collection containing the hymn under any reference
  - every operation returns a new document and leaves the input unchanged
- [X] T004 [P] Unit tests for loading in `tests/unit/repertoire-storage.test.ts`, with an in-memory `Storage`, following the three "Loading" steps of `contracts/storage.md`: valid v2 used as is; invalid v2 copied to `hymnia.repertoire.corrupt-<ISO date>`, empty result and a `corrupt` flag; v2 absent → empty, and the 001 key `hymnia.repertoire` is neither read nor removed; a `setItem` that throws → change kept in memory and an `unavailable` flag

### Implementation

- [X] T005 [P] Zod schema and types in `src/lib/repertoire/schema.ts`, exactly as `contracts/storage.md` "Document (v2)": `version` literal `2`; collection `id` string, `name` string, `createdAt`/`updatedAt` ISO date-time strings, `entries` array of `{ hymnal: string, number: string, addedAt: ISO date-time }`; export `RepertoireDoc`, `Collection`, `CollectionEntry`, `EntryRef = { hymnal, number }`, `EMPTY_DOC`
- [X] T006 Pure operations in `src/lib/repertoire/model.ts`, each as listed in "Operations" of `data-model.md` (`createCollection`, `renameCollection`, `deleteCollection`, `restoreCollection`, `addEntry`, `removeEntry`, `toggleEntry`, `moveEntry`, `collectionsWith`, `validateName`, `parseDocument`). Names: `name.trim()`, length 1–60, uniqueness with `normalizeText` from `src/lib/search/normalize.ts`. Ids from `crypto.randomUUID()` with a fallback for old browsers. `now` is passed in (ISO string). Sorting helper `byUpdatedDesc`; makes T003 pass
- [X] T007 Store in `src/lib/repertoire/store.ts`: `createRepertoireStore(storage, now)` following "Loading" and "Writing" in `contracts/storage.md` (key `hymnia.repertoire.v2`; the 001 key `hymnia.repertoire` is ignored); a Svelte store of the document plus `notice` (`null` | `corrupt` | `unavailable`, each shown once per visit); actions wrapping each model operation (`create`, `rename`, `remove` returning an `undo()` valid for 8 s, `add`, `removeEntry`, `toggle`, `move`); listens to the `storage` event for the v2 key (another tab: replace the document); after the first collection exists, calls `navigator.storage?.persist?.()` once, ignoring errors; exports the app instance `repertoire`; makes T004 pass
- [X] T008 [P] Hymn-reference helpers in `src/lib/repertoire/resolve.ts`: `hymnIdOf(catalog)` (reference → hymn id via `catalog.getEntry`), `resolveEntries(catalog, collection)` → rows `{ entry, hymn?, hymnal?, available }` for the screens ("Unavailable hymns are kept, shown as "Chant indisponible", removable, and never resolved to another hymn")
- [X] T009 [P] Shared dialogs in `src/lib/components/`: `CollectionNameDialog.svelte` (native `<dialog>` with `showModal()`, field "Nom de la collection" focused and prefilled on rename, buttons "Créer"/"Renommer" and "Annuler", error text under the field with `aria-describedby` and `aria-invalid`: "Donnez un nom à la collection.", "Une collection porte déjà ce nom.", "60 caractères au plus."; stays open on error; returns the new id), `ConfirmDialog.svelte` (title, text, confirm and cancel buttons, confirm focused last, Escape cancels), `UndoToast.svelte` (`role="status"`, message and "Annuler" button, disappears after 8 s), following `contracts/ui.md` "Create / rename" and "Collection"
- [X] T010 [P] `src/lib/components/StorageNotice.svelte`: one-time message for `notice` from the store ("Vos collections ne pourront pas être conservées sur cet appareil." / "Le répertoire enregistré était illisible ; il a été mis de côté."), shown in the layout `src/routes/+layout.svelte`

**Checkpoint**: `npm test` passes T003 and T004.

---

## Phase 3: User Story 1 - Create a named collection and fill it from a search (Priority: P1) 🎯 MVP

**Goal**: From the Répertoire, create and name a collection, then add hymns to it by searching
from inside it.

**Independent Test**: With an empty Répertoire, create "Culte", search `CE 1` and `fleuve`
from the collection, add one result of each; the collection lists both, in that order, and
they open on tap.

### Tests (write first)

- [X] T011 [P] [US1] End-to-end test in `tests/e2e/us6-collection-create.spec.ts` for acceptance scenarios 1–6 of User Story 1 in spec.md (create with a name, add `CE 12`, add three results without the search being cleared, already-added shown and no duplicate, empty name refused, hymn opens with the stored reference)

### Implementation

- [X] T012 [P] [US1] `src/lib/components/AddResultList.svelte`: renders a `SearchResponse` like `ResultList.svelte` (exact hymn, same number, number list, text with excerpts, the same calm messages) but each row has the title and references as a link to the hymn and a separate toggle button per `contracts/ui.md` "Add hymns": label "Ajouter « <title> »" / "Retirer « <title> »", `aria-pressed`, icon + / ✓, 44 px; "already added" uses `collectionsWith` / `hymnIdOf` (compares hymns, not references). Add the `plus` icon to `src/lib/components/Icon.svelte`
- [X] T013 [US1] Add-hymns screen `src/routes/repertoire/[collection]/ajouter/+page.svelte` and `+page.ts` (load catalog and the collection; unknown id → `NotFound` "Collection introuvable" with a link to `/repertoire`): `SearchBox` + `HymnalFilter` + 001 search client, query and filter kept in the URL (`?q=`, `?recueils=`, with `goto(…, { replaceState: true, keepFocus: true, noScroll: true })` as on `src/routes/+page.svelte`); toggling a row calls `repertoire.toggle`; polite live region "Ajouté à <name>" / "Retiré de <name>"; the query is never cleared; header with back link to the collection and a button "Terminé (n)" counting hymns added during this visit
- [X] T014 [US1] Collection screen `src/routes/repertoire/[collection]/+page.svelte` and `+page.ts`, first version, following the `Playlist` mockup: back link "Répertoire", name (`h1`), "n chants", button "Ajouter des chants" (link to `ajouter`), ordered list of entries from `resolveEntries` (number and hymnal abbreviation, title; link to the hymn with its stored reference, FR-006); unavailable rows show "Chant indisponible" and the stored reference; empty collection: "Aucun chant pour l’instant." + "Ajouter des chants"; unknown id → `NotFound`
- [X] T015 [US1] Répertoire screen `src/routes/repertoire/+page.svelte`, rewritten following the `Lists` mockup: title and "Nouvelle collection" (quiet button with `plus` icon) opening `CollectionNameDialog`; after creating, go to `/repertoire/<id>/ajouter` (contracts/ui.md); list of collections (`hy-row`: name, "n chants"), newest change first (FR-001); empty state "Aucune collection pour l’instant." with the same action

**Checkpoint**: User Story 1 works on its own; T011 passes. This is the MVP.

---

## Phase 4: User Story 2 - Keep several collections (Priority: P1)

**Goal**: Several collections listed with their counts; rename, delete with confirmation and
undo, remove a hymn.

**Independent Test**: Create three collections; rename one; delete another (confirm, then
"Annuler", then delete again); remove a hymn from the last one.

- [X] T016 [P] [US2] End-to-end test in `tests/e2e/us7-collections-manage.spec.ts` for acceptance scenarios 1–5 of User Story 2 in spec.md, plus: name taken on rename refused, undo restores the deleted collection with its hymns
- [X] T017 [US2] Collection menu in `src/routes/repertoire/[collection]/+page.svelte`: "Plus d’options" icon button opening a small menu (native `<dialog>` or disclosure, keyboard reachable) with "Renommer" (`CollectionNameDialog` prefilled), "Modifier l’ordre" (placeholder hidden until US4) and "Supprimer" (`ConfirmDialog` "Supprimer « <name> » ?" with text "Les chants restent dans leurs recueils."; then go to `/repertoire` and show `UndoToast` "Collection « <name> » supprimée" with "Annuler", 8 s, using the `undo()` from the store)
- [X] T018 [US2] Remove one hymn from a collection in `src/routes/repertoire/[collection]/+page.svelte`: a "Retirer « <title> »" icon button per row (also on unavailable rows), with the removal announced in a polite live region; no confirmation (the hymn can be added again)
- [X] T019 [US2] Show the `UndoToast` on the Répertoire page `src/routes/repertoire/+page.svelte` when arriving after a deletion (the toast state lives in the store so it survives the navigation), and check that `/repertoire` no longer imports `src/lib/repertoire/legacy.ts` (the 001 list is not migrated)

**Checkpoint**: User Stories 1 and 2 work on their own; T016 passes.

---

## Phase 5: User Story 3 - Choose the collection when adding from a hymn (Priority: P2)

**Goal**: The bookmark on a hymn opens a sheet to toggle it in any collection or create one.

**Independent Test**: With "Culte" and "Mariage", open CE 1, tap the bookmark, tick
"Mariage"; open the sheet again, create "Noël": CE 1 is in "Mariage" and "Noël".

- [X] T020 [P] [US3] End-to-end test in `tests/e2e/us8-collection-sheet.spec.ts` for acceptance scenarios 1–6 of User Story 3 in spec.md, plus: HE 7 shows a filled bookmark when CE 1 is in a collection (same hymn), Escape closes the sheet and focus returns to the bookmark
- [X] T021 [US3] `src/lib/components/CollectionSheet.svelte` per `contracts/ui.md` "Bookmark sheet": native `<dialog class="hy-sheet">` with `showModal()`, handle, title "Ajouter à une collection", one toggle row per collection (name, "n chants", ✓ when the hymn is in it, `aria-pressed`), newest change first, then "Nouvelle collection" (opens `CollectionNameDialog`, then adds the hymn to the new collection), "Fermer"; each toggle calls `repertoire.toggle` at once and announces "Ajouté à <name>" / "Retiré de <name>"; focus returns to the opener on close
- [X] T022 [US3] Hymn screen `src/routes/recueils/[recueil]/[numero]/+page.svelte`: replace the 001 single-list toggle by the sheet, on the mobile bookmark and the desktop button ("Ajouter à une collection" / "Dans n collections"), both with `aria-haspopup="dialog"`; the bookmark is filled (`aria-pressed="true"`) when `collectionsWith` finds the hymn under any reference (FR-010); remove the last import of `src/lib/repertoire/legacy.ts` and delete that file

**Checkpoint**: User Stories 1–3 work on their own; T020 passes.

---

## Phase 6: User Story 4 - Put the hymns of a collection in order (Priority: P3)

**Goal**: Reorder hymns; read a collection in order with previous/next following it.

**Independent Test**: In a collection of three hymns, move the third to the top, reload: the
order is kept. "Lire dans l’ordre": the reader shows "<name> · 1 / 3", next opens the second
hymn of the collection.

- [X] T023 [P] [US4] End-to-end test in `tests/e2e/us9-collection-order.spec.ts` for acceptance scenarios 1–3 of User Story 4 in spec.md, plus: "Monter" disabled on the first row and "Descendre" on the last, focus stays on the moved row's button, swipe and arrow keys follow the collection, unknown `?collection=` ignored
- [X] T024 [US4] Order mode in `src/routes/repertoire/[collection]/+page.svelte`: "Modifier l’ordre" in the menu toggles a mode where each row shows "Monter « <title> »" and "Descendre « <title> »" (disabled at the ends) and "Retirer"; moving calls `repertoire.move` and keeps focus on the same button of the moved row; "Terminé" leaves the mode
- [X] T025 [US4] "Lire dans l’ordre" primary button on `src/routes/repertoire/[collection]/+page.svelte` (hidden when the collection has no available hymn): opens the first available entry at `/recueils/<hymnal>/<number>?collection=<id>`; collection entries link with the same parameter
- [X] T026 [US4] Reader in collection mode in `src/routes/recueils/[recueil]/[numero]/+page.ts` and `+page.svelte`: when `?collection=<id>` names a collection containing this reference, previous/next (buttons, swipe, arrow keys, desktop neighbours) come from the collection's available entries and keep the parameter; the top bar shows "<name> · <position> / <count>" and the back arrow returns to the collection; at the ends the buttons are disabled with "Premier chant de la collection" / "Dernier chant de la collection"; otherwise 001 behaviour is unchanged (FR-012)

**Checkpoint**: All user stories work on their own; T023 passes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T027 [P] Accessibility: add the new screens to `tests/e2e/a11y.spec.ts` (`/repertoire` with and without collections, `/repertoire/<id>`, `/repertoire/<id>/ajouter?q=gloire`, the open sheet on `/recueils/ce/1`, the name dialog with an error), seeding collections with `page.addInitScript`; zero violations in light and dark at text 100 % and 200 % (SC-006)
- [X] T028 [P] Offline: extend `tests/e2e/offline.spec.ts` to create a collection, add a hymn from its search and reorder while offline, then reload offline and find everything unchanged (SC-004)
- [X] T029 [P] Scale: unit test in `tests/unit/repertoire-scale.test.ts` that builds 50 collections of 100 entries, checks the serialised document is under 1 MB and that loading and `collectionsWith` take under 50 ms in Node (SC-003)
- [X] T030 [P] Update `specs/001-hymnal-browse-search/contracts/routes.md` (the `/repertoire` row now points to this feature) and `design/decisions.md` (§3 D1: Répertoire now has collections; list differences from the `Lists` and `Playlist` mockups: "Nouvelle collection", no "Favoris" list, no "Partager", no per-hymn note)
- [X] T031 Run every check in `specs/003-repertoire-collections/quickstart.md` (lint, type check, unit, queries, end-to-end on `android`) and fix any failure; screenshots of the new screens in light and dark at phone and desktop width, compared with the `Lists` and `Playlist` mockups

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks all user stories.
- **US1 (Phase 3)**: after Phase 2. The MVP.
- **US2 (Phase 4)**: after Phase 2; T017–T018 extend the collection screen from T014, so after
  T014.
- **US3 (Phase 5)**: after Phase 2; reuses `CollectionNameDialog` (T009). Independent of US1
  and US2 screens.
- **US4 (Phase 6)**: after T014 (collection screen) and T017 (menu).
- **Polish (Phase 7)**: after the stories you want to ship.

### Within Each Story

- Tests first; check that they fail.
- Model and store (Phase 2) before components; components before screens.
- `src/routes/repertoire/[collection]/+page.svelte` is changed by T014, T017, T018, T024 and
  T025: do these one after the other.
- `src/routes/recueils/[recueil]/[numero]/+page.svelte` is changed by T001, T022 and T026: one
  after the other.

---

## Parallel Examples

### Phase 2

```text
T003 tests/unit/repertoire-model.test.ts    T004 tests/unit/repertoire-storage.test.ts
T005 src/lib/repertoire/schema.ts          T008 src/lib/repertoire/resolve.ts
T009 dialogs in src/lib/components/         T010 StorageNotice.svelte
then T006 (model) → T007 (store)
```

### User Story 1

```text
T011 e2e test    T012 AddResultList.svelte
then T013 (add screen), T014 (collection), T015 (Répertoire)
```

### After Phase 2, with two people

```text
US1 + US2 (Répertoire and collection screens)    US3 (sheet on the hymn screen)
```

---

## Implementation Strategy

### MVP First

1. Phase 1, then Phase 2 (model and store).
2. Phase 3, User Story 1. **Stop and check**: create a collection and fill it from its search
   on a phone.

### Incremental Delivery

1. Add US2 (several collections, rename, delete with undo): the P1 scope is complete.
2. Add US3 (bookmark sheet on the hymn).
3. Add US4 (order and reading in order).
4. Phase 7: accessibility, offline, scale, documentation.

---

## Notes

- No design gate: the screens follow the `Lists` and `Playlist` mockups; the sheet, dialogs and
  add screen use the existing tokens and classes. If they do not look right, design them in
  Claude Design and record the result in `design/decisions.md` before T021.
- Search behaviour is not changed: `src/lib/search/` is reused as is, so the reference query
  suite (`npm run test:queries`) must give the same results.
- Commit after each task or group of related tasks.

## Implementation log

**2026-11-11**: All 31 tasks done on branch `003-repertoire-collections` (created from `main`,
which now holds feature 001). Checks: lint and type check clean; 128 unit tests (31 new: model,
loading, scale); reference queries and performance unchanged; 60 end-to-end tests on `android`
(24 new: the four stories, offline, axe on the new screens in light and dark at 100 % and 200 %).

Deviations from the tasks as written:

- **No migration** (user decision, before implementation): the 001 single list (key
  `hymnia.repertoire`) is ignored; FR-013 and SC-005 removed from the spec; the documents were
  updated.
- **T012**: `AddResultList` is a thin wrapper: `ResultList` gained an optional per-row `action`
  snippet, so both lists share the same results and messages.
- **T014, T017, T018, T024, T025**: the collection screen was written once in its final form
  (menu, rename, delete, remove, order mode, "Lire dans l’ordre").
- **T019**: the undo message (`UndoToast`) lives in the layout, so it survives the navigation
  back to the Répertoire.
- **T026**: in collection mode, the desktop side list shows the collection instead of the
  hymnal, and the top navigation highlights "Répertoire".
- **Links with `?collection=`**: the lint rule `svelte/no-navigation-without-resolve` cannot see
  that `hymnInCollectionUrl` starts from a resolved URL; it is disabled around those links only.
