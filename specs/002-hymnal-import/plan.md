# Implementation Plan: Import Hymnals from Source Sites

**Branch**: `002-hymnal-import` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-hymnal-import/spec.md`

## Summary

The content maintainer imports hymnals from the four source sites into the `content/` files
that feature 001 publishes. Imported text is faithful to the source. Re-runs are safe and never
overwrite manual work, the same hymn is recognised across hymnals and sites, and nothing is
published until rights are recorded.

Approach: a TypeScript command-line tool (`npm run import`) in the same repository, reusing
feature 001's schemas and normalisation. The pipeline has these steps:

1. A polite, cached fetcher that follows robots rules, waits between requests and identifies
   itself.
2. One adapter per source, which lists a hymnal's hymns and extracts each page into a `RawHymn`.
3. Text fingerprints that tell new, unchanged and changed hymns apart. A changed hymn becomes a
   pending change for review.
4. Duplicate detection on normalised title plus lyric similarity, with automatic merges or
   proposals.
5. Rights computed from versioned decisions.
6. Atomic, stable writes and a report for every run.

All state is in versioned files under `import/`, with no database. See
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS, run with `tsx`

**Primary Dependencies**: built-in `fetch`, `cheerio` (HTML parsing), `robots-parser`, `diff`
(before/after of pending changes), Zod schemas and `normalizeText`/`tokenize` shared with
feature 001,
`node:util parseArgs` (CLI)

**Storage**: JSON files. `content/` is the shared source of truth; the importer writes it.
`import/` holds sources, decisions, links, pending changes and reports, all versioned.
`import/cache/` holds the raw pages and is ignored by git.

**Testing**: Vitest. Adapter tests on saved fixture pages, unit tests (fingerprint, matching,
rights, atomic write), integration tests of full `run` with no network (idempotence, pending
changes, 20% threshold, interruption), and the SC-005 reference duplicate list.

**Target Platform**: The maintainer's machine (Linux), command line; network access to the four
sites only during `run`.

**Project Type**: CLI tool inside the existing single web project

**Performance Goals**: Bounded by politeness, not by CPU. With about 6,000 pages at 1 request
per second (10 s for psalmodie.ch), a first full import takes a few hours per source and can be
resumed from the cache. Processing a cached hymnal (extraction, matching, writing) takes under
1 minute for 1,000 hymns.

**Constraints**: robots.txt and `Crawl-delay` respected; at least 1 s between requests per host;
identifying User-Agent; no partial writes; byte-identical re-runs; no publication without a
rights decision; no chords or audio stored.

**Scale/Scope**: 4 sources, about 8 hymnals, about 6,000 source pages, about 4,500 distinct
hymns after merging (estimate).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Status |
|-----------|-----------------------|--------|
| I. Advanced search at the core | Not directly affected. Merging duplicates (R7) gives one result per hymn, and the shared `normalizeText`/`tokenize` keep matching consistent with search. | ✅ |
| II. Clean, text-centred design | No UI. Chords and annotations are removed from the lyrics, so the reading view stays clean. | ✅ |
| III. Faithful text and rights | Text is kept as in the source (adapter rule 2), and `check` verifies it against the cache. Each hymn stores its source URL and date. Changed source text goes through review (pending). Hymns default to `unconfirmed`, and only a recorded rights decision publishes them. Each source's terms and permission are recorded, and the importer refuses to fetch a source whose permission was refused. | ✅ |
| IV. Unified multi-hymnal model | Duplicates are merged into one hymn with several entries. A new hymnal or source needs an adapter and config only, with no change in `src/`. Import state is kept apart from content. Saved collections (user data) are never written by the import; they follow merges and renumbering through the stored `hymnId` and the published redirects (R12). | ✅ |
| V. Simplicity, incremental delivery | Files instead of a database, `parseArgs` instead of a CLI framework, `cheerio` instead of a browser. The work is delivered one source at a time, starting with conducteurdelouange.com. Import, normalisation and numbering are covered by tests. | ✅ |
| VI. Accessibility, real-world use | Not affected (no UI). | ✅ |
| Content and sources | Versioned scripts in `scripts/import/`; idempotent (R6); source URL and date stored for each hymn; text stored in NFC with normalisation used for matching only. | ✅ |
| Workflow and quality | Spec → plan → tasks. Changes to matching are checked against a versioned reference list (SC-005). The search reference queries of feature 001 are re-run after each large import. | ✅ |

**Result**: Passed before research and again after design. Cross-feature changes, none of them
a violation:
- Feature 001: the additive `alternateSources` field, strict content schemas, and the published
  `redirects` map.
- Feature 003: entries gain an optional `hymnId`, within storage version 2 (R12).

No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-hymnal-import/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R11
├── data-model.md        # Phase 1: import records, derived rights, transitions
├── quickstart.md        # Phase 1: how to run and validate
├── contracts/
│   ├── cli.md              # hymnia-import subcommands and guarantees
│   ├── source-adapter.md   # interface and rules for a source adapter
│   └── import-files.md     # import/ layout and file formats; 001 schema change
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
import/                          # import state (see contracts/import-files.md)
├── sources.json
├── decisions/{rights,merges,source-priority}.json
├── state/links.json
├── pending/
├── reports/
└── cache/                       # git-ignored

scripts/import/
├── cli.ts                       # entry point: parseArgs, subcommands
├── fetcher.ts                   # robots, delay, retries, User-Agent, disk cache
├── sources/
│   ├── index.ts                 # adapter registry
│   ├── cdl.ts                   # conducteurdelouange.com
│   ├── jemaf.ts                 # jemaf.fr
│   ├── psalmodie.ts             # psalmodie.ch
│   └── ecriture.ts              # ecrituremusique.com
├── pipeline/
│   ├── run.ts                   # orchestrates one run, applies the 20% threshold
│   ├── fingerprint.ts
│   ├── match.ts                 # duplicates: title index, 3-gram Jaccard, decisions
│   ├── reconcile.ts             # new / unchanged / pending / missing
│   ├── rights.ts                # computes the rights field from decisions
│   └── ids.ts                   # stable hymn ids
├── store/
│   ├── files.ts                 # atomic, stable JSON write
│   └── state.ts                 # read and validate import/ files (Zod)
└── report.ts                    # JSON and Markdown reports

src/lib/domain/                  # feature 001 schemas: add alternateSources
src/lib/search/normalize.ts      # reused as is (normalizeText, tokenize)
src/lib/repertoire/              # 003: entries remember their hymnId (R12)
content/redirects.json           # merged hymn id → kept id, published (R12)

tests/import/
├── fixtures/<source>/*.html     # a few saved pages per source
├── adapters/<source>.test.ts
├── unit/                        # fingerprint, match, rights, ids, files
├── integration/run.test.ts      # idempotence, pending, missing, threshold, interruption
├── reference-duplicates.json    # ≥ 30 known shared hymns + known distinct pairs
└── reference-duplicates.test.ts
```

**Structure Decision**: The importer is a set of scripts in `scripts/import/` within the
existing project (constitution: import scripts are versioned in `scripts/`). It shares domain
schemas and normalisation with the app but adds no code to the app bundle. All import state is
in `import/`, kept apart from `content/`, which stays the only input of feature 001's build.

## Delivery order

1. Protect saved collections (R12): entries remember their `hymnId`, the catalog publishes
   redirects, and the sample hymnals move to the test fixtures. This is done before any real
   hymnal is published.
2. Shared base: fetcher, store, fingerprint, reconcile, rights, report, `check`, plus the
   additive and strict changes to the 001 schema.
3. conducteurdelouange.com adapter. It covers 5 hymnals and is enough for US1, US2 and US4.
4. Matching (US3), which becomes useful once two hymnals are imported.
5. jemaf.fr, psalmodie.ch and ecrituremusique.com adapters (US5), one at a time.

## Complexity Tracking

No constitution violations to justify.
