# Data Model: Pasteur & Compagnie Hymnal

Phase 1 of [plan.md](./plan.md). Hymn, hymnal entry, section, credit and source are unchanged
(features 001 and 002). This feature adds data, two pinned tables in the adapter, and two
backward-compatible fields in the import's working types.

## Hymnal (content/hymnals.json)

A new record, `pasteur-compagnie`. Its exact JSON is in [research.md](./research.md) R3.

| Field | Value | Rule |
|-------|-------|------|
| `id` | `pasteur-compagnie` | slug, never changes |
| `name` | `Pasteur & Compagnie` | NFC |
| `abbreviations` | `["P&C"]` | first ≤ 3 characters; `compactKey` = `pc`, unique |
| `sortOrder` | 12 | after Arc-en-ciel |
| `parts` | 5 albums from 100 to 500, then "Hors album" from 1000 | increasing `first`; one part per entry of `PETC_ALBUMS` plus "Hors album" |

## Source (import/sources.json)

| Field | Value |
|-------|-------|
| `id` | `petc` |
| `name` | `Pasteur & Compagnie — pasteuretcompagnie.com` |
| `baseUrl` | `https://pasteuretcompagnie.com` |
| `hymnals` | `["pasteur-compagnie"]` |
| `minDelayMs` | 1000 |
| `terms` | see research R2 |
| `permission` | `unknown` |
| `access` | live (field absent) |

## Album (adapter table `PETC_ALBUMS`)

| Field | Meaning |
|-------|---------|
| `handle` | the album's product handle (`dans-ses-mains`) |
| `first` | the part's first number (300) |
| `name` | the part name, which is the album title without "(album)" |
| `skip` | optional reason: the album is not a part (instrumental KIDS) |

Rules:
- Each `first` is a multiple of 100 below 1000, and no two albums share one.
- Every non-skipped album has a part of the same name and `first` in `content/hymnals.json`.
  A unit test checks this.
- A new album is added here, with the next free hundred, in the same commit as its part and its
  content.

## Pinned number (adapter table `PETC_NUMBERS`)

| Field | Meaning |
|-------|---------|
| `number` | the hymnal number, as an integer |
| `page` | a song handle (`il-me-gardera-he-will-hold-me-fast`), `album-kids-paroles#<track>`, or `<album-handle>#track-<n>` for a track with no lyrics |

Rules (unit-tested):
- Numbers are unique. A page may appear several times only when it is on several albums.
- An album number is `first + track` of an album in `PETC_ALBUMS`.
- "Hors album" numbers start at 1001, go up by product id at freeze time, and are never reused.
- Entries are never removed or renumbered. A song that leaves the site keeps its row.

## Track (adapter, transient)

The adapter builds this from an album page, `{ album, track, title }`, and resolves it to one of:

| Result | Ref returned | Report |
|--------|--------------|--------|
| one song page | `/products/<song>` with `first + track` | as any hymn |
| a KIDS lyrics-page song | `/pages/album-kids-paroles#<track>` | as any hymn |
| a title ending in "(instrumental)" | none | log line |
| no song page, no lyrics page | `/products/<album>#track-<n>` | skipped: "no lyrics on the site: album track n "…"" |
| several song pages | `/products/<album>#track-<n>` | skipped: "album track n "…" matches several song pages" |

Title matching normalises with `normalizeText`, drops brackets, and accepts a track title that
is a word-prefix of the song title, or the other way round.

## Import working types (scripts/import)

| Type | Change |
|------|--------|
| `RawHymn` | + `warnings?: string[]`, optional (research R7) |
| `HymnalReport` | + `toCheck: { number, hymnId, title, warnings }[]` |
| `reconcile` | an unlinked entry whose URL this source already links, in the same run or in the state, to a hymn of the same hymnal is attached to that hymn (research R5) |

`import/state/links.json` is unchanged. A song on two albums has two links, one per number,
with the same URL.

## Initial numbers (2026-11-16)

The first content of `PETC_NUMBERS` and the counts used by the quickstart:
- 5 albums with 54 song tracks: 48 have lyrics (44 distinct songs) and 6 have none;
- the instrumental KIDS album is skipped, and so is track 11 of Plus haut encore;
- 27 songs are on no album.

Rows marked "none" are reserved numbers that are reported as skipped.

