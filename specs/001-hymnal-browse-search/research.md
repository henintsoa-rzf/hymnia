# Research: Browse and Search the Multi-Hymnal Collection

**Feature**: `001-hymnal-browse-search` | **Date**: 2026-11-11

Each section answers one open question from the plan's Technical Context.

## 1. Platform

**Decision**: An installable Progressive Web App (PWA): a static site that works offline, is
installable on the phone home screen, and also works on tablet and desktop.

**Rationale**:
- The spec is mobile-first but also covers tablet and desktop (Assumptions). One web codebase
  covers all three.
- Offline reading (FR-018, Principle VI) is fully supported by a service worker that caches the
  app and the hymn data.
- No app-store review, accounts, or per-platform builds (Principle V, simplicity). A link is
  enough to share the app in a church.
- Static hosting is free or close to free and needs no server to maintain.

**Alternatives considered**:
- *Native app with a cross-platform framework (React Native/Expo, Flutter)*: better system
  integration, but two app stores, signing, and a release process for every content change.
  Not needed for reading and searching text. Can be reconsidered later (a PWA can be wrapped as
  a store app if needed).
- *Server-rendered website with server-side search*: breaks offline use and the 200 ms target
  on weak church networks.

## 2. Front-end framework

**Decision**: SvelteKit 2 with Svelte 5 and TypeScript, built as a fully static site
(`adapter-static`), with `@vite-pwa/sveltekit` for the service worker and install manifest.

**Rationale**: Small bundles (good on mid-range phones), file-based routes that map directly to
the screens in the spec, first-class static export, and a maintained PWA plugin.

**Alternatives considered**: React + Vite (larger runtime, more choices to make for routing and
state); vanilla TypeScript (too much hand-written UI plumbing for five screens).

## 3. Search engine

**Decision**: Run search entirely on the device with **MiniSearch**, inside a Web Worker, using
an index built ahead of time. Number queries ("JEM 245") are handled first by a small query
parser and a direct lookup table, before any text search.

**Rationale**:
- MiniSearch supports per-field boosts (title > first line > lyrics, FR-007), prefix search
  (results while typing, FR-009), fuzzy matching with a per-term limit (FR-006: one typo for
  words of 5+ letters), a custom term normaliser (FR-005), and returns which terms matched
  (needed to highlight excerpts, FR-008).
- The index is serialised at build time, so the phone only loads it instead of rebuilding it.
- Running in a Web Worker keeps typing smooth while searching.
- Estimated corpus: ~10 hymnals, ~6,000 hymns, ~1 KB of lyrics each, so ~6 MB of raw text.
  Compressed transfer for the data and index is estimated at 2–4 MB, cached once.

**Alternatives considered**:
- *SQLite in the browser (WASM) with FTS5*: strong full-text search, but a ~1 MB engine, no
  built-in typo tolerance, and harder to tune ranking. Worth revisiting if the corpus grows a
  lot.
- *FlexSearch*: faster, but weaker typo tolerance and less precise match details for
  highlighting.
- *Hosted search service (Meilisearch, Algolia)*: excellent typo tolerance, but needs a network
  connection, which breaks FR-018.

**Normalisation rules** (shared by indexing and querying, FR-005):
Unicode NFD, then remove combining accents, lowercase, `œ`→`oe`, `æ`→`ae`, split on spaces,
punctuation, and both apostrophe forms (`'` and `’`). The displayed text is never modified
(FR-020).

## 4. Data storage

**Decision**: Three layers.

1. **Source of truth, in the repository**: plain JSON files under `content/`: one file listing
   the hymnals, and one file per hymn holding its lyrics, credits, source and all its
   hymnal/number entries. Files are validated against a schema
   ([contracts/content-schema.md](./contracts/content-schema.md)).
2. **Build output, published with the app**: a build script
   (`scripts/build-data.ts`) checks the content and keeps only hymns whose rights are
   confirmed (FR-019). It then writes one compact data file and the pre-built search index,
   each named after a hash of its content.
3. **On the device**: the service worker stores the app, the data file and the index in the
   browser cache for offline use. Reading preferences (text size, light/dark mode) are stored
   in `localStorage`, separate from hymn data (Principle IV).

**Rationale**:
- Text files in git give a full history of every lyric change: who changed what, when, and why
  (Principle III).
- Adding a hymnal means adding data files and rebuilding, with no code change (Principle IV).
- Hymns without confirmed rights are never published at all, which is safer than hiding them
  in the app.
- No database server and no account: nothing to run or secure in this feature.

**Alternatives considered**:
- *Hosted database (Postgres, Supabase, Firebase)*: needed only once there are user accounts or
  syncing between devices (favourites, playlists). Not needed here (YAGNI).
- *IndexedDB on the device*: unnecessary while the whole collection fits in a few cached
  files. To be revisited for user data (favourites) in a later feature.
- *One file per hymnal*: would duplicate a hymn that appears in several hymnals, which goes
  against the unified model of Principle IV.

## 5. Sample data

**Decision**: Ship a small sample collection under `content/` with public-domain lyrics only:
two hymnals, about 20 hymns each, at least one hymn present in both, and some hymns with suffixed
numbers (e.g. "123a").

**Rationale**: The hymnal import is a separate feature with unresolved rights questions.
Public-domain texts (e.g. *À toi la gloire*, Edmond Budry, 1884) let the app and the search be
tested on real French hymns now, without any rights risk.

## 6. Testing

**Decision**:
- **Vitest** for unit tests: normalisation, number-query parsing, ranking, excerpts, content
  validation.
- **Reference query suite**: a versioned file of ≥ 50 queries with the expected hymn and
  required rank, run with Vitest against the sample collection (SC-003 and the constitution's
  quality rules).
- **Playwright** for end-to-end tests on a mobile viewport: one test per user story, a light
  and dark mode check, an offline test (network cut after the first visit, SC-006), and
  accessibility checks with `@axe-core/playwright` (WCAG 2.2 AA).
- A **performance test** that times searches on a synthetic collection of 6,000 hymns, to check
  the 200 ms target (SC-002) without waiting for the real import.

## 7. Hosting

**Decision**: Any static host (GitHub Pages, Cloudflare Pages or Netlify). The choice can wait
until the first deployment; nothing in the app depends on it.

## 8. Tooling

**Decision**: Node.js 22 LTS (already installed) with npm. No extra package manager.
