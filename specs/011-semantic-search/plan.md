# Implementation Plan: Semantic search

**Branch**: `011-semantic-search` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-semantic-search/spec.md`

## Summary

Users can press « Par le sens » to find hymns by theme or idea, not only by the words they
remember. The result is one list that blends meaning and word matches. Exact titles stay first.

Approach, in the three steps of the request:

1. **Build (offline, maintainer)**: `npm run data` turns each distinct stanza of each published
   hymn into a vector with `text-embedding-3-large` through the Mammouth AI API (maintainer's
   credits). It cuts the vectors to 512 dims, quantises them to int8 (about 5 MB) and writes
   them next to the catalog. A local cache means only new or changed stanzas are embedded again.
2. **Query (online)**: a small Cloudflare Worker, added to the existing static deployment at
   `POST /api/embed`, turns the query into a vector with the same model and the same cutting
   code. It holds the API key, checks the configuration version, and limits length and rate.
3. **Ranking (offline, device)**: the existing search Web Worker compares the query vector with
   every stanza (about 10 ms). It keeps each hymn's best stanza, then blends with word search by
   Reciprocal Rank Fusion.

The meaning data is downloaded in the background once the app is idle, cached apart from the
precache. The last 50 query vectors are kept, so repeated searches work offline.

What to index (stanza alone, with title, or with a generated theme description) and the blend
weights are chosen by a measured comparison on a versioned set of 40+ reference queries. There
is no reranker (Q2). See [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22 (build, tests), browsers (app), and the
Cloudflare Workers runtime (new `worker/`)

**Primary Dependencies**: Existing: SvelteKit 2 / Svelte 5 (`adapter-static`),
`@vite-pwa/sveltekit` (Workbox), MiniSearch, Zod. New: the Mammouth AI API (OpenAI-compatible
embeddings, model `text-embedding-3-large`), an external service with no SDK, called with
`fetch`. Dev only: `wrangler` and `@cloudflare/workers-types`. Theme descriptions, only if
measured: the Claude Message Batches API (`claude-haiku-5-5`), called from a maintainer script
through the official SDK `@anthropic-ai/sdk` (dev dependency; changed from `fetch` at
implementation, as the Claude API guidance requires the SDK in a TypeScript project).

**Storage**:

- `static/data/` build output: two new hashed binary files and a `meaning` entry in
  `manifest.json` ([contracts/meaning-data.md](./contracts/meaning-data.md)).
- `.cache/embeddings/` (git-ignored) on the maintainer's machine.
- `content/generated/themes.json` (versioned, only if used).
- On the device: a Workbox runtime cache `hymnia-meaning`, plus `localStorage`
  `hymnia.meaning.queries` (last 50 query vectors).
- The edge cache of the Worker.

**Testing**: Vitest:

- unit: vector cut, normalise and quantise; row map; ranking; fusion; query cache; embed client;
  Worker handler with a fake upstream;
- `queries`: a meaning reference set with committed query vectors, so it runs offline;
- `perf`: 20,000 × 512 synthetic rows.

Playwright: `us15-meaning-search.spec.ts`, with `/api/embed` mocked, offline, axe, light and dark.

**Target Platform**: Current mobile and desktop browsers (PWA, as feature 001), plus Cloudflare
Workers for `/api/*`.

**Project Type**: Offline-first static web app, plus one serverless route in the same deployment

**Performance Goals**:

- Results within 2 s of the button press on a typical mobile network, and within 300 ms for a
  repeated query (SC-003).
- Device ranking under 50 ms for about 10,000 rows.
- Word search stays under 200 ms and is untouched (SC-006).

**Constraints**:

- Meaning data at most 10 MB (SC-004); the build fails above that. The comparison may raise it
  to 20 MB with 1,024 dims, only on a gain of at least 3 top-10 points (research R4).
- Query at most 500 characters; client timeout 10 s; offline message within 1 s.
- No query text or identity is logged.
- Only published hymns are indexed.
- Generated text is never shown.

**Scale/Scope**: 2,730 hymns, 10,042 distinct stanzas today, growing with each hymnal (about
20,000 rows planned for). A handful of users, so a low query rate. One new button and its status
states on the search screen.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Status |
|-----------|-----------------------|--------|
| I. Advanced search at the core | Search by meaning is an explicit goal. It **adds to** word search: typing still gives word results live, unchanged, and the blended list keeps exact titles first. Meaning data loads only at the first search by meaning, so the 200 ms word-search budget is not touched (SC-006, existing perf test kept). | ✅ |
| II. Clean, text-centred design | One button beside the field and one status line. The reading view is unchanged. | ✅ |
| III. Faithful text and rights | Lyrics are never modified. Theme descriptions are stored apart, marked generated, absent from the catalog, and a test checks they are never displayed (FR-022, SC-008). Only hymns published by the build are indexed. Lyrics are sent to processors (Mammouth → OpenAI; Claude if themes are used) at build time to derive data. This is not publication, and vectors cannot be read back as text (research R12). | ✅ |
| IV. Unified multi-hymnal model | One hymn is indexed once, whatever its hymnals. A new hymnal is indexed by the next build with no code change. Query vectors (user data) are kept apart from hymn data. | ✅ |
| V. Simplicity, incremental delivery | No new runtime npm dependency: `fetch`, typed arrays, Workbox runtime caching. Exhaustive ranking, no vector index. No reranker. **But** this adds the app's first server code and an external paid API. See Complexity Tracking. Search, build and fusion are covered by tests. | ⚠ justified |
| VI. Accessibility, real-world use | Ranking and repeated queries work offline. A clear message when offline, so word search is never blocked. Labelled button with `aria-pressed`, `aria-live` status, keyboard-reachable cancel. Mobile first. | ✅ |
| Content and sources | The meaning build is a versioned script in `scripts/semantic/`. It can be run again with the same result (embedding cache, content-hashed files), and makes no change to `content/` hymns. | ✅ |
| Workflow and quality | New versioned reference set `tests/queries/meaning-queries.json` (≥ 40) and recorded comparison (`meaning-evaluation.json`). The word-search reference queries still pass unchanged. UI checked on mobile in light and dark. | ✅ |

**Result**: Passed before research, with one justified deviation (V). Re-checked after design:
unchanged. The design adds no further dependency, and the Worker is limited to one route.

## Project Structure

### Documentation (this feature)

```text
specs/011-semantic-search/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R12 decisions (provider, representation, size, fusion…)
├── data-model.md        # Phase 1: MeaningConfig, IndexedStanza, MeaningData, QueryVector…
├── quickstart.md        # Phase 1: how to build, evaluate, test and deploy
├── contracts/
│   ├── embed-api.md     # POST /api/embed
│   ├── meaning-data.md  # manifest entry + binary files
│   └── meaning-search.md# worker messages, blended ranking, UI states
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/lib/meaning/                 # NEW, shared by app, worker, build and Worker
├── config.ts                    # MeaningConfig (model, representation, dims, fusion) + id
├── vector.ts                    # cut + L2-normalise, int8 quantise, base64 ⇄ Float32Array
├── stanzas.ts                   # indexed texts per hymn: dedupe repeats, merge short sections
├── rank.ts                      # dot product over rows, best row per hymn, filter, top-N
├── fuse.ts                      # RRF + exact-title pinning + excerpt choice
├── query-cache.ts               # localStorage LRU of 50 query vectors
└── embed-client.ts              # POST /api/embed: timeout 10 s, abort, offline, error mapping

src/lib/search/
├── worker.ts                    # + meaning-prefetch / meaning-search messages, lazy load
├── client.ts                    # + meaning search and status API
├── engine.ts                    # unchanged ranking; used as the word list for fusion
└── types.ts                     # + kind 'meaning', matchedBy, tier 6
src/lib/domain/schema.ts         # DataManifest.meaning (optional)
src/lib/components/SearchBox.svelte    # + « Par le sens » button
src/lib/components/MeaningStatus.svelte# NEW: waiting / preparing / error line with Annuler
src/routes/+page.svelte          # mode words|meaning, `sens=1` in URL, idle prefetch

worker/
└── index.ts                     # NEW: Cloudflare Worker, POST /api/embed (contracts/embed-api.md)

scripts/
├── build-data.ts                # calls buildMeaningData; maxBytes check; manifest.meaning
└── semantic/                    # NEW
    ├── build.ts                 # rows + vectors files from the catalog and the cache
    ├── embed.ts                 # Mammouth batches, retries, .cache/embeddings/<model>.jsonl
    ├── smoke.ts                 # first task: endpoint and model check
    ├── evaluate.ts              # candidates × reference set → meaning-evaluation.json
    └── generate-themes.ts       # only if measured: Claude Batches → content/generated/themes.json

tests/
├── unit/meaning-*.test.ts       # vector, stanzas, rank, fuse, query-cache, embed-client, worker
├── queries/
│   ├── meaning-queries.json     # ≥ 40 reference queries (FR-019)
│   ├── meaning-query-vectors.json   # committed vectors for the current configId
│   ├── meaning-evaluation.json  # recorded comparison (FR-021)
│   └── meaning.test.ts          # SC-001 / SC-002, ids exist, no generated text in catalog
├── perf/meaning.perf.test.ts
└── e2e/us15-meaning-search.spec.ts

vite.config.ts                   # globIgnores **/meaning*; runtimeCaching CacheFirst hymnia-meaning
wrangler.jsonc                   # main, assets.run_worker_first ["/api/*"], ratelimits binding
.env.example                     # MAMMOUTH_API_KEY, EMBEDDINGS_BASE_URL, EMBEDDINGS_MODEL
.gitignore                       # .cache/
```

**Structure Decision**: The single static web project stays. The meaning logic sits in
`src/lib/meaning/` as pure modules, so the same code runs in the build (Node), the search Web
Worker and the Cloudflare Worker. In particular `vector.ts` and `config.ts` guarantee that query
and stanza vectors are made the same way. The Cloudflare Worker lives in a top-level `worker/`
with one file, because it is not part of the SvelteKit app. Maintainer scripts go to
`scripts/semantic/`, as the constitution and the home conventions require.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| First server code: a Cloudflare Worker for `POST /api/embed` | A query must be turned into a vector by the same model as the stanzas. That needs the API key, which must never ship to the device. | Calling Mammouth from the browser exposes the key. Running a model in the browser means a 100–600 MB download per device (SC-004). Doing the whole search on the server would break offline ranking, which the user asked for. |
| External paid API (Mammouth AI, `text-embedding-3-large`) | The maintainer's choice, on existing credits. The model is multilingual and strong in French. Total cost is under $1 per full index. | Cloudflare Workers AI is free-tier and needs no secret, but the maintainer prefers Mammouth. It stays the documented fallback (research R1). |
| Optional generated theme descriptions (Claude) | It may be the only way to find hymns by occasion ("enterrement", "baptême") when the lyrics never use those words. | Kept only if the measured comparison shows a gain (FR-021). Otherwise the script and file are dropped. |
