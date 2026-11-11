# Contract: Content Files

**Consumers**: the build script (`scripts/build-data.ts`) and the future hymnal-import feature,
which must produce files in this format. Any change to this contract is a breaking change for
importers.

Entity fields and validation rules are defined in [../data-model.md](../data-model.md).

## Layout

```text
content/
├── hymnals.json          # list of hymnals
└── hymns/
    └── <hymn-id>.json    # one file per hymn; file name = hymn id
```

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
    { "hymnal": "jem", "number": "245" }
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

## Build output (published with the app)

The build writes these files, which the app loads. They are internal to the app and are not a
stable interface:

| File | Content |
|------|---------|
| `static/data/catalog.<hash>.json` | Hymnals with `hymnCount`; published hymns with derived `firstLine` and entry `sortKey`. |
| `static/data/index.<hash>.json` | Serialised search index. |
| `static/data/manifest.json` | Current file names and content version, so the app can detect and fetch an update. |

The build fails, with a list of errors, if any validation rule in the data model is broken.
