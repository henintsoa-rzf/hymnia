# Research: Read the Bible and search by meaning from chosen verses

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

The spec left no open question (Clarifications, 2026-11-19). This file records the technical
choices and the reasons for them.

---

## R1. Source of the Louis Segond 1910 text

**Decision**: the **eBible.org `fraLSG`** edition ("Louis Segond 1910"), downloaded from its
USFM archive. The copyright page of this edition says: "This Bible is in the Public Domain. It is
not copyrighted." The archive is saved under `import/cache/bible/fraLSG/` with its URL and
retrieval date (`source.json`), and is never committed. The text built from it is committed
under `content/bible/` (R3).

- Details: `https://ebible.org/details.php?id=fraLSG`. Copyright page:
  `https://ebible.org/fraLSG/copyright.htm`.
- eBible publishes its texts as USFM, USX and USFX. The details page links readable formats
  (ePub, PDF, HTML, SWORD). The USFM archive follows eBible's usual address
  (`https://ebible.org/Scriptures/fraLSG_usfm.zip`). **The first implementation task confirms
  this address and the file layout.** If no USFM archive is offered, the fallback is the
  verse-per-line format (`fraLSG_vpl.zip`), whose parser is simpler still.
- eBible also lists a "Louis Segond 1910 Original Corrected (Public Domain version)" edition. The
  maintainer keeps `fraLSG`, the edition named "Louis Segond 1910". Switching later is a
  configuration change plus a re-import, recorded in `source.json`.

**Confirmed (T002, 2026-11-19)**: `https://ebible.org/Scriptures/fraLSG_usfm.zip` answers 200
(3.47 MB, deflate). It holds 66 files `NN-CODEfraLSG.usfm` (`02-GEN` … `40-MAL`, `70-MAT` …
`96-REV`) plus `copr.htm` (« Cette Bible est dans le domaine public », dated 2026-10-30),
`keys.asc`, `signature.txt.asc` and `latin.css`. There are 1,189 chapters and 31,170 verses, with
no gap and no verse bridge (`\v 1-2`). The edition adds editorial material that is **not** the
1910 text: book introductions (`\imt`, `\ip`, `\io`, `\ie`…), section headings (`\s1`, `\ms1-2`,
`\mr`), parallel references (`\r`) and cross-references (`\x`). Psalm titles are **verse 1**
(LSG numbering, e.g. Psaume 3:1 « Psaume de David. A l’occasion de sa fuite… »), so there is no
`\d`.

**Rationale**: a known public-domain edition (Principle III) in a structured format (books,
chapters and verses marked up, no guessing). eBible updated the edition on 2026-03-11, so the
markup is current.

**Alternatives considered**:

- Door43 `fr_f10`: built from the same eBible USFM, so nothing more to gain.
- `BibleCorps/FRA-B-LSG1910-PD-UBS` (GitHub): a second public-domain source. It can serve to
  cross-check verse counts, not as the main source.
- Scraping a reading website (BibleGateway, biblestudytools): terms of use are unclear, and
  parsing HTML is fragile. Rejected.

## R2. What is kept from the USFM

**Decision**: the import keeps **book, chapter, verse and verse text**. Psalm titles are verse 1 in
this edition, so they are kept as verse text. Everything else is dropped and listed in
`source.json` → `dropped`:

| USFM | Kept? | How |
|------|-------|-----|
| `\id`, `\h`, `\toc1-3` | Book identity only | Matched against the fixed book table (R5) |
| `\c n` | Yes | Chapter number |
| `\v n text` | Yes | Verse text, NFC, spaces collapsed |
| `\p`, `\q1-3`, `\m`, `\b`, `\nb`, `\pi1` | Marker no, text yes | Paragraph and poetry layout. The text on the line belongs to the current verse. One verse per line is shown |
| `\imt*`, `\ip`, `\ipi`, `\io*`, `\ior`, `\is*`, `\ib`, `\ie`, `\tr`/`\th*`/`\tc*`, `\mt*`, `\h`, `\toc*`, `\r` | No | Editorial introductions, titles and parallel references: whole line dropped |
| `\f … \f*`, `\x … \x*` | No | Footnotes and cross-references, removed along with their content |
| `\w word\|attrs\w*`, `\+w`, `\wj`, `\qs`, `\it`, `\add`, `\nd` and other character marks | Text only | The marks and attributes go, the words stay (« — Pause. » of `\qs` included) |
| `\s`, `\ms`, `\mr` | No | Section headings added by the edition, not part of the 1910 text |

Each verse's text is reproduced word for word. Only the markup is removed. Verse numbers must run
from 1 to n with no gap in each chapter. The import fails on any gap, duplicate, unknown book
code or empty verse, and names the place.

**Rationale**: Principle III: faithful text, with every difference from the source traced.
Showing one verse per line makes selecting one verse simple and clear. The poetry layout of
the Psalms is lost, a known and accepted cost.

## R3. The Bible content and how it ships

**Decision**:

- **Content (committed)**: `content/bible/lsg1910.json`, one file written by
  `scripts/bible/import.ts`, with `content/bible/source.json` (URL, retrieval date, edition,
  checksum of the archive, dropped markup). Hymn content lives in `content/` already. The Bible
  sits in its own folder, never mixed with the hymns (Principle IV).
