# Contract: Screens and URLs

**Consumers**: users (shared links, bookmarks) and the end-to-end tests. URLs are in French and
must stay stable once published.

| URL | Screen | Purpose | Spec |
|-----|--------|---------|------|
| `/` | Search | Search field with focus, hymnal filter, results. With an empty query, shows the hymnal list. | US1, US2, US5, FR-001 |
| `/?q=<query>&recueils=<id,id>` | Search | Same, pre-filled (shareable, works with the back button). | FR-010 |
| `/recueils` | Hymnals | All hymnals with name and hymn count. | US3, FR-011 |
| `/recueils/<hymnal-id>` | Hymnal | Hymns in number order with a "go to number" field. | US3, FR-012 |
| `/recueils/<hymnal-id>/<number>` | Hymn | Lyrics, credits, source, other references, next/previous. | US4, FR-013–016 |
| `/repertoire` | Répertoire | Hymns bookmarked on this device (design decision D1; favourites and lists come in a later feature). | — |
| `/reglages` | Settings | Text size and theme. Text size can also be changed from the hymn screen. | FR-015, FR-017 |

## Rules

- `<number>` is the number as printed, URL-encoded ("123a", "123%20bis").
- An unknown hymnal or number shows a "not found" page with a link back to search. It is not an
  error page.
- A hymn reached from search opens on its `primaryRef` URL, so next/previous stay within that
  hymnal.
- Every screen works offline once the app has been opened once (FR-018).
