# Data Model: Evangile21 Hymnal

This feature adds no new entity to the app. It adds data (one hymnal, one source, its hymns)
and two small additions to the import model of feature 002. Base definitions:
[../001-hymnal-browse-search/data-model.md](../001-hymnal-browse-search/data-model.md) and
[../002-hymnal-import/data-model.md](../002-hymnal-import/data-model.md).

## Hymnal `evangile21` (content/hymnals.json)

| Field | Value | Rule |
|-------|-------|------|
| `id` | `evangile21` | Never reused (feature 002, FR-028) |
| `name` | `Evangile21` | As requested by the maintainer |
| `abbreviations` | `["E21", "Evangile21"]` | First one (≤ 3 characters) is shown in tiles and results |
| `sortOrder` | `10` | After the existing hymnals |

## Source `evangile21` (import/sources.json)

| Field | Value |
|-------|-------|
| `id` | `evangile21` |
| `name` | `Evangile 21 — evangile21.thegospelcoalition.org` (shown under each hymn) |
| `baseUrl` | `https://evangile21.thegospelcoalition.org` |
| `hymnals` | `["evangile21"]` |
| `minDelayMs` | `1000` (unused: the source is never fetched) |
| `terms` | URL, summary and date read, filled in implementation (research R8) |
| `permission` | `unknown` |
| `access` | **new**, `"saved-pages"` (research R3) |

**New field `access`** (optional, all sources): `"fetch"` (default when absent) or
`"saved-pages"`. Validation: one of the two values. Existing entries are unchanged and keep
their meaning.

## Saved page → cache entry (`add-pages`, research R2)

A browser-saved file becomes one cache entry of feature 002 (`<sha1(url)>.html` +
`.meta.json`, type `CachedMeta`):

| Cache field | From the saved file |
|-------------|---------------------|
| `url` | "saved from url" comment, else `link[rel=canonical]`, else `meta[property=og:url]`; fragment removed; host must be the source's |
| `retrievedAt` | File modification date (ISO date) |
| `status` | `200` |
| `etag`, `lastModified` | `null` |
| `sha256` | Of the page body, as the fetcher computes it |

Outcomes per file: `added`, `replaced` (same URL, other content), `unchanged`, `refused`
(with reason: `no url`, `other host`, `challenge page`, `empty`).

## Series entry (adapter, in memory)

One song card of the series page: `path` (e.g. `/article/roc-des-ages/`), `url`, `title` (card
text), `author` (card author; not a credit). Order: as listed (newest first); reversed for
numbering.

## Number table (adapter constants, research R5)

```text
EVANGILE21_NUMBERS: { number: number; path: string }[]   // oldest first, explicit numbers
EVANGILE21_SKIPPED: { path: string; reason: string }[]   // pages that get no number
```

Rules:
- `number` values are unique, ≥ 1; `path` values are unique across both lists.
- An entry's number never changes once committed; a removed song leaves a gap.
- A listed path in neither list gets `max(number) + k` (k = 1, 2… in list order, oldest first)
  and is logged as "not pinned yet".
- A skipped path yields no `EntryRef` and is logged with its reason on every run.

`EntryRef` produced: `{ hymnal: "evangile21", number: String(number), url: baseUrl + path }`.

## RawHymn (feature 002) for an Evangile21 page

| Field | Rule here |
|-------|-----------|
| `title` | Page `h1`, `cleanLine`; trailing "(chant)" removed and counted |
| `sections` | Labelled stanzas in source order; "Couplet N" → verse N, "Refrain"/"Chœur" → chorus, "Pont" → bridge, other labels → other |
| `credits` | Labelled credit lines of the body, roles via `mapCreditRole`; page author never used |
| `strippedMarkup` | Counts: `section-label`, `download-links`, `title-qualifier`, … |
| `unknownCredits` | Credit labels with no known role |

State transitions are those of feature 002 (new → unchanged / changed → pending → accepted or
rejected; missing at source). Nothing new.
