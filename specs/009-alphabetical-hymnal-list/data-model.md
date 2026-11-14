# Data Model: Alphabetical order of the hymnal list

No stored data changes. `content/hymnals.json`, the published catalog and the search index keep
their format and content.

## Hymnal (existing, `PublishedHymnal`)

| Field | Role in this feature |
|-------|----------------------|
| `id` | Tiebreak when two names compare equal (FR-003). |
| `name` | Sort key for display lists (FR-001, FR-002). |
| `sortOrder` | Unchanged. Still the editorial priority for search and the hymn page (FR-006). |
| `hymnCount` | Unchanged. Hymnals with `0` stay out of the lists (FR-007). |

## Derived list: hymnals by name

- **Source**: the listed hymnals (`hymnCount > 0`), i.e. the same set as `getHymnals()`.
- **Order**: French collation on `name`, base sensitivity (ignores case and accents); then `id`.
- **Lifetime**: computed once per catalog; a new catalog version gives a new list.
- **Invariant**: same members as `getHymnals()`, only the order differs.
