# Data model: Search-by-meaning mode

This feature adds no stored data. It adds one piece of screen state and one fact read from the
existing data manifest.

## Search mode (screen state, `src/routes/+page.svelte`)

| Field | Type | Rule |
|-------|------|------|
| `mode` | `'word' \| 'meaning'` | `'word'` on a fresh visit; `'meaning'` when the URL has `sens=1` |

Kept with the rest of the search in the URL: `?q=…&recueils=…&sens=1` (`sens=1` only in meaning
mode). Not saved in preferences.

### Transitions

```text
          press button (text query → run search by meaning at once)
  word ─────────────────────────────────────────────────────────▶ meaning
   ▲                                                                 │
   └─────────────── press button (cancel any search in progress) ────┘
```

- Editing the text, clearing it, or changing the hymnal filter never changes the mode.
- In meaning mode, editing the text makes results by meaning stale (word results show) until
  Enter (feature 011, US1 scenario 7, unchanged).
- Changing the hymnal filter while results by meaning are current runs it again (feature 011
  FR-006, unchanged).

### Related existing state (unchanged meaning)

- `meaningFor` / `meaningResponse`: the query and filter whose results by meaning are shown.
  "Current" means `mode === 'meaning' && meaningFor.query === query`.
- `meaningPhase`: waiting, preparing, error (feature 011).

## Meaning availability (page load)

| Field | Type | Source |
|-------|------|--------|
| `meaningAvailable` | `boolean` | `Boolean(manifest.meaning)` in `static/data/manifest.json`, read by the catalog loader (`data.catalog.meaningAvailable`) |

When false: no button, the field is laid out as without the feature, and `sens=1` in the URL is
ignored (word mode).

## Query text

`query` is always one line: line breaks typed or pasted into the field become single spaces before
the value is stored. Length limits are unchanged (500 characters for search by meaning, feature
011).
