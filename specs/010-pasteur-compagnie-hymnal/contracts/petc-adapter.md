# Contract: `petc` adapter and the same-page rule

This contract extends [specs/002-hymnal-import/contracts/source-adapter.md](../../002-hymnal-import/contracts/source-adapter.md).
Decisions: [research.md](../research.md). Shapes: [data-model.md](../data-model.md).

## `listEntries('pasteur-compagnie', ctx)`

1. Read `/collections/partitions?page=1`, `?page=2`, … up to the first page with no product
   card. Collect song handles from the grid only, keep the first occurrence of each, and log
   `pasteur-compagnie: <rows> rows, <n> song pages`.
2. Read `/collections/digital-albums`, then each album page that is not skipped. Parse each
   numbered tracklist (`^\d+\.\s*title`) and the lyrics pages its description links to
   (`/pages/album-kids-paroles`); a lyrics page is only fetched when a song is parsed. Log
   `pasteur-compagnie: <a> albums, <t> tracks, <m> matched`.
3. Resolve tracks (data-model "Track") and numbers (`PETC_ALBUMS`, `PETC_NUMBERS`, research R4).
4. Return the refs sorted by number. A hymnal other than `pasteur-compagnie` throws.

Any other hymnal, a list page that fails, or an album page that fails stops the source
(feature 002: "listing failed").

| Case | Expected |
|------|----------|
| list pages 1 and 9 (fixtures) | 8 + 4 handles, no duplicate, no menu links |
| album list | 6 album handles |
| `dans-ses-mains`, track 7 "Il me gardera (Alicia Roehrig & Philippe Viguier)" | ref 307 → `/products/il-me-gardera-he-will-hold-me-fast` |
| Impros louange, track 9 "A l'Agneau" | ref 209 → `/products/a-l-agneau-sur-son-trone` (prefix match) |
| Hymnes21 2018 track 5 and Plus haut encore track 5 | refs 105 and 505, same URL |
| `kids`, track 2 "L'évangile c'est de la bombe" | ref 402 → `/pages/album-kids-paroles#2` |
| `dans-ses-mains`, track 5 "Les cieux proclament" | ref 305 → `/products/dans-ses-mains#track-5` |
| `kids-album-pistes-instrumentales` | no refs; log "skipped: same tracklist as KIDS" |
| Plus haut encore, track 11 "L'espoir (instrumental)" | no ref; log line |
| `grace-infinie`, on no album | its pinned number (1005) |
| a song page that is not pinned and on no album | next free number above the highest pinned "Hors album" one; log `not pinned yet` |
| an album that is not in `PETC_ALBUMS` | next free hundred; log `add it to PETC_ALBUMS and to the parts in content/hymnals.json` |
| a pinned song missing from every list | still returned (Exo rule) |

## `parseHymn(html, ref)`

Pure. It dispatches on the URL:

| URL | Behaviour |
|-----|-----------|
| `/products/<song>` | parse `.product-single__description`, title from the product `<h1>` |
| `/pages/album-kids-paroles#<n>` | the block from `<h1>n. title` up to the next `<h1>`; the title is the heading without "n." |
| `/products/<album>#track-<n>` | `{ ok: false, reason: 'no lyrics on the site: album track n "…"' }` (research R6); a track matching several song pages is logged by `listEntries` and fails with the same reason |
| a page with no product description, or no lyrics | `{ ok: false, reason: 'no lyrics' }` |

Output rules (FR-008 to FR-012, research R8 and R9):

| Case (fixture) | Expected |
|----------------|----------|
| `jesus-merci-jesus-thank-you` | title "Jésus merci"; verse 1, chorus, verse 2, bridge… in order; credit Pat Sczebel (unspecified) |
| `lespoir-1` | credit Philippe Viguier (lyrics, music); no "Violons", "DA, mix…" lines; `strippedMarkup['recording credit'] = 2`; sections including "Pré-refrain" |
| `redempteur-adorable` | no labels; one verse per blank-line stanza; "Allélu, alléluia  (x4)" kept, spaces tidied by `cleanLine` |
| `coule-a-flots-come-thou-fount` | credits: John Wyeth (music), Robert Robinson (lyrics), Philippe Viguier (translation); "Pont par Shayne Barnard" not stored; a warning if the stanzas cannot be split |
| `noel-jesus-est-ne` | "Arrangement piano-violon et leadsheet." and "A Toi Gloire 116." not in the lyrics; "Decovert-Blochet. Air anglais" handled as credits or a warning, never as lyrics |
| `papa-cest-quoi-une-ame-partition` | title "Papa c'est quoi une âme ?"; dialogue kept as lyrics |
| title "Voici Noël (jazzy)" / "Là aussi (Psaume 139)" | the bracket is kept |
| all 68 current titles (unit test on a list, no pages) | English brackets and "(partition)" removed; others kept |
| an album page given as a song | `{ ok: false }` |

Each returned text is NFC and passes `cleanLine`. No chord, label, link or note appears in
`sections`.

## Pipeline change: same page, several numbers (research R5)

In `reconcile`, an outcome whose `(source, hymnal, number)` is not linked and whose number is
free is checked before matching. If a link of the same source with the same `url` points, in this
run or in the state, to a hymn that has an entry in the same hymnal, the outcome attaches to that
hymn:
- the entry is added;
- the source is not added to `alternateSources` again;
- a new link is created, and the outcome is reported under `autoMerged`.

| Case | Expected |
|------|----------|
| refs 105 and 505 with the same URL, first run | one hymn with entries `pasteur-compagnie 105` and `505`; two links |
| re-run, unchanged | both `unchanged`; no write |
| the page's text changes | one pending change per link, both for the same hymn (the existing behaviour for two links) |
| other sources (cdl, jemaf, …) | unchanged: their refs never share a URL within a hymnal |

## Report change (research R7)

`HymnalReport.toCheck` lists `{ number, hymnId, title, warnings }` for every extracted hymn with
warnings. `npm run import -- report` prints it under "To check by hand". Reports written before
this change, which have no `toCheck`, still load.
