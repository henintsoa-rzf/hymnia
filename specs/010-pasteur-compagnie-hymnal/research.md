# Research: Pasteur & Compagnie Hymnal

Phase 0 of [plan.md](./plan.md). Facts were observed on pasteuretcompagnie.com on 2026-11-16.

## R1. What the site is and how to read it

**Decision**: Add a new source `petc` with live access, read through the importer's polite
fetcher. The adapter reads the shop's ordinary HTML pages:

| Page | URL | Requests |
|------|-----|----------|
| Song list | `/collections/partitions?page=1` … `?page=9`, stop at the first page with no product | 9 |
| Album list | `/collections/digital-albums` | 1 |
| Album page | `/products/<album-handle>` | 6 |
| KIDS lyrics | `/pages/album-kids-paroles` | 1 |
| Song page | `/products/<song-handle>` | 68 |

That is about 85 requests, or about 90 s at 1 request per second.

**Rationale**:
- The site is a Shopify shop. robots.txt allows `/collections/*` and `/products/*`. It only
  disallows carts, checkout, accounts, `sort_by` and `+` filter URLs, and sets no Crawl-delay.
- A plain request with a non-browser User-Agent gets HTTP 200, so the `saved-pages` fallback
  (feature 004) is not needed.
- The song page holds the full lyrics in `.product-single__description`, which is the same text
  as the shop's product description. Its canonical URL is the human page, which is what users
  should see as the source link.
- Every hymn's source URL is the page that was actually fetched, so `check` can re-parse it
  from the cache.

**Alternatives considered**:
- Shopify's JSON endpoints (`/collections/partitions/products.json?limit=250`,
  `/products/<handle>.json`). They are allowed by robots.txt and give ids and dates directly,
  in 2 requests for the whole catalogue. Rejected:
  - The entry URL would be the `.json` URL while the source link must be the human page. That
    breaks the "URL fetched = URL shown" rule that `check` and the cache rely on.
  - It depends on a Shopify feature a shop owner can switch off.
  - The ids are only needed once, to freeze the pinned table (R4), and that table is built from
    a one-off read. The JSON endpoints may be used then, outside the adapter.
- Reading the album list from `/collections/digital-albums` links only. The page also links to
  other products in its menus and scripts (`/products/album`, `/products/albumimproslouange`,
  …). The adapter reads only the product cards of the collection grid, as for the song list.

## R2. Terms of use and permission

**Decision**: Record the source in `import/sources.json` with `permission: "unknown"` and these
terms:
- URL: `https://pasteuretcompagnie.com/pages/termes-et-conditions`
- Checked: 2026-11-16
- Summary: "Products are distributed by Philippe Viguier médias. The terms cover sales only
  (immediate payment, downloads, no refunds). Nothing allows or forbids reusing the lyrics.
  Leadsheets are free, which does not grant a right to republish. Permission to ask:
  philippeviguiermedias@gmail.com (address given on the album pages)."

**Rationale**: Constitution III. The hymns stay `unconfirmed` and appear only in the
personal-use build.

## R3. Hymnal, abbreviation and parts

**Decision**: Add this entry to `content/hymnals.json`:

```json
{ "id": "pasteur-compagnie", "name": "Pasteur & Compagnie", "abbreviations": ["P&C"],
  "sortOrder": 12,
  "parts": [
    { "name": "Hymnes21 2018", "first": 100 },
    { "name": "Impros louange", "first": 200 },
    { "name": "Dans ses mains", "first": 300 },
    { "name": "KIDS", "first": 400 },
    { "name": "Plus haut encore", "first": 500 },
    { "name": "Hors album", "first": 1000 }
  ] }
```

**Rationale**:
- **Abbreviation**: `compactKey("P&C")`, `compactKey("PC")` and `compactKey("p c")` are all
  `pc`. No other hymnal uses `pc`. A query "PC 307" or "P&C 307" normalises to `p c 307`, and
  the query parser resolves the prefix through `compactKey`. One abbreviation is therefore
  enough: a second "PC" would be ignored by the uniqueness check (same hymnal) but adds nothing.
  "P&C" has 3 characters, which is the short-code limit. The spec was amended.
