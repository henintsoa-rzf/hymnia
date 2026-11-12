# Fixtures: ecrituremusique.com (`ecriture`)

Pages saved on 2026-11-11 with the importer's own fetcher (robots.txt followed, at least 1.5 s
between requests, identifying User-Agent). `index.json` gives each file's URL and retrieval
time; tests use it to seed a page cache. Pages are saved as served (Squarespace), except that the
contents of `<script>` and `<style>` elements were removed to keep the fixtures small (the
adapter never reads them); about 120–250 kB each.

These pages contain lyrics protected by copyright ("© 2019 Écriture Musique" on each song; the
site has no terms of use or legal notice page). They are kept **only** as test fixtures, are
never published, and are as few as the tests need.

| File | Page | Why it is here |
|------|------|----------------|
| `listing-chants.html` | `/chants` | Alphabetical list and discography (3 albums, 32 songs); also must fail to parse |
| `hymn-taparole.html` | `/taparole` — Vol. 1, track 1 (#1) | Verses "1. …", one chorus written once, "Paroles et musique : …" |
| `hymn-glorieuxleternelregne.html` | `/glorieuxleternelregne` — En toutes choses, track 1 (#26) | "REFRAIN" and a different "DERNIER REFRAIN" |
| `hymn-christseul.html` | `/christseul` — Vol. 1, track 3 (#3) | "PRE-REFRAIN" (type `other`), chorus label inside the `<em>` |
| `hymn-larichesse.html` | `/larichesse` — Vol. 1, track 12 (#12) | "PONT" (bridge) |
| `hymn-atasuite.html` | `/atasuite` — Contemplez Christ, track 10 (#22) | Chorus first; six credited names |
| `hymn-celestepere.html` | `/celestepere` — Vol. 1, track 9 (#9) | Four verses, pre-chorus; used to derive "no credits" |
| `not-a-hymn.html` | `/apropos` | Must fail to parse ("no lyrics block") |

## Robots and requests

robots.txt disallows `/search`, `/api/`, `/static/`, `/config`, `/account` and others for
everyone, and blocks a list of AI bots. The adapter fetches **one** page per run to list songs
(`/chants`) and then the song pages; it never uses the site search or `?format=json`.

## Numbering: the site is not a numbered hymnal

Songs have no number. They appear in two places on `/chants`:

- an accordion "Tous nos chants (par ordre alphabétique)" (`.accordion-item__description a`);
- the discography: one text block per album, `h3` album title, then links "1. Ta Parole",
  "2. Dieu sublime"… Track numbers restart on each album.

Entries need a number, so `ECRITURE_ALBUMS` in `scripts/import/sources/ecriture.ts` gives each
album a fixed block, oldest album first: Écriture Vol. 1 (2020) = 1–12, Contemplez Christ (2023)
= 13–25, En toutes choses, Pt. 1 (2026) = 26–32. Number = first number of the album + track − 1.
Alphabetical order was rejected: every new song would renumber the ones after it. A new album must
be added by hand at the end of the list; until then its songs are skipped and logged, as are songs
of the alphabetical list that are on no album and tracks without a "N." prefix. These numbers are
**ours, not printed by the source**: the maintainer should confirm this scheme.

## Page structure (selectors used by `scripts/import/sources/ecriture.ts`)

- **Song page** (`/<slug>`): Squarespace text blocks `.sqs-html-content`.
  - Lyrics: the first block whose first child is an `h2` (the title). Then one `<p>` with lines
    separated by `<br>`; a blank line (`<br><br>`) separates stanzas.
  - A verse starts with its number in the text: "1. Ta Parole, …" (removed, counted as
    `verse-number`). Other stanzas start with a label line in capitals: "REFRAIN",
    "DERNIER REFRAIN" (chorus), "PRE-REFRAIN" (`other`), "PONT" (bridge); the label is removed
    and counted as `section-label`. A stanza with neither would be `other` (none seen). Choruses
    are in `<em>`, which is only formatting. A chorus is written once; it is not repeated.
  - Credits: the next text block: "© 2019 Écriture Musique." then "Paroles et musique : A, B,
    C." Each part of the label is mapped with `mapCreditRole`, so every name gets `lyrics` and
    `music`. Unknown labels go to `unknownCredits`. The block after that (description,
    "Thèmes :", "Références bibliques :") is not read.
  - The rest (shop products: lead sheets, chord charts, piano scores, mp3; lyric sheet PDF) is
    ignored. No chords appear in the page text, so nothing is stripped as chords.
- **Not a song**: `/chants` and `/apropos` have an `h2` followed by prose with no numbered verse
  and no label, so they fail with "no lyrics block".
- Apostrophes are mixed on this site (`'` and `’`, sometimes in the same song); they are kept
  as they are. The alphabetical list writes "Glorieux, l’Eternel règne", the song page
  "Glorieux, l’Éternel règne": titles come from the song page.
