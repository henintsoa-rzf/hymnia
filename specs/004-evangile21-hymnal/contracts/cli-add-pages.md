# Contract: `add-pages` subcommand and `saved-pages` sources

Additions to [../../002-hymnal-import/contracts/cli.md](../../002-hymnal-import/contracts/cli.md)
and [../../002-hymnal-import/contracts/import-files.md](../../002-hymnal-import/contracts/import-files.md).
Exit codes and `--json` behave as in feature 002.

## `add-pages --source <id> <folder> [--dry-run]`

Loads pages saved from a browser into the import cache of a source, so that `run` can work
without requesting the site.

| Input | Rule |
|-------|------|
| `--source` | Required; must exist in `import/sources.json` (else exit `2`). Works for any source, whatever its `access`. |
| `<folder>` | Required; every `*.html` / `*.htm` file directly in it is read. Sub-folders (the browser's `*_files/`) are ignored. Missing folder → exit `2`. |
| `--dry-run` | Prints what would happen; writes nothing. |

For each file, the page URL is taken from, in order: the `<!-- saved from url=(NNNN)URL -->`
comment, `<link rel="canonical" href>`, `<meta property="og:url" content>`. Then:

| Case | Outcome |
|------|---------|
| No URL found | `refused: no url` |
| URL host ≠ source `baseUrl` host | `refused: other host` |
| `<title>` is "Just a moment..." (challenge page) | `refused: challenge page` |
| Empty body | `refused: empty` |
| URL not in cache | `added` |
| URL in cache, same body | `unchanged` (cache file untouched) |
| URL in cache, other body | `replaced` |

Guarantees:
1. No network request.
2. Cache files are written atomically, in the fetcher's format (`<sha1(url)>.html` and
   `.meta.json`; `retrievedAt` = file modification date; `status` 200).
3. Output: one line per refused file (name and reason), then counts
   `added / replaced / unchanged / refused`. Exit `0` if at least one file was usable, `1` if
   every file was refused.
4. Running it twice on the same folder: the second run reports everything `unchanged`.

## `import/sources.json`: field `access`

```json
{ "id": "evangile21", "access": "saved-pages", "baseUrl": "https://evangile21.thegospelcoalition.org", "…": "…" }
```

- Optional; `"fetch"` (default) or `"saved-pages"`. Any other value fails validation (`check`,
  and `run` exits `1`).
- `run --source <id>` on a `saved-pages` source works from the cache only, with or without
  `--offline`, and prints "source <id>: saved pages only, no request is sent".
- A page missing from the cache is a skipped hymn with reason `page not saved` and its URL. The
  20% rule of feature 002 applies unchanged.
- `HYMNIA_CONTACT` is not required for such a run (no network).