- **Parts**: `groupByPart` (`src/lib/domain/parts.ts`) puts each number in the last part whose
  `first` is not above it. Album hundreds plus a "Hors album" part at 1000 give the order the
  spec asks for (FR-006a). No app change is needed: parts are already data (JEM, Psalmodie,
  Arc-en-ciel).
- **Sort order**: `sortOrder` 12 places the hymnal after Arc-en-ciel (11), the last hymnal today.

**Alternatives considered**:
- Hymnal id `petc` or `pc`. Rejected: the id shows in URLs (`/recueils/<id>`), so a readable
  slug is better.
- "Hors album" at 1–99, listed first (the Psalmodie layout). Rejected in the spec: the albums
  are the main way into the hymnal.

## R4. Numbering: a pinned table built from the albums

**Decision**: Numbers are pinned in the adapter, as `EVANGILE21_NUMBERS` and `CDL_PINNED` are
(see `scripts/import/sources/README.md`, "A hymnal the site does not number"). There are two
tables:

- `PETC_ALBUMS`: album handle → `{ first, name }`, plus albums skipped with a reason. Today the
  only skipped album is `kids-album-pistes-instrumentales` ("same tracklist as KIDS").
- `PETC_NUMBERS`: `{ number, page }`, where `page` is a song handle or `album-kids-paroles#<track>`,
  for every numbered entry. The first version is generated once from the albums and the
  catalogue as of 2026-11-16 (see [data-model.md](./data-model.md), "Initial numbers"), then
  frozen.

At run time, `listEntries` rebuilds the expected entries from the live lists and compares them
with the tables:
1. An album track matched to a song page → number `first + track`.
2. A song page on no album → its pinned "Hors album" number.
3. A page or track that is not pinned yet:
   - on a known album, it gets `first + track`;
   - on no album, it gets the next free number from 1001;
   - on an unknown album, it gets the next free hundred below 1000.

   The adapter logs `… is not pinned yet: add it to PETC_NUMBERS` (and, for an album, `add it to
   PETC_ALBUMS and to the parts in content/hymnals.json`).
4. A pinned entry whose page is no longer listed is still returned while the song page exists.
   Feature 002 then reports it as missing only if the page fails. This is the Exo rule
   (005 R3), so a tracklist edit never moves numbers.
5. A pinned number that the live tracklist puts elsewhere (a track renumbered or replaced)
   keeps its pinned number, and the difference is logged for a manual decision.

**Rationale**:
- Released tracklists do not change, so `first + track` is stable.
- "Hors album" depends on the shop's product ids, which only matter for the first freeze; after
  that the table decides. Pinning is the project's existing rule for made-up numbers, and a
  unit test guards it.
- Computing numbers at every run without a table would renumber "Hors album" songs whenever
  one is removed.

**Alternatives considered**: storing the numbers in `import/state/`. Rejected: the other
unnumbered hymnals keep their tables in the adapter, under review in the same commit as the
content.

## R5. A song on two albums (same page, two numbers)

**Decision**: Make one small, generic change to `reconcile`. When an extracted entry is not
linked yet, check whether the same source already links the same page URL in the same run or in
the state, to a hymn in the same hymnal. If it does, attach the entry to that hymn. The hymn
gains an entry and the source is not added twice to `alternateSources`.

**Rationale**:
- `listEntries` returns two refs with the same URL ("Coule à flots": 105 and 505). The fetcher
  requests the page once. Without the change, the second ref goes to the matcher, which never
  merges two hymns of the same hymnal (`match.ts`: "a hymnal never holds the same hymn twice",
  except lettered variants). The second ref would then become a second, identical hymn.
- The content model already allows a hymn with two numbers in one hymnal. 15 hymns do (e.g.
  `la-foi`: AdF 361 and 361A). The build rule only forbids one number owned by two hymns.
- Matching on "same source, same URL" is exact, so it cannot wrongly merge two different songs.

**Alternatives considered**:
- A manual `merge` decision for each of the 4 songs. Rejected: it would have to be redone for
  every future song on two albums, and the URL already proves it is the same page.
- Returning one ref per page from the adapter. Rejected: the pipeline has no way to carry two
  numbers on one ref.

## R6. Album tracks with no lyrics, and unmatched tracks: reported as skipped entries

