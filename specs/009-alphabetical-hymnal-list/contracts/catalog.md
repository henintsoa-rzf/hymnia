# Contract: hymnals by name

## Catalog API (`src/lib/data/catalog.ts`)

```ts
/** Listed hymnals (at least one published hymn), in French alphabetical order of name, then id. */
getHymnalsByName(): PublishedHymnal[];
```

- Returns the same hymnals as `getHymnals()`, as a list sorted by name.
- Returns the same array on every call for a given catalog (no re-sort per render).
- `getHymnals()` is unchanged: listed hymnals in `sortOrder`.

## Screens

| Screen | Component | List passed |
|--------|-----------|-------------|
| `/recueils` | `HymnalList` | `getHymnalsByName()` |
| `/` (search) | `HymnalFilter` | `getHymnalsByName()` |
| `/repertoire/[collection]/ajouter` | `HymnalFilter` | `getHymnalsByName()` |

Unchanged on these screens: the `hymnalMap` given to result lists, `pickExamples`, and the
`hymnals.length > 1` check that shows the filter, all of which keep using `getHymnals()`.

`HymnalFilter`: chips render in the order received; selecting a chip does not reorder; the
« Tous les recueils » clear chip stays last.
