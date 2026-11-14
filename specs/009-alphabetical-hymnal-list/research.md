# Research: Alphabetical order of the hymnal list

## 1. Where to sort

- **Decision**: Add `getHymnalsByName()` to the catalog (`src/lib/data/catalog.ts`), computed
  once in `createCatalog` from the listed hymnals (`hymnCount > 0`). The Recueils screen and the
  two `HymnalFilter` instances use it.
- **Rationale**: One list for the three screens (SC-002). `getHymnals()` order is used as a
  priority by `pickExamples` (the first number example, « JEM 1 » today) and the hymn page reads
  `sortOrder` for its other numbers; the engine builds its own order from `catalog.hymnals`.
  Keeping `getHymnals()` as is leaves all of these untouched (FR-006).
- **Alternatives considered**:
  - Sort in `scripts/build-data.ts` and write `hymnals.json` alphabetically: the engine derives
    its priority from that array order, so search results would change. Rejected.
  - Change `getHymnals()` to alphabetical: the first start-screen example would move from JEM to
    À Toi la Gloire, an unasked change. Rejected.
  - Sort inside `HymnalList` and `HymnalFilter`: two copies of the rule, and the components would
    no longer show the list they are given. Rejected.
  - Rewrite `sortOrder` values in `content/hymnals.json` to match the alphabet: mixes display and
    priority, and a new hymnal would need a manual position (FR-005). Rejected.

## 2. Collation rules

- **Decision**: `new Intl.Collator('fr', { sensitivity: 'base' })` on `name`; on a tie, `id`
  with plain code-unit comparison.
- **Rationale**: French collation sorts « À » with « A » and « É » with « E » (FR-002), ignores
  case, puts digits before letters, and keeps the typographic apostrophe inside the J names. The
  `id` tiebreak gives one order on every device even when two names compare equal (FR-003); ids
  are unique ASCII slugs.
- **Checked**: on the current catalog, the collator gives À Toi la Gloire, Ailes de la Foi,
  Arc-en-ciel, Célébrons Dieu, Chorale Psalmodie, Écritures, Evangile21, Exo, J’aime l’Éternel,
  as in the spec.
- **Alternatives considered**: `localeCompare` without options (same result in practice, but the
  locale then depends on the device); stripping accents by hand with `normalizeText` (duplicates
  what the collator does, and loses a stable order between accented and plain spellings).

## 3. Leading articles and abbreviations

- **Decision**: Sort on the full displayed name; no article skipping; abbreviations ignored.
- **Rationale**: The spec's assumptions; the name is the first thing each row and chip shows.

## 4. Tests

- **Decision**: Unit test in `tests/unit/catalog.test.ts` with a catalog built from the real
  hymnal names and their real `sortOrder`, checking the expected order, ties by id, and that an
  empty hymnal stays hidden. E2E: rows on `/recueils` and chips on both search screens follow the
  same order, sorted by name.
- **Rationale**: The e2e fixture has two hymnals whose name order already matches `sortOrder`,
  so only the unit test can catch a list that is still in `sortOrder`. Changing the fixture's
  `sortOrder` would change the primary hymnal in other e2e tests.
