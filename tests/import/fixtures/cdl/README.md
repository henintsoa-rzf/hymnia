# Fixtures: conducteurdelouange.com (`cdl`)

Pages saved on 2026-11-11 with the importer's own fetcher (robots.txt followed, at least 1.5 s
between requests, identifying User-Agent). `index.json` gives each file's URL and retrieval
time; tests use it to seed a page cache.

These pages contain lyrics protected by copyright (see the site's
[terms](https://www.conducteurdelouange.com/termes-et-conditions): no public use without
permission). They are kept **only** as test fixtures, are never published, and are as few as
the tests need. Public-domain hymns were chosen where they show the needed structure.

| File | Page | Why it is here |
|------|------|----------------|
| `listing-jem1-page1.html` | `/chants/recueil/1` (J'aime l'Éternel 1, page 1 of 19) | Listing with numbers, pagination |
| `listing-jem1-page19.html` | `/chants/recueil/1?page=19` | Last listing page (11 items, #361–#371) |
| `listing-exo.html` | `/chants/recueil/6` (Exo) | Listing **without** numbers: entries skipped |
| `hymn-130.html` | `/130` — JEM 1 #1 | Chorus first, one verse, chorus again |
| `hymn-7.html` | `/7` — JEM 1 #17 | "Strophe 1"/"Refrain 1" labels; verse number written in the text ("1. …") |
| `hymn-201.html` | `/201` — JEM 1 #3 | One verse with a blank line inside |
| `hymn-1411.html` | `/1411` — AdF #1 (Bèze, Bourgeois; public domain) | Three "Couplet", lines split in `chordpro-text` spans, two credited names |
| `hymn-1413.html` | `/1413` — AdF #3 (Marot, Bourgeois; public domain) | Six verses |
| `not-a-hymn.html` | `/termes-et-conditions` | Must fail to parse ("no lyrics block") |

## Page structure (selectors used by `scripts/import/sources/cdl.ts`)

- **Hymnals** (`/chants`): JEM is split in volumes `/chants/recueil/1`, `3`, `5`, `44` with
  continuous numbering (volume 2 starts at #372); AdF is `/chants/recueil/19`, Célébrons Dieu
  `/chants/recueil/11`, Exo `/chants/recueil/6` (no numbers). À Toi la Gloire is not on the site.
- **Listing**: `ul > li` with `a[href="/<id>"]` (title) and `.details .source` ("J'aime
  l'Éternel 1 #20"). 20 items per page; pages are `?page=N`, the last one is in `.pagination`.
- **Hymn page**: title in the `h2` of the row that holds `section.body`.
  - Lyrics: `section.body`, ChordPro rendered as `div`s, in order:
    `.chordpro-comment` (section label: "Strophe", "Strophe 1", "Couplet", "Refrain 1"…),
    `.chordpro-start_of_verse` / `.chordpro-end_of_verse`, `.chordpro-chorus` (wraps the
    chorus lines), `.chordpro-verse` (one line). A line may be split into
    `.chordpro-elem` > `.chordpro-chord` + `.chordpro-text`; chords are always empty on public
    pages. `.chordpro-key` is the key (ignored). `<br>` separates blocks.
  - Credits: `section.credits .credit .author a` — names only, **no role** (composer and author
    share the class), so they are stored with role `unspecified`. `.credit .source` repeats the
    hymnal and number.
  - `section.copyright` holds the copyright notice (not stored).
- Apostrophes are straight (`'`) on this site; they are kept as they are.
- No page with chords visible or without credits was found; tests derive those cases from a
  fixture.
