# Data Model: Search the hymn on YouTube

No stored data, no schema change, no user data.

## YouTube search link (derived)

| Field | Source | Rule |
|-------|--------|------|
| `text` | `entry.title ?? hymn.title` on the hymn page | NBSP (U+00A0) and narrow NBSP (U+202F) → space; whitespace runs collapsed; trimmed |
| `href` | `youtubeSearchUrl(text)` | `https://www.youtube.com/results?search_query=` + `encodeURIComponent(text)` |

- Recomputed on each hymn page render (previous/next, collection reading); never persisted.
- An empty title cannot occur (titles are required by the content schema); if it did, the helper
  still returns a valid URL (an empty search) and the page does not fail.
