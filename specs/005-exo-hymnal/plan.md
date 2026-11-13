# Implementation Plan: Exo Hymnal

**Branch**: `005-exo-hymnal` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-exo-hymnal/spec.md`

## Summary

Fill the Exo hymnal, which already exists but is empty, with the 60 Exo songs of
conducteurdelouange.com (`/chants/recueil/6`, 3 overlapping pages that show only 50 of them). The site and its page layout
are already handled by the `cdl` adapter of feature 002. The only gap is that Exo rows have no
number, so the adapter skips them.

The plan:
1. Teach the `cdl` adapter about unnumbered hymnals. Exo songs get made-up numbers pinned in a
   table, oldest site id first, like Evangile21.
2. Always list pinned songs, so the site's overlapping pages do not make songs flap between
   missing and active.
3. Drop bracketed "(Refrain)" repeat markers from the lyrics.
4. Everything else is feature 002 unchanged: matching with JEM, rights, report, `check`.
5. The copyright line is not stored, as for every hymnal. The spec was amended. See
   [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS, run with `tsx` (as features 002 and 004)

**Primary Dependencies**: existing only: `cheerio`, Zod schemas, `cleanLine`, the polite cached
fetcher. No new dependency.

**Storage**: JSON files:
- `import/sources.json`: `exo` is added to `cdl.hymnals`;
- `content/hymns/`: imported or merged hymns;
- `import/state/links.json`: the links;
- the page cache `import/cache/cdl/` (git-ignored).

**Testing**: Vitest (`npm run test:import`). The tests cover the adapter on new fixtures
(3 overlapping Exo list pages and 2 song pages), the pinned-table invariants, and that the JEM,
AdF and CD fixtures are unchanged. After the import, run `npm run test:queries`.

**Target Platform**: the maintainer's machine (Linux), command line.

**Project Type**: a CLI tool inside the existing single web project.

**Performance Goals**: trivial: about 53 requests at 1 per second, under 2 minutes.

**Constraints**:
- The site's robots rules apply, with at most 1 request per second.
- Lyrics are faithful to the source.
- Numbers never change once committed.
- Re-runs produce byte-identical files.
- The songs appear in the personal-use build only (`permission: unknown`).

**Scale/Scope**: 1 existing source, 1 existing hymnal, 60 songs. Only 4 merged with existing hymns (research R6).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Status |
|-----------|-----------------------|--------|
| I. Advanced search | "Exo 12", title and lyrics search work through the existing engine. The reference queries are re-run. | ✅ |
| II. Clean design | No UI change. Chords and repeat markers are kept out of the lyrics. | ✅ |
| III. Faithful text and rights | Text is as on the site, and `check` verifies it against the cache. Each hymn keeps its URL and retrieval date. Hymns are `unconfirmed`, so they appear in the personal-use build only. The copyright line is not stored for any hymnal, and authors and the source are still credited (R5). | ✅ |
| IV. Unified model | Data and adapter only. Nothing in `src/` changes. Shared songs are merged with JEM by matching. Pinned numbers keep saved collections attached. | ✅ |
| V. Simplicity | The existing adapter is extended, with no new source or mechanism. The number table reuses the Evangile21 pattern. Listing, numbering and parsing are tested. | ✅ |
| VI. Accessibility | Not affected. | ✅ |
| Content and sources | conducteurdelouange.com is already named for Exo in the constitution. The import is reproducible, idempotent and stores text in NFC. | ✅ |
| Workflow and quality | Spec → plan → tasks. Search reference queries are re-run. | ✅ |

**Result**: Passed before research and again after design. There are no cross-feature
contract changes. Feature 002's `cdl` adapter gains a backward-compatible behaviour for
unnumbered hymnals ([contracts/cdl-exo-listing.md](./contracts/cdl-exo-listing.md)).

## Project Structure

### Documentation (this feature)

```text
specs/005-exo-hymnal/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R8
├── data-model.md        # Phase 1: source change, pinned table, listing → entries
├── quickstart.md        # Phase 1: test, import, validate
├── contracts/
│   └── cdl-exo-listing.md   # listing, numbering, repeat markers, tests
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
import/
└── sources.json                     # cdl.hymnals + "exo"

content/hymns/                       # + Exo hymns / Exo entries on JEM hymns (generated)

scripts/import/sources/
├── cdl.ts                           # CDL_VOLUMES.exo, CDL_PINNED, unnumbered listing,
│                                    # union with pinned ids, section labels written as lines
└── README.md                        # note: unnumbered cdl hymnals use pinned ids

tests/import/
├── adapters/cdl.test.ts             # Exo listing / numbering / page cases; old Exo test replaced
└── fixtures/cdl/                    # + listing-exo-page{1,2,3}.html, hymn-698.html,
                                     #   hymn-1320.html; index.json and README updated;
                                     #   listing-exo.html removed
```

**Structure Decision**: the existing single project. The change stays inside the `cdl` adapter
and its tests. Nothing in `src/` or the pipeline changes.

## Implementation order

1. **Fixtures**: fetch the 3 Exo list pages and pages `/698` and `/1320` with the importer's
   fetcher. Check how "(Refrain)" is rendered (R4). Update `index.json` and the README.
2. **Adapter**: support unnumbered hymnals in `parseListing` and `listEntries`, add
   `CDL_PINNED` and the repeat markers, then write the tests (contract table).
3. **Pinned table**: read the list several times to collect every id (R3). Freeze `CDL_PINNED.exo`
   in ascending id order.
4. **Source**: add `exo` to `cdl.hymnals`. Do a dry run and read the report, then a real run.
   Review the duplicates. Do a JEM dry run to confirm that nothing changes.
5. **Validation**: run `check`, `npm run test:queries` and the quickstart checks in the
   personal-use build. Record the counts in the quickstart.

## Complexity Tracking

No violations.
