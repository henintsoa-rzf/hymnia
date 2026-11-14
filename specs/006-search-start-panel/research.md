# Research: Recent hymns on the search screen

No item in the Technical Context was left open. The points below record the choices made while
reading the existing code (search page, Répertoire store and resolution, hymn page, data build).

## R1. Where the history lives

- **Decision**: A new module `src/lib/history/` (schema, pure model, store), saved in
  `localStorage` under its own key `hymnia.history.v1`, separate from `hymnia.prefs` and
  `hymnia.repertoire.v2`.
- **Rationale**: Same pattern as the Répertoire (zod schema + pure operations + a small Svelte
  store with guarded storage access), so nothing new to learn and the model is unit-testable
  without a browser. A separate key keeps « Effacer » from touching collections or preferences
  (FR-006, FR-010) and keeps user data apart from hymn data (Principle IV).
- **Alternatives considered**:
  - Add a field to `Prefs`: mixes a growing list into small settings; `sanitizePrefs` would
    have to validate entries. Rejected.
  - Make history a hidden Répertoire collection: collections are user-named and ordered by hand;
    history is automatic and capped. Different rules, and it would show up in the Répertoire.
    Rejected.
  - IndexedDB: overkill for ≤ 20 small records. Rejected (Principle V).

## R2. What an entry stores, and how it resolves after a data update

- **Decision**: Store `{ hymnal, number, hymnId, openedAt }`. On display, resolve each entry
  with the same rules as Répertoire entries (follow `hymnId` through redirects; renumbered →
  current reference in the same hymnal, else first entry; unpublished → skipped). Reuse the
  resolution in `src/lib/repertoire/resolve.ts` by exporting its single-entry function
  (`resolveEntry`) instead of duplicating it. Repairs are not written back: history rolls over
  quickly and resolving 20 entries on display is trivial.
- **Rationale**: Meets FR-011 and the renumbering edge case with code that is already tested.
- **Alternatives considered**: Store the reference only — breaks when a hymnal is renumbered
  or hymns are merged (feature 002, FR-027). Write repairs back like the Répertoire — extra
  code for no visible benefit. Both rejected.

## R3. When a hymn counts as "opened"

- **Decision**: Record from the hymn page (`/recueils/[recueil]/[numero]`) whenever it shows a
  found hymn (`data.found`), including when previous/next or a collection reading changes the
  hymn. A not-found page records nothing.
- **Rationale**: One place covers every way of getting there (search, hymnal list, collection,
  shared link, previous/next), which is what the spec's edge cases ask for.
- **Alternatives considered**: Record on click in each list — misses shared links and
  previous/next, and spreads the logic. Rejected.

## R4. Limits

- **Decision**: Keep 20 entries, show 8, one entry per hymn (by resolved hymn id; reopening
  moves it to the top and updates the reference it was opened under).
- **Rationale**: From the spec (FR-003 to FR-005). Keeping more than shown leaves room for
  skipped (unresolvable) entries without the visible list shrinking.

## R5. Example searches must come from the loaded catalog

- **Finding**: Every hymn in `content/` is currently `rights: "unconfirmed"`. A public build
  publishes none of them; only a personal-use build (`HYMNIA_PERSONAL_USE=1`) does. The e2e
  suite runs on `tests/fixtures/sample-content` (hymnal `ce`). A fixed list such as « JEM 245 »
  would return nothing in two of these three catalogs.
- **Decision**: Derive the three examples from the loaded catalog with a pure, deterministic
  function `pickExamples(catalog)` in `src/lib/search/examples.ts`:
  1. **Number**: the first hymnal (by `sortOrder`) that has hymns → `«<abbr> <first number>»`.
  2. **Title**: the title of a hymn other than the one above, the first whose title is 2–5
     words long.
  3. **Lyrics**: the first 3 words of the first verse of a third hymn, taken from a line that is
     not the hymn's title and whose 3 words have at least 16 letters (found during
     implementation: « Je ne manquerai » matched too many hymns to find its own in the top 3).
  If the catalog has fewer than 3 hymns, return what can be made (possibly none); the block is
  hidden when the list is empty.
- **Rationale**: Always returns results on whatever catalog is loaded (FR-008, SC-005), needs no
  upkeep when hymnals are added (Principle IV), and stays stable between visits.
- **Alternatives considered**: A fixed list in the app — breaks in the public build and the e2e
  fixture. A random pick on each visit — unstable and hard to test. Both rejected.
- **Spec impact**: The spec's assumption "Example searches are a fixed list in the app" is
  replaced by this derivation (spec updated).

## R6. Layout on mobile and desktop

- **Decision**: Three small components — `RecentHymns`, `RecentCollections`, `SearchExamples`.
  Mobile (empty field): help text, examples (if shown), recent hymns, recent collections, in the
  main column. Desktop: main column shows help text and examples; side column shows recent
  hymns, recent collections, keyboard tips. Uses the existing `.desktop-only` / `.mobile-only`
  classes, as today. Rows reuse `.hy-row` / `HymnRef` styling from hymnal and result lists.
- **Rationale**: Same structure as the current page, minus `HymnalList`. No new layout system.

## R7. Clearing

- **Decision**: « Effacer » (accessible name « Effacer les chants récents ») empties the history
  at once, without confirmation or undo.
- **Rationale**: The data is low-value and rebuilds itself as hymns are opened; a confirmation
  would slow down a one-tap action. (Collections, which are hand-made, keep their confirmation.)
- **Alternative considered**: Undo toast like collection deletion. Not worth it here.

## R8. Tabs and storage failures

- **Decision**: Read storage when the store is created; no `storage` event listener. Every
  read/write is wrapped in try/catch; on failure the history lives in memory for the visit and no
  notice is shown (unlike the Répertoire, nothing the user made is at risk).
- **Rationale**: The spec does not require live sync between tabs; silence on failure matches
  FR-012.
