# Fixtures: psalmodie.ch (`psalmodie`)

Pages saved on 2026-11-11 with the importer's own fetcher (robots.txt followed: it sets
`Crawl-delay: 10`, so at least 10 s between requests; identifying User-Agent). `index.json`
gives each file's URL and retrieval time; tests use it to seed a page cache.

These pages contain lyrics protected by copyright (most songs are recent, with a `©` line or
a publisher). The site publishes no terms of use or legal notice (see below). The pages are
kept **only** as test fixtures, are never published, and are as few as the tests need. The
text used for the main extraction test, "Tel que je suis" (Charlotte Elliott, 19th century),
is in the public domain.

| File | Page | Why it is here |
|------|------|----------------|
| `programme-souffle-de-vie.html` | `/paroles-du-programme-souffle-de-vie/` (1995, 19 songs) | Printed numbers ("1.   Titre"); unnumbered verses; chorus once; "Texte :", "Musique :", "trad.", `©` lines |
| `programme-parce-quil-vit.html` | `/paroles-du-programme-parce-quil-vit/` (2026, 16 songs) | Numbered verses ("1. …"), "Refrain :", "Pré-refrain", "Pont :", "Derniers refrains :", repeat markers, chorus over two paragraphs; "Paroles et musique :", "Adaptation française :" |
| `programme-certitudes.html` | `/paroles-du-programme-certitudes/` (2006, 16 songs) | "Refrain : text" on one line |
| `programme-moments-deternite.html` | `/paroles-du-programme-moments-deternite/` (2010, 15 songs) | **No song numbers**; a heading that wraps a stray `<p>` (`<h3>\n<p>Symbole des apôtres</h3>`) |
| `programme-paul.html` | `/paroles-du-programme-paul/` (2000, musical) | Act headings without a number ("A.   Lapidation d'Étienne") among numbered songs ("1/ Tuons-le!", "15’ / Libération") |
| `not-a-hymn.html` | `/obtenir-des-partitions/` | Must fail to parse ("no lyrics block") |

## What the site is

psalmodie.ch is the site of a Swiss choir, not a hymnal. It has no per-song pages and no
songs index: the menu "Paroles des chants" links to one page per concert programme
(`/paroles-du-programme-<slug>/`), 7 in all on 2026-11-11, 122 songs (98 without Paul):
Souffle de vie (19), Paul (24 + 4 act headings), Certitudes (16), Moments d'éternité (15),
Ouvre mes yeux (16), Te rencontrer (16), Parce qu'il vit (16). Each song appears once per
programme; some songs appear in several programmes (e.g. "Car Dieu a tant aimé le monde",
"Un homme nouveau").

## Numbering (decided by the adapter, not by the site)

Songs are numbered only inside a programme, and only on some pages: "1.", "2." (Souffle de
vie, Certitudes, Parce qu'il vit), "1/", "15’ /" (Paul), nothing at all (Moments d'éternité,
Ouvre mes yeux, Te rencontrer). Entries need one number per hymnal, so the adapter
(`PSALMODIE_PROGRAMMES` in `scripts/import/sources/psalmodie.ts`) gives each programme a block
of 100, oldest first:

| Block | Programme | Number used |
|-------|-----------|-------------|
| 100 | Souffle de vie (1995) | printed |
| 200 | Paul (2000) | printed — **not imported**: a musical with speaker labels ("Foule :", "Paul :"), récitatifs and no credits |
| 300 | Certitudes (2006) | printed |
| 400 | Moments d'éternité (2010) | position on the page |
| 500 | Ouvre mes yeux (2016) | position on the page |
| 600 | Te rencontrer (2021) | position on the page |
| 700 | Parce qu'il vit (2026) | printed |

Entry number = block + song number: "Tout-Puissant" is song 2 of Parce qu'il vit → `702`.
A new programme gets the next block (800), so existing numbers do not move. Numbers by
position move if the site reorders an unnumbered page. Headings with no printed number in a
"printed" programme (Paul's acts) are skipped and logged.

An entry's URL is the programme page plus `#chant-<i>`, `i` being the position of the song's
`h3` among all `h3` of the page. The fragment is not sent to the site (one page per programme
is downloaded); `parseHymn` uses it to find the song.

## Page structure (selectors used by the adapter)

- WordPress page; content in `article .entry-content`. Only `h3`, `p`, `br`, `em` are used.
- **Song**: an `h3` ("1.    Titre", "Titre", "15’ / Titre"; `&nbsp;` padding), then `p`
  paragraphs until the next `h3`. Lines are separated by `<br />`; `<p>&nbsp;</p>` is spacing.
  Some `h3` wrap a stray `<p>`: the heading text is the whole `h3` text.
- **Sections**, in source order:
  - verse: a paragraph; "1. " at its start is the verse number (removed, counted
    `verse-number`). In a song with numbered verses, an unnumbered paragraph goes on with the
    section before it ("Symbole des apôtres", a second "Pont" paragraph), or is an `other`
    section after a chorus or a repeat marker. In a song with no numbers, each paragraph is a
    verse numbered in order (as the cdl adapter does).
  - label line: "Refrain :", "Pré-refrain :", "Pont :", "Derniers refrains :", sometimes with
    the first line after the colon ("Refrain : Jésus, Roi des rois !"); removed, counted
    `section-label`. Refrain → `chorus`, Pont → `bridge`, others → `other`.
  - repeat marker: "Refrain", "Pré-refrain" alone at the end of a paragraph; removed, counted
    `repeat-marker`. The chorus stays written once (contract rule 3).
  - choruses are in italics (`em`); an italic paragraph right after a chorus continues it.
- **Credits**: italic lines "Label : names" at the end of the song. Labels seen: "Texte",
  "Paroles", "Musique", "Paroles et musique" (both roles), "Adaptation française",
  "Traduction" — mapped with `mapCreditRole`, each part of "X et Y". Names are split on
  commas, and on "et"/"&" only when both sides have two words ("Samuel et Frédérique Jaccard"
  stays whole). "trad. X" inside a "Texte" value gives role `translation`. Notes in
  parentheses ("(d'après le Symbole des apôtres)") and dates ("2000 et 2009") are dropped.
  "La Bible, Jean 3.16" is kept whole. `©` lines are not credits. Any other line after the
  first credit line is reported in `unknownCredits` (e.g. "Adaptation française et strophes
  supplémentaires : …", "(d'après Psaumes 141:3 …)").
- **Chords**: none on the site; no chord stripping is needed. Audio, video and PDF scores
  (`/obtenir-des-partitions/`) are ignored.

## Terms of use

No terms of use, legal notice ("mentions légales") or privacy page is linked from the site;
`/mentions-legales/` and `/politique-de-confidentialite/` return 404. The footer only says
"Psalmodie - 2026". Most songs carry a `©` line naming a publisher. The only statement about
reuse is on `/obtenir-des-partitions/`: « Nous désirons que les chants que nous diffusons
soient utiles à d'autres croyants, églises, chorales. » (about the scores it offers).

## Surprises

- Apostrophes are mostly curly (`’`, `&rsquo;`), sometimes straight; kept as they are.
- Typos are kept ("Sébastien, Müller" in a credit, "Decouroux" and "Decourroux").
