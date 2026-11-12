# Implementation Plan: Evangile21 Hymnal

**Branch**: `004-evangile21-hymnal` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-evangile21-hymnal/spec.md`

## Summary

Add the hymnal "Evangile21": the songs of the "Chants Hymnes21" series of
evangile21.thegospelcoalition.org. It uses the import pipeline of feature 002, with no change to
the app.

The site blocks automated clients with a Cloudflare challenge, even for `robots.txt`. By the
maintainer's decision, the importer never requests it. Instead:

1. The maintainer saves the series page and the song pages from a browser.
2. A new, source-agnostic subcommand `add-pages` loads them into the import cache.
3. A new `access: "saved-pages"` flag on the source makes every run work from the cache only.
4. A new adapter `evangile21` lists the song cards and extracts lyrics and credits. It gives each
   song a pinned number from an explicit table, oldest first, like the other unnumbered sources.

Everything after that (fingerprints, pending changes, matching with other hymnals, rights,
report, `check`) is feature 002 unchanged. See [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS, run with `tsx` (as feature 002)

**Primary Dependencies**: existing only: `cheerio`, Zod schemas, `cleanLine`/`mapCreditRole`,
the fetcher cache format, `node:util parseArgs`. No new dependency.

**Storage**: JSON files. New data: one entry in `content/hymnals.json`, one in
`import/sources.json`, the imported hymns in `content/hymns/`, and links and reports in
`import/`. Saved pages go into `import/inbox/evangile21/` (new, git-ignored) and then into
`import/cache/evangile21/` (git-ignored).

**Testing**: Vitest (`npm run test:import`):
- adapter tests on saved fixtures;
- unit tests of `add-pages` (URL detection, refusals, idempotence) and of the numbering rules;
- an integration test of a full `run` on a `saved-pages` source with no network: no request
  sent, missing page reported, re-run byte-identical, new song gets the next number.

The search reference queries of feature 001 are re-run after the import.

**Target Platform**: the maintainer's machine (Linux), command line. A browser is used to save
the pages.

**Project Type**: CLI tool inside the existing single web project

**Performance Goals**: trivial: about 45 pages, all processed from disk in a few seconds.

**Constraints**:
- No request to the site from the importer.
- Lyrics are faithful to the saved pages.
- Numbers never change once committed.
- Re-runs produce byte-identical files.
- Nothing is published without a rights decision. The songs only appear in the personal-use
  build.

**Scale/Scope**: 1 source, 1 hymnal, 44 listed entries (about 40 songs after skips).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Status |
|-----------|-----------------------|--------|
| I. Advanced search at the core | Hymnal + number ("Evangile21 12", "E21 12"), title and lyrics search work through the existing engine. One quirk: "Evangile21" typed alone reads as an unknown hymnal. It is only visible when there are no results, and is accepted without an app change (R9). Feature 001's reference queries are re-run. | ✅ |
| II. Clean, text-centred design | No UI change. Download links, headings and embeds are kept out of the lyrics. | ✅ |
| III. Faithful text and rights | Text is as on the saved page, and `check` verifies it against the cache. Each hymn keeps its source URL and the date the page was saved. Hymns are `unconfirmed` with `permission: unknown`, so they appear in the personal-use build only. The site's choice to block automated clients is respected: no request is sent (R1). | ✅ |
| IV. Unified multi-hymnal model | The new hymnal is data only: no change in `src/`. Songs shared with other hymnals are merged or proposed by feature 002's matching. Numbers are pinned, so saved collections stay attached. | ✅ |
| V. Simplicity, incremental delivery | No new dependency. One adapter. One generic subcommand (about 100 lines) and one optional field, instead of a headless browser. The number table follows the existing pattern (R5). Import, numbering and `add-pages` are covered by tests. | ✅ |
| VI. Accessibility, real-world use | Not affected (no UI change). | ✅ |
| Content and sources | The import is reproducible from the saved pages, which are kept in the cache. It is idempotent, keeps the URL and date per hymn, and stores text in NFC. The source list in the constitution does not name Evangile 21. Adding it is a content decision, not a principle change. | ✅ |
| Workflow and quality | Spec → plan → tasks. Search reference queries re-run after the import. | ✅ |

**Result**: Passed before research and again after design. Cross-feature changes, both additive
and neither a violation:
- Feature 002: the `add-pages` subcommand and the optional `access` field
  ([contracts/cli-add-pages.md](./contracts/cli-add-pages.md)).
- Feature 001: none.

No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-evangile21-hymnal/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: hymnal, source, number table, saved page → cache
├── quickstart.md        # Phase 1: save, load, import, validate
├── contracts/
│   ├── cli-add-pages.md        # add-pages subcommand, access: saved-pages
│   └── evangile21-adapter.md   # listing, numbering, extraction rules and tests
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
content/
├── hymnals.json                 # + evangile21
└── hymns/                       # + imported hymns (generated by the import)

import/
├── sources.json                 # + evangile21 (access: "saved-pages")
├── inbox/evangile21/            # NEW, git-ignored: pages saved from the browser
└── cache/evangile21/            # git-ignored, filled by add-pages

scripts/import/
├── saved-pages.ts               # NEW: URL detection, refusals, cache write
├── commands.ts                  # + add-pages; run honours access: saved-pages
├── fetcher.ts                   # export the cache-writing helpers used by saved-pages.ts
├── store/state.ts               # SourceSchema + optional access
└── sources/
    ├── evangile21.ts            # NEW: adapter, EVANGILE21_NUMBERS, EVANGILE21_SKIPPED
    ├── all.ts                   # + import './evangile21'
    └── README.md                # + "a site that blocks the importer: saved pages"

tests/import/
├── adapters/evangile21.test.ts  # NEW
├── unit/saved-pages.test.ts     # NEW
├── integration/saved-pages-run.test.ts   # NEW
└── fixtures/evangile21/         # NEW: series page, ≥5 song pages, failing page,
                                 #      index.json, README.md

.gitignore                       # + import/inbox/
```

**Structure Decision**: the existing single project. The new code sits beside the four other
adapters and the existing subcommands of `scripts/import/`. Nothing in `src/` changes.

## Implementation order

1. **`access` field and `add-pages`**, with unit tests. Delivered first so the maintainer can
   start saving pages.
2. **Fixtures**: save the series page and 6–7 song pages, strip scripts and styles, and write
   the fixtures README with the selectors (R7, R10).
3. **Adapter** `evangile21`: listing, extraction, tests. Then the number table and skip list,
   finalised from all 44 saved pages (R5, R6).
4. **Source entry and hymnal entry**: terms read in a browser (R8), then a dry run, the report,
   a real run, and review of duplicates.
5. **Validation**: `check`, `npm run data`, the search reference queries, and the quickstart
   checks in the personal-use build.

## Complexity Tracking

No violations.