| Number | Part | Track | Song page |
|---|---|---|---|
| 101 | Hymnes21 2018 | 1. Sauvé | `sauve-1` |
| 102 | Hymnes21 2018 | 2. Vois l'amour | `vois-lamour-here-is-love` |
| 103 | Hymnes21 2018 | 3. Jésus a tout payé | `jesus-a-tout-paye-jesus-paid-it-all` |
| 104 | Hymnes21 2018 | 4. Là aussi | `la-aussi-psaume-139` |
| 105 | Hymnes21 2018 | 5. Coule à flots | `coule-a-flots-come-thou-fount` |
| 106 | Hymnes21 2018 | 6. Mon âme éveille-toi | `mon-ame-eveille-toi-1` |
| 107 | Hymnes21 2018 | 7. Sois seul ma vision | `sois-seul-ma-vision-1` |
| 108 | Hymnes21 2018 | 8. Purifié | `purifie-1` |
| 109 | Hymnes21 2018 | 9. Viens suis-moi | `viens-suis-moi-1` |
| 201 | Impros louange | 1. Dans la joie | none: no lyrics on the site |
| 202 | Impros louange | 2. Sois seul ma vision | `sois-seul-ma-vision-1` |
| 203 | Impros louange | 3. Mon Dieu plus près de toi | `mon-dieu-plus-pres-de-toi-nearer-my-god-to-thee` |
| 204 | Impros louange | 4. Viens suis-moi | `viens-suis-moi-1` |
| 205 | Impros louange | 5. Sur le mont du Calvaire | `sur-le-mont-du-calvaire-the-old-rugged-cross` |
| 206 | Impros louange | 6. Enseigne-moi | `enseigne-moi` |
| 207 | Impros louange | 7. Hymne à la joie | `hymnes-a-la-joie-joyful-joyful-we-adore-thee` |
| 208 | Impros louange | 8. Tel que je suis | `tel-que-je-suis` |
| 209 | Impros louange | 9. A l'Agneau | `a-l-agneau-sur-son-trone` |
| 210 | Impros louange | 10. Rien ne peut sauver mon âme | none: no lyrics on the site |
| 211 | Impros louange | 11. Mon âme éveille-toi | `mon-ame-eveille-toi-1` |
| 212 | Impros louange | 12. Jésus-Christ est ma sagesse | `jesus-christ-est-ma-sagesse` |
| 213 | Impros louange | 13. Par la foi | `par-la-foi` |
| 214 | Impros louange | 14. Seigneur attire | none: no lyrics on the site |
| 301 | Dans ses mains | 1. Je m'attends à toi (Sébastien Demrey) | `je-mattends-a-toi-i-will-wait-for-you` |
| 302 | Dans ses mains | 2. La gloire du Calvaire (Philippe Viguier) | `la-gloire-du-calvaire` |
| 303 | Dans ses mains | 3. Jésus merci (Elyne Jeannet & Philippe Viguier) | `jesus-merci-jesus-thank-you` |
| 304 | Dans ses mains | 4. Viens et vois (Philippe Viguier & Darlène Rizzitelli) | `viens-et-vois-were-you-there` |
| 305 | Dans ses mains | 5. Les cieux proclament (Tendry) | none: no lyrics on the site |
| 306 | Dans ses mains | 6. Ô Jésus je t'aime (Louise Zbinden) | `o-jesus-je-taime-my-jesus-i-love-thee` |
| 307 | Dans ses mains | 7. Il me gardera (Alicia Roehrig & Philippe Viguier) | `il-me-gardera-he-will-hold-me-fast` |
| 308 | Dans ses mains | 8. Saint-Esprit (Elyne Jeannet & Philippe Viguier) | `saint-esprit-holy-spirit` |
| 309 | Dans ses mains | 9. Non par moi mais par Christ en moi (Philippe Viguier) | `non-par-moi` |
| 310 | Dans ses mains | 10. Entre tes mains (Tendry) | none: no lyrics on the site |
| 401 | KIDS | 1. De génération en génération | `de-generation-en-generation` |
| 402 | KIDS | 2. L'évangile c'est de la bombe | KIDS lyrics page, `album-kids-paroles#2` |
| 403 | KIDS | 3. Oui je crois | `oui-je-crois` |
| 404 | KIDS | 4. Au ciel | `au-ciel` |
| 405 | KIDS | 5. Coeur cassé | KIDS lyrics page, `album-kids-paroles#5` |
| 406 | KIDS | 6. Bien dans ma peau | KIDS lyrics page, `album-kids-paroles#6` |
| 407 | KIDS | 7. Que tout ce qui respire | `que-tout-ce-qui-respire` |
| 408 | KIDS | 8. Quand je songe à cette croix | `quand-je-songe-a-cette-croix` |
| 409 | KIDS | 9. Il me tient par la main | `il-me-tient-par-la-main` |
| 410 | KIDS | 10. Psaume 131 | `psaume-131` |
| 411 | KIDS | 11. Papa, c'est quoi une âme? | `papa-cest-quoi-une-ame-partition` |
| 501 | Plus haut encore | 1. Le seul Dieu trois fois saint | `le-seul-dieu-trois-fois-saint` |
| 502 | Plus haut encore | 2. Plus haut encore | `plus-haut-encore` |
| 503 | Plus haut encore | 3. Est-il digne ? | `est-il-digne-is-he-worthy` |
| 504 | Plus haut encore | 4. C'était toujours toi | none: no lyrics on the site |
| 505 | Plus haut encore | 5. Coule à flots (par-dessus tout) | `coule-a-flots-come-thou-fount` |
| 506 | Plus haut encore | 6. En mémoire de ton nom | `en_memoire_de_ton_nom` |
| 507 | Plus haut encore | 7. Psaume 32 | `psaume-32` |
| 508 | Plus haut encore | 8. Je me confie en mon Sauveur | `je-me-confie-en-mon-sauveur-i-will-trust-my-savior-jesus` |
| 509 | Plus haut encore | 9. Nous voici | `nous-voici` |
| 510 | Plus haut encore | 10. L'espoir | `lespoir-1` |
| — | Plus haut encore | 11 L'espoir (instrumental) | skipped: instrumental |
| 1001 | Hors album | — | `au-dessus-des-royaumes` (2020-02-20) |
| 1002 | Hors album | — | `alleluia-quel-grand-sauveur` (2020-03-13) |
| 1003 | Hors album | — | `glorieux-tout-puissant-glorious-and-mighty` (2020-03-13) |
| 1004 | Hors album | — | `o-dieu-ta-grace-grace-greater-than-our-sins` (2020-03-13) |
| 1005 | Hors album | — | `grace-infinie` (2020-04-11) |
| 1006 | Hors album | — | `lamour-de-dieu` (2020-05-14) |
| 1007 | Hors album | — | `vous-creatures-du-grand-roi-all-creatures-of-our-god-and-king` (2020-10-18) |
| 1008 | Hors album | — | `sa-grace-est-plus-grande-his-mercy-is-more` (2020-10-28) |
| 1009 | Hors album | — | `viens-decouvrir-cette-fontaine` (2020-11-21) |
| 1010 | Hors album | — | `joie-dans-le-monde-joy-to-the-world` (2020-11-21) |
| 1011 | Hors album | — | `chef-couvert-de-blessures-1` (2020-11-21) |
| 1012 | Hors album | — | `roc-des-ages-roc-of-ages` (2020-11-21) |
| 1013 | Hors album | — | `quel-amour-mysterieux-what-wondrous-love-is-this` (2020-11-21) |
| 1014 | Hors album | — | `redempteur-adorable` (2020-11-21) |
| 1015 | Hors album | — | `parle-nous` (2021-06-07) |
| 1016 | Hors album | — | `seigneur-mon-roc-et-mon-redempteur-o-lord-my-roc-and-my-redeemer` (2021-11-11) |
| 1017 | Hors album | — | `voici-noel-jazzy` (2022-12-11) |
| 1018 | Hors album | — | `folle-nuit-de-la-croix` (2023-01-24) |
| 1019 | Hors album | — | `dieu-leternel-incree` (2023-03-25) |
| 1020 | Hors album | — | `psaume-150` (2024-04-08) |
| 1021 | Hors album | — | `psaume-42` (2024-05-01) |
| 1022 | Hors album | — | `christ-notre-esperance` (2024-05-01) |
| 1023 | Hors album | — | `o-peuple-fidele` (2025-11-29) |
| 1024 | Hors album | — | `et-se-peut-il-and-can-it-be` (2025-11-29) |
| 1025 | Hors album | — | `minuit-chretiens` (2025-11-29) |
| 1026 | Hors album | — | `noel-jesus-est-ne` (2025-11-29) |
| 1027 | Hors album | — | `chantons-lhistoire-demmanuel` (2025-12-03) |
