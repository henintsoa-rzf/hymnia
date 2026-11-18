---

description: "Task list for semantic search (search by meaning)"
---

# Tasks: Semantic search

**Input**: Design documents from `/specs/011-semantic-search/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R12), data-model.md, contracts/embed-api.md,
contracts/meaning-data.md, contracts/meaning-search.md, quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for search. The
constitution's workflow requires a versioned reference query set for any search change
(FR-019). Write each test task before the code task it covers, and see it fail first.

**Organization**: Tasks are grouped by user story (US1–US4 of spec.md):
- US1: find a hymn by its meaning (blended list);
- US2: weak or no connection (offline repeats, messages, background download);
- US3: choose what to index by measurement;
- US4: keep the index in step with the hymns.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

This is a single project at the repository root (plan.md, "Project Structure"):
- shared pure modules go in `src/lib/meaning/`. They are imported by the app, the search Web
  Worker, the build (Node) and the Cloudflare Worker, so they use no DOM, Node or Workers-only
  API;
- the Cloudflare Worker is in `worker/index.ts`;
- maintainer scripts are in `scripts/semantic/`;
- tests are in `tests/unit/meaning-*.test.ts`, `tests/queries/meaning*.{json,test.ts}`,
  `tests/perf/meaning.perf.test.ts` and `tests/e2e/us15-meaning-search.spec.ts`.

Values used everywhere (from research.md and the contracts):
- model `text-embedding-3-large`, full vectors of 3,072 dims;
- base URL `https://api.mammouth.ai/v1`;
- env `MAMMOUTH_API_KEY`, `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_MODEL`;
- initial `configId` `te3-large/title+stanza/512/i8/v1`;
- size limit `maxBytes` 10 MB (20 MB only under the rule in research R4);
- query limit 500 characters; client timeout 10 s; upstream timeout 8 s;
- rate limit 30 requests per 60 s; query cache of 50; fusion `k = 60`.

Patterns to copy:
- **localStorage store with validation**: `src/lib/history/store.ts` and
  `src/lib/history/schema.ts`.
- **Worker messages and dropping stale replies**: `src/lib/search/worker.ts` and
  `src/lib/search/client.ts`.
- **Build output and size check**: `writeOutput()` and `main()` in `scripts/build-data.ts`.
- **Reference query tests**: `tests/queries/reference.test.ts`.
- **Perf corpus**: `tests/perf/generate-corpus.ts`.
- **E2E helpers**: `tests/e2e/helpers.ts`.

**Network and secrets**: only `scripts/semantic/*` and `worker/index.ts` call the embeddings
API. Unit, query and e2e tests never touch the network: they use the fake embedder (T010) or
committed vectors. Never print or commit `MAMMOUTH_API_KEY`. Put any throwaway script in
`~/9-scratch/`, never in the repository or directly in `~`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Check the provider, then add configuration and tooling.

- [X] T001 Write `scripts/semantic/smoke.ts`. It reads `.env` (`process.loadEnvFile`), calls
  `POST ${EMBEDDINGS_BASE_URL ?? 'https://api.mammouth.ai/v1'}/embeddings` with
  `{ model: EMBEDDINGS_MODEL ?? 'text-embedding-3-large', input: [argv[2]] }` and
  `Authorization: Bearer ${MAMMOUTH_API_KEY}`. It prints
  `OK <model> <dims> dims via <base>`, or the HTTP status and error body without the key. Run
  it: `npx tsx scripts/semantic/smoke.ts "la fidélité de Dieu"`. **STOP and report to the
  maintainer** if the status is not 200 or the vector length is not 3072 (research R1,
  fallback decision).
- [X] T002 [P] Add `MAMMOUTH_API_KEY=`, `# EMBEDDINGS_BASE_URL=https://api.mammouth.ai/v1` and
  `# EMBEDDINGS_MODEL=text-embedding-3-large` to `.env.example`, each with a one-line comment.
  Add `.cache/` to `.gitignore`.
- [X] T003 [P] Add the dev dependencies `wrangler` and `@cloudflare/workers-types`
  (`npm install -D`). Create `worker/tsconfig.json`, which extends the root config with
  `types: ["@cloudflare/workers-types"]` and `include: ["index.ts", "../src/lib/meaning/**"]`.
  Make sure `npm run check` and `npm run lint` still pass, adding `worker/` to the eslint and
  prettier scope.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared meaning modules, the build step and the ranking that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Write `tests/unit/meaning-vector.test.ts` for `src/lib/meaning/vector.ts`:
  - `cutAndNormalize(v: Float32Array, dims)` keeps the first `dims` values and gives L2 norm 1;
  - `quantizeInt8(v)` returns `{ q: Int8Array, scale }` with `scale = maxAbs / 127`, and
    `dot(dequantized, v) > 0.999` for a random unit vector;
  - `dotInt8(query, rows, row, dims) * scale` equals the float dot product within 1e-2;
  - `toBase64(Float32Array)` and `fromBase64` round-trip, little-endian.
