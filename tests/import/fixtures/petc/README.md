# Fixtures: pasteuretcompagnie.com (`petc`)

Pages saved on 2026-11-16 through the importer's fetcher (robots.txt, 1.5 s between requests,
User-Agent with contact), with `<script>`, `<style>` and SVG bodies removed. URLs and dates:
`index.json`. Adapter: `scripts/import/sources/petc.ts`. Decisions:
`specs/010-pasteur-compagnie-hymnal/research.md`. The pages are copyrighted: keep as few as the
tests need.

| File | Page | Used for |
|------|------|----------|
| `list-page1.html`, `list-page9.html` | `/collections/partitions?page=1`, `?page=9` | grid cards (8, then 4) |
| `albums.html` | `/collections/digital-albums` | album cards (6) |
| `album-dans-ses-mains.html` | `/products/dans-ses-mains` | tracklist, singers in brackets, tracks with no lyrics (5, 10) |
| `album-kids.html`, `album-kids-instrumental.html` | `/products/kids`, `/products/kids-album-pistes-instrumentales` | tracklist and link to the lyrics page; the instrumental copy |
| `kids-lyrics.html` | `/pages/album-kids-paroles` | one `<h1>n. title</h1>` block per track |
| `song-jesus-merci.html` | `/products/jesus-merci-jesus-thank-you` | `<h2>` names line, `<em><strong>` labels, one `<p>` per line |
| `song-lespoir.html` | `/products/lespoir-1` | recording credits, "Pré-refrain" |
| `song-redempteur-adorable.html` | `/products/redempteur-adorable` | no labels, stanzas split by empty `<p>`, credits after the lyrics |
| `song-coule-a-flots.html` | `/products/coule-a-flots-come-thou-fount` | prose credits with "Pont par", © line; on two albums |
| `song-noel-jesus-est-ne.html` | `/products/noel-jesus-est-ne` | shop note, first lyric line equal to the title, "A Toi Gloire 116." |
| `song-papa.html` | `/products/papa-cest-quoi-une-ame-partition` | "(partition)" in the title, a spoken dialogue |
| `catalogue.json` | (not a page) | titles of the 68 song cards and the album tracklists of 2026-11-16, no lyrics: rebuilds the listing in tests |

## Structure

The site is a Shopify shop (theme "Debut").

- **Collection pages** (`/collections/partitions?page=n`, `/collections/digital-albums`): one
  `.grid-view-item` per product, with `a.grid-view-item__link`
  (`href="/collections/<c>/products/<handle>"`) and `.product-card__title`. Menus and scripts link
  to other products (`/products/album`, `/products/albumimproslouange`…): only the grid counts.
  A page past the last one has no card.
- **Product pages** (`/products/<handle>`): title in `h1.product-single__title`, description in
  `.product-single__description.rte`. The canonical URL is the page itself.
- **Album descriptions**: a numbered tracklist, one `<p>n. Title (singers)</p>` per track, with
  production credits and links around it. KIDS links to `/pages/album-kids-paroles`.
- **Song descriptions** (hand-written rich text, same author as the Evangile21 posts):
  - credits first, as a names-only `<h2>` or prose ("Musique et paroles par X. Tr. Y."), or
    after the lyrics ("Musique par S. S. Wesley, paroles par A. Humbert. Ar. …");
  - labels `<p><em><strong>Couplet 1</strong></em></p>`, "Refrain", "Pré-refrain", "Pont", "Intro",
    sometimes with a note ("Refrain (femmes)");
  - one `<p>` per line, or `<p>` with `<br>`; empty `<p>` (or `&nbsp;`) between stanzas, and
    sometimes inside a labelled section;
  - lines that are not lyrics: shop notes ("La fichier en vente contient…", "Arrangement
    piano-violon et leadsheet."), recording credits ("Violons: …", "DA, mix et mastering…"),
    "Paroles :", "mp3 gratuit", hymnal references ("ATG #119", "A Toi Gloire 116."), copyright
    lines;
  - some were pasted from a ChordPro page: empty `.chordpro-chords` rows between the lines, or
    (O peuple fidèle) chord lines and syllables split under the chords ("appel - le").
