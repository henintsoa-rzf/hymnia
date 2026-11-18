# Quickstart: Semantic search

How to run and validate this feature end to end. See [plan.md](./plan.md) for the design,
[contracts/](./contracts/) for the formats and [data-model.md](./data-model.md) for the
entities.

## Prerequisites

- Node 22 and `npm install` (as for feature 001).
- In `.env` (never committed; see `.env.example`):

  ```sh
  MAMMOUTH_API_KEY=…                                  # Mammouth AI key (research R1)
  # EMBEDDINGS_BASE_URL=https://api.mammouth.ai/v1    # default
  # EMBEDDINGS_MODEL=text-embedding-3-large           # default
  ```

- For the Worker: a Cloudflare login (`npx wrangler login`) and the secret, set once:
  `npx wrangler secret put MAMMOUTH_API_KEY`.

## 0. Smoke test of the provider (first task)

```sh
npx tsx scripts/semantic/smoke.ts "la fidélité de Dieu"
```

Expected: `OK text-embedding-3-large 3072 dims via https://api.mammouth.ai/v1`. On a 404 or
"model not found", Mammouth does not serve this route or model. Stop and decide on a fallback
(research R1).

## 1. Build the meaning data

```sh
npm run data
```

Expected, in addition to today's output:

```text
  meaning: te3-large/title+stanza/512/i8/v1 — 10042 rows, 5.0 MB (embedded 10042, cached 0)
```

Run it a second time. Expect `embedded 0, cached 10042` and identical file names (US4 scenario
1, SC-007). Without `MAMMOUTH_API_KEY` and with an empty cache, expect one warning,
`meaning data skipped`, and a build that still succeeds.

## 2. Choose what to index (User Story 3)

```sh
npx tsx scripts/semantic/generate-themes.ts --sample 30   # only to try title+theme+stanza; review the sample
npx tsx scripts/semantic/generate-themes.ts               # all hymns, through the Batches API
npx tsx scripts/semantic/evaluate.ts
```

Expected: a table with one row per candidate (representation × dims × float/int8), plus the
blended rows and a `words only` row, giving top1, top10, top50, MRR and size. It writes
`tests/queries/meaning-evaluation.json`. Set the chosen `configId` and fusion weights in
`src/lib/meaning/config.ts` (FR-021), then rebuild.

## 3. Automated tests

```sh
npm test               # unit: vector cut/quantise, rows map, ranking, fusion, query cache,
                       #       embed client (timeout, abort, offline, 409), Worker handler
npm run test:queries   # includes meaning.test.ts: SC-001 and SC-002 on the reference set,
                       # with committed query vectors (no network); skipped with a notice when
                       # the build has no meaning data
npm run test:perf      # ranking 20,000 × 512 rows on Node: well under 300 ms (SC-003)
npm run test:e2e       # us15-meaning-search.spec.ts, with /api/embed mocked by Playwright
```

## 4. Manual check in the app

```sh
npm run build && npx wrangler dev        # app + Worker on http://localhost:8787
```

1. Load the app and wait a few seconds. DevTools → Application → Cache Storage shows
   `hymnia-meaning` with two `meaning*` files. The precache does not contain them (R8).
2. Type « la fidélité de Dieu dans l'épreuve ». Word results appear as you type. Press « Par le
   sens ». Within 2 s, a blended list appears with stanza excerpts (US1, SC-003).
3. Type the exact title « Il est fidèle » and press the button. That hymn is first (US1
   scenario 2).
4. Select only JEM in the hymnal filter and search again. Only JEM hymns appear (FR-006).
5. Go offline (DevTools → Network → Offline). Repeat the query from step 2: results come back
   at once. Try a new query: the message « La recherche par le sens nécessite une connexion »
   appears, and word results stay (US2, SC-005).
6. Edit the query. The meaning list is replaced by word results, and `sens=1` leaves the URL
   (US1 scenario 7).
7. Check the search screen on a mobile viewport in light and dark modes, and with a screen
   reader for the status line (constitution workflow).

## 5. Deploy

```sh
npm run build && npx wrangler deploy
curl -s -X POST https://<host>/api/embed -H 'content-type: application/json' \
  -d '{"text":"grâce","configId":"<current configId>"}' | head -c 120
```

Expected: `{"configId":"…","dims":512,"vector":"…`. A wrong `configId` gives 409, and a 501-
character text gives 413.

## Notes from implementation (2026-11-18)

- `npm run check` also type-checks the Worker (`tsc -p worker/tsconfig.json`). That config
  includes `worker/index.ts` only; the shared modules it imports are checked through it. The
  browser-only modules (`embed-client.ts`, `query-cache.ts`) use DOM types and are not part of
  the Worker.
- `HYMNIA_FAKE_EMBEDDER=1 npm run data` writes fake meaning data with configId
  `fake/title+stanza/512/i8/v1`, so it can never pass for real data (the Worker answers 409).
  The e2e build uses it.
- `npx tsx scripts/semantic/evaluate.ts --fake` runs the whole comparison with the fake
  embedder, at no cost, and writes nothing: it checks the pipeline, not the quality.
- §4 was run with `wrangler dev` without a key: app and SPA routes 200, `/api/embed` 409, 413,
  400 and 404 as in the contract, and 502 for the upstream call. Steps 1–7 with real meaning
  data wait for `MAMMOUTH_API_KEY`.
- WebKit (the `iphone` Playwright project) cannot start on the current dev machine (missing
  system libraries: `sudo npx playwright install-deps`); the e2e suite was run on `android`.