- [X] T005 [P] Write `tests/unit/meaning-config.test.ts` for `src/lib/meaning/config.ts`:
  - `configId(config)` gives `te3-large/title+stanza/512/i8/v1` for the default;
  - changing `representation`, `dims` or `rev` changes the id;
  - `MEANING_CONFIG.maxBytes === 10 * 1024 * 1024`;
  - `fusion` is `{ k: 60, wMeaning: 1, wWords: 1 }`;
  - `minSectionChars === 40`.
- [X] T006 [P] Implement `src/lib/meaning/vector.ts` (T004 must pass). Use pure typed-array
  code, with no dependency.
- [X] T007 [P] Implement `src/lib/meaning/config.ts` (T005 must pass), following the
  MeaningConfig table of data-model.md:
  - `model: 'text-embedding-3-large'`;
  - `representation: 'stanza' | 'title+stanza' | 'title+theme+stanza'`;
  - `dims: 256 | 512 | 1024`, `quant: 'i8'`, `rev`;
  - `fusion`, `minSectionChars: 40`, `maxBytes`;
  - `FULL_DIMS = 3072`;
  - `export const MEANING_CONFIG` holds the shipped configuration, and
    `configId(c)` returns `<modelShort>/<representation>/<dims>/<quant>/v<rev>`.
- [X] T008 [P] Write `tests/unit/meaning-stanzas.test.ts` for `src/lib/meaning/stanzas.ts`,
  using `PublishedHymn` objects built inline:
  - a chorus repeated 3 times with identical lines gives 1 indexed text;
  - a section under 40 characters joins the previous section, or the next one when it is first,
    and `section` points to the first section of the group;
  - `indexedText` follows the representation: `stanza` gives the lines joined by `\n`;
    `title+stanza` gives `<title>\n\n<stanza>`; `title+theme+stanza` gives
    `<title> — <theme>\n\n<stanza>` and throws if the theme is missing;
  - the lyrics passed in are never mutated.
- [X] T009 Implement `src/lib/meaning/stanzas.ts` (T008 must pass):
  `indexedStanzas(hymn, hymnIndex, representation, themes?) → { hymnIndex, section, text }[]`.
- [X] T010 [P] Create `tests/helpers/fake-embedder.ts`, a deterministic embedder for tests and
  e2e. It normalises the text with `normalizeText` from `src/lib/search/normalize.ts`, hashes
  each word into a 3,072-dim bag of words with a fixed seed, then L2-normalises. Texts sharing
  words get close vectors. Export `fakeEmbed(texts: string[]): Promise<Float32Array[]>`.
- [X] T011 [P] Add the optional `meaning?: { configId: string; dims: number; rows: number;
  vectors: string; rowMap: string; bytes: number }` to `DataManifest` in
  `src/lib/domain/schema.ts` (contracts/meaning-data.md).
- [X] T012 Write `tests/unit/meaning-embed-cache.test.ts` for `scripts/semantic/embed.ts`, with
  a temporary directory and an injected `embedBatch` spy:
  - texts already in `.cache/embeddings/<model>.jsonl` are not sent;
  - new ones are sent in batches of at most 100, with at most 4 in parallel;
  - a 429 or 5xx is retried with backoff, and other 4xx are not;
  - each line is `{ key: sha256(model + text), vector: base64 float32 of 3072 }`;
  - the result reports `{ embedded, cached }`.
- [X] T013 Implement `scripts/semantic/embed.ts` (T012 must pass):
  - `createEmbedder({ baseUrl, model, apiKey, cacheDir, embedBatch? })` with
    `embed(texts) → { vectors: Float32Array[], embedded, cached }`;
  - the default `embedBatch` POSTs `<baseUrl>/embeddings` as in T001;
  - `hasCredentials()` for the build's skip rule.
