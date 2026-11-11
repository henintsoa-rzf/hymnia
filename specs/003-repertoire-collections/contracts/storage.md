# Contract: Stored Répertoire

**Consumers**: the Répertoire store (read/write), future features (notes, sharing, sync) that
must migrate from it.

## Keys (`localStorage`)

| Key | Content |
|-----|---------|
| `hymnia.repertoire.v2` | The Répertoire document (below) |
| `hymnia.repertoire` | Single list of feature 001: **ignored**, not migrated and not deleted (user decision) |
| `hymnia.repertoire.corrupt-<ISO date>` | A document that could not be read, kept for recovery |

## Document (v2)

```json
{
  "version": 2,
  "collections": [
    {
      "id": "0f8b5c2e-…",
      "name": "Culte du 16 novembre",
      "createdAt": "2026-11-11T09:00:00.000Z",
      "updatedAt": "2026-11-11T09:05:00.000Z",
      "entries": [
        { "hymnal": "ce", "number": "1", "addedAt": "2026-11-11T09:01:00.000Z" },
        { "hymnal": "he", "number": "3 bis", "addedAt": "2026-11-11T09:02:00.000Z" }
      ]
    }
  ]
}
```

## Loading (in order)

1. `v2` present and valid → use it.
2. `v2` present but invalid → copy it to `corrupt-<date>`, start empty, show a notice once.
3. `v2` absent → empty Répertoire (the 001 key is not read).

## Writing

- The whole document is written after each change, synchronously.
- A write failure (quota, blocked storage) keeps the change in memory and shows the notice
  "Vos collections ne pourront pas être conservées sur cet appareil." once per visit.
- A `storage` event for `hymnia.repertoire.v2` from another tab replaces the in-memory
  document (last write wins).

## Compatibility

Any future field is added with a new `version` and a tested migration from 2. Hymn data
updates never write to these keys.