**Decision**: These tracks are returned as refs anyway: the 6 tracks with no lyrics on the site,
and any track that matches no song page or several. Their URL is the album page with a
`#track-<n>` fragment, for example
`https://pasteuretcompagnie.com/products/dans-ses-mains#track-5`. When given an album page,
`parseHymn` returns `{ ok: false, reason }`, for example
`no lyrics on the site: album track 5 "Les cieux proclament"` or
`album track 3 "…" matches no song page`. Feature 002 lists them under "skipped", with number and
URL, on every run.

**Rationale**:
- The spec asks for these tracks in the report (FR-004c, FR-005), and the report already has a
  per-hymnal "skipped" list with number, URL and reason. No new report section is needed.
- The album page is fetched once per run anyway, for its tracklist.
- 6 failures out of about 80 refs is far below the 20 % abort threshold.
- When a song page appears later, the track's ref simply points to it and its number is already
  reserved.

**Alternatives considered**: logging only (`ctx.log`). Rejected: the log is not kept in
`import/reports/`.

## R7. Doubtful songs: a `warnings` list per extracted hymn

**Decision**: Add an optional `warnings: string[]` to `RawHymn` and a
`toCheck: { number, hymnId, warnings }[]` list to `HymnalReport`, printed by `report` as "To
check by hand". `parseHymn` is still pure. It adds warnings for:
- lyrics with no labels and no blank line, imported as one section (FR-012);
- lines before or after the lyrics that it could not classify, kept out of the lyrics;
- a removed bracket in the title that does not look like an English title (R9).

**Rationale**:
- FR-012 asks for these songs to be listed for a manual check.
- `unknownCredits` exists but means "credit label with no role". Using it for other doubts would
  mislabel them.
- The change is backward-compatible: other adapters return no warnings.

**Alternatives considered**: a `strippedMarkup` count. Rejected: it gives a count but not the
song.

## R8. Lyrics and credits extraction

**Decision**: The description HTML is a Shopify rich-text block written by the same author as
the Evangile21 posts. It has the same layouts:
- one `<p>` per line;
- `<p>` with `<br>`;
- `<strong>`/`<em>` labels;
- `&nbsp;` spacers;
- sometimes a `<h2>` with the names.

The adapter reuses the Evangile21 helpers, exported from `evangile21.ts` and not copied:
- the tokenizer into lines and stanza breaks;
- `labelSection`;
- the prose credit parser (`addCredits`, `namesLine`): "Paroles par X, musique par Y. Tr. Z.",
  "Pont par …", "Ar. …".

Rules specific to this source:
- **Labels**: "Couplet n", "Refrain", "Pré-refrain", "Pont", "Intro", "Fin", "Coda" →
  verse/chorus/bridge/other. Labels are not lyrics (FR-009).
- **Unlabelled songs**: blank-line breaks split stanzas into verses 1…n. With no breaks, the
  lyrics form one section and the hymn gets a warning.
- **Prelude and postlude**: lines before the first lyrics, or after the last stanza, are
  classified in this order:
  - a credit line (role word, "Tr.", "Ar.", "Domaine public", "©", or a names-only `<h2>`).
    Its names feed the credits; the line itself is not lyrics;
  - a known note (see the table below);
  - the title repeated, or "Partition(s) <title>";
  - otherwise a warning.

  The lyrics start at the first label or, with no label, at the first line that is none of
  these.
- **Known notes**, never lyrics (FR-011), counted in `strippedMarkup` under `shop note` or
  `recording credit`:

  | Kind | Lines seen |
  |------|------------|
  | Shop description | "Le/La fichier en vente contient…", "Une version jazz…", "Arrangement piano-violon et leadsheet.", "Un arrangement simple et accessible du classique." |
  | Recording credits | "Violons: …", "DA, mix et mastering…", "Mix et mastering…", "Produit par…" |
  | Markers | "mp3 gratuit", "Paroles :" / "PAROLES :" |
  | Hymnal references | "ATG #258", "A Toi Gloire 116", "Rec. Conf. d'Ausburg" |