- [X] T014 Write `tests/unit/meaning-build.test.ts` for `scripts/semantic/build.ts`, on the
  sample content (`loadSample()` from `tests/helpers/sample.ts`) with `fakeEmbed`:
  - `vectors.byteLength === rows * dims`;
  - `rowMap` is 8 bytes per row (uint16 `hymnIndex`, uint16 `section`, float32 `scale`,
    little-endian);
  - rows are ordered by `hymnIndex` then `section`;
  - every published hymn with at least one section has at least one row;
  - with no credentials and an incomplete cache, the result is `{ skipped: 'no-credentials' }`;
  - when the size is over `maxBytes`, the build returns an error.
- [X] T015 Implement `scripts/semantic/build.ts` (T014 must pass):
  - `buildMeaningData(catalog, config, embedder, themes?)` returns
    `{ vectors: Uint8Array, rowMap: Uint8Array, rows, report }`, or `{ skipped }`;
  - it uses `indexedStanzas`, then `cutAndNormalize` to `config.dims`, then `quantizeInt8`.
- [X] T016 Wire the meaning step into `scripts/build-data.ts`:
  - after `buildData`, call `buildMeaningData` with `MEANING_CONFIG` and `createEmbedder`. When
    `HYMNIA_FAKE_EMBEDDER=1`, use `fakeEmbed` instead (for e2e);
  - write `meaning.<hash>.bin` and `meaning-rows.<hash>.bin` with `hash()` and add
    `manifest.meaning`;
  - print `  meaning: <configId> — <rows> rows, <MB> MB (embedded N, cached M)`;
  - exit 1 when `bytes > MEANING_CONFIG.maxBytes`;
  - when skipped, print one warning, `⚠ meaning data skipped (no MAMMOUTH_API_KEY and
    incomplete cache)`, and still succeed;
  - add a case to `tests/unit/build-data.test.ts` checking that the manifest has no `meaning`
    when skipped.
- [X] T017 [P] Write `tests/unit/meaning-rank.test.ts` for `src/lib/meaning/rank.ts`, with
  small hand-made rows:
  - the best row per hymn is kept, and a hymn appears once;
  - hymns outside the allowed hymnals are dropped (entries of `PublishedHymn`);
  - the top N are sorted by score, with ties broken by catalog order;
  - the result has `{ hymnIndex, section, score }`;
  - a query whose `dims` differs from the data throws.
- [X] T018 [P] Write `tests/unit/meaning-fuse.test.ts` for `src/lib/meaning/fuse.ts`
  (contracts/meaning-search.md, "Ranking"):
  - word tier-2 results (exact title) come first, in word order;
  - the others are sorted by `wMeaning/(k+rankMeaning) + wWords/(k+rankWords)`, with ties
    broken by meaning rank;
  - a hymn in both lists appears once with `matchedBy: 'both'`;
  - meaning-only results have `tier: 6` and an excerpt of the best stanza's first 2 lines,
    ≤ 160 characters, with no highlights;
  - the excerpt comes from the source with the larger term;
  - the output is cut to `limit`.
- [X] T019 Implement `src/lib/meaning/rank.ts` (T017 must pass). Use one exhaustive pass over
  the `Int8Array` with `dotInt8`, multiplied by `scale`.
- [X] T020 Implement `src/lib/meaning/fuse.ts` (T018 must pass). Extend `src/lib/search/types.ts`:
  - `SearchKind` gets `'meaning'`;
  - `Tier` gets `6`;
  - `SearchResult` gets `matchedBy?: 'words' | 'meaning' | 'both'`.

**Checkpoint**: `npm test` passes. `HYMNIA_FAKE_EMBEDDER=1 npm run data` writes meaning files and
`manifest.meaning`. Without a key and with an empty cache, `npm run data` warns and succeeds.

---

## Phase 3: User Story 1 - Find a hymn by its meaning (Priority: P1) 🎯 MVP

**Goal**: The user types a query, presses « Par le sens » and gets up to 50 hymns in one list
that blends meaning and word matches. Exact titles come first, the hymnal filter is respected,
and each result opens its hymn.

**Independent Test**: Run `npm run test:e2e -- us15`, with `/api/embed` mocked from
`fakeEmbed`, on the sample content built with `HYMNIA_FAKE_EMBEDDER=1`. Manually, run
quickstart §4 steps 2–4 with `npx wrangler dev`.

### Tests for User Story 1

- [X] T021 [P] [US1] Write `tests/unit/meaning-worker-api.test.ts` for `worker/index.ts`
  (contracts/embed-api.md). Call the exported `handle(request, env, ctx)` with a fake
  `env.MAMMOUTH_API_KEY`, a fake upstream `fetch`, a fake `EMBED_LIMIT.limit()` and a fake
  cache. Check:
  - 200 `{ configId, dims: 512, vector }` with the vector cut to 512 and a norm of 1;
  - 400 for bad JSON or empty text;
  - 409 `{ error: 'config', expected }` for another `configId`;
  - 413 for 501 code points;
  - 429 with `Retry-After` when the limit is refused;
  - 502 on an upstream error, and 503 on an upstream timeout over 8 s;
  - 404 JSON for `GET /api/embed` and `/api/other`;
  - a cache hit makes no upstream call;
  - no `console.*` call contains the query text.
