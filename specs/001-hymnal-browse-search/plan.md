# Implementation Plan: Browse and Search the Multi-Hymnal Collection

**Branch**: `001-hymnal-browse-search` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-hymnal-browse-search/spec.md`

## Summary

Users can find a hymn by hymnal and number, by title, or by a line of the lyrics, even with no
accents or a typo. They can also browse each hymnal in number order and read a hymn in a
clean, adjustable view, including offline.

Approach: an installable, offline-first web app (PWA) built as a static site. Everything runs on
the device: the hymn data and a search index built ahead of time are downloaded once and
cached. Number queries are resolved by a small parser and a lookup table, and text queries by
MiniSearch in a Web Worker. Hymn content lives as validated JSON files in the repository, so a
new hymnal is a data change, with no code change. See [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (build and tests)

**Primary Dependencies**: SvelteKit 2 + Svelte 5 (`adapter-static`), `@vite-pwa/sveltekit`
(service worker, install manifest), MiniSearch (search), Zod (content validation)

**Storage**: JSON files in `content/` (source of truth, versioned in git). The build produces a
data file and a search index with hashed names, cached on the device by the service worker.
Reading preferences are kept in `localStorage`. No database or server.

**Testing**: Vitest (unit tests, reference query suite, performance test), Playwright with
`@axe-core/playwright` (end-to-end, offline, accessibility)

**Target Platform**: Current mobile browsers (Safari iOS 16+, Chrome Android), plus desktop
browsers; installable as a PWA; static hosting

**Project Type**: Offline-first web application (static PWA), single project

**Performance Goals**: Results on screen ≤ 200 ms per keystroke on a mid-range phone for
~6,000 hymns (SC-002); hymn opens in under 5 s from app launch (SC-001)

**Constraints**: Fully offline after first visit; data and index together ≤ 5 MB
compressed; WCAG 2.2 AA; light and dark modes; French interface; only hymns with confirmed
rights are published

**Scale/Scope**: About 10 hymnals and 6,000 hymns once imported. This feature uses a
public-domain sample of 2 hymnals and about 40 hymns. 6 screens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Status |
|-----------|-----------------------|--------|
| I. Advanced search at the core | Search field on the home screen (`/`). Searches by number, title and full lyrics, with filters; accents and typos ignored. Index built ahead of time and searched in a worker for ≤ 200 ms. Semantic search is left for a later feature, on top of this one. | ✅ |
| II. Clean, text-centred design | One purpose per screen ([contracts/routes.md](./contracts/routes.md)); lyrics view with nothing else by default; light and dark modes. | ✅ |
| III. Faithful text and rights | Text stored in NFC and never changed for display. Source, credits and corrections stored with each hymn. Hymns with unconfirmed rights are left out at build time. Sample uses public-domain texts only. | ✅ |
| IV. Unified multi-hymnal model | A hymn is stored once and linked to several hymnals ([data-model.md](./data-model.md)). A new hymnal is a data change only. Preferences are kept apart from hymn data. | ✅ |
| V. Simplicity, incremental delivery | No server, database or account. Delivered as the first slice (reading and search). Search, data validation and numbering are covered by automated tests. | ✅ |
| VI. Accessibility, real-world use | Mobile first, adjustable text size, offline via service worker, axe checks in end-to-end tests. | ✅ |
| Content and sources | The data build is a versioned script in `scripts/` that can be run again with the same result. Each hymn stores its source URL and date. Text is stored in NFC, and normalisation is used for search only. | ✅ |
| Workflow and quality | Reference query suite versioned and run on each search change; end-to-end tests on a mobile viewport in light and dark modes. | ✅ |

**Result**: Passed before research and again after design. No violations; Complexity Tracking
is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-hymnal-browse-search/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and alternatives
├── data-model.md        # Phase 1: entities and validation rules
├── quickstart.md        # Phase 1: how to run and validate
├── contracts/
│   ├── content-schema.md   # format of content files (also for the future importer)
│   ├── search.md           # search input, query interpretation, ranking, output
│   └── routes.md           # screens and URLs
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
content/                    # source of truth for hymn data (JSON, versioned)
├── hymnals.json
└── hymns/<hymn-id>.json

scripts/
└── build-data.ts           # validate content/, write catalog + search index to static/data/

src/
├── lib/
│   ├── domain/             # types and Zod schemas (Hymnal, Hymn, Section, Entry, Credit)
│   ├── search/
│   │   ├── normalize.ts    # shared normalisation (indexing and queries)
│   │   ├── query-parser.ts # empty / hymnal+number / number / short / text
│   │   ├── engine.ts       # MiniSearch setup, ranking tiers, excerpts
│   │   ├── worker.ts       # Web Worker wrapper
│   │   └── client.ts       # UI-side API, drops outdated responses
│   ├── data/catalog.ts     # load and cache the catalog, lookups, next/previous
│   ├── prefs/              # text size, theme, hymnal filter (localStorage)
│   └── components/         # SearchBox, ResultList, HymnalFilter, LyricsView, …
├── routes/
│   ├── +layout.svelte      # theme, text size, navigation
│   ├── +page.svelte        # search (home)
│   ├── recueils/+page.svelte
│   ├── recueils/[recueil]/+page.svelte
│   ├── recueils/[recueil]/[numero]/+page.svelte
│   └── reglages/+page.svelte
└── service-worker / PWA config via @vite-pwa/sveltekit

static/data/                # build output (ignored by git)

tests/
├── unit/                   # normalize, query-parser, engine, build-data validation
├── queries/
│   ├── reference-queries.json   # ≥ 50 queries with expected hymn and rank
│   └── reference.test.ts
├── perf/search.perf.test.ts     # synthetic 6,000-hymn collection
└── e2e/                    # one spec per user story, offline, theme, axe
```

**Structure Decision**: Single static web project. Data build scripts are in `scripts/` (as
required by the constitution and the home folder conventions). Hymn content is in `content/`,
separate from code, so the future import feature only writes files there.

## Complexity Tracking

No constitution violations to justify.