- **App data (built)**: `npm run data` (`scripts/build-data.ts`) validates the file, writes
  `static/data/bible.<hash>.json` and adds a `bible` entry to `manifest.json`. A missing Bible
  file leaves the entry out, and the app then hides the Bible section (as with `meaning`).
- **Format**: one JSON file, compact (data-model.md, `BibleData`). Chapters are arrays of verse
  texts. A verse's number is its position + 1, which the import guarantees (R2).
- **Size**: about 4.3 MB raw and about 1.3 MB gzip (measured at import and written to the build
  report). The build fails above **2 MB compressed** (SC-006).
- **Offline**: the file sits in `static/data/` like the catalog, so the existing service worker
  precaches it with the app (`client/**/*.json`, under the 15 MB per-file limit). Unlike the
  meaning data, it is not left to a runtime cache: reading must work offline from the first
  install (FR-003, SC-001).
- **Loading**: the screens load the file once per visit, on the first visit to the Bible section,
  in `src/lib/bible/store.ts` (as `src/lib/data/store.ts` does for the catalog). Hymn screens never
  load it.

**Rationale**: 1.3 MB compressed adds about a quarter to the install download (about 5 MB
compressed today) and keeps reading fully offline. One file means one request and one cache
entry. Parsing 4.3 MB of JSON takes well under 100 ms on a mid-range phone, which fits the
300 ms budget for opening a chapter (SC-003). A perf test checks it.

**Alternatives considered**:

- One file per book (66 files): faster first paint of a short book, but 66 hashed files to
  manifest and precache, for a gain of under 100 ms. Rejected while the single file meets
  SC-003. Kept as the fallback if the perf test fails.
- Optional download in Settings: the user asked for a Bible saved on the phone. At 1.3 MB it
  does not justify a separate step. Rejected.
- IndexedDB: the service worker cache already gives offline access. Rejected (YAGNI).

## R4. The query made from the selected verses

**Decision**: the query text is **the selected verses' text, in Bible order, joined by a space**,
with no verse numbers and no references. The Worker tidies it (NFC, spaces collapsed) exactly as
it tidies a typed query. One vector is made for the whole text (spec Assumptions), with the same
model, cutting and 1,024 dims as the hymn search (`MEANING_CONFIG`).

- No `configId` change: the query side gains a new kind of text, but the stanza vectors and the
  way vectors are made are the same. Devices keep their meaning data and query cache.
- A single verse goes through the same path (one text, one call). No verse vector exists on
  the device (Clarifications).