- [X] T022 [P] [US1] Write `tests/unit/meaning-embed-client.test.ts` for the online path of
  `src/lib/meaning/embed-client.ts`, with a fake `fetch`:
  - a 200 returns a `Float32Array` of `dims`;
  - a reply whose `configId` or `dims` differs is rejected as `'config'`;
  - 409 maps to `'config'`, 413 and 400 to `'failed'`, and 502/503 to `'unavailable'`.
- [X] T023 [P] [US1] Write `tests/e2e/us15-meaning-search.spec.ts`, US1 part. Mock
  `**/api/embed` with `page.route`, answering with `fakeEmbed` of the posted text, and check:
  - the « Par le sens » button is absent for an empty query, `CE 1` and `12`, and present for
    text;
  - pressing it shows « Résultats par le sens » and results with excerpts;
  - an exact sample title stays first;
  - with the CE filter, only CE hymns are listed;
  - tapping a result opens it at its `primaryRef`;
  - editing the query removes `sens=1` from the URL and shows word results;
  - pressing it with a 600-character query shows « Recherche limitée aux 500 premiers
    caractères » and posts 500 characters.

### Implementation for User Story 1

- [X] T024 [US1] Implement `worker/index.ts` (T021 must pass):
  - `export default { fetch: handle }`, with `handle` exported for tests;
  - validate, then rate-limit with `env.EMBED_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') })`;
  - look up `caches.default`, keyed by `configId` + normalised text (NFC, lower case, collapsed
    spaces);
  - call upstream with an 8 s `AbortSignal.timeout`;
  - `cutAndNormalize` to `MEANING_CONFIG.dims`, then `toBase64`;
  - cache with `Cache-Control: max-age=2592000`;
  - log nothing but status.
- [X] T025 [US1] Update `wrangler.jsonc`:
  - `main: "worker/index.ts"`;
  - `assets.run_worker_first: ["/api/*"]` and `assets.binding: "ASSETS"`, keeping
    `not_found_handling`;
  - `ratelimits: [{ name: "EMBED_LIMIT", namespace_id: "1101", simple: { limit: 30, period: 60 } }]`;
  - `observability: { logs: { enabled: true, invocation_logs: false } }`;
  - add a comment that the secret is set with `wrangler secret put MAMMOUTH_API_KEY`.

  Check with `npx wrangler deploy --dry-run`.
- [X] T026 [US1] Implement the online path of `src/lib/meaning/embed-client.ts` (T022 must
  pass): `embedQuery(text, configId, { fetchFn, signal }) → { ok: true, vector } | { ok: false,
  reason: 'config' | 'failed' | 'unavailable' | 'rate' | 'offline' | 'timeout' | 'cancelled' }`.
  It cuts the text to 500 code points and returns `truncated: true` when it does.
- [X] T027 [US1] Extend `src/lib/search/worker.ts`:
  - add the messages `meaning-search` and `meaning-result` (contracts/meaning-search.md);
  - on the first `meaning-search`, read `manifest.meaning` (through `fetchData` in
    `src/lib/data/catalog.ts`, which then also returns the manifest), fetch both files and
    check that `rows` matches and every `hymnIndex < catalog.hymns.length`; otherwise post
    status `failed`;
  - then `rankMeaning` (top 100), `engine.search({ query, hymnals, limit: 100 })` and `fuse`,
    to give a `SearchResponse` with `kind: 'meaning'`;
  - answer only the latest id, as for word search.
- [X] T028 [US1] Extend `src/lib/search/client.ts`:
  - `searchMeaning(request, vector, configId)`, which resolves `null` when superseded;
  - `meaningStatus` (a subscribable store, or a callback, from `meaning-status` messages);
  - `meaningConfig()`, which returns `manifest.meaning` or `undefined`.
- [X] T029 [P] [US1] Add the « Par le sens » button to `src/lib/components/SearchBox.svelte`,
  using the props `meaningAvailable: boolean`, `meaningActive: boolean` and `onmeaning`:
  - a text label with an icon, `type="button"`, and `aria-pressed={meaningActive}`;
  - shown only when `meaningAvailable` and `parseQuery(value).kind === 'text'`;
  - a 44 px touch target, in light and dark (design tokens).
