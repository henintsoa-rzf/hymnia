# Contract: Meaning data files

These files are written by `npm run data` (`scripts/build-data.ts` → `scripts/semantic/build.ts`)
into `static/data/`, next to the catalog and the word-search index (feature 001).

## `manifest.json` (extended)

```jsonc
{
  "version": "0f6d5b05e1",                 // catalog version (unchanged)
  "catalog": "catalog.<hash>.json",
  "index": "index.<hash>.json",
  "meaning": {                             // optional: absent when the build had no vectors
    "configId": "te3-large/title+stanza/512/i8/v1",
    "dims": 512,
    "rows": 10042,
    "vectors": "meaning.<hash>.bin",       // rows × dims bytes
    "rowMap": "meaning-rows.<hash>.bin",   // rows × 8 bytes
    "bytes": 5221888                       // both files, for the progress display
  }
}
```

`DataManifest` in `src/lib/domain/schema.ts` gets the optional `meaning` field. Old clients
ignore it.

## `meaning.<hash>.bin`

A raw `Int8Array` of `rows × dims` values, row after row, with no header. Row `r` is the
quantised, L2-normalised vector of `IndexedStanza.row = r` (see [data-model.md](../data-model.md)).

## `meaning-rows.<hash>.bin`

`rows` records of 8 bytes, little-endian:

| Offset | Type | Field |
|--------|------|-------|
| 0 | uint16 | `hymnIndex` (index in the catalog's `hymns` of this build) |
| 2 | uint16 | `section` (index in that hymn's `sections`) |
| 4 | float32 | `scale` |

## Rules

- Both files come from the same build as the catalog named in the same manifest. The worker
  refuses meaning data whose row count or hymn indexes do not fit the loaded catalog.
- The names are content hashes, so files are immutable and cached `CacheFirst` (research R8).
- They are never precached by the service worker (`globIgnores: ['**/meaning*']`).
- Build failure: the build stops (exit 1) when `vectors + rowMap > MeaningConfig.maxBytes` (10 MB, or 20 MB if the comparison raised it; SC-004), or when a
  published hymn with lyrics has no row.
- When the build has no credentials and its cache is incomplete, `meaning` is left out with a
  warning. This is not an error.
