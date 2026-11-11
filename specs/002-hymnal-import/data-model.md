# Data Model: Import Hymnals from Source Sites

**Feature**: `002-hymnal-import` | **Date**: 2026-11-11

The importer **writes** feature 001's entities (Hymnal, Hymn, Section, HymnalEntry, Credit,
Source, Correction), defined in
[../001-hymnal-browse-search/data-model.md](../001-hymnal-browse-search/data-model.md). This file
defines the import's own records. They are stored under `import/`, apart from `content/`.
Exact file formats are in [contracts/import-files.md](./contracts/import-files.md).

## Change to feature 001's Hymn (additive)

| Field | Type | Rules |
|-------|------|-------|
| `alternateSources` | Source[] | Optional, default `[]`. Other sources that provide the same hymn after a merge (FR-017). Not shown in the app for now. |

The 001 content schema and the Zod schema must allow this field. Existing files stay valid.

## Import records

### SourceConfig (`import/sources.json`)

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Slug (`cdl`, `jemaf`, `psalmodie`, `ecriture`). Unique. |
| `name` | string | Display name, recorded in each hymn's `source.name`. |
| `baseUrl` | URL | Site root. |
| `hymnals` | string[] | Hymnal ids this source covers; each must exist in `content/hymnals.json`. |
| `minDelayMs` | integer | ≥ 1000. The fetcher uses the larger of this and the site's `Crawl-delay`. |
| `terms` | object | `url`, `summary`, `checkedAt` (date). |
| `permission` | enum | `unknown`, `requested`, `granted`, `refused`. `unknown` means a warning before fetching (FR-023); `refused` means the import refuses to run. |

### CachedPage (`import/cache/`, not versioned)

| Field | Type | Rules |
|-------|------|-------|
| `url` | URL | Page address. |
| `retrievedAt` | datetime | ISO. |
| `status` | integer | HTTP status. |
| `etag`, `lastModified` | string \| null | For conditional re-fetch. |
| `sha256` | string | Hash of the body. |

### RawHymn (in memory, adapter output)

| Field | Type | Rules |
|-------|------|-------|
| `source` | string | SourceConfig id. |
| `hymnal` | string | Hymnal id. |
| `number` | string | As printed. |
| `url` | URL | Page the hymn was extracted from. |
| `title` | string | Non-empty. |
| `sections` | Section[] | ≥ 1, chords removed, NFC. |
| `credits` | Credit[] | May be empty (reported as "no credits"). |
| `strippedMarkup` | record | Counts of removed chord/annotation kinds (reported). |

**Fingerprint**: SHA-256 of `normalize(title) + sections (type, number, normalised lines)`.
The importer computes it; it is not stored on the RawHymn.

### Link (`import/state/links.json`, versioned)

| Field | Type | Rules |
|-------|------|-------|
| `source`, `hymnal`, `number` | key | Unique together. |
| `hymnId` | string | Existing hymn in `content/hymns/`. |
| `url` | URL | Last known page URL. |
| `acceptedFingerprint` | string | Fingerprint of the source text last written or accepted. |
| `status` | enum | `active`, `missing` (no longer listed at the source). |
| `lastSeenAt` | date | Last run that found it. |

### PendingChange (`import/pending/<hymnId>--<source>.json`, versioned)

| Field | Type | Rules |
|-------|------|-------|
| `hymnId`, `source`, `hymnal`, `number` | refs | — |
| `detectedAt` | date | — |
| `oldFingerprint`, `newFingerprint` | string | — |
| `diff` | string | Unified diff of the lines (title + sections). |
| `proposed` | RawHymn | What would be written. |

### RightsDecision (`import/decisions/rights.json`, versioned)

| Field | Type | Rules |
|-------|------|-------|
| `scope` | enum | `source`, `hymnal`, `hymn`. |
| `target` | string | Source id, hymnal id, or hymn id. Must exist. |
| `basis` | enum | `permission`, `licence`, `public-domain`, `refused`. |
| `date` | date | ISO. |
| `note` | string | Free text (who granted it, reference). |

Only one decision is allowed per (scope, target); a newer decision replaces the older one, and
git keeps the history.

### MergeDecision (`import/decisions/merges.json`, versioned)

| Field | Type | Rules |
|-------|------|-------|
| `a`, `b` | string | Two hymn ids. The pair is stored with `a < b`. |
| `decision` | enum | `merge` (into `a`), `distinct`. |
| `date` | date | — |

### SourcePriority (`import/decisions/source-priority.json`, versioned)

A map from hymnal id to an ordered list of source ids. A missing hymnal falls back to the order
of `sources.json`.

### ImportRun and Report (`import/reports/<runId>.json` + `.md`, versioned)

| Field | Type | Rules |
|-------|------|-------|
| `runId` | string | `YYYYMMDD-HHMMSS`. |
| `startedAt`, `finishedAt` | datetime | — |
| `args` | object | Sources, hymnals, flags. |
| `perSource` | map | `status`: `ok`, `aborted` (threshold), `unreachable`, `skipped-permission`. |
| `perHymnal` | map | Counts plus lists: `new`, `changed` (pending), `unchanged`, `skipped` (reason, URL), `missing`, `possibleDuplicates`, `autoMerged`, `conflicts`, `noCredits`, `rightsInherited`. |

## Derived values

- **Hymn `rights`**: comes from the most specific RightsDecision for the hymn, then its hymnals
  (if any hymnal entry is covered by a `permission` or `licence` decision), then its source. A
  `refused` decision or no decision gives `unconfirmed`. `public-domain` gives `public-domain`;
  `permission` or `licence` gives `confirmed`.
- **Hymn `id`** (new hymns): `slug(title)`. If that id is already taken, the importer uses
  `slug(title)-<hymnal>-<number>`. The id never changes afterwards.

## State transitions

```text
Source hymn:  (no link) ──match──▶ new hymn | attached to existing hymn (auto-merge)
              linked, same fingerprint ──▶ unchanged (no write)
              linked, new fingerprint  ──▶ pending ──accept──▶ written, fingerprint updated
                                                    └─reject──▶ fingerprint updated, text kept
              linked, not listed       ──▶ missing (kept; back to active if it reappears)

Hymn rights:  unconfirmed ──decision (permission|licence|public-domain)──▶ confirmed | public-domain
              any ──decision refused / decision removed──▶ unconfirmed
```

## Validation rules (import refuses to write on failure)

1. Every hymn written passes feature 001's content schema (FR-003).
2. No two links point to the same (hymnal, number) with different hymn ids. A clash is a
   conflict: it is reported and nothing is written.
3. Every `target` in decisions and every `hymnals` id in sources exists.
4. Lyrics in `content/` differ from the extracted source only by whitespace and NFC, unless a
   Correction records the difference (FR-004). `hymnia-import check` verifies this against the
   cache.