- [X] T030 [US1] Wire the meaning mode into `src/routes/+page.svelte`:
  - `mode: 'words' | 'meaning'`, with `sens=1` in the URL next to `q` and `recueils`;
  - on press, call `embedQuery`, then `client.searchMeaning`, and show the response in
    `ResultList` under the label « Résultats par le sens »;
  - any edit of the query returns to word mode and drops `sens=1` (US1 scenario 7);
  - loading a URL with `sens=1` re-runs the meaning search;
  - show the truncation note when `truncated`.
- [X] T031 [US1] Make `src/lib/components/ResultList.svelte` show a meaning excerpt (empty
  `highlights`) the same way as word excerpts, with no visual badge (constitution II). Check
  that `tier: 6` results render.
- [X] T032 [US1] Build the e2e data with meaning data: in `playwright.config.ts`, prefix the
  `webServer` command with `HYMNIA_FAKE_EMBEDDER=1`. Export the fake vectors for the route mock
  from `tests/e2e/helpers.ts`. Make T023 pass on both projects (android, iphone).

**Checkpoint**: Search by meaning works online, end to end, with the default configuration.

---

## Phase 4: User Story 2 - Search by meaning with a weak or no connection (Priority: P1)

**Goal**:
- Repeated queries work offline.
- New queries offline get a clear message within 1 s.
- Slow replies can be cancelled and time out at 10 s.
- The meaning data downloads in the background once the app is idle, and never in the precache.

**Independent Test**: Run the US2 part of `tests/e2e/us15-meaning-search.spec.ts` with
`context.setOffline(true)`, plus quickstart §4 steps 1 and 5.

### Tests for User Story 2

- [X] T033 [P] [US2] Write `tests/unit/meaning-query-cache.test.ts` for
  `src/lib/meaning/query-cache.ts`, with a fake storage as in
  `tests/unit/history-storage.test.ts`. Data model: `{ v: 1, configId, items: { key, vector,
  usedAt }[] }`, "At most 50 items, least recently used dropped first". Check:
  - keys are normalised (NFC, lower case, trimmed, collapsed spaces), so « Grâce  divine » and
    « grâce divine » are one entry;
  - the 51st entry drops the least recently used one, and `get` refreshes `usedAt`;
  - a store with another `configId` or invalid JSON is dropped whole;
  - storage errors are swallowed (private mode).
- [X] T034 [P] [US2] Extend `tests/unit/meaning-embed-client.test.ts`:
  - with `navigator.onLine === false`, it returns `'offline'` without calling `fetch`;
  - a network `TypeError` gives `'offline'`;
  - no reply within 10 s (fake timers) gives `'timeout'`;
  - aborting gives `'cancelled'`;
  - 429 gives `'rate'`;
  - failures are never written to the query cache.
- [X] T035 [P] [US2] Extend `tests/e2e/us15-meaning-search.spec.ts` with US2:
  - after one online meaning search, go offline and repeat it: results appear without a
    request, checked with `page.route` call counts;
  - offline with a new query, « La recherche par le sens nécessite une connexion » appears
    within 1 s and word results stay;
  - a mock that delays 15 s shows « Recherche par le sens… », then « Annuler » cancels;
  - Cache Storage `hymnia-meaning` holds both `meaning*` files after idle;
  - the precache manifest lists no `meaning` file.

### Implementation for User Story 2

- [X] T036 [US2] Implement `src/lib/meaning/query-cache.ts` (T033 must pass), following
  `src/lib/history/store.ts`. The key is `hymnia.meaning.queries`, and the store exports
  `getQueryVector(configId, text)` and `putQueryVector(configId, text, vector)`.
- [X] T037 [US2] Complete `src/lib/meaning/embed-client.ts` (T034 must pass):
  - check offline first;
  - add `AbortSignal.any([userSignal, AbortSignal.timeout(10_000)])`;
  - map errors to reasons;
  - look up the query cache before any call, and write to it only on success.
- [X] T038 [P] [US2] Create `src/lib/components/MeaningStatus.svelte`:
  - one status line in a polite `aria-live` region, for the states waiting, preparing (with a
    %), offline, timeout, rate, unavailable, config (with the existing reload action from
    `UpdatePrompt.svelte`) and failed;
  - use the exact French messages of contracts/embed-api.md and contracts/meaning-search.md;
  - « Annuler » is a keyboard-reachable button shown while waiting or preparing.
