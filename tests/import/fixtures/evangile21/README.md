# Fixtures: evangile21.thegospelcoalition.org (`evangile21`)

The site answers the importer with a Cloudflare challenge (HTTP 403, "Just a moment…"), even for
`robots.txt` (checked 2026-11-12). By the maintainer's decision the importer never requests it
(specs/004-evangile21-hymnal/research.md, R1): every page here was **saved from a browser** and
loaded with `npm run import -- add-pages`. `index.json` gives each file's URL and the time the
page was saved.

These pages contain lyrics protected by copyright. They are kept **only** as test fixtures, are
never published, and are as few as the tests need. `<script>`, `<style>`, `<svg>`,
`<noscript>`, `<link>`, `srcset` and `data:` URIs are stripped (the adapter never reads them),
except in `hymn-roc-des-ages-full.html`, which is kept whole to check that stripping changes
nothing.

| File | Page | Why it is here |
|------|------|----------------|
| `listing-series.html` | `/series/chants-hymnes21/` | The list with all 44 songs (saved after "EN VOIR PLUS"), plus featured, recent and podcast cards |
| `hymn-roc-des-ages.html` | Evangile21 19 | `<p>` stanzas with `<em>` labels, download links, prose credits, "Version anglophone" |
| `hymn-o-dieu-grace.html` | 14 | "Paroles:" marker, chorus, credits with "(« Grace Greater… »)" |
| `hymn-dieu-plus-pres-de-toi.html` | 13 | No labels (verses numbered by position), "Ar." arrangement, initials ("R.K. Carter") |
| `hymn-folle-nuit-de-la-croix.html` | 28 | One `<p>` per line, labels between stanzas, names line above the lyrics |
| `hymn-dieu-leternel-incree.html` | 29 | `div.chordpro-lyrics` per line, `<p>&nbsp;</p>` between stanzas, "Refrain 1…4", "Tag" |
| `hymn-psaume-32.html` | 31 | Prose before and after, Bible verses quoted between stanzas, bold lyrics |
| `hymn-viens-suis-moi.html` | 7 | No credits ("© 2016 Philippe Viguier" only) |
| `hymn-psaume-150-article.html` | 33 | Chorus written out, unlabelled, after each verse; credits in the editor's note |
| `hymn-psaume-150-video.html` | (skipped) | Same song as the article page: labelled, chorus once (research R6) |
| `hymn-sois-seul-vision.html` | 22 | "PAROLES" marker, "Refrain:" only labels, "Air traditionnel…, paroles de…" |
| `hymn-alleluia-grand-sauveur.html` | 2 | Title "(Philip Bliss)" repeats a credit: removed |
| `hymn-en-memoire-de-ton-nom.html` | 38 | Title "(chant)" removed; article before "Les paroles"; no credits |
| `not-a-hymn.html` | `/video/craignons-leternel/` (skipped) | An article about a song, no lyrics: must fail with "no lyrics" |
| `hymn-roc-des-ages-full.html` | 19 | Unstripped copy of `hymn-roc-des-ages.html` |

## Series page

- Song cards: `article.left_image_article_card h2.article_title a.article_link`, newest first,
  followed by `div.article_author` (the page author, not a song credit). Other blocks on the page
  (`featured_article_card`, `title_article_card`, `podcast_article_card`) are not songs.
- The live page shows 14 songs and loads the others with a "EN VOIR PLUS" button
  (`#ajax-load-more`, JavaScript). **Save it after clicking the button until every song shows**,
  with the browser's "Save page as…". A copy of the server HTML (e.g. fetched by a script) only
  has the first 14. There is no `a.next.page-numbers` link today; the adapter follows one if it
  appears.
- No dates on the list. Each song page has its date in `ga_publish_date` (MM-DD-YYYY).

## Song pages

- Title: `h1.entry-title`.
- Lyrics and most credits: `.entry-content .content_container` (the first one). Hand-made
  WordPress content, four layouts:
  1. one `<p>` per stanza, lines separated by `<br>`, the first line an `<em>` label
     ("Couplet 1", "Refrain", "Pré-refrain", "Pont", "Fin", "Introduction");
  2. one block per line (`<p>` or `div.chordpro-lyrics`), stanzas separated by a label line or
     an empty `<p>&nbsp;</p>`;
  3. stanzas with no label at all (classic hymns);
  4. an article first, then a "Paroles" / "Les paroles" / "Transcript" marker and the lyrics.
