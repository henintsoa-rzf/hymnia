# Implementation Plan: Pasteur & Compagnie Hymnal

**Branch**: `010-pasteur-compagnie-hymnal` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-pasteur-compagnie-hymnal/spec.md`

## Summary

Add the hymnal "Pasteur & Compagnie" (`pasteur-compagnie`, short code "P&C") and its shop,
pasteuretcompagnie.com, as a new live source `petc`. The adapter reads the 9 pages of the
"Partitions" list (68 song pages) and the "Digital albums" list (6 albums, one of them the
instrumental copy of KIDS).

Each album becomes a part of the hymnal, numbered by hundred in release order. A song's number
is the album's hundred plus its track number (P&C 307 = "Dans ses mains", track 7). The 27
songs on no album go into a last part, "Hors album", from 1001. The numbers are pinned in the
adapter, like Evangile21 and Exo.

The plan:
1. **New `petc` adapter.** It handles:
   - listing and album tracklists;
   - matching tracks to song pages;
   - the KIDS lyrics page for 3 songs that have no song page;
   - lyrics and credit extraction, reusing the Evangile21 parsers (same author, same layouts);
   - title cleaning.
2. **Data**: the hymnal with its 6 parts, the source record (`permission: unknown`), the pinned
   tables, and the fixtures.
3. **Two small, generic pipeline changes**:
   - **Same page, several numbers (R5)**: a song on two albums becomes one hymn with two entries,
     not two copies. The matcher never merges within a hymnal, so this needs the change.
   - **Warnings (R7)**: doubtful extractions are listed in the report as "To check by hand".
4. **Reported, not imported**: album tracks with no lyrics are returned as entries that fail
   with a clear reason, so they appear in the report's "skipped" list with their number (R6).
5. **Unchanged from feature 002**: matching with Evangile21/JEM/ATG, rights, `check`, report.

Three spec points were corrected during research:
- one abbreviation is enough, since "PC" already finds "P&C" (R3);
- "Domaine public" and "Pont par" are not stored, because the credit model has no field for
  them (R8);
- the KIDS song-page versus lyrics-page comparison was dropped.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS, run with `tsx` (as features 002 to 005)

**Primary Dependencies**: existing only: `cheerio`, Zod schemas, `cleanLine`, `mapCreditRole`,
the Evangile21 tokenizer and credit parser (exported, not copied), and the polite cached
fetcher. No new dependency.

**Storage**: JSON files:
- `content/hymnals.json`: the new hymnal and its parts;
- `import/sources.json`: the new source;
- `content/hymns/`: new hymns, and P&C entries on existing hymns;
- `import/state/links.json`: the links;
- the page cache `import/cache/petc/` (git-ignored).

**Testing**: Vitest (`npm run test:import`):
- the adapter on fixtures (contract tables);
- the title rule on the 68 current titles;
- the pinned-table invariants, and that `PETC_ALBUMS` matches the parts in `hymnals.json`;
- the `reconcile` same-page rule;
- the report's `toCheck` list.

The existing adapter and pipeline tests must still pass. After the import, run
`npm run test:queries`.

**Target Platform**: the maintainer's machine (Linux), command line.

**Project Type**: a CLI tool inside the existing single web project.

**Performance Goals**: trivial: about 85 requests at 1 per second, under 2 minutes.

**Constraints**:
- robots.txt (Shopify) applies, with at most 1 request per second and the importer's
  User-Agent and contact.
- Lyrics are faithful to the source.
- Numbers never change once committed.
- Re-runs produce byte-identical files.
- The songs appear in the personal-use build only (`permission: unknown`).

**Scale/Scope**: 1 new source, 1 new hymnal with 6 parts, 71 songs (75 entries). About 29 are
expected to merge with Evangile21 and a few with JEM/ATG/AdF/CD/Arc. 6 album tracks are reported
with no lyrics.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Status |
|-----------|-----------------------|--------|
| I. Advanced search | "P&C 307", "PC 307", title and lyrics search work through the existing engine (`compactKey("P&C") = "pc"`, R3). The reference queries are re-run. | ✅ |
| II. Clean design | No UI change. Parts reuse the existing headed groups on the hymnal page. Shop notes, recording credits and labels are kept out of the lyrics. | ✅ |
| III. Faithful text and rights | Text is as on the site, and `check` re-parses the cached page. Each hymn keeps its URL and retrieval date. Terms were read and recorded (R2). Hymns are `unconfirmed`, so they appear in the personal-use build only. Doubtful extractions are listed for a manual check rather than guessed (R7). | ✅ |
| IV. Unified model | Data plus an adapter. Nothing in `src/` changes, and parts are data. A song on two albums is one hymn with two entries (R5). Shared songs merge with Evangile21/JEM by matching. Pinned numbers keep saved collections attached. | ✅ |
| V. Simplicity | One new adapter that reuses the Evangile21 parsers. Two small backward-compatible pipeline changes, justified below. Pinned tables follow the existing pattern. Listing, numbering, parsing and the pipeline rule are tested. | ✅ |
| VI. Accessibility | Not affected. | ✅ |
| Content and sources | pasteuretcompagnie.com is a new source. It is recorded with its terms, and the import is reproducible (script in `scripts/`), idempotent, NFC. The constitution's list of reference sources can be extended at the next amendment, which this feature does not block. | ✅ |
| Workflow and quality | Spec → plan → tasks. Search reference queries are re-run. The UI is checked on mobile, light and dark (quickstart). | ✅ |

**Result**: Passed before research and again after design. Feature 002's pipeline gets two
backward-compatible changes: the same-page rule in `reconcile`, and `warnings`/`toCheck`. Both
are described in [contracts/petc-adapter.md](./contracts/petc-adapter.md).

## Project Structure

### Documentation (this feature)

```text
specs/010-pasteur-compagnie-hymnal/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R11
├── data-model.md        # Phase 1: hymnal, source, pinned tables, initial numbers
├── quickstart.md        # Phase 1: test, import, validate
├── contracts/
│   └── petc-adapter.md  # listing, tracks, parsing, same-page rule, report
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
content/
├── hymnals.json                     # + pasteur-compagnie with 6 parts
└── hymns/                           # + P&C hymns / P&C entries on existing hymns (generated)