- [X] T039 [US2] Exclude the meaning files from the precache and cache them at runtime, in
  `vite.config.ts`:
  - add `'**/meaning*'` to `generateSW.globIgnores`;
  - add `runtimeCaching: [{ urlPattern: ({ url }) => /\/data\/meaning[^/]*\.bin$/.test(url.pathname),
    handler: 'CacheFirst', options: { cacheName: 'hymnia-meaning', expiration: { maxEntries: 4 } } }]`.
- [X] T040 [US2] Add the background download to `src/lib/search/worker.ts`:
  - a `meaning-prefetch` message fetches both files and reads the body stream to post
    `meaning-status` `{ state: 'downloading', loaded, total: manifest.meaning.bytes }`, then
    `ready` or `failed`;
  - a `meaning-search` that arrives during the download waits for it, then runs;
  - with no `manifest.meaning`, it posts `unavailable`.
- [X] T041 [US2] Start the idle prefetch from `src/routes/+layout.svelte`:
  - once the search client is ready, use `requestIdleCallback`, or `setTimeout(…, 5000)` where
    it is missing, to send `meaning-prefetch`;
  - skip it when `navigator.connection?.saveData`, in which case the first meaning search
    triggers the download;
  - retry once on the next app start after `failed`.
- [X] T042 [US2] Use `MeaningStatus` in `src/routes/+page.svelte`:
  - show it between the field and the results;
  - word results stay visible in every error state;
  - « Annuler » aborts `embedQuery` and returns to word mode.

  Make T035 pass.

**Checkpoint**: US1 and US2 both work. Word search is unaffected offline.

---

## Phase 5: User Story 3 - Choose what to index, based on measured results (Priority: P1)

**Goal**: A versioned set of 40+ reference queries, a reproducible comparison of
representations, dims, int8 against float and blend weights, and a recorded choice that sets
`MEANING_CONFIG`, including the 10 MB / 20 MB rule.

**Independent Test**: `npx tsx scripts/semantic/evaluate.ts` prints the table and writes
`tests/queries/meaning-evaluation.json`. `npm run test:queries` passes `meaning.test.ts`.

### Tests for User Story 3

- [X] T043 [P] [US3] Write `tests/queries/meaning-queries.test.ts`, which checks
  `tests/queries/meaning-queries.json` against the real content (`content/`, built in memory
  with personal use as in the other real-content query tests):
  - at least 40 entries;
  - every category of data-model.md (`theme`, `occasion`, `short`, `long`, `bible`,
    `paraphrase`) appears at least 3 times;
  - every `expect` id exists;
  - no duplicate `id`.
- [X] T044 [P] [US3] Write `tests/queries/meaning.test.ts`. It loads the built
  `static/data/manifest.json` and the meaning files, plus the committed
  `tests/queries/meaning-query-vectors.json`, and skips with a notice when `manifest.meaning` is
  absent or its `configId` differs from the vectors file. It asserts:
  - SC-001: ≥ 50% of queries have an expected hymn in the top 10, and ≥ 75% in the top 50,
    using `rank` + `fuse` + `engine`;
  - SC-002: the top-10 count of the blend is ≥ 2 × that of `engine.search` alone;
  - SC-008: no theme description text appears in the catalog JSON.

### Implementation for User Story 3

- [X] T045 [US3] Draft `tests/queries/meaning-queries.json`, about 50 entries of
  `{ id, category, query, expect: string[], note? }`. Use real hymn ids found by reading
  `content/hymns/` (grace, faithfulness, Easter, Christmas, communion, mission, comfort, praise;
  funeral, baptism, wedding; one-word queries; pasted paragraphs; « Psaume 23 », « Jean 3.16 »;
  paraphrases of well-known hymns). **Hand it to the maintainer for review** before T048, and
  record their edits. T043 must pass.
- [X] T046 [P] [US3] Implement `scripts/semantic/generate-themes.ts` (research R11):
  - `--sample N` or all hymns;
  - Claude Message Batches API with model `claude-haiku-5-5`, key `ANTHROPIC_API_KEY` from
    `.env` (add it to `.env.example`);
  - the prompt asks for 1–2 French sentences of ≤ 300 characters on themes and uses, quoting no
    lyrics;
  - write `content/generated/themes.json` as `{ [hymnId]: { text, lyricsHash, model,
    generatedAt } }`;
  - regenerate only when `lyricsHash` (sha256 of the joined lines) changed;
  - reject and log any output that contains a run of 6 consecutive lyric words.

  Run it with `--sample 30` and give the sample to the maintainer to review, then run it on all
  hymns.
