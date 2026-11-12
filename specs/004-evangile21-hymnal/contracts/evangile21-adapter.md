# Contract: Evangile21 source adapter

Follows [../../002-hymnal-import/contracts/source-adapter.md](../../002-hymnal-import/contracts/source-adapter.md)
with no interface change. File: `scripts/import/sources/evangile21.ts`, registered in
`scripts/import/sources/all.ts`.

## `listEntries("evangile21", ctx)`

1. `ctx.fetch("https://evangile21.thegospelcoalition.org/series/chants-hymnes21/")` (served
   from the cache), then each "next page" link, if any.
2. Keeps the song cards only (`article.left_image_article_card h2.article_title a`); ignores
   featured, recent and podcast blocks. A path seen twice is kept once.
3. Maps each path through `EVANGILE21_SKIPPED` (no entry, logged with reason) and
   `EVANGILE21_NUMBERS` (pinned number); an unknown path gets the next free number, oldest first,
   logged "not pinned yet".
4. A pinned path absent from the list produces no entry; the pipeline reports the hymn as
   "missing at source" (feature 002).
5. Any other hymnal id throws, like the other adapters.

## `parseHymn(html, ref)`

Pure. Returns `{ ok: true, hymn }` with `source: "evangile21"`, or `{ ok: false, reason }` with
one of: `no title`, `no lyrics`, `challenge page`.

Rules (research R7):
- Title from `h1`; trailing "(chant)" removed.
- Lyrics: stanzas after the download links / "Paroles :" header; download links, embeds,
  "Partager" and commentary excluded; labels mapped and removed; text kept otherwise
  (`cleanLine`, NFC).
- Credits only from labelled lines; the page author is never a credit.

## Tests (`tests/import/adapters/evangile21.test.ts`)

On the saved fixtures (research R10):
- the series page lists the 44 song cards and none of the other blocks;
- numbering: pinned numbers used, an unpinned path gets `max + 1`, a skipped path is absent, a
  removed path leaves the others unchanged;
- at least five song pages: title, section types and numbers, first and last line, credits;
  "Roc des âges" and one page with a chorus;
- no download-link text, "Paroles :" or "Partager" in any extracted line;
- "Psaume 150": article and video pages handled as R6 decides;
- one page fails with its reason;
- stripping `<script>`/`<style>` from a fixture does not change the result.
