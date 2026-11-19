# Data model: Highlight the matching stanza

No stored data changes. The meaning data (vectors, rows, version) and the catalog are unchanged.

## SearchResult (changed, in memory)

`src/lib/search/types.ts`

| Field | Type | Rule |
|-------|------|------|
| `matchedSection` | `number?` (new) | Index in `hymn.sections` of the first section of the group that ranked the hymn by meaning. Set only when the result's `excerpt` is that group's excerpt (research R3). Absent for word-only results and for `both` results showing a word excerpt. |

`MeaningCandidate` (`src/lib/meaning/fuse.ts`) gets the same field, filled in `searchByMeaning`
from `hit.section`.

## Stanza group (new name for an existing concept)

`src/lib/meaning/stanzas.ts`, `stanzaGroups(sections, minSectionChars)`

| Field | Type | Rule |
|-------|------|------|
| `sections` | `number[]` | Indices in `hymn.sections`, in order; first occurrences of their text only; length ≥ 1. |
| `lines` | `string[]` | The lines of those sections, joined (what is embedded, before the prefix). |

The group's key is `sections[0]`; it equals the meaning row's `section`. Building it is steps 1–2 of
today's `indexedStanzas`, unchanged.

## Passage (URL, transient)

`/recueils/<hymnal>/<number>?passage=<n>`

| Rule | Result |
|------|--------|
| `n` is a whole number and is `sections[0]` of a group of this hymn | Mark every section of that group. |
| Absent, empty, not a whole number, out of range, or not a group start | Mark nothing; page as usual (FR-010). |

Lifetime: one page view. Never stored (not in the hymn history, not in collections).