- [X] T047 [US3] Implement `scripts/semantic/evaluate.ts`:
  - build every candidate in memory from the embedding cache (`createEmbedder`): representation
    {stanza, title+stanza, title+theme+stanza} × dims {256, 512, 1024} × {float, int8}, plus
    3,072 float as a ceiling;
  - embed the reference queries once (full vectors, cached);
  - for each candidate, compute top1, top10, top50, MRR and bytes, then the blend for the best
    representation over the grid `wMeaning, wWords ∈ {0.5, 1, 1.5, 2}`, and words only;
  - apply FR-021, choosing the best top10 or a smaller candidate within 5 points;
  - apply the size rule of research R4: 1,024 dims ships, with `maxBytes` 20 MB, only if int8
    1,024 beats int8 512 by ≥ 3 top-10 points;
  - print a table and write `tests/queries/meaning-evaluation.json` (data-model.md,
    MeaningEvaluation).
- [X] T048 [US3] Run `npx tsx scripts/semantic/evaluate.ts`. Set the chosen `representation`,
  `dims`, `maxBytes` and `fusion` weights in `src/lib/meaning/config.ts`, bumping `rev` if
  needed. Fill in "Evaluation results" at the end of `specs/011-semantic-search/research.md`
  with the table and the decision. If `title+theme+stanza` is not chosen, delete
  `content/generated/themes.json` and say so there.
- [X] T049 [US3] Write `scripts/semantic/query-vectors.ts`. It embeds every query of
  `meaning-queries.json` through the embedder cache, cuts the vectors to `MEANING_CONFIG.dims`
  and writes `tests/queries/meaning-query-vectors.json` as
  `{ configId, vectors: { [id]: base64 } }`. Run it, run `npm run data`, then make T044 pass.
  If SC-001 fails, report the failing queries to the maintainer rather than editing the
  expectations.

**Checkpoint**: The shipped configuration is chosen by measurement and recorded, and the
regression test guards it.

---

## Phase 6: User Story 4 - Keep the index in step with the hymns (Priority: P2)

**Goal**: Rebuilds re-embed only new or changed stanzas. A change of configuration re-embeds
everything. Devices never mix two builds or two configurations.

**Independent Test**: Run `tests/unit/meaning-incremental.test.ts`, then quickstart §1 run
twice (`embedded 0` the second time).

### Tests for User Story 4

- [X] T050 [P] [US4] Write `tests/unit/meaning-incremental.test.ts`, with sample content, a temp
  cache dir and a counting fake `embedBatch`:
  - a second build of unchanged content embeds 0 texts and writes byte-identical files with
    the same hashes;
  - changing one line of one hymn embeds only that hymn's changed stanzas;
  - adding a hymn embeds only its stanzas;
  - another `representation` re-embeds every text, and another model uses a new cache file.
- [X] T051 [P] [US4] Add to `tests/unit/meaning-worker-api.test.ts` and a new
  `tests/unit/meaning-load.test.ts`:
  - the search worker's loader refuses meaning files whose `rows` or `hymnIndex` do not fit the
    catalog, and posts `failed` (FR-015);
  - a query cache with an old `configId` is dropped (US4 scenario 4).

### Implementation for User Story 4

- [X] T052 [US4] Make T050 and T051 pass. Fix any non-determinism in
  `scripts/semantic/build.ts` (row order, float rounding in `scale`) or in
  `scripts/semantic/embed.ts` (cache write order). Extract the loader check from
  `src/lib/search/worker.ts` into `src/lib/meaning/load.ts` so it is testable.
- [X] T053 [US4] If themes are used (T048), make `scripts/build-data.ts` fail with a clear
  message when a published hymn's `lyricsHash` differs from `content/generated/themes.json`,
  pointing to `generate-themes.ts`. Add a test case in `tests/unit/meaning-build.test.ts`.
  Skip this task if themes are not used.

**Checkpoint**: All four stories work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Performance, accessibility, privacy, docs and deploy.

- [X] T054 [P] Write `tests/perf/meaning.perf.test.ts`. On 20,000 synthetic rows × 512 dims
  (`generate-corpus.ts`, random unit vectors), `rank` + `fuse` take < 50 ms median over 20 runs
  on Node. Check that `tests/perf/search.perf.test.ts` (word search ≤ 200 ms) still passes
  unchanged (SC-006).
- [X] T055 [P] Add an axe check and light/dark screenshots of the meaning states (button,
  waiting, results, offline message) on both Playwright projects to
  `tests/e2e/us15-meaning-search.spec.ts`. Also add an assertion to `tests/e2e/a11y.spec.ts`.
