# Contract: Search by meaning (app side)

This extends [feature 001's search contract](../../001-hymnal-browse-search/contracts/search.md).
Word search as you type is unchanged.

## Worker messages (`src/lib/search/worker.ts`)

Added to `WorkerIn`:

```ts
| { type: 'meaning-prefetch' }                                   // idle download (R8)
| { type: 'meaning-search'; id: number; request: SearchRequest; vector: ArrayBuffer; configId: string }
```

Added to `WorkerOut`:

```ts
| { type: 'meaning-status'; state: 'absent' | 'downloading' | 'ready' | 'failed' | 'unavailable';
    loaded?: number; total?: number }                              // 'unavailable': no `meaning` in manifest
| { type: 'meaning-result'; id: number; response: SearchResponse }
```

As for word search, only the latest `meaning-search` is answered, and older ones get `null` on
the client.

## Response

`SearchResponse` (feature 001) with `kind: 'meaning'`. Each `SearchResult` gets:

```ts
matchedBy: 'words' | 'meaning' | 'both';
excerpt?: Excerpt;   // meaning: the best stanza's first 2 lines (≤ 160 chars), no highlights
```

`tier` keeps its meaning for word hits. Meaning-only hits use the new value `6`.

## Ranking (research R5, R6)

1. Meaning list: the dot product of the query with every row, multiplied by `scale`. Keep the
   best row per hymn and drop hymns outside the hymnal filter (FR-006). Sort, then keep the
   top 100.
2. Word list: `engine.search({ query, hymnals, limit: 100 })`.
3. Word hits of tier 2 (exact title) come first, in word order.
4. The rest is sorted by `wMeaning/(k + rankMeaning) + wWords/(k + rankWords)`, with ties broken
   by the meaning rank. The shipped weights are 1 : 0 (research.md "Evaluation results"): the
   meaning order, word-only hits after every meaning hit.
5. The output is cut to `limit` (default 50).

## When the action is offered (FR-001, edge cases)

> **Replaced by feature 012**: the button is now an icon switch shown whenever the data has
> meaning vectors, whatever the query. See
> [specs/012-meaning-search-mode/contracts/search-mode.md](../../012-meaning-search-mode/contracts/search-mode.md).
> The 500-character limit below still applies.

- `parseQuery(query).kind === 'text'` and the manifest has `meaning`. It is never offered for
  an empty query, a number or a hymnal + number.
- Queries over 500 characters are cut to 500, with the note « Recherche limitée aux 500
  premiers caractères ».

## UI states (search screen, `src/routes/+page.svelte`)

> **Feature 012** changes the « Words » and « Query edited » rows: the button is an icon switch
> for a mode of the field, `sens=1` means "meaning mode" and stays while the text is edited, and
> Enter runs the search by meaning
> ([search-mode.md](../../012-meaning-search-mode/contracts/search-mode.md)).

| State | What the user sees |
|-------|--------------------|
| Words (default) | As today. A « Par le sens » button sits beside the field when the action is offered. |
| Waiting | A status line « Recherche par le sens… » with « Annuler ». Word results stay visible below. |
| Preparing | « Préparation de la recherche par le sens… 45 % » (data downloading). The search runs when it ends. |
| Meaning results | A blended list under the label « Résultats par le sens ». The URL gets `&sens=1`, so the back button returns to it. |
| Offline / error / 409 / 429 | A one-line message (see [embed-api.md](./embed-api.md)). Word results stay. |
| Query edited | Back to Words: `sens=1` is dropped and word search updates as usual (US1 scenario 7). |

Accessibility: the button has a text label and `aria-pressed`. The status line is a polite
`aria-live` region, and « Annuler » is reachable by keyboard. The layout is checked on mobile in
light and dark modes (constitution workflow).

Opening a result: as in feature 001, the result opens at `primaryRef` (FR-005).
