# Implementation Plan: Read the Bible and search by meaning from chosen verses

**Branch**: `015-bible-verse-search` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-bible-verse-search/spec.md`

## Summary

Hymnia gets a « Bible » section with the Louis Segond 1910 text (public domain, eBible.org
`fraLSG`, R1). A versioned import (`scripts/bible/import.ts`) turns the USFM into one compact JSON
file, `content/bible/lsg1910.json`. Only verse text and Psalm titles are kept, and every dropped
marker is traced (R2). The data build hashes it into `static/data/` (about 1.3 MB gzip), and the
service worker precaches it like the catalog, so reading works fully offline (R3).

Screens: book list with a reference field, chapter grid, and chapter text. The chapter screen has
a reading bar (previous/next across books) and remembers the last chapter (R5, R9, R10). Tapping
verses selects them across chapters. A selection bar offers « Chercher des chants », « Copier »,
« Partager » and « Effacer » (contracts/bible-ui.md).

The search sends the selected verses' text, joined in Bible order, to the existing
`POST /api/embed` and gets back one 1,024-dim vector. That vector ranks hymns with the existing
on-device meaning search, Settings scope and stanza marking (R4, R7). **No verse vector is ever
computed or stored.** The Worker's text limit rises from 500 to 2,000 code points, and the search
field keeps its 500 cut (R6). A verse reference set (≥ 20 selections) checks quality: ≥ 60 % with
an expected hymn in the top 10 (R8).

Nothing changes in the hymn content, catalog, search index, meaning data or `configId`.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (`adapter-static`, SPA). The
Cloudflare Worker is in TypeScript too (`worker/index.ts`).

**Primary Dependencies**: Existing only (zod for the schema, `node:zlib` for the archive and size
check). The USFM parser and the zip reading are small, hand-written code: `scripts/bible/zip.ts`
reads the archive's central directory and inflates each entry with `zlib.inflateRawSync`. The
machine has no `unzip`, and no library is needed. **No new dependency.**

**Storage**:
- Bible content: `content/bible/` (committed) → `static/data/bible.<hash>.json` (precached by the
  service worker).
- User data: `localStorage` `hymnia.prefs` gets the new field `bibleAt`. The selection lives in
  `sessionStorage` `hymnia.bible.selection`. Verse query vectors go in the existing query cache
  `hymnia.meaning.queries`.

**Testing**:
- Vitest unit: books table, reference parser and formatter, selection, URL form, copy format,
  `prefs.bibleAt`, Bible schema, USFM parser on a fixture, Worker limit, `embedQuery` `maxChars`.
- Reference queries (`test:queries`): new verse set.
- Perf (`test:perf`): Bible parse and chapter lookup.
- Playwright e2e: new `us19-bible-read.spec.ts`, `us20-bible-search.spec.ts`; axe on the Bible
  screens; the offline spec covers a chapter.

**Target Platform**: Mobile browsers first (iOS Safari, Android Chrome), desktop browsers; PWA,
offline-first.

**Project Type**: Static web app (SvelteKit PWA) plus the existing Cloudflare Worker (one
constant changes).

**Performance Goals**:
- A chapter opens in < 300 ms on a common phone (SC-003), the first visit included (Bible JSON
  parse < 100 ms, budgeted in the perf test).
- Results from a selection appear in < 3 s online (SC-005): one embed call, then on-device ranking
  that already runs in under 100 ms.

**Constraints**:
- Bible data ≤ 2 MB compressed (SC-006). Install download grows by about 1.3 MB.
- WCAG 2.2 AA in light and dark; 44 px touch targets.
- The hymn reading view and the search screen are unchanged (Principle II).
- Default hymn search is byte-identical: existing reference sets are unchanged.

**Scale/Scope**: 66 books, 1,189 chapters, 31,170 verses. Work items:
- one import script;
- one new library folder (`src/lib/bible/`: books, schema, store, reference, selection, query);
- four routes under `/bible`;
- two components (`VerseList.svelte`, `VerseSelectionBar.svelte`);
- small changes to `meaning/config.ts`, `meaning/embed-client.ts`, `worker/index.ts`,
  `prefs.ts`, `schema.ts` (manifest), `build-data.ts`, `+layout.svelte` and `Icon.svelte`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Search at the heart | Search stays on the main screen, untouched. Search by meaning gains a new kind of query (Scripture) and still adds to word search, never replaces it. The lexical 200 ms target is unaffected (no change to the engine). | Pass |
| II. Clean design | Each Bible screen has one purpose: pick a book, pick a chapter, read and select, or see hymns. The selection bar only shows while verses are selected. The hymn reading view is unchanged. | Pass |
| III. Text fidelity and rights | Louis Segond 1910 is public domain (eBible copyright page). The source URL, date, checksum and dropped markup are recorded in `content/bible/source.json`. Verse text is reproduced word for word, only markup is removed (R2). The translation and its status are shown (FR-004). | Pass |
| IV. Unified multi-hymnal model | The Bible is separate content, in its own folder and file, never mixed with hymns. User data (position, selection) is kept apart from both. Hymnals are unaffected. | Pass |
| V. Simplicity and incremental delivery | No new dependency, no new service, no stored verse vectors (the simplest option, chosen by the maintainer). It ships in usable slices: reading (US1), then search from verses (US2), then copy (US3). **Order deviation**: the constitution lists "music (chords, audio)" before "extensions (hymn/verse links)", and music is not built yet. See Complexity Tracking. | Pass, justified |
| VI. Accessibility and reading | Mobile first, text size and themes followed, reading fully offline, verses as toggle buttons with pressed state, selection bar as a named region, axe in e2e. | Pass |
| Workflow: reference query set | A new versioned verse reference set with a threshold (R8). The existing sets must stay green, which proves the default path is unchanged. | Pass |
| Workflow: mobile, light and dark | Quickstart §4 and e2e at phone width, both themes. | Pass |
| Content: reproducible import | `npm run bible` is versioned, idempotent and records URL and date (quickstart §1). | Pass |

**Re-check after Phase 1**: unchanged. The design adds no dependency, keeps the configuration id,
and keeps verse data out of the hymn data. One justified entry in Complexity Tracking (delivery
order).

## Project Structure

### Documentation (this feature)

```text
specs/015-bible-verse-search/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── bible-ui.md         # routes, reading, selection, results, copy format, a11y
│   └── embed-api.md        # change to /api/embed: 2,000 code points
├── checklists/
│   └── requirements.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
scripts/
├── bible/
│   ├── import.ts                        # NEW: download (cached) → unzip → parse USFM → content/bible/*
│   ├── zip.ts                           # NEW: minimal zip reader (stored + deflate entries)
│   └── usfm.ts                          # NEW: pure USFM → BibleData parser (R2)
├── build-data.ts                        # validate Bible, write bible.<hash>.json, manifest.bible, size check
└── semantic/query-vectors.ts            # also embeds the verse reference set

