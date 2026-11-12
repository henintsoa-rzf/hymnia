# Contract: Content Files

**Consumers**: the build script (`scripts/build-data.ts`) and the future hymnal-import feature,
which must produce files in this format. Any change to this contract is a breaking change for
importers.

Entity fields and validation rules are defined in [../data-model.md](../data-model.md).

## Layout

```text
content/
├── hymnals.json          # list of hymnals
├── redirects.json        # optional (feature 002): merged hymn id → kept hymn id
└── hymns/
    └── <hymn-id>.json    # one file per hymn; file name = hymn id
```

**Amended 2026-11-11 (feature 002):** every object is strict, so an unknown or misspelt field
fails the build; hymns may carry `alternateSources`; `redirects.json` is new. All three
changes keep existing files valid.

## `content/hymnals.json`

```json
[
  {
    "id": "jem",
    "name": "J'aime l'Éternel",
    "abbreviations": ["JEM"],
    "sortOrder": 1
  }
]
```

## `content/hymns/<hymn-id>.json`

```json
{
  "id": "a-toi-la-gloire",
  "title": "À toi la gloire",
  "entries": [
    { "hymnal": "atg", "number": "1" },
    { "hymnal": "jem", "number": "245", "title": "Gloire au Ressuscité" }
  ],
  "sections": [
    { "type": "verse", "number": 1, "lines": ["À toi la gloire, ô Ressuscité !", "…"] },
    { "type": "chorus", "number": null, "lines": ["…"] }
  ],
  "credits": [
    { "name": "Edmond Budry", "role": "lyrics" },
    { "name": "G. F. Haendel", "role": "music" }
  ],
  "source": { "name": "Domaine public", "url": null, "retrievedAt": "2026-11-11" },
  "rights": "public-domain",
  "corrections": []
}
```

(Hymnal numbers above are illustrative.)

Optional field, written by the feature 002 importer when hymns from several sources are merged.
Absent means none. It is validated but not copied into the published catalog:

```json
"alternateSources": [
  { "name": "JEM — jemaf.fr", "url": "https://jemaf.fr/…", "retrievedAt": "2026-11-20" }
]
```

## `content/redirects.json` (optional)

Written by the feature 002 importer when it merges a hymn into another, so collections saved
on devices can follow the hymn (feature 002 FR-026, feature 003 FR-016). A missing file is the
same as `{}`.

```json
{ "a-toi-la-gloire-jem-245": "a-toi-la-gloire" }
```

Rules (the build fails otherwise): a source is never the id of an existing hymn file; a target
is an existing hymn id, never another redirect (no chains).

## Build output (published with the app)

The build writes these files, which the app loads. They are internal to the app and are not a
stable interface:

| File | Content |
|------|---------|
| `static/data/catalog.<hash>.json` | Hymnals with `hymnCount`; published hymns with derived `firstLine` and entry `sortKey`; `redirects`. Hymnals with no published hymn are in the catalog but the app does not list them. |
| `static/data/index.<hash>.json` | Serialised search index. |
| `static/data/manifest.json` | Current file names and content version, so the app can detect and fetch an update. |

The build fails, with a list of errors, if any validation rule in the data model is broken.
