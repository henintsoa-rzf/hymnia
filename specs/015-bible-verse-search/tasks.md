---

description: "Task list for reading the Bible and searching hymns from chosen verses (feature 015)"
---

# Tasks: Read the Bible and search by meaning from chosen verses

**Input**: Design documents from `/specs/015-bible-verse-search/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R10), data-model.md, contracts/bible-ui.md,
contracts/embed-api.md, quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for search behaviour and
for imports, and the workflow requires a versioned reference query set for any search change
(FR-017). Write each test task before the code it covers and see it fail first.

**Organization**: Tasks are grouped by user story (spec.md):
- US1: read the Bible offline (P1);
- US2: find hymns from chosen verses (P1);
- US3: copy or share the chosen verses (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single SvelteKit project at the repository root, plus the Worker in `worker/` (plan.md, "Project
Structure").

Values used everywhere (data-model.md, research.md, contracts):

- **Translation**: id `lsg1910`, name « Louis Segond 1910 », rights `public-domain`. Source:
  eBible.org `fraLSG`, USFM archive (R1).
- **Book code**: USFM (`GEN` … `REV`), 66 books in Protestant canonical order.
- **Book slug**: French name, lower case, no accents, spaces as hyphens (`genese`, `psaumes`,
  `1-corinthiens`, `cantique-des-cantiques`).
- **VerseId**: `"<CODE>.<chapter>.<verse>"`, e.g. `"JHN.3.16"`. Bible order: books.ts order, then
  chapter, then verse.
- **URL form of a selection** (`?versets=`): runs of consecutive verses as
  `slug.chapter.first[-last]`, joined by `~`. Example: `psaumes.23.1-4~jean.10.11`.
- **Label**: « Psaume 23:1-4 ; Jean 10:11 ». Book `refName`, `chapter:first-last`, runs joined by
  « ; ». Runs of the same book and chapter share the book name: « Jean 3:16-17, 21 ».
- **Query text**: the selected verses' text in Bible order, joined by one space. No numbers, no
  references, unless R4's measurement picks the « label — text » form.
- **Limits**: `MAX_QUERY_CHARS = 500` (search field, unchanged), `MAX_EMBED_CHARS = 2000` (Worker,
  and the verse selection), counted in Unicode code points after NFC.
- **Storage**: `prefs.bibleAt: { book: BookCode; chapter: number } | null`, default `null`, under
  `hymnia.prefs`. The selection lives in `sessionStorage` `hymnia.bible.selection`.
- **French strings**: « Bible », « Ancien Testament », « Nouveau Testament »,
  « Aller à… (ex. Jean 3:16) », « Référence introuvable », « Louis Segond 1910 · domaine public »,
  « Chapitre N », « Versets choisis », « N versets · <label> », « Chercher des chants »,
  « Copier », « Partager », « Effacer », « Sélection effacée », « N versets choisis »,
  « Limite atteinte : 2 000 caractères au plus », « ‹ Retour aux versets », « Chants pour »,
  « Voir le texte », « Aucun verset choisi », « La recherche par le sens demande une connexion. »,
  « Réessayer », « Versets copiés », « Copie impossible sur cet appareil »,
  « La Bible n’est pas disponible dans cette version ».

---

## Phase 1: Setup

- [X] T001 Run `npm run check`, `npm test`, `npm run test:queries` and `npm run test:e2e` from the repository root and note any failure that exists before this feature
- [X] T002 Confirm the source (research R1): open `https://ebible.org/details.php?id=fraLSG` and `https://ebible.org/fraLSG/copyright.htm`, find the USFM archive URL (expected `https://ebible.org/Scriptures/fraLSG_usfm.zip`), download it into `import/cache/bible/fraLSG/`, and list its files (one `.usfm` per book, plus front matter). Record the confirmed URL and file layout at the end of R1 in specs/015-bible-verse-search/research.md. If no USFM archive exists, record the verse-per-line archive (`fraLSG_vpl.zip`) instead, and adapt T007 to parse it
- [X] T003 Check that `import/cache/` is ignored by git (`.gitignore`); add `import/cache/bible/` if not

---

## Phase 2: Foundational (blocking prerequisites)