- [X] T056 [P] Document the feature in `README.md`:
  - search by meaning, and the `.env` keys;
  - `wrangler secret put MAMMOUTH_API_KEY`;
  - `npm run build && npx wrangler deploy`;
  - how to rerun the comparison;
  - that query text goes to Mammouth and OpenAI with no identity.
- [X] T057 Run the whole suite: `npm run lint`, `npm run check`, `npm test`,
  `npm run test:queries` (the existing word reference queries must pass unchanged),
  `npm run test:perf` and `npm run test:e2e`.
- [X] T058 Run quickstart.md §1–§4 with the real content and `npx wrangler dev`, on a phone-sized
  viewport, in light and dark. Note any deviation in `specs/011-semantic-search/quickstart.md`.
- [X] T059 Deploy with the maintainer's go-ahead only (outward-facing): `npx wrangler secret put
  MAMMOUTH_API_KEY`, then `npm run build && npx wrangler deploy`. Run the curl checks of
  quickstart §5 (200, 409, 413).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first. It is a go/no-go on the provider. T002 and T003 run in
  parallel after it.
- **Foundational (Phase 2)**: depends on Setup. It blocks every story.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational. It reuses US1's `embed-client.ts`, worker messages
  and page wiring (T026–T030), so it is best done after US1.
- **US3 (Phase 5)**: depends on Foundational only (it needs `stanzas`, `embed`, `rank`, `fuse`
  and `engine`). It can run in parallel with US1 and US2. Its result (T048) changes
  `config.ts`, after which `npm run data` is run again.
- **US4 (Phase 6)**: depends on Foundational. T051 touches files of US1 and US2.
- **Polish (Phase 7)**: after the stories wanted for release. T059 needs the maintainer's
  approval.

### Within Each Story

- Tests come before implementation and must fail first.
- Pure modules come before the worker or page wiring, and wiring before e2e.
- T045 (reference queries) and the T046 sample need the maintainer's review before T048.

### Parallel Opportunities

- Phase 2: T004, T005, T008, T010, T011, T017 and T018 (all different files). Then T006, T007,
  T019 and T020 in parallel.
- US1: T021, T022 and T023 in parallel. T029 in parallel with T027 and T028.
- US2: T033, T034 and T035 in parallel. T038 in parallel with T036 and T039.
- US3: T043, T044 and T046 in parallel. US3 as a whole in parallel with US1 and US2.
- US4: T050 and T051 in parallel.
- Polish: T054, T055 and T056 in parallel.

---

## Parallel Example: Foundational

```bash
Task: "Write tests/unit/meaning-vector.test.ts (T004)"
Task: "Write tests/unit/meaning-config.test.ts (T005)"
Task: "Write tests/unit/meaning-stanzas.test.ts (T008)"
Task: "Create tests/helpers/fake-embedder.ts (T010)"
Task: "Write tests/unit/meaning-rank.test.ts (T017)"
Task: "Write tests/unit/meaning-fuse.test.ts (T018)"
```

## Parallel Example: User Story 1

```bash
Task: "Write tests/unit/meaning-worker-api.test.ts (T021)"
Task: "Write tests/unit/meaning-embed-client.test.ts (T022)"
Task: "Write tests/e2e/us15-meaning-search.spec.ts, US1 part (T023)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1. If T001 fails, stop and pick a fallback with the maintainer.
2. Phase 2, foundational.
3. Phase 3 (US1), with the default `title+stanza / 512` configuration.
4. **STOP and VALIDATE**: run the US1 e2e and quickstart §4 steps 2–4 with `wrangler dev`.

### Incremental Delivery

1. Setup and Foundational give a build that can write meaning data.
2. US1 gives search by meaning online (MVP, demo locally).
3. US2 makes it robust offline, with the background download. This is the minimum before
   deploying to users, since the app is used in places with weak networks (Principle VI).
4. US3 gives the measured choice, which may change `config.ts`. Then rebuild. Ideally run it
   in parallel with US1 and US2, so the shipped configuration is the measured one.
5. US4 hardens rebuilds for future hymnal imports.
6. Polish, then deploy (T059) with the maintainer's approval.

---

## Notes

- [P] tasks are on different files, with no dependency on unfinished tasks.
- Keep `src/lib/meaning/*` free of DOM, Node and Workers-only APIs: they run in four places.
- Never change displayed lyrics or add generated text to the catalog (FR-022).
- Commit after each task or logical group, with the attribution line from the session's
  instructions.
- Avoid editing `src/lib/search/engine.ts` ranking: word search must stay as it is (SC-006).
