# Contract change: Query embedding service (`POST /api/embed`)

Base contract: [specs/011-semantic-search/contracts/embed-api.md](../../011-semantic-search/contracts/embed-api.md).
Only the length limit changes (research R6). Everything else is unchanged: request and response
shapes, `configId`, rate limit, caching and privacy.

## Changes

| Item | Before | After |
|------|--------|-------|
| `text` rule | 1–500 code points after tidying | **1–2,000** code points after tidying |
| 413 `too-long` | More than 500 | More than **2,000** |
| Worker constant | `MAX_QUERY_CHARS` | `MAX_EMBED_CHARS` (`src/lib/meaning/config.ts`) |

## Client rules

- **Search field** (feature 011/012): unchanged. It cuts the query at 500 code points
  (`MAX_QUERY_CHARS`) and shows the "texte raccourci" note.
- **Verse search** (this feature): it never cuts. The selection cannot exceed 2,000 code points
  (contracts/bible-ui.md §3), so a 413 can only mean a bug, and it shows the generic failure
  message.
- `embedQuery` gains an option `maxChars` (default `MAX_QUERY_CHARS`). The verse screen passes
  `MAX_EMBED_CHARS`.

## Tests

- Worker unit tests: 2,000 code points → 200, 2,001 → 413. A 2,000-character text that mixes
  combining and accented characters is counted in code points after NFC.
- Client unit test: `embedQuery` with `maxChars: 2000` sends 1,200 characters uncut. Without
  the option it still cuts at 500.
