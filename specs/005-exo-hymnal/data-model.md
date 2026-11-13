# Data Model: Exo Hymnal

No new entity in the app. All shapes come from features 001 (`src/lib/domain/schema.ts`) and
002 (`scripts/import/store/state.ts`). This feature adds data and one adapter table.

## Hymnal `exo` (exists, unchanged)

`content/hymnals.json`: `{ "id": "exo", "name": "Exo", "abbreviations": ["Exo"], "sortOrder": 7 }`.
It has no `parts`, because the site shows no albums (research R2).

## Source `cdl` (changed)

`import/sources.json` → `cdl.hymnals`: `["jem", "adf", "cd"]` → `["jem", "adf", "cd", "exo"]`.
The terms, `permission: "unknown"` and `minDelayMs: 1000` are unchanged.

`scripts/import/sources/cdl.ts`:

```text
CDL_VOLUMES.exo = [6]                       // /chants/recueil/6
CDL_PINNED: Record<hymnal, PinnedId[]>      // hymnals the site does not number
PinnedId = { number: number; id: number }   // id = site page id (/<id>)
```

Validation, enforced by a unit test:
- `number` values are unique and ≥ 1. `id` values are unique.
- A hymnal in `CDL_PINNED` is also in `CDL_VOLUMES`. A hymnal listed in `sources.json` for
  `cdl` has an entry in `CDL_VOLUMES` (the existing test, updated to include `exo`).
- The initial table is in ascending `id` order, with numbers 1..N and no gap.
- After that, numbers never change and are never reused. A song removed from the site keeps its
  row.

## Listing → entries (`listEntries('exo')`)

```text
rows      = every row of /chants/recueil/6?page=1..last, with a /<id> link
listedIds = distinct ids of rows (first seen wins)
ids       = listedIds ∪ pinned ids
entry(id) = { hymnal: "exo", number: String(pinned(id) ?? next++), url: BASE + "/" + id }
```

- Unpinned ids are numbered after `max(pinned)`, in ascending id order.
- Entries are returned sorted by number.
- Logs: rows read and distinct count, each unpinned id ("not pinned yet"), and each pinned id
  not listed in this run.

## Imported hymn (per Exo song)

This is the RawHymn of feature 002, unchanged:
- `source: "cdl"`, `hymnal: "exo"`, `number` (pinned), `url`;
- `title` (the page's `h2`);
- `sections` (verse/chorus/bridge/other, numbered verses);
- `credits` (`role: "unspecified"`);
- `strippedMarkup` (it may now include `section-marker`, research R4).

Then it follows the usual path: a new hymn or a merge into an existing one (matching), a link
in `import/state/links.json` (`source: "cdl", hymnal: "exo"`), and the rights status
`unconfirmed`.

## State transitions (links, feature 002 unchanged)

`active` ⇄ `missing`. A link becomes `missing` only if its id leaves both the list and the
pinned table. Since pinned ids are always listed (research R3), a pinned Exo link does not
become `missing`. A page that fails to load is reported as a failure, and its content is kept.
