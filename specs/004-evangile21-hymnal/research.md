# Research: Evangile21 Hymnal

Inputs: [spec.md](./spec.md), the saved series page supplied by the maintainer
(`Chants Hymnes21 Archives - Evangile 21.html`), the import pipeline of feature 002
([../002-hymnal-import/research.md](../002-hymnal-import/research.md)), and a few test requests to
the site on 2026-11-12.

## R1. The site blocks the importer: pages are saved from a browser

- **Finding**: evangile21.thegospelcoalition.org is behind a Cloudflare "managed challenge".
  With the importer's own User-Agent (`HymniaImporter/<version> (+contact: …)`), every request
  answers `403` with a "Just a moment…" page, including `robots.txt`, the series page, the RSS
  feeds (`/feed/`, `/series/chants-hymnes21/feed/`) and the song pages. A request that looks
  like `curl` gets through.
- **Decision** (maintainer, 2026-11-12): the importer never requests this site. The maintainer
  saves the series page and each song page from a browser into a folder. A new subcommand,
  `add-pages`, puts those files in the import cache. The run then works from the cache only, as
  `run --offline` already does.
- **Rationale**: the site chose to block automated clients. Getting past the challenge with a
  borrowed identity would go against the constitution's respect of sources (III) and against
  FR-021/FR-022 of feature 002 (follow robots rules, identify ourselves). With saved pages,
  nothing the importer does reaches the site, and the rest of the pipeline (cache, fingerprints,
  `check`, re-runs) works unchanged.
- **Alternatives rejected**: a curl-like User-Agent (rejected by the maintainer); a headless
  browser that solves the challenge (same objection, plus a heavy dependency, against V); waiting
  for Evangile 21 to allow the importer (nothing imported meanwhile; still worth asking, see R8).

## R2. Loading saved pages into the cache (`add-pages`)

- **Decision**: `add-pages --source <id> <folder>` reads every `*.html` file in the folder (not
  the `*_files/` asset folders a browser writes next to them), finds the page URL, and writes
  the page into `import/cache/<source>/` in the fetcher's format (`<sha1(url)>.html` and
  `.meta.json`), so that `ctx.fetch(url)` finds it offline.
- **Page URL**, first found of: the `<!-- saved from url=(NNNN)… -->` comment (Chrome, Edge),
  `<link rel="canonical">`, `<meta property="og:url">`. The supplied series page has all three.
  The URL must be on the source's `baseUrl` host; the fragment is dropped.
- **Refused files**, listed with their reason, nothing written for them: no URL found, URL on
  another host, a challenge page (`<title>Just a moment...</title>`), an empty page.
- **`retrievedAt`**: the file's modification date (the day it was saved), as an ISO date.
  `status` is 200, `etag` and `lastModified` are null, `sha256` is computed like the fetcher does.
- **Same URL already in the cache**: replaced when the content differs (the run then sees a
  changed page and goes through the pending-change review of feature 002), left alone when it
  is the same. The command prints added, replaced, unchanged and refused counts.
- **Rationale**: the cache is already the single place the pipeline reads pages from, and
  `check` already compares content with it. One small command is enough; no new storage.
- **Alternative rejected**: an adapter that reads a folder directly. Adapters must not touch
  files (source-adapter contract), and `check` and re-runs would not see those pages.

## R3. A source that is never fetched (`access: "saved-pages"`)

- **Decision**: `import/sources.json` gains an optional field `access`, `"fetch"` (default) or
  `"saved-pages"`. For a `saved-pages` source, `run` always works offline, with or without
  `--offline`, and says so. A page missing from the cache fails like any page that cannot be
  fetched: the hymn is skipped with the reason "page not saved" and its URL, so the maintainer
  knows which page to save. The 20% rule of feature 002 still applies, so a run with most pages
  missing writes nothing.
- **Rationale**: makes it impossible to hit the site by forgetting `--offline`.

## R4. Listing the songs

- **Finding**: the series page lists 59 cards. 44 are songs (`article.left_image_article_card`
  with `h2.article_title a.article_link`, then `div.article_author`); the others are the site's
  "featured", "recent" and podcast blocks (`featured_article_card`, `title_article_card`,
  `podcast_article_card`). The list is newest first. The saved copy has no pagination link and
  no dates.
- **Found on implementation**: the live page shows 14 songs and loads the others with an "EN VOIR
  PLUS" button (JavaScript, `#ajax-load-more`). The series page must be saved from the browser
  after clicking it until all songs show; the copy supplied by the maintainer was.
- **Decision**: `listEntries` reads the cached series page
  (`https://evangile21.thegospelcoalition.org/series/chants-hymnes21/`), keeps only
  `left_image_article_card` items, and follows a "next page" link (`a.next.page-numbers`) if the
  live list ever grows one; each page must have been saved.
- Song pages are under `/article/`, `/video/` and `/pasteur-compagnie/`. The page path
  (e.g. `/article/roc-des-ages/`) identifies a song.

## R5. Numbering: a pinned table, oldest first

- **Decision**: the adapter holds `EVANGILE21_NUMBERS`, an explicit list of `{ number, path }`,
  oldest song first (the bottom of the series list is number 1), like `ECRITURE_ALBUMS` and
  `PSALMODIE_PROGRAMMES` (feature 002, R13). Numbers are written out, never computed from
  positions, so a song removed from the site leaves a gap and nothing moves.
- A listed song that is not in the table gets the next numbers after the highest pinned one, in
  list order oldest first, and the log says "not pinned yet: add it to EVANGILE21_NUMBERS". This
  meets US3 (a new song gets the next free number on the next run). The maintainer pins it in
  the same change that commits the imported content, so the number can never shift.
