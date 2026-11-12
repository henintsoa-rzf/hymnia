# Fixtures: jemaf.fr (`jemaf`)

Pages saved on 2026-11-11 with the importer's own fetcher (robots.txt followed, at least 1.5 s
between requests, identifying User-Agent). `index.json` gives each file's URL and retrieval
time; tests use it to seed a page cache.

These pages contain lyrics protected by copyright. The site's
[legal notice](https://jemaf.fr/mentions-legales) says the lyrics belong to their authors or
publishers, and that the site relies on the authors' tacit consent. They are kept **only** as
test fixtures, are never published, and are as few as the tests need. Public-domain hymns were
chosen where they show the needed structure (AdF 1, AdF 309A, ATG 1).

| File | Page | Why it is here |
|------|------|----------------|
| `listing-atg.html` | `/index/atg&lt=0-9` (À Toi la Gloire, whole index) | Listing: 400 items in number order |
| `hymn-af001.html` | `/chant/af001` — AdF 1 (Bèze, Bourgeois; public domain) | Three numbered verses, "1. " written in the text, author and composer |
| `hymn-atg001.html` | `/chant/atg001` — ATG 1 (Budry, Handel; public domain) | Verses with a blank line inside, chorus written out after each verse |
| `hymn-jem017.html` | `/chant/jem017` — JEM 17 | "Strophe 1" / "Refrain 1" / "Strophe 2" / "Refrain 2" labels |
| `hymn-jem1000.html` | `/chant/jem1000` — JEM 1000 | 4-digit code; "Refrain a/b", "Pont 1", "Pont 2a/2b", "Fin"; a "Pont" drawn as a `div.strophe`; two names in one credit string |
| `hymn-af309a.html` | `/chant/af309a` — AdF 309A (Gerhardt, Teschner; public domain) | Lettered variant: listed as "AF309A", but the page itself prints "AF309"; comment "Air du n° 126" |
| `not-found.html` | `/chant/af999` | Number that does not exist: HTTP 200, "Le numéro af999 n'existe pas." Must fail ("no lyrics block") |
| `not-a-hymn.html` | `/mentions-legales` | Legal notice. Must fail ("no lyrics block") |

## Page structure (selectors used by `scripts/import/sources/jemaf.ts`)

- **Hymnals**: the site has J'aime l'Éternel (vol. 1–4, one continuous numbering 1–1200;
  vol. 1 ends at 371, vol. 2 at 721, vol. 3 at 999), JEM Kids (`jemk`, 196, not one of ours),
  Ailes de la Foi (`af`, up to 655, plus 22 lettered variants such as 309A, 630A, 630B) and
  À Toi la Gloire (`atg`, 400). Our ids map as `jem` → `jem1-4`, `adf` → `af`, `atg` → `atg`.
  All three hymnals are fully listed on the site (JEM 1199 items, AdF 677, ATG 400).
- **Listing** (`/index/<recueil>&lt=0-9`): the whole hymnal on one page, in number order
  (`&lt=A-Z` gives the same items by title; `&lt=<letter>` one letter; without `&lt` nothing).
  Items are `a.resRech[href="chant/<code>"]` with the printed code in a `span` ("ATG001",
  "AF309A", "JEM1000"), then the title and an optional `sub` (first line). `p.nbTrouves`
  gives the count. No item without a number was seen; the adapter skips and logs one.
- **Numbering**: the number is the code without its prefix and leading zeros ("AF001" → "1",
  "AF309A" → "309A", "JEM1000" → "1000"). Hymn URLs are `chant/<recueil><3 digits>[a-z]`
  (`chant/jem1000` above 999). An unknown number returns HTTP 200 with a short message.
- **Hymn page**: everything is in `#paroles-chant .paroles` (`#multicol`):
  - Title: the text nodes of the `h2` in `.accord-title`. The `h2` also contains the first line
    (`sub`), the original title (`.original`) and "CODE. Composer" (`p.composer`). The markup
    is slightly broken (`<h2>Title</span>…`), which the parser tolerates.
  - Lyrics: a `div.ancre` label ("Strophe", "Strophe 1", "Refrain", "Refrain 1", "Refrain a",
    "Pont 1", "Pont 2a", "Fin"; the site's list also has "Introduction" and "Paroles"), then a
    `div.strophe` or `div.refrain` with the lines separated by newlines (no `<br>`). The
    **label** decides the type: "Pont 2a" is drawn as a `div.strophe`, "Pont 1" and "Fin" as
    `div.refrain`. Blank lines inside a block (ATG verses of 2 × 4 lines) are dropped; the block
    stays one section. Choruses are written out after every verse, so they appear each time.
  - Verse numbers are written in the text ("1. Qu'on batte des mains !"): removed, counted as
    `verse-number`.
  - `div.informations` shows "Texte de <author>", an optional comment ("Air du n° 126"), the
    code and title, and the copyright line. `p.recueil-theme` gives the volume, Bible reference
    and themes. None of this is stored.
  - Credits: the page embeds its data as `var chant = {"text": {…}, "data": {…}};` (JSON on
    one line). `text.author` (shown as "Texte de") → `lyrics`, `text.composer` → `music`. Other
    string fields that are not known non-credits (`title`, `original`, `reference`, `comment`,
    `copyright`, `code`, `subtitle`) go through `mapCreditRole`, or into `unknownCredits`.
  - Chords: not in the rendered lyrics. The JSON has `textChords` (chord positions marked
    with `*`) and `data.chords` (the chord list); the site draws them in the browser. The
    adapter ignores both; it still runs `stripChords` on every line.
- MP3 files (`ressources/mp3/<code>.mp3`) and YouTube/Google links are ignored.

## Surprising things

- A lettered variant (AdF 309A) shows "AF309" on its own page and in its JSON `code`; only the
  listing and the URL carry the letter. The listing's "309A" is used as the number.
- The site often fills `author` and `composer` with the same string, sometimes several people
  in one string ("Paul Baloche et Michael Rossback"), sometimes not a person ("Mélodie
  hébraïque"). For translated songs `author` is often the French adapter (JEM 17: Christian
  Glardon, "© 1974 Adaptation française"), but the site labels it as the text author. Names are
  kept exactly as given, one credit per field.
- Line breaks follow the site, not always the printed book (AdF 1, verse 1 has 7 lines, the
  others 6).
- Apostrophes are mostly straight (`'`), with a few curly ones (`’`, JEM 1000); kept as they are.
