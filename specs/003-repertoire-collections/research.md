# Research: Collections in the Répertoire

## 1. Where collections are stored

- **Decision**: `localStorage`, one JSON document under `hymnia.repertoire.v2`, validated with
  Zod on read; written whole on each change.
- **Rationale**: the data is small (50 × 100 entries ≈ 400 KB, well under the ~5 MB quota),
  reads are synchronous so screens render at once, it works offline and in the installed app,
  and 001 already uses it for preferences and the single list. Writing the whole document keeps
  it consistent (no partial update).
- **Alternatives**: IndexedDB (async, more code, only needed for much larger data); a server
  with accounts (out of scope, against Principle V for now); the URL (not durable).
- **Risk**: `localStorage` can be cleared by the browser under storage pressure. The installed
  PWA asks for persistent storage (`navigator.storage.persist()`) once collections exist; best
  effort, no error if refused.

## 2. Format and loading

- **Decision**: document `{ version: 2, collections: [...] }`; each collection has a random id
  (`crypto.randomUUID()`), name, dates and ordered entries `{ hymnal, number, addedAt }`. The
  001 single list (`hymnia.repertoire`) is not migrated (user decision): it is ignored and left
  untouched. An unreadable document is kept aside under
  `hymnia.repertoire.corrupt-<date>` and the user starts with an empty Répertoire and a message,
  instead of losing it silently.
- **Rationale**: an explicit version allows later changes (notes, sharing) with tested
  migrations; ids keep URLs stable when a collection is renamed.
- **Alternatives**: name as id (breaks on rename); one key per collection (no atomic write).

## 3. Identity of a hymn in a collection

- **Decision**: store the reference (hymnal + number, the stable public identifier of 001's
  routes), not the hymn id or its text. "Already added" resolves references to hymn ids
  through the catalog and compares those, so CE 1 and HE 7 count as the same hymn.
- **Rationale**: references are what users see and what opens the hymn (FR-006); hymn content
  is never copied into user data (Principles III and IV). If a reference no longer resolves,
  the entry shows "Chant indisponible" and can be removed.
- **Alternatives**: hymn id only (loses the reference the user chose); both (duplicate truth).

## 4. Search inside a collection

- **Decision**: a separate route `/repertoire/<id>/ajouter?q=…` reusing `SearchBox`,
  `HymnalFilter` and the 001 search worker; results rendered by a new `AddResultList` where
  each row has a toggle button "Ajouter / Ajouté" (with `aria-pressed`) and the title opens the
  hymn. The query stays in the field after each addition; a counter "3 chants ajoutés" and a
  "Terminé" button return to the collection.
- **Rationale**: same search as the main screen (spec assumption), a dedicated screen keeps one
  purpose per screen (Principle II), and the URL keeps the query on back navigation as in 001.
- **Alternatives**: a sheet over the collection (cramped on a phone, nested scrolling); adding
  an "add" mode to the main search screen (mixes two purposes).

## 5. Choice of collections from a hymn (bookmark)

- **Decision**: a bottom sheet built on the native `<dialog>` (`showModal`), styled with the
  design's `hy-sheet` / `hy-handle` / `hy-scrim` classes: one row per collection with a check
  mark (`role="checkbox"`-like toggle buttons with `aria-pressed`), most recently changed first,
  then "Nouvelle collection". Each tap applies immediately and a short status ("Ajouté à
  Mariage") is announced. On desktop the same dialog is centred.
- **Rationale**: two taps to add (SC-002); the native dialog gives focus trapping, Escape and
  `inert` background for free (WCAG); toggling matches the spec (FR-008).
- **Alternatives**: a separate page (more taps, loses the reading position); a popover menu (no
  room for creation and long names).

## 6. Ordering and reading in order

- **Decision**: "Monter" / "Descendre" buttons on each row in an edit mode ("Modifier l’ordre"),
  plus "Retirer". No drag in this version. "Lire dans l’ordre" opens the first hymn with
  `?collection=<id>`; the reader then takes previous/next and swipe from the collection and
  shows "Culte · 2 / 5". Without the parameter, 001 behaviour is unchanged.
- **Rationale**: buttons work with one hand, keyboard and screen readers (WCAG 2.5.7 requires a
  non-drag alternative anyway); a URL parameter keeps the reader stateless and the back button
  correct.
- **Alternatives**: drag and drop only (fails 2.5.7); storing "current collection" in memory
  (lost on reload).

## 7. Deleting and undo

- **Decision**: confirm in a dialog, then delete and show a toast "Collection « X » supprimée"
  with "Annuler" for 8 seconds; undo restores the collection at its place with its id.
- **Rationale**: FR-003; confirmation plus undo protects against mistakes without nagging.

## 8. Names

- **Decision**: trimmed, 1–60 characters, unique after the 001 normalisation (case, accents,
  punctuation ignored) so "Noël" and "noel" clash. Validation messages under the field:
  "Donnez un nom à la collection.", "Une collection porte déjà ce nom.", "60 caractères au
  plus.".
- **Rationale**: reuses `normalizeText` from the search so the rule is consistent everywhere.

## 9. Other tabs and storage unavailable

- **Decision**: the store listens to the `storage` event to reload changes made in another tab.
  If storage is unavailable (private browsing, quota), collections live in memory for the visit
  and a one-time notice says they will not be kept.
- **Rationale**: spec edge cases; no data loss without telling the user.

## 10. Design

- **Decision**: no new design gate. The Répertoire list and a collection screen exist in the
  handoff (`Lists`, `Playlist`); the sheet and dialogs reuse its `hy-sheet`, `hb-btn`,
  `hb-search` styles. Differences from the mockups: "Nouvelle collection" (not "liste"), no
  "Favoris" special list (every collection is an ordinary one), no "Partager"
  and no per-hymn note ("Ouverture") in this version.
- **Alternatives**: a new Claude Design round for the sheet and the collection search (possible
  if the result does not look right; noted as an option in the tasks).