- `EVANGILE21_SKIPPED` lists paths that get no number, each with its reason: a page with no
  lyrics (an article about a song) or a second page for a song already numbered (R6). They are
  logged on every run. The table and the skip list are finalised in implementation from the
  saved pages, so that numbers have no gaps at the start.
- **Rationale**: the same pattern as the two other unnumbered sources; stable by construction;
  no new state file. Feature 002 maps `(source, hymnal, number)` to a hymn id in
  `import/state/links.json`, so a number that never changes keeps the link stable (FR-006).
- **Alternative rejected**: numbers derived from publication date on each run. One deletion at
  the source would renumber every later song and break saved collections and the links file.

## R6. Two pages for one song ("Psaume 150")

- **Decision**: the series lists `/article/psaume-150/` (author "Hymnes21") and
  `/video/psaume-150/` (author Kevin Stauffer). When both saved pages hold the same lyrics, the
  article page gets the number and the video page goes to `EVANGILE21_SKIPPED` with the reason
  "same song as /article/psaume-150/". When the lyrics differ, both get numbers and the pipeline
  keeps two hymns (feature 002, decision 2: same-hymnal variants with other lyrics stay apart).
- **Rationale**: FR-010 asks for one number for one song. Recording the second page as an
  `alternateSources` entry would need the pipeline to accept two URLs for one entry; a skip with
  a reason is enough for one known case.

## R7. Extraction of a song page

- **Finding** (from the excerpts in the series page; to be confirmed on the saved pages): the
  article body starts with download links ("Téléchargements : Partitions⎪Accords⎪Accords
  guitare (Capo 3)", or "PARTITIONS ACCORDS ACCORDS GUITARE (CAPO)"), then "Paroles :", then
  labelled stanzas ("Couplet 1", "Refrain", "Pont"…) with one line per `<br>`. WordPress pages
  carry the title in `h1` and the date in `article:published_time`.
- **Decision**:
  - Title: the page `h1`, cleaned with `cleanLine`. A trailing "(chant)" is removed (a site
    qualifier, counted in `strippedMarkup`). Other parentheses stay: an English original title
    ("(O Lord, my Rock and my Redeemer)") or a psalm subtitle is part of the printed title and
    becomes searchable that way (FR-011). "(Philip Bliss)" is checked on its page: kept unless it
    only repeats a credit.
  - Lyrics: everything between the download/"Paroles :" header and the end of the body, or the
    first block that is not lyrics (credits, commentary, video embed, "Partager"). Labels map
    with the same table as the other adapters: "Couplet N" → verse N, "Refrain"/"Chœur" →
    chorus, "Pont" → bridge, anything else ("Intro", "Fin", "Coda") → other. Labels are removed
    and counted. Repeated lines stay (adapter rule 3).
  - Credits: labelled lines in the body ("Paroles", "Musique", "Traduction", "Adaptation"…)
    through `mapCreditRole`; unknown labels go to `unknownCredits`. The card/page author
    (Philippe Viguier, Kevin Stauffer, "Hymnes21") is not a credit (spec, edge cases).
  - No lyrics block, or no labelled stanza and no line breaks → `{ ok: false, reason: "no
    lyrics" }`.
- The exact selectors go in `tests/import/fixtures/evangile21/README.md` once the pages are
  saved, as for the other sources.
- **Found on implementation** (all 44 pages read): four layouts (one `<p>` per stanza with
  `<br>`; one block per line, including `div.chordpro-lyrics`; unlabelled stanzas; an article
  then a "Paroles"/"Transcript" marker). Credits are prose ("Paroles par X, musique par Y. Tr.
  Z."), sometimes a names line above the lyrics or the editor's note
  (`.article_editors_note`). "Composition :" and "Auteurs :" name the songwriters without saying
  who wrote what: stored as `unspecified`. Five pages are articles about a song with no lyrics
  or a single stanza. Details: `tests/import/fixtures/evangile21/README.md`.

## R8. Terms of use and rights

- **Decision**: the source entry records `permission: "unknown"` and the terms found on the site
  (to be read in a browser during implementation, like the other sources: legal notice / "À
  propos"). Hymns are `unconfirmed` and appear only in the personal-use build
  (`HYMNIA_PERSONAL_USE=1`, constitution III). Asking Evangile 21 for permission (and for an
  importer-friendly access, which would remove the need for R1) is a maintainer action outside
  this feature.

## R9. Hymnal entry and search

- **Decision**: `content/hymnals.json` gains `{ "id": "evangile21", "name": "Evangile21",
  "abbreviations": ["Evangile21", "E21"], "sortOrder": 10 }`.
- **Finding**: the query parser reads "Evangile21 12", "E21 12" and "Evangile 21 12" as hymnal
  `evangile21`, number 12 (the lazy prefix reaches the full "evangile21" before the final
  digits). Typed alone, "Evangile21" is read as an unknown hymnal "EVANGILE" with number 21; the
  only effect is the hint "unknown hymnal" when the text search finds nothing. Accepted: no app
  change for a new hymnal (constitution IV); noted for a later search feature.
- Hymn ids come from the existing `ids` rules (a title already used, e.g. "Roc des âges", gets a
  suffixed id), so no clash with other hymnals.

## R10. Test fixtures

- **Decision**: `tests/import/fixtures/evangile21/` holds the saved series page and at least
  five song pages (verses and chorus, credits, no credits if any, "Psaume 150" both pages) plus
  one page that must fail (an article about a song, if it has no lyrics), with `index.json` and
  `README.md` like the other sources. Browser-saved pages are large (≈300 KB); `<script>`,
  `<style>` and inline SVG/base64 are stripped from fixtures to keep the repository small; the
  test checks that stripping them does not change the extraction.