The Bible content, its schema, the build step and the loader. US1 and US2 both need them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [X] T004 [P] Write tests/unit/bible-books.test.ts: `BOOKS` has 66 entries; codes and slugs are unique; the AT has 39 books and the NT 27; the chapter counts sum to 1,189 (e.g. `PSA` 150, `MAL` 4, `OBA` 1, `REV` 22); no two books share an abbreviation's `compactKey`; `bookByCode`, `bookBySlug` and `compareVerseIds('PSA.23.1', 'JHN.3.16') < 0` behave as expected
- [X] T005 [P] Write tests/fixtures/bible/ with two small USFM books, `01-GEN.usfm` (chapters 1–2, a few verses each) and `20-PSA.usfm` (an introduction `\imt1`/`\ip` before `\c 1`, Psaume 3 with its title as verse 1, `\q1` continuation lines, `\r` and `\s1` lines, one `\x … \x*` cross-reference, one `\f … \f*` footnote, `\w mot|strong="H1234"\w*`, `\wj \+w mot|strong="G1"\+w*\wj*`, and `\qs — \+w Pause|strong="H5542"\+w*.\qs*`), plus the expected `expected.json` (BibleData shape of data-model.md, with only these books). Write tests/unit/bible-usfm.test.ts: the parser output equals `expected.json`; footnote and cross-reference content is gone; `\w` keeps the word only; the introduction, `\r` and `\s1` lines are dropped; « — Pause. » is kept; spaces are collapsed and text is NFC; a verse gap (`\v 1` then `\v 3`), a duplicate verse, an empty verse and an unknown `\id` each throw an error naming book, chapter and verse; `dropped` lists the markers removed
- [X] T006 [P] Write tests/unit/bible-schema.test.ts: `BibleDataSchema` accepts a valid 66-book document built from `BOOKS` with one-verse chapters, and rejects a wrong book order, a wrong chapter count ("number of chapters per book equals books.ts"), an empty verse, a verse with `\` or a double space, and non-NFC text

### Implementation

- [X] T007 [P] Create src/lib/bible/books.ts: `BookCode` union type, `BOOKS: readonly Book[]` with `{ code, slug, name, refName, abbreviations, testament: 'AT' | 'NT', chapters }` for the 66 books (French names: « Genèse » … « Apocalypse »; `refName` « Psaume » for PSA, otherwise `name`; usual French abbreviations « Gn », « Ex », « Lv », « Nb », « Dt », « Jos », « Jg », « Rt », « 1 S », « 2 S », « 1 R », « 2 R », « 1 Ch », « 2 Ch », « Esd », « Né », « Est », « Jb », « Ps », « Pr », « Ec », « Ct », « És », « Jr », « Lm », « Éz », « Dn », « Os », « Jl », « Am », « Ab », « Jon », « Mi », « Na », « Ha », « So », « Ag », « Za », « Ml », « Mt », « Mc », « Lc », « Jn », « Ac », « Rm », « 1 Co », « 2 Co », « Ga », « Ép », « Ph », « Col », « 1 Th », « 2 Th », « 1 Tm », « 2 Tm », « Tt », « Phm », « Hé », « Jc », « 1 P », « 2 P », « 1 Jn », « 2 Jn », « 3 Jn », « Jud », « Ap », plus variants such as « Gen », « Psa », « Jean », « 1Co », « I Co »), and the helpers `bookByCode`, `bookBySlug`, `verseId(code, chapter, verse)`, `parseVerseId`, `compareVerseIds`. Make T004 pass
- [X] T008 [P] Create scripts/bible/zip.ts: `readZip(bytes: Uint8Array): Map<string, Uint8Array>`. It reads the end-of-central-directory record and the central directory, and supports stored (0) and deflate (8) entries via `zlib.inflateRawSync`. It throws on any other method or on a bad signature. Add a unit case in tests/unit/bible-usfm.test.ts that zips the fixture with a tiny in-test writer (stored entries) and reads it back
- [X] T009 Create scripts/bible/usfm.ts: `parseUsfmBooks(files: { name: string; text: string }[]): { data: BibleData; dropped: string[] }`. Rules of research R2: keep `\c`, `\v` and the text of paragraph lines (`\p`, `\q*`, `\m`, `\b`, `\pi*`, `\nb`); drop `\f…\f*`, `\x…\x*` with their content; keep the text of character marks (`\w`, `\add`, `\nd`, …) and drop `|attributes`; drop whole lines of `\s*`, `\ms*`, `\mr`, `\r`, `\toc*`, `\h`, `\mt*`, `\imt*`, `\ip*`, `\io*`, `\is*`, `\ib`, `\ie`, `\tr`, `\ide`, `\rem`, and anything before `\c 1`; NFC, collapse spaces, trim. Skip non-canonical books (front matter, deuterocanon) and report them. Enforce the errors listed in T005. Make T005 pass
- [X] T010 Create src/lib/bible/schema.ts: zod `BibleDataSchema` (`translation: 'lsg1910'`, `name`, `books` per data-model.md, each chapter a `string[]` of at least 1 verse) with a `superRefine` that checks book order and chapter counts against `BOOKS` and that each verse is non-empty, NFC, has no `\` and no double space. Export the types `BibleData`, `BibleBook`, `BibleChapter`, and `BibleSourceSchema` for `content/bible/source.json` (`translation`, `name`, `rights: 'public-domain'`, `edition`, `url`, `retrievedAt` ISO date, `sha256`, `dropped: string[]`, `verses: number`). Make T006 pass
- [X] T011 Create scripts/bible/import.ts and the npm script `"bible": "tsx scripts/bible/import.ts"` in package.json. It downloads the archive (URL from T002) into `import/cache/bible/fraLSG/` unless already cached, unzips it with `readZip`, parses it with `parseUsfmBooks`, and validates it with `BibleDataSchema`. It writes `content/bible/lsg1910.json` (tab-indented, stable key order) and `content/bible/source.json` (with `retrievedAt` of the download, `sha256` of the archive, `dropped`, and the `verses` total). It prints books, chapters, verses, raw size and gzip size. With `--offline` it uses the cache only. Re-running on the same archive must write byte-identical files
- [X] T012 Run `npm run bible`. Check Jean 3:16 against quickstart §1, Psaume 23 (6 verses), Malachie (4 chapters), Psaume 3:1 (« Psaume de David… »), and a total of 31,170 verses. Fix the parser for any USFM marker it does not handle. Commit-ready output: content/bible/lsg1910.json, content/bible/source.json
- [X] T013 Add `bible?: { translation: 'lsg1910'; file: string; bytes: number; verses: number }` to `DataManifest` in src/lib/domain/schema.ts, commented « Absent when the build had no Bible. Old clients ignore it. »
- [X] T014 In scripts/build-data.ts: read the Bible from `<contentDir>/bible/` if it exists, otherwise from `content/bible/` (so the e2e build from tests/fixtures/sample-content gets the real Bible). Validate it with `BibleDataSchema` and `BibleSourceSchema`, and fail if the verse count differs from `source.json.verses` by more than 1 %. Write `bible.<hash>.json` in `writeOutput` and set `manifest.bible`. Fail the build when its gzip size exceeds 2 MB (SC-006), and print the size next to the catalog line. With no Bible found, leave `manifest.bible` unset and print a warning. Add cases to tests/unit/build-data.test.ts for the gzip limit and the missing-Bible path
- [X] T015 Create src/lib/bible/bible.ts (pure `createBible`, tested in tests/unit/bible-api.test.ts) and src/lib/bible/store.ts: `loadBible(fetchFn = fetch): Promise<Bible | null>`, loaded once per visit from `manifest.bible.file` (same getter and base path as src/lib/data/catalog.ts `fetchCatalog`). It resolves `null` when the manifest has no `bible`, resets on a failed load like `loadCatalog`, and returns a `Bible` API: `book(code)`, `chapter(code, n)` → `string[]` or `undefined`, `verseText(id)`, `next(code, n)` and `previous(code, n)` (across books; `undefined` at Genèse 1 and Apocalypse 22)
- [X] T016 [P] Write tests/perf/bible.perf.test.ts: parse `content/bible/lsg1910.json` and build the `Bible` API in under 150 ms (Node, warm), and look up 1,000 random chapters in under 5 ms in total (SC-003 budget)

**Checkpoint**: `npm run bible && npm run data` produce `static/data/bible.<hash>.json` under 2 MB gzip, and all foundational tests pass.

---

## Phase 3: User Story 1 - Read the Bible offline (Priority: P1) 🎯 MVP

**Goal**: a « Bible » section where any chapter can be reached by navigation or by typing a reference, read offline, with the last chapter remembered.

**Independent Test**: with the network cut, open Bible → Jean → 3, read verse 16, go to the next chapter and back; reload the app: Bible reopens at Jean 3 (spec US1).

### Tests for User Story 1

- [X] T017 [P] [US1] Write tests/unit/bible-reference.test.ts (SC-007 table, at least 40 cases): `parseReference` accepts `Jean 3:16`, `jn 3:16`, `Jean 3,16`, `jean 3.16`, `JEAN 3`, `ps 23`, `Psaume 23`, `psaumes 23:1-4`, `1co13`, `1 Co 13:4`, `I Co 13`, `deut 6:4`, `Ésaïe 40:31`, `esaie 40`, `apocalypse 22`, `ap 22:20`, `Abdias` (no chapter → 1), `cantique 2`, `ct 2`. It returns `{ book, chapter, verse? }` and flags `adjusted: true` for `ps 151` (→ 150) and `jean 3:99` (→ 3:36). It returns `null` for `jo 3` (ambiguous: Job, Joël, Jonas, Josué, Jean), `xyz 1` and empty text. `formatLabel` gives « Psaume 23:1-4 », « Jean 3:16-17, 21 », « Psaume 23:1 ; Romains 8:38-39 », « Genèse 1:1 ; Apocalypse 22:21 »
- [X] T018 [P] [US1] Extend tests/unit/prefs.test.ts: `bibleAt` defaults to `null`; `{ book: 'JHN', chapter: 3 }` survives `sanitizePrefs`; an unknown book, a chapter 0, chapter 22 of `JHN` (21 chapters) or a non-object becomes `null`
- [X] T019 [P] [US1] Write tests/e2e/us19-bible-read.spec.ts (both projects, phone width): the Bible tab is in the tab bar and is current on `/bible…`; `/bible?livres` lists 66 books under « Ancien Testament » and « Nouveau Testament »; Psaumes → 23 shows 6 numbered verses; next from Malachie 4 shows Matthieu 1; Genèse 1 has previous disabled; « Aller à… » with `jn 3:16` opens `/bible/jean/3?v=16` with verse 16 in view; `jo 3` shows « Référence introuvable »; after opening Romains 8, a reload of `/bible` lands on `/bible/romains/8`; with `context.setOffline(true)` after a first load, `/bible/psaumes/23` still shows its verses; light and dark screenshots of the chapter screen are taken without visual diff assertions

### Implementation for User Story 1

- [X] T020 [US1] Create src/lib/bible/reference.ts: `parseReference(text): { book: BookCode; chapter: number; verse?: number; adjusted: boolean } | null` and `formatLabel(ids: VerseId[]): string`, as in research R5. Match on `compactKey` (src/lib/search/normalize.ts) of names and abbreviations, then on the unique book whose compact name starts with the text. Separators are `:` `,` `.`, plus `-` for ranges. Out-of-range values clamp to the nearest existing chapter or verse, using `BOOKS` for chapters and the `Bible` API for verses (pass a `verseCount(code, chapter)` function so the module stays pure). Make T017 pass
- [X] T021 [US1] Add `bibleAt` to `Prefs`, `DEFAULT_PREFS` (`null`) and `sanitizePrefs` in src/lib/prefs/prefs.ts. A valid value is `{ book: BookCode in BOOKS; chapter: integer 1..book.chapters }`, anything else is `null`. Make T018 pass
- [X] T022 [P] [US1] Add a `bible` icon to src/lib/components/Icon.svelte (an open book with a bookmark ribbon, same 24 px box and 1.5 stroke as `book`, visibly different from it)
- [X] T023 [US1] In src/routes/+layout.svelte, add the « Bible » link (`/bible`, icon `bible`) between « Recueils » and « Répertoire » in `links`, current when `routeId.startsWith('/bible')`. Hide it when the manifest has no `bible` entry (expose `bibleAvailable` from `fetchCatalog`/`loadCatalog` in src/lib/data/catalog.ts and src/lib/data/store.ts, like `meaningAvailable`). Treat `/bible/[livre]/[chapitre]` as a reading screen (`reading` is true there too), so the tab bar gives way to the reading bar
- [X] T024 [US1] Create src/routes/bible/+page.ts and +page.svelte (contracts/bible-ui.md §2.1). `load` gets the catalog and `loadBible()`. With `prefs.bibleAt` set and no `?livres`, it does `goto(…, { replaceState: true })` to that chapter. Otherwise it shows the reference field (Enter → `parseReference`; a hit opens `/bible/<slug>/<chapter>` with `?v=<verse>` if given; a miss shows « Référence introuvable » under the field and keeps the text), the two headed book groups (h2) as links (one-chapter books link to chapter 1), and the footer « Louis Segond 1910 · domaine public ». With `loadBible()` → `null`, it shows « La Bible n’est pas disponible dans cette version ». `<title>`: `Hymnia · Bible`
- [X] T025 [US1] Create src/routes/bible/[livre]/+page.ts and +page.svelte (§2.2): unknown slug → `NotFound` with a link to `/bible`. The h1 is the book name, followed by a grid of chapter links, each with `aria-label="Chapitre N"` and at least 44 × 44 px. `<title>`: `Hymnia · <Livre>`
- [X] T026 [US1] Create src/lib/components/VerseList.svelte in read-only form: props `verses: string[]`, `code: BookCode`, `chapterNumber`, `focusVerse?: number`. One block per verse, `id="v<n>"`, the number in small figures before the text, lyrics typography and `--text-scale`. `focusVerse` scrolls into view and marks the verse briefly (2 s background fade, none with `prefers-reduced-motion`)
- [X] T027 [US1] Create src/routes/bible/[livre]/[chapitre]/+page.ts and +page.svelte (§2.3): unknown book or chapter → `NotFound`. The h1 is « <name> <n> ». It renders `VerseList` with `focusVerse` from `?v`, sets `prefs.bibleAt` on show, and has a reading bar at the bottom: previous (`aria-label` « Chapitre précédent »), « <Livre> <n> ▾ » opening the chapter grid of the book (native `<dialog>` or a link to `/bible/<slug>`), and next (« Chapitre suivant »). Previous and next use `Bible.previous`/`next` and are disabled at the ends. Style the bar like the hymn screen's reading bar. `<title>`: `Hymnia · <Livre> <n>`
- [X] T028 [US1] Run `npm run build` and check that the service worker precache list (`build/client/sw.js` or the workbox manifest) includes `data/bible.<hash>.json`; if not, adjust `globPatterns` in vite.config.ts (it must not match `**/meaning*`). Then make T019 pass, including the offline case

**Checkpoint**: US1 works on its own. The Bible is readable offline, references open, and the position is remembered.

---

## Phase 4: User Story 2 - Find hymns from chosen verses (Priority: P1)

**Goal**: select verses across chapters and get the hymns whose stanzas match their meaning, with one online vector made from the selected text.

**Independent Test**: select Psaume 23:1-4, tap « Chercher des chants »: within 3 s a hymn based on Psaume 23 is in the first ten; select Jean 3:16 alone: results show the same way (spec US2).

### Tests for User Story 2

- [X] T029 [P] [US2] Extend tests/unit/meaning-worker-api.test.ts (contracts/embed-api.md §Tests): a 2,000 code point text → 200; 2,001 → 413 `too-long`; a 2,000-character text with decomposed accents (`é`) counts code points after NFC tidying (accepted when ≤ 2,000 after NFC)
- [X] T030 [P] [US2] Extend tests/unit/meaning-embed-client.test.ts: `embedQuery(text1200, meta, { maxChars: 2000 })` sends 1,200 characters uncut with `truncated: false`; without `maxChars` a 1,200-character text is still cut to 500 with `truncated: true`
- [X] T031 [P] [US2] Write tests/unit/bible-selection.test.ts against `createSelection({ storage, verseText })` with tests/helpers/memory-storage.ts: `toggle` adds and removes; ids stay unique and in Bible order whatever the tap order; `text` joins verse texts in Bible order with one space; `chars` counts code points; `toggle` refuses with `'too-long'` when the new `chars` would exceed 2,000 and leaves the selection unchanged; `clear` empties; state survives a new `createSelection` on the same storage; broken storage JSON gives an empty selection. `toUrlParam(['PSA.23.1','PSA.23.2','PSA.23.3','PSA.23.4','JHN.10.11'])` is `psaumes.23.1-4~jean.10.11` and `fromUrlParam` reverses it; unknown slugs and out-of-range parts are ignored; an empty or invalid value gives `[]`
- [X] T032 [P] [US2] Write tests/unit/bible-query.test.ts: `verseQueryText(ids, bible)` gives the texts in Bible order joined by a space, with no numbers. `verseQueryText(ids, bible, { withLabel: true })` gives « <label> — <text> » (the R4 candidate form)

### Implementation for User Story 2

- [X] T033 [US2] In src/lib/meaning/config.ts add `export const MAX_EMBED_CHARS = 2000;` with a comment (contracts/embed-api.md). In worker/index.ts compare against `MAX_EMBED_CHARS` instead of `MAX_QUERY_CHARS`. Update the 413 row of specs/011-semantic-search/contracts/embed-api.md with a note « raised to 2,000 by feature 015 ». Make T029 pass
- [X] T034 [US2] In src/lib/meaning/embed-client.ts give `cutQuery(text, max = MAX_QUERY_CHARS)` a `max` parameter and `EmbedOptions` a `maxChars?: number`, passed to `cutQuery`. Make T030 pass
- [X] T035 [US2] Create src/lib/bible/selection.ts: `createSelection({ storage, verseText })` returning a Svelte-readable store of `{ ids, text, chars, label }` with `toggle(id): 'added' | 'removed' | 'too-long'`, `clear()`, `replace(ids)`. Store under `sessionStorage` key `hymnia.bible.selection` (guarded; memory fallback). Add `toUrlParam` / `fromUrlParam` per data-model.md « URL form ». Export a lazily created app instance `bibleSelection` bound to the loaded `Bible`. Make T031 pass
- [X] T036 [US2] Create src/lib/bible/query.ts with `verseQueryText(ids, bible, options?)`. Make T032 pass
- [X] T037 [US2] Turn the verses of src/lib/components/VerseList.svelte into toggles (contracts/bible-ui.md §3): each verse is a `<button type="button" aria-pressed={selected}>` holding the number and text, full width, left-aligned, keeping the reading typography. A selected verse gets the accent background plus a bar on its left edge, as the stanza marked by feature 013 (never colour alone). Tapping calls `onToggle(id)`. Long-press text selection must still work (`user-select: text` on the text span)
- [X] T038 [US2] Create src/lib/components/VerseSelectionBar.svelte: shown while at least one verse is selected, above the reading bar. `role="region"`, `aria-label="Versets choisis"`. It shows « N versets · <label> », shortened with an ellipsis, with the full label in `title`. Its actions are « Chercher des chants » (primary, a link to `/bible/chants?versets=<toUrlParam>`) and « Effacer » (announces « Sélection effacée »), and it has a slot or props for the US3 actions. A polite live region announces « N versets choisis » on change and « Limite atteinte : 2 000 caractères au plus » (shown 4 s) when `toggle` returns `'too-long'`. Targets are at least 44 px
- [X] T039 [US2] Wire selection into src/routes/bible/[livre]/[chapitre]/+page.svelte: pass the selected ids and `onToggle` to `VerseList`, and render `VerseSelectionBar`. The selection persists across chapters (moving does not clear it)
- [X] T040 [US2] Create src/routes/bible/chants/+page.ts and +page.svelte (contracts/bible-ui.md §4):
  - On load, read `versets` with `fromUrlParam` and `replace` the selection. If it is empty, show « Aucun verset choisi » with a link to `/bible`.
  - Header: « ‹ Retour aux versets » (to the first verse's chapter with `?v=`), the h1 « Chants pour <label> », and a collapsed « Voir le texte » block (`<details>`) with the verse text.
  - Run: `const meta = getSearchClient().meaningConfig()`, then `embedQuery(verseQueryText(ids, bible), meta, { maxChars: MAX_EMBED_CHARS, cache: browserQueryCache(meta.configId), signal })`, then `client.searchMeaning({ query: '', hymnals: [], excluded: $prefs.excluded }, vector, meta.configId)`.
  - Show `MeaningStatus` (the same phases, cancel and retry as src/routes/+page.svelte `runMeaning`, including « preparing » while the meaning data downloads) and `ResultList` with the `scope` from `createScope`. There are no filter chips.
  - The live region announces « Résultats par le sens : N chants ». Offline: « La recherche par le sens demande une connexion. » with « Réessayer ».
  - `<title>`: `Hymnia · Chants pour <label>`.
- [X] T041 [US2] Check in tests/unit/meaning-fuse.test.ts (add a `searchByMeaning` case there, or in a new tests/unit/meaning-search.test.ts) that `searchByMeaning` with `query: ''` returns the meaning order unchanged under the shipped fusion (`wWords: 0`), so the verse screen shows exactly the meaning ranking (research R7). Add the case if missing
- [X] T042 [US2] Write tests/queries/verse-queries.json with at least 20 selections `{ id, refs: VerseId[], expect: hymnId[] }`, choosing passages that a hymn of the full collection clearly paraphrases or quotes: search `content/hymns/` for the hymn ids (e.g. Psaume 23, Psaume 121, Ésaïe 40:31, Lamentations 3:22-23, Jean 3:16, Romains 8:38-39, 1 Corinthiens 13:4-8, Philippiens 2:6-11, Apocalypse 4:8-11, Psaume 103:1-5, Ésaïe 53:4-6, Matthieu 11:28-30, Jean 14:1-3, 2 Corinthiens 12:9, Hébreux 12:1-2, Psaume 46:1-3, Psaume 91:1-2, Jean 1:1-14, Luc 2:10-14, 1 Pierre 1:3-4). Include at least 5 single-verse selections and at least 3 selections spanning two chapters or books. Texts are read from content/bible/, never copied into the file
- [X] T043 [US2] Extend scripts/semantic/query-vectors.ts to also read tests/queries/verse-queries.json. Build both query forms with `verseQueryText` (plain, and `withLabel`) from content/bible/lsg1910.json, tidy them as the Worker does (`tidyQuery`, no cut: each must be ≤ 2,000 code points, else fail), embed them, and write tests/queries/verse-query-vectors.json `{ configId, plain: { id: base64 }, labelled: { id: base64 } }`. Run it with the key (`npx tsx scripts/semantic/query-vectors.ts`)
- [X] T044 [US2] Write tests/queries/verse-meaning.test.ts on the built data (`npm run test:queries`), modelled on tests/queries/meaning.test.ts. For each form, rank with `searchByMeaning` (`query: ''`, no exclusions) and compute top 1, top 10, top 50 and MRR. Write the scores and the chosen form to tests/queries/verse-evaluation.json: the labelled form wins only if its top 10 is at least 3 points above plain. Assert the chosen form's top 10 is at least 60 % (SC-004), and list the misses in the failure message. If labelled wins, set the default of `verseQueryText` in src/lib/bible/query.ts to `withLabel: true` and record it in research R4
- [X] T045 [US2] Write tests/e2e/us20-bible-search.spec.ts with `/api/embed` mocked as in tests/e2e/us15-meaning-search.spec.ts:
  - Tapping verses 38 and 39 of Romains 8 marks them (`aria-pressed="true"`), and the bar reads « 2 versets · Romains 8:38-39 ».
  - Moving to Psaume 23 and adding verse 1 gives « 3 versets · Psaume 23:1 ; Romains 8:38-39 ».
  - « Chercher des chants » opens `/bible/chants?versets=psaumes.23.1~romains.8.38-39` and shows results; the request body text has the three verses in Bible order.
  - A result opens a hymn with `?passage=`. Back returns, and « Retour aux versets » keeps the selection.
  - Running it again makes no `/api/embed` request.
  - Offline shows the connection message and « Réessayer ».
  - Selecting verse after verse in Psaume 119 ends with the limit note, and the joined text stays ≤ 2,000 characters.
  - « Effacer » empties the bar.
  - A hymnal left out in Settings never appears in the results.

**Checkpoint**: US1 and US2 work on their own. Search from verses meets SC-004 on the reference set.

---

## Phase 5: User Story 3 - Copy or share the chosen verses (Priority: P2)

**Goal**: selected verses can be copied or shared as text with their references and the translation name.

**Independent Test**: select Jean 3:16-17, copy, paste in a note: the text, then « — Jean 3:16-17 (Louis Segond 1910) » (spec US3).

### Tests for User Story 3

- [X] T046 [P] [US3] Extend tests/unit/bible-query.test.ts: `copyText(ids, bible)` for Jean 3:16-17 is « <v16> <v17>\n— Jean 3:16-17 (Louis Segond 1910) »; for Psaume 23:1-2 + Jean 10:11 the two runs are separate paragraphs (blank line between them), then « — Psaume 23:1-2 ; Jean 10:11 (Louis Segond 1910) »; a gap in the same chapter (Jean 3:16, 3:18) also starts a new paragraph

### Implementation for User Story 3

- [X] T047 [US3] Add `copyText(ids, bible)` to src/lib/bible/query.ts (format of contracts/bible-ui.md §5). Make T046 pass
- [X] T048 [US3] Add « Copier » and, when `navigator.share` exists, « Partager » to src/lib/components/VerseSelectionBar.svelte. Copy uses `navigator.clipboard.writeText(copyText(...))` in a try/catch; on success it shows the « Versets copiés » toast (reuse the toast pattern of src/lib/components/UndoToast.svelte or a polite live region), on failure « Copie impossible sur cet appareil ». Share calls `navigator.share({ text })` and ignores `AbortError`
- [X] T049 [US3] Extend tests/e2e/us20-bible-search.spec.ts: grant clipboard permissions (Chromium project), select Jean 3:16-17, tap « Copier », and read the clipboard: it equals `copyText` output; « Versets copiés » is announced. Skip the clipboard read on WebKit and assert only the toast

**Checkpoint**: all three stories work on their own.

---

## Phase 6: Polish & cross-cutting concerns

- [X] T050 [P] Extend tests/e2e/a11y.spec.ts with axe runs on `/bible?livres`, `/bible/jean`, `/bible/jean/3` with two verses selected (selection bar shown), and `/bible/chants?versets=jean.3.16` with results, in light and dark mode
- [X] T051 [P] Extend tests/e2e/offline.spec.ts (if it lists precached routes) with a Bible chapter
- [X] T052 [P] Update README.md: the Bible section, `npm run bible` (source, cache folder, idempotence, `--offline`), the Bible size in the data build report, and the 2,000-character Worker limit
- [X] T053 Check by hand at phone width, in light and dark mode, following quickstart.md §4 (steps 1–10), with a real `/api/embed` (dev server and `.env` key, or the deployed Worker): selected-verse contrast, the selection bar over the reading bar, four tabs at 320 px wide, text size at 2.0
- [X] T054 Run `npm run check`, `npm run lint`, `npm test`, `npm run test:queries`, `npm run test:perf` and `npm run test:e2e`. All must pass, and the existing meaning reference set must give the same scores as before (no change to the default path). Then run `npm run data` to restore the real collection in static/data
- [X] T055 Deploy the Worker with the new limit (`npm run build && npx wrangler deploy`, README.md) **only after the maintainer confirms**. Then `POST /api/embed` with a 1,500-character text and the shipped `configId` must return 200

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none. T002 (the source URL) blocks T011 and T012.
- **Foundational (Phase 2)**: needs Setup. Blocks every story.
  - T004–T006 come before T007, T009 and T010.
  - T007 comes before T009, T010 and T015.
  - T008 and T009 come before T011, then T012.
  - T010 and T013 come before T014.
  - T012 comes before T014 and T016.
- **US1 (Phase 3)**: needs Phase 2.
- **US2 (Phase 4)**: needs Phase 2. It reuses the chapter screen and `VerseList` of US1 (T026, T027), so in practice it comes after US1. T033 and T034 (Worker and client limit) can be done at any time.
- **US3 (Phase 5)**: needs the selection store and bar of US2 (T035, T038).
- **Polish (Phase 6)**: after the stories it covers.

### Within each story

Tests first (they must fail), then pure modules, then components, then routes, then e2e.

### Parallel opportunities

- Phase 2: T004, T005 and T006 together, then T007 and T008 together. T016 runs once T012 is done.
- US1: T017, T018 and T019 together; T022 alongside T020 and T021.
- US2: T029, T030, T031 and T032 together. T033 and T034 run alongside T035 and T036. T042 (choosing the reference passages) can start as soon as T012 is done.
- Polish: T050, T051 and T052 together.

---

## Parallel Example: User Story 2

```text
# Tests first, all different files:
T029 tests/unit/meaning-worker-api.test.ts
T030 tests/unit/meaning-embed-client.test.ts
T031 tests/unit/bible-selection.test.ts
T032 tests/unit/bible-query.test.ts

# Then, side by side:
T033 src/lib/meaning/config.ts + worker/index.ts
T034 src/lib/meaning/embed-client.ts
T035 src/lib/bible/selection.ts
T036 src/lib/bible/query.ts
T042 tests/queries/verse-queries.json   (needs content/bible only)
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 and Phase 2: the Bible content is imported, validated and shipped.
2. Phase 3: the Bible can be read offline.
3. **Stop and validate**: quickstart §4 steps 1–3. This can already ship: a Bible next to the hymns.

### Incremental delivery

1. US1: reading (MVP).
2. US2: search from verses. Ship once the verse reference set reaches 60 % in the top 10 and the Worker is deployed with the new limit (T055).
3. US3: copy and share.

Each slice keeps the earlier ones working. The existing reference sets must stay green at every
step.