import/
└── sources.json                     # + petc (terms, permission unknown)

scripts/import/
├── sources/
│   ├── petc.ts                      # new adapter: PETC_ALBUMS, PETC_NUMBERS, listing, tracks,
│   │                                #   KIDS lyrics page, parse, title rule
│   ├── evangile21.ts                # export tokenizer, labelSection, credit helpers (no change
│   │                                #   in behaviour)
│   ├── all.ts                       # + import './petc'
│   ├── types.ts                     # RawHymn + warnings
│   └── README.md                    # note: albums as parts, tracks with no lyrics
├── pipeline/reconcile.ts            # same page, several numbers; warnings → toCheck
└── report.ts                        # HymnalReport.toCheck, printed "To check by hand"

tests/import/
├── adapters/petc.test.ts            # contract tables, title rule, pinned/parts invariants
├── unit/reconcile.test.ts           # + same-page rule; report toCheck
├── integration/petc-rerun.test.ts   # 2 album entries on one hymn survive a re-run unchanged
└── fixtures/petc/                   # list p1 and p9, album list, 3 album pages, KIDS lyrics,
                                     #   6 song pages; index.json, README.md
```

**Structure Decision**: the existing single project. There is a new adapter and two small
pipeline changes in `scripts/import/`. Nothing in `src/` changes.

## Implementation order

1. **Fixtures (R11)**: save the pages with the importer's fetcher. Write `index.json` and a
   README with selectors (`.product-single__description`, grid cards, `<h1>` blocks of the KIDS
   page).
2. **Pipeline**: add `warnings` and `toCheck`, then the `reconcile` same-page rule, with tests
   first (contract tables). Run the full import test suite to check that nothing else moves.
3. **Adapter**:
   - export the Evangile21 helpers;
   - write `petc.ts`: listing, albums and tracks, then parse, then titles;
   - write the tests from the contract.
4. **Pinned tables**: freeze `PETC_ALBUMS` and `PETC_NUMBERS` from data-model "Initial
   numbers". Check them against a live dry run: there should be no "not pinned yet" line.
5. **Data**: add the hymnal with its parts and the source. Do a dry run and read the report and
   `toCheck`, adjusting rules where a song is wrong. Then do a real run and review the duplicates
   with Evangile21.
6. **Validation**: run `check`, a second run (no change), `npm run test:queries` and the
   quickstart checks in the personal-use and public builds. Record the counts in the quickstart.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|---------------------------------------|
| `reconcile` same-page rule (R5) | A song on two albums must be one hymn with two numbers. The matcher, by design, never merges within a hymnal. | Manual `merge` decisions per song have to be redone for every future double. Leaving duplicates breaks constitution IV. |
| `RawHymn.warnings` and `HymnalReport.toCheck` (R7) | FR-012: doubtful extractions must be listed for a manual check, on a source whose text layout varies song by song. | `unknownCredits` would mislabel them, and a log line is not kept in the report. |