- Before the lyrics: download links ("Téléchargements : Partitions⎪Accords", "[PARTITIONS]",
  "LEADSHEET – ACCORDS"), sometimes a names line ("Pete James et Aaron Keyes") or a subtitle.
- After the lyrics: a credits paragraph, often bold-italic prose ("Paroles par Augustus Toplady,
  musique par Thomas Hastings. Tr. Philippe Viguier."), links, "Version anglophone :" with a video.
- Editor's note: `.entry-content .article_editors_note` ("Composition : …", "Traduction : …").
- `.article_author_bio` and everything after it is about the page author: never read.

## Extraction rules (adapter `scripts/import/sources/evangile21.ts`)

- Start: after the first lyrics marker; else at the first label; else at the first line that
  is not a download link, a names line or a credit line.
- End: the first download-link line, credit line ("Paroles par", "Musique", "Tr.", "©",
  "Composition :", "Note de l'éditeur"…), "Version anglophone", "Partitions disponibles", or a
  line longer than 140 characters (commentary). Bible verses ("4car nuit et jour…") are dropped.
- Labels: "Couplet N" → verse N; "Refrain N" / "Chœur" → chorus; "Pont" → bridge; "Pré-refrain",
  "Introduction", "Fin", "Coda", "Tag" → other. A label with no lines after it is a repeat
  marker. Unlabelled stanzas are verses numbered by position, unless the page labels its verses
  itself (then they are `other`).
- Credits: "Paroles et musique" → lyrics + music; "Paroles" → lyrics; "Musique" → music;
  "Tr." / "Traduction" / "Traducteurs" → translation; "Ar." → arrangement; "Composition :" /
  "Auteurs :" and a names line → unspecified. Copyright holders, performers, producers, "pont
  par", "refrain par" are not stored.
- Title: a trailing "(chant)" or a parenthesis repeating a credited name is removed.

## Pages with no number (`EVANGILE21_SKIPPED`)

| Page | Reason |
|------|--------|
| `/video/craignons-leternel/` | Article about the song, no lyrics |
| `/article/lhistoire-qui-est-derriere-o-come-all-you-unfaithful-o-viens-peuple-infidele/` | Article about the song (quotes a draft) |
| `/article/chantons-le-chant-demmanuel/` | Article about the song, quotes one stanza only |
| `/video/sa-grace-est-plus-grande/` | Article about the song, no lyrics |
| `/article/nouveau-chant-par-ta-grace-infinie/` | Article about the song, no lyrics |
| `/video/psaume-150/` | Same lyrics as `/article/psaume-150/` (differences: "œuvres"/"oeuvres", one comma, the chorus written once) |

## First import (2026-11-12)

- 44 pages saved, `add-pages`: added 45 (series page + 44 songs), refused 0.
- `run`: 38 pages, 0 failures, 38 Evangile21 hymns. Six are Evangile21 versions of classic hymns
  that À Toi la Gloire also prints (4, 12, 13, 15, 16, 18; their credits cite ATG 206, 288, 258,
  307, 316, 119). The matcher merged them at first; by the maintainer's decision they are kept as
  separate hymns, with `distinct` decisions in `import/decisions/merges.json`, so the app shows
  the Evangile21 wording (e.g. the introduction and bridge of "Ô Jésus je t'aime").
- 1 possible duplicate: "Toute la terre", JEM 716, another song: recorded `distinct`.
- 4 hymns have no credits on their page (7, 25, 35, 38).
- `check`: every imported text matches its saved page.
- Spot check (SC-002): the extraction of all 38 numbered pages was read side by side with the
  page text, and 10 hymn files (1, 2, 13, 19, 22, 28, 29, 31, 33, 38) were compared line by line,
  in order, with their page: same lines, no download link or heading, source URL and date present.

## Re-running Evangile21

1. Open the series page, click "EN VOIR PLUS" until every song shows, and save it ("Save page
   as…") into `import/inbox/evangile21/`, replacing the old copy. Save each new song page there
   too.
2. `npm run import -- add-pages --source evangile21 import/inbox/evangile21`
3. `npm run import -- run --source evangile21 --hymnal evangile21 --yes`, then read the report.
4. For each "not pinned yet" song, add `{ number, path }` to `EVANGILE21_NUMBERS` (or the page
   to `EVANGILE21_SKIPPED` with its reason) in the same commit as its content.
