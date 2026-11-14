# Data Model: Recent hymns on the search screen

User data on the device, kept apart from hymn data and from the Répertoire (Principle IV).
Storage format: [contracts/storage.md](contracts/storage.md).

## History entry

| Field      | Type              | Rules                                                           |
| ---------- | ----------------- | --------------------------------------------------------------- |
| `hymnal`   | string, non-empty | Hymnal id the hymn was opened under (`jem`, `adf`, `ce`…).      |
| `number`   | string, non-empty | Number as published in that hymnal (`245`, `3 bis`).            |
| `hymnId`   | string, non-empty | Hymn id at the time it was opened; followed through redirects.  |
| `openedAt` | ISO 8601 datetime | Last time the hymn page was shown.                              |

## History document

| Field     | Type                  | Rules                                                  |
| --------- | --------------------- | ------------------------------------------------------ |
| `version` | literal `1`           | Any other value → treated as empty history.            |
| `entries` | History entry[] (≤20) | Most recent first. At most one entry per `hymnId`.      |

Invalid JSON or a document that fails validation is treated as an empty history and overwritten
on the next save (no recovery copy: nothing hand-made is lost).

## Operations (pure, in `src/lib/history/model.ts`)

- **record(doc, ref, hymnId, now)** → new doc. Removes any entry with the same `hymnId`
  (after resolving redirects on both sides is the caller's job: it passes the current id),
  puts the new entry first, trims to 20. Recording the hymn already on top only updates
  `openedAt` and the reference.
- **clear()** → `{ version: 1, entries: [] }`.
- **parse(raw)** → doc (empty on any error).

## Resolution for display (`src/lib/history/resolve.ts`)

- **recentHymns(catalog, doc, limit = 8)** → rows `{ hymnal, number, hymn, hymnalInfo }`.
  Each entry goes through the Répertoire's single-entry resolution (`resolveEntry`, exported
  from `src/lib/repertoire/resolve.ts`): follow `hymnId`, use the current reference when
  renumbered, skip when not published. Entries that resolve to a hymn already listed are
  skipped (two old ids merged into one hymn). Stops at `limit` rows.

## State transitions

```text
(empty) --open hymn--> [A]
[A] --open B--> [B, A]
[B, A] --open A--> [A, B]          (moved to top, reference updated)
[… 20 entries] --open new--> new first, oldest dropped
any --Effacer--> (empty)
```

## Read-only inputs

- **Collection** (feature 003): `name`, `entries.length`, `updatedAt`. The 3 most recent come
  from the existing `byUpdatedDesc` in `src/lib/repertoire/model.ts`.
- **Example search**: `{ kind: 'number' | 'title' | 'lyrics', query: string }`, derived from the
  loaded catalog by `pickExamples` (research R5). Not stored.