content/bible/
├── lsg1910.json                         # NEW (generated by the import, committed)
└── source.json                          # NEW

src/
├── lib/
│   ├── bible/
│   │   ├── books.ts                     # NEW: 66 books (code, slug, names, abbreviations, chapters)
│   │   ├── schema.ts                    # NEW: zod BibleData + VerseId helpers
│   │   ├── store.ts                     # NEW: loadBible() once per visit, from manifest.bible
│   │   ├── reference.ts                 # NEW: parse typed references; format labels
│   │   ├── selection.ts                 # NEW: selection store (sessionStorage), limit, URL form
│   │   └── query.ts                     # NEW: query text, copy/share text
│   ├── meaning/
│   │   ├── config.ts                    # MAX_EMBED_CHARS = 2000
│   │   └── embed-client.ts              # option maxChars
│   ├── prefs/prefs.ts                   # Prefs.bibleAt
│   ├── domain/schema.ts                 # DataManifest.bible
│   └── components/
│       ├── VerseList.svelte             # NEW: verses as toggle buttons
│       ├── VerseSelectionBar.svelte     # NEW: count, label, actions, limit note
│       └── Icon.svelte                  # 'bible' icon
├── routes/
│   ├── +layout.svelte                   # Bible tab; reading bar on chapter screen
│   └── bible/
│       ├── +page.svelte / +page.ts                      # NEW: books, reference field, resume
│       ├── [livre]/+page.svelte / +page.ts              # NEW: chapter grid
│       ├── [livre]/[chapitre]/+page.svelte / +page.ts   # NEW: chapter text, reading bar
│       └── chants/+page.svelte / +page.ts               # NEW: hymns from verses
worker/index.ts                          # limit MAX_EMBED_CHARS

tests/
├── fixtures/bible/                      # NEW: small USFM sample (2 books) + expected JSON
├── unit/
│   ├── bible-books.test.ts              # NEW
│   ├── bible-reference.test.ts          # NEW (SC-007 table)
│   ├── bible-selection.test.ts          # NEW (order, limit, URL form)
│   ├── bible-query.test.ts              # NEW (query and copy text)
│   ├── bible-usfm.test.ts               # NEW
│   ├── bible-schema.test.ts             # NEW
│   ├── prefs.test.ts                    # bibleAt
│   ├── meaning-embed-client.test.ts     # maxChars
│   └── meaning-worker-api.test.ts       # 2,000 / 2,001
├── queries/
│   ├── verse-queries.json               # NEW (≥ 20 selections)
│   ├── verse-query-vectors.json         # NEW (generated)
│   ├── verse-evaluation.json            # NEW (scores of both query forms)
│   └── verse-meaning.test.ts            # NEW (≥ 60 % top 10)
├── perf/bible.perf.test.ts              # NEW
└── e2e/
    ├── us19-bible-read.spec.ts          # NEW (navigation, references, resume, offline)
    ├── us20-bible-search.spec.ts        # NEW (selection, limit, search with mocked embed, copy)
    └── a11y.spec.ts                     # Bible screens
```

**Structure Decision**: the existing single SvelteKit app and its Worker. The Bible logic lives in
pure modules under `src/lib/bible/`, tested in Node. Routes and components only render and wire
the stores. The search from verses reuses `embedQuery`, the search worker's `searchMeaning`,
`ResultList` and `MeaningStatus` as they are.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Delivery order (Principle V): "extensions (hymn/verse links)" comes before "music (chords, audio)" | The maintainer asked for it now. Search by meaning (features 011–013) already provides what it needs, so the cost is small and the slice stands alone. Music needs sources and rights work not yet started. | Waiting for music first: it would block a cheap, ready feature on unrelated content work. Each slice of this feature is usable on its own, which is the intent of the principle. |
