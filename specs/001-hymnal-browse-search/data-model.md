# Data Model: Browse and Search the Multi-Hymnal Collection

**Feature**: `001-hymnal-browse-search` | **Date**: 2026-11-11

The model separates the **hymn** (the song itself) from its **entries** in hymnals (where it is
published, and under which number), as required by constitution Principle IV. The exact file
format is in [contracts/content-schema.md](./contracts/content-schema.md).

## Entities

### Hymnal (Recueil)

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique, lowercase slug (`jem`, `adf`, `atg`). Used in URLs. Never changes. |
| `name` | string | Full name as published ("Ailes de la Foi"). |
| `abbreviations` | string[] | At least one ("AdF"). Unique across all hymnals once normalised. Used by the number-query parser (FR-004). |
| `sortOrder` | integer | Display order in the hymnal list. |
| `hymnCount` | integer | Computed at build time from published entries (FR-011). Not stored in source files. |

### Hymn (Chant)

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique, stable slug (`a-toi-la-gloire`). Never reused. |
| `title` | string | Required, as in the source. |
| `sections` | Section[] | At least one, in source order (FR-013). |
| `entries` | HymnalEntry[] | At least one. |
| `credits` | Credit[] | Zero or more (FR-014). |
| `source` | Source | Required (Principle III). |
| `rights` | enum | `confirmed`, `public-domain`, `unconfirmed`. Only the first two are published (FR-019). |
| `corrections` | Correction[] | Log of changes made to the source text. Zero or more. |

**Derived at build time**: `firstLine` (first line of the first section), used by search ranking
(FR-007).

### Section (Strophe / Refrain / Pont)

| Field | Type | Rules |
|-------|------|-------|
| `type` | enum | `verse`, `chorus`, `bridge`, `other`. |
| `number` | integer \| null | Verse number, as in the source. `null` for chorus and bridge. |
| `lines` | string[] | At least one. Text in Unicode NFC, unchanged from the source (FR-020). |

### HymnalEntry (Numérotation)

| Field | Type | Rules |
|-------|------|-------|
| `hymnal` | string | Must match an existing hymnal `id`. |
| `number` | string | As printed ("245", "123a", "123 bis"). Unique within its hymnal. |
| `sortKey` | integer + string | Derived: numeric part, then suffix. Used for number order (FR-012) and next/previous (FR-016). |

### Credit (Crédit)

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | As credited in the source. |
| `role` | enum | `lyrics`, `music`, `translation`, `arrangement`. |

### Source

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Name of the source ("JEM — jemaf.fr", "Domaine public"). |
| `url` | string \| null | Page the text was taken from. |
| `retrievedAt` | date | ISO date (YYYY-MM-DD). |

### Correction

| Field | Type | Rules |
|-------|------|-------|
| `date` | date | ISO date. |
| `description` | string | What changed and why. |

### Reading preferences (per device, not in content)

| Field | Type | Rules |
|-------|------|-------|
| `textScale` | number | 0.85 to 2.0, default 1.0 (FR-015). |
| `theme` | enum | `system` (default), `light`, `dark` (FR-017). |
| `hymnalFilter` | string[] | Selected hymnal ids; empty means all (FR-010). |

## Relationships

```text
Hymnal 1 ──── * HymnalEntry * ──── 1 Hymn
Hymn 1 ──── * Section
Hymn 1 ──── * Credit
Hymn 1 ──── 1 Source
```

A hymn present in JEM and À Toi la Gloire has two entries. In browse view it appears in both
hymnals; in text search it appears once with both references (spec edge cases).

## Validation rules (checked by the build, which fails on any error)

1. Every `entries[].hymnal` matches an existing hymnal.
2. No two entries share the same hymnal and number.
3. Hymnal abbreviations are unique after normalisation.
4. Every text field is in Unicode NFC.
5. Every hymn has at least one section with at least one non-empty line.
6. Hymns with `rights: unconfirmed` are excluded from the published output, and the build lists
   how many were excluded.

## Lifecycle

Rights status is the only state that changes: `unconfirmed` → `confirmed` (or
`public-domain`) once checked. Moving back to `unconfirmed` removes the hymn from the next
published build.

## Search index (derived, not stored in source)

One document per hymn, with these indexed fields:

| Field | Boost | Content |
|-------|-------|---------|
| `title` | 3 | Hymn title |
| `firstLine` | 2 | First line of the first section |
| `lyrics` | 1 | All section lines joined |

The parser uses a separate lookup table, normalised abbreviation or name + number → (hymnal
id, entry number), for number queries (FR-002 to FR-004).