- **Repeat marks**: "(x4)" and similar stay in the line, as in other hymnals.
- **Found during the import** (2026-11-16):
  - some descriptions were pasted from a ChordPro page: an empty `.chordpro-chords` row after
    each line would make each line a stanza. The rows are removed before tokenising;
  - "O peuple fidèle" has chord lines and syllables split under them ("appel - le"). Chord lines
    (also "Intro : G D/G…") are removed, and in such a song only, " - " between letters is
    rejoined;
  - in a song that labels its sections, blank lines also fall inside sections. A stanza with no
    label continues the section before it, or is "other" when it comes first;
  - labels may carry a note ("Refrain (femmes)"): still labels;
  - a title repeated before the lyrics is a heading only when more prelude follows; otherwise it
    is the first lyric line ("Noël ! Jésus est né.");
  - copyright lines ("Townend Songs (PRS) (adm. by …)") are notes, not credits.
- **"Domaine public", "©", "Pont par …"**: not stored. A credit is only a name and a role
  (`CreditSchema`), and the shared Evangile21 credit parser already stops at these clauses. The
  same applies to the copyright line of every hymnal (005 R5). The spec (FR-010) was amended.

**Rationale**:
- Faithful text (constitution III). `check` compares the stored text with a re-parse of the
  cached page.
- Reusing the Evangile21 code keeps one implementation of the same author's conventions.

**Alternatives considered**: a new parser from scratch. Rejected because it duplicates code.

## R9. Titles

**Decision**:
- The hymn title is the product title without a trailing bracket when that bracket is the
  English original title or "(partition)". "(jazzy)" and "(Psaume 139)" are kept.
- The test for "English title" is that the bracket contains a word from a short English
  function-word list (the, thee, thou, is, are, my, of, our, you, I, am, as, to, love, Lord,
  holy, grace, God, King, Him, there, all, and, can, it, be, will, wait, for, paid, me, in,
  through, not, but, yet, here, come, sing, song, speak, were, just, joyful…). The test is
  checked against all 68 current titles.
- A bracket that is removed but does not pass this test gets a warning (R7).
- The album track title is used only for matching. Its singer brackets are never stored.
- The cleaned title becomes the P&C entry title when the hymn joins an existing one, as for
  every other hymnal (`HymnalEntry.title`).

**Rationale**: spec Edge Cases. One title field per hymn, no app change.

## R10. Matching with existing hymns

**Decision**:
- Feature 002 matching is unchanged. No `source-priority.json` entry is added for
  `pasteur-compagnie`, since the hymnal has only one source.
- When a P&C song joins an Evangile21 or JEM hymn, that hymn keeps its reference text, and P&C
  becomes an alternate source.
- Expected: most of the 29 titles shared with Evangile21 merge automatically (same author, same
  text). Versions that differ, for example "Coule à flots" with and without the "Par-dessus
  tout" bridge, end up as possible duplicates for the maintainer.
- **Amended 2026-11-16 (maintainer)**: a song whose words differ from the existing hymn, even by
  a few words, is never merged; it stays a separate hymn with its own text. The matcher's
  automatic merge works on similarity, so after a run every P&C entry attached to an existing
  hymn is compared word by word with that hymn, and any difference is recorded as `distinct`.

**Rationale**: spec Edge Cases. This is how Exo joined JEM (feature 005).

## R11. Test fixtures

**Decision**: Save these pages with the importer's fetcher into `tests/import/fixtures/petc/`,
with `index.json` and a `README.md` listing selectors and layouts:
- list pages 1 and 9 (the last page, short);
- the album list;
- the album pages `dans-ses-mains`, `kids` and `kids-album-pistes-instrumentales`;
- the KIDS lyrics page;
- song pages:
  - `jesus-merci-jesus-thank-you` (labelled, `<h2>` credit);
  - `lespoir-1` (recording credits);
  - `redempteur-adorable` (no labels, blank lines);
  - `coule-a-flots-come-thou-fount` (no labels, credits as prose, on two albums);
  - `noel-jesus-est-ne` (shop note, hymnal reference after the lyrics);
  - `papa-cest-quoi-une-ame-partition` (dialogue);
- one product page that is not a song (an album page given as a song ref), which must fail.

**Rationale**: `scripts/import/sources/README.md`, step 3. Keep as few copyrighted pages as the
tests need.