- **To measure**: a second form adds the reference before the text ("Psaume 23:1-4 — L'Éternel
  est mon berger…"). Hymn themes often name a psalm, so this might help. Both forms are scored on
  the verse reference set (R8), and the better top-10 score ships. Text only is the default and
  ships if the gap is under 3 points, the same rule as feature 011 R4.

**Measured (T044, 2026-11-19, 24 selections, tests/queries/verse-evaluation.json)**:

| Form | Top 1 | Top 10 | Top 50 | MRR |
|------|-------|--------|--------|-----|
| plain (verses' text) | 70.8 % | 91.7 % | 100 % | 0.807 |
| labelled (« Psaume 23:1-4 — … ») | 66.7 % | **95.8 %** | 100 % | 0.763 |

By the rule above, the **labelled form ships** (`VERSE_QUERY_FORM`): +4.1 points of top 10, which
is one selection (Philippiens 2:9-11 moves from rank 19 to the top 10). The labelled form ranks a
little lower at the very top (top 1, MRR), so the choice should be measured again as the set
grows. The selection's character count includes the label, so the text sent never passes 2,000.

**Rationale**: the user asked for the vector to be made from the selected text. A text joined
with spaces is what the Worker would make of line breaks anyway (`tidyQuery`).

## R5. Book names, abbreviations and references

**Decision**: one table, `src/lib/bible/books.ts`, holds the 66 books in Protestant canonical
order. Each book has:

- a **USFM code** (`GEN`, `PSA`, `JHN`), used in data and stored state;
- a **URL slug**: French name, lower case, without accents, spaces as hyphens (`genese`,
  `psaumes`, `1-corinthiens`, `cantique-des-cantiques`);
- a **display name** (« Genèse », « Psaumes », « 1 Corinthiens »), and the singular form used in
  references (« Psaume 23 »);
- **abbreviations**: the usual French ones (Louis Segond / TOB style: « Gn », « Ex », « Ps »,
  « Mt », « Jn », « 1 Co », « Ap »), plus common variants (« Gen », « Psa », « Jean », « 1Co »,
  « I Co »).

`src/lib/bible/reference.ts` parses typed references:

- Book: matched on the compact key (`compactKey` of `src/lib/search/normalize.ts`: no accents, no
  case, no spaces or dots). It first tries an exact name or abbreviation, then the only book whose
  name starts with the text (« deut » → Deutéronome). Several books starting the same way
  (« jo » → Job, Joël, Jonas, Josué, Jean) count as unknown.
- Then `chapter`, `chapter:verse`, `chapter,verse`, `chapter.verse`, `chapter:verse-verse`.
- An out-of-range chapter or verse opens the nearest existing one and says so (spec Edge Cases).
- The same module formats references: « Psaume 23:1-4 ; Jean 10:11 », grouping runs of
  consecutive verses and chapters of the same book.

**Rationale**: the hymnal number parser already uses `compactKey`, so the two parsers behave
alike. The table is static code, not data: the 66 books never change.

## R6. Raising the query length for verse searches

**Decision**:

- The **Worker accepts up to 2,000 code points** for every query (`MAX_EMBED_CHARS = 2000` in
  `src/lib/meaning/config.ts`). It returns 413 above that.
- The **search field still cuts at 500** (`MAX_QUERY_CHARS`, unchanged), so feature 011's
  behaviour and messages do not change.
- The **verse selection is limited to 2,000 characters** of joined text. The selection bar
  refuses a verse that would exceed it and says why (FR-011). The client never needs to cut a
  verse query.

**Rationale**: the Worker cannot tell a verse query from a typed one, and does not need to. The
cost of 2,000 characters is about 500 tokens, roughly $0.00007 per call, and the rate limit
(30 per 60 s) is unchanged. One limit on the Worker keeps the contract simple. The 500 cut in the
field is a product choice of feature 011, not a cost guard, so it stays.

**Alternatives considered**: a `kind: "verses"` field that unlocks the higher limit. It adds a
field the Worker cannot check, so it protects nothing. Rejected.

## R7. Running the search and showing results

**Decision**: a dedicated screen, **`/bible/chants?versets=<refs>`**, runs the search and shows
the hymns.

- `versets` encodes the selection compactly: `psaumes.23.1-4~jean.10.11`. A reload or a shared
  link runs the same search (its vector comes from the query cache when known).
- The search reuses the existing chain unchanged: `embedQuery` (with its query cache) →
  `client.searchMeaning({ query: '', hymnals: [], excluded }, vector, configId)`. With an empty
  `query`, the word list is empty. The shipped fusion gives words no weight (`wWords: 0`), so the
  order is exactly the meaning order. Hymnals left out in Settings are skipped (feature 014).
- Results use `ResultList` and `MeaningStatus` as the search screen does. Each result links with
  `?passage=` so the matching stanza is marked (feature 013).
- There is no hymnal filter on this screen. The Settings choice applies (FR-014). A per-search
  filter can come later if asked.

**Rationale**: a URL per search gives the back button, reload and sharing for free, as on the
search screen (`?q=…&sens=1`). Putting verse queries into the search field would mix two inputs
in one control, and the field is limited to 500 characters (R6).

## R8. Verse reference set (FR-017, SC-004)

**Decision**:

- `tests/queries/verse-queries.json`: **at least 20 selections**. Each has an id, the verse
  references, and one or more expected hymn ids. They are chosen where a hymn clearly paraphrases
  or quotes the passage: Psaume 23, Psaume 121, Ésaïe 40:31, Lamentations 3:22-23, Jean 3:16,
  Romains 8:38-39, 1 Corinthiens 13, Philippiens 2:6-11, Apocalypse 4:8-11… The set includes
  single verses and selections across chapters. The texts are read from `content/bible/`, never
  copied into the file.
- `scripts/semantic/query-vectors.ts` is extended to embed these texts as well, into
  `tests/queries/verse-query-vectors.json`, so the test runs offline as for the meaning set.
- `tests/queries/verse-meaning.test.ts` asserts that **≥ 60 %** of the selections have an expected
  hymn in the top 10 (SC-004). It also records the scores of both query forms (R4) in
  `tests/queries/verse-evaluation.json`.

**Rationale**: Constitution, development flow: every search change is checked against a versioned
reference set.

## R9. Selection, reading position, copy

**Decision**:

- **Selection**: a Svelte store in `src/lib/bible/selection.ts`, a set of verse ids
  (`JHN.3.16`), mirrored in `sessionStorage` so that a reload of the tab keeps it. It is not saved
  with the user's collections (spec Key Entities).
- **Reading position**: a new `bibleAt` field (`{ book, chapter }` or `null`) in the reading
  preferences (`src/lib/prefs/prefs.ts`, sanitized like the other fields). Opening `/bible` with a
  saved position goes to that chapter.
- **Copy and share**: `navigator.clipboard.writeText` and `navigator.share` when offered, each
  guarded. Format in contracts/bible-ui.md §5.

**Rationale**: the existing storage patterns, with no new library. The selection lives in memory
and the tab, since the spec says it lasts while the app is open.

## R10. Navigation

**Decision**: a fourth main section, **« Bible »**, between « Recueils » and « Répertoire », in
the mobile tab bar and the desktop top bar. A new `bible` icon (an open book with a bookmark
ribbon, 1.5 stroke, as the others) is added to `Icon.svelte`. The chapter screen uses a reading
bar like the hymn screen: previous chapter, chapter picker, next chapter.

**Rationale**: FR-005. Four tabs fit at 320 px with the current tab style, about 80 px each.
