# Contract: Matching stanza, from result to reading view

## Pure functions

```ts
// src/lib/meaning/stanzas.ts
export type StanzaGroup = { sections: number[]; lines: string[] };
/** Steps 1–2 of indexedStanzas: distinct sections, short ones joined to a neighbour. */
export function stanzaGroups(
  sections: { lines: string[] }[],
  minSectionChars?: number            // default MEANING_CONFIG.minSectionChars
): StanzaGroup[];
// indexedStanzas(...) output is unchanged (same rows, same texts, section = group.sections[0]).

// src/lib/meaning/passage.ts (new)
/** The section indices to mark for `?passage=<param>`; [] when nothing should be marked. */
export function markedSections(
  sections: { lines: string[] }[],
  param: string | null,
  minSectionChars?: number
): number[];
```

`markedSections` returns `[]` for `null`, `''`, anything not matching `^\d+$`, an index not in
range, or an index that is not `sections[0]` of a group.

## Search (worker → page)

`SearchResult.matchedSection?: number`, set by `fuse()`:

| Result | Excerpt kept | `matchedSection` |
|--------|--------------|------------------|
| meaning only | meaning | `hit.section` |
| both, meaning wins | meaning (or word if meaning has none) | `hit.section` when the meaning excerpt is kept |
| both, words win, word excerpt present | word | absent |
| both, words win, no word excerpt | meaning | `hit.section` |
| words only | word / none | absent |

## Result link (`ResultList.svelte`, text rows)

```
href = hymnUrl(primaryRef.hymnal, primaryRef.number)
       + (matchedSection !== undefined ? `?passage=${matchedSection}` : '')
```

No other link in the app adds `passage`.

## Reading view

`LyricsView.svelte` gets `marked?: number[]` (section indices in `hymn.sections`). Its printed
blocks keep their source index, so a block is marked when its index is in `marked`.

For each marked block:

| | Value |
|---|---|
| Class | `hb-stanza hb-stanza--match` (plus refrain/bridge classes as today) |
| Look | background `--meaning-soft`; 3 px left bar `--meaning`; text does not move horizontally; no animation |
| Scroll offset | `scroll-margin-top: var(--space-6)` |
| Accessible text | first marked block only: `<span class="hb-sr">Passage correspondant à votre recherche : </span>` before the number/label |
| Lyrics | unchanged (same lines, order, numbers, labels) |

The hymn page (`/recueils/[recueil]/[numero]`) computes
`marked = markedSections(hymn.sections, page.url.searchParams.get('passage'))` and passes it.

## Scroll on open

On `afterNavigate` with `type !== 'popstate'`, after `tick()`:

1. `el` = first `.hb-stanza--match`; none → stop.
2. `bottomLimit = innerHeight − (height of .hy-readbar if shown, else 0)`.
3. If `el.top < 0` or `el.bottom > bottomLimit` → `el.scrollIntoView({ block: 'start' })`.
   Otherwise do not scroll.

Back/forward (`popstate`) keeps the restored scroll position.
