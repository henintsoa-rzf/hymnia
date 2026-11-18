# Data Model: Semantic search

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature adds derived data and one small user store. Hymns, hymnals and the catalog
(feature 001, [contracts/content-schema.md](../001-hymnal-browse-search/contracts/content-schema.md))
are unchanged.

## MeaningConfig

How vectors are made. A single module (`src/lib/meaning/config.ts`) defines it, and the build,
the Worker and the app all import it, so they cannot disagree.

| Field | Type | Rule |
|-------|------|------|
| `id` | string | Derived: `<model>/<representation>/<dims>/<quant>/v<rev>`, e.g. `te3-large/title+stanza/512/i8/v1`. Any change to a field below gives a new id. |
| `model` | string | `text-embedding-3-large`, called through the Mammouth API (R1). |
| `representation` | `'stanza' \| 'title+stanza' \| 'title+theme+stanza'` | R2. |
| `dims` | 256 \| 512 \| 1024 | The full 3,072-dim vector is cut to this length and re-normalised, by the same code in the build and the Worker. |
| `quant` | `'i8'` | R4. |
| `fusion` | `{ k: 60, wMeaning: number, wWords: number }` | R6, set by the comparison. |
| `minSectionChars` | 40 | Shorter sections join a neighbour (R2). |
| `maxBytes` | 10 MB, or 20 MB | Size limit of the meaning data. 20 MB only if the comparison clears the rule in research R4 (SC-004). |

## IndexedStanza (one row of the meaning data)

| Field | Type | Rule |
|-------|------|------|
| `row` | integer | 0 … n−1, its position in the vector file. |
| `hymnIndex` | integer | Index of the hymn in the catalog's `hymns` array of the same build. |
| `section` | integer | Index of the section shown as excerpt: the first section of the group. |
| `vector` | int8[dims] | L2-normalised, then quantised. |
| `scale` | float32 | `maxAbs / 127` of the float vector. |

Validation (build):

- Every published hymn with at least one section has at least one row.
- Within a hymn, no two rows have the same indexed text.
- Rows are ordered by `hymnIndex`, then `section`.
- The total size is at most `MeaningConfig.maxBytes` (SC-004).

## MeaningData (build output)

The set of rows of one build. It is described in `manifest.json` next to the catalog and index
([contracts/meaning-data.md](./contracts/meaning-data.md)) and made of two hashed files. It
belongs to exactly one catalog `version`, and the app refuses it if the manifest's `version`
differs from the catalog's (FR-015).

State on a device:

```text
absent ──(idle, online, not saveData)──▶ downloading ──▶ cached ──(first search by meaning)──▶ loaded in worker
   │                                      │   ▲
   │                                      ▼   │ retry on next idle / on button
   └──(saveData: wait for first use)      failed
new build (manifest changes) ──▶ absent for the new files; old cached files expire (4 entries max)
```

## EmbeddingCacheEntry (maintainer machine only)

`.cache/embeddings/<model>.jsonl`, not committed. Each line is `{ key, vector }`, where
`key = sha256(model + indexedText)` and `vector` is the full 3,072-dim float32 vector as base64.
Shorter dims are derived from it by cutting and re-normalising (research R7). The cache is used
by the build and by the comparison. When a key is missing, the build embeds that text.

## ThemeDescription (only if measured, R11)

`content/generated/themes.json`: `{ [hymnId]: ThemeDescription }`.

| Field | Type | Rule |
|-------|------|------|
| `text` | string | 1–2 French sentences, ≤ 300 characters, quoting no lyrics. |
| `lyricsHash` | string | sha256 of the hymn's lyrics when generated. If they differ, it is regenerated. |
| `model` | string | Generating model id. |
| `generatedAt` | ISO date | |

It is never copied into the catalog (FR-022). It is read only by the meaning build and the
comparison.

## QueryVector (device, user data)

`localStorage["hymnia.meaning.queries"]`, kept apart from hymn data (Principle IV).

```ts
{ v: 1, configId: string, items: { key: string; vector: string /* base64 float32 */; usedAt: number }[] }
```

- `key`: the query in NFC, lower case, trimmed, with spaces collapsed.
- At most 50 items, least recently used dropped first (FR-013).
- The whole store is dropped if `configId` is not the current one, or if it fails validation.

## MeaningQuery (reference set, versioned)

`tests/queries/meaning-queries.json`:

```ts
{ id: string; category: 'theme' | 'occasion' | 'short' | 'long' | 'bible' | 'paraphrase';
  query: string; expect: string[] /* hymn ids, any one counts */; note?: string }[]
```

At least 40 entries, covering every category of FR-019. Each `expect` id must exist in the
content: a test checks this, as for the word-search reference queries.

`tests/queries/meaning-query-vectors.json` holds the query vectors of the reference set for the
current `configId`. They are committed (about 110 KB), so the regression test runs offline.

## MeaningEvaluation (versioned record, FR-021)

`tests/queries/meaning-evaluation.json`:

```ts
{ date: string; queries: number; chosen: string /* configId */;
  candidates: { configId: string; fusion?: { wMeaning: number; wWords: number };
                top1: number; top10: number; top50: number; mrr: number; bytes: number }[];
  wordsOnly: { top1: number; top10: number; top50: number; mrr: number } }
```
