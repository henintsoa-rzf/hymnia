# Research: Semantic search

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-17

Facts measured on the corpus (2026-11-17, every hymn, personal-use build): 2,730 hymns, 11,846
sections, **10,042 distinct sections** once each hymn's repeated sections are counted once. The
median distinct section is 147 characters long and the longest is 1,261. 59 sections are under
40 characters ("Alléluia ! Amen !").

---

## R1. Who turns text into vectors

**Decision (maintainer's choice, 2026-11-17)**: **`text-embedding-3-large`**, through the
**Mammouth AI API**, on the maintainer's existing credits. The same model and API serve both
sides:

- the data build, for the stanzas;
- the new Worker, for queries.

Both sides therefore make vectors the same way.

- **Endpoint**: Mammouth is assumed to be OpenAI-compatible: `POST <base>/embeddings` with
  `{ model, input }`, where `<base>` is `https://api.mammouth.ai/v1`. This could not be
  confirmed from public pages on 2026-11-17, so the **first implementation task is a smoke
  test** with the maintainer's key: the route answers, the model is offered, and it returns
  3,072-dim vectors. The base URL and model are settings (`EMBEDDINGS_BASE_URL`, `EMBEDDINGS_MODEL`).
  If Mammouth lacks the route, switching to OpenAI directly is a configuration change, and the
  same `configId` stays valid as long as the model is the same.
- **Model facts**: multilingual (strong on French), 3,072 dims natively. Trained so that
  shorter vectors keep most of their quality: cutting a vector and re-normalising it is what the
  API's own `dimensions` parameter does. The build and the Worker both request the full vector
  and cut it with the same shared code (R7), so they cannot drift apart. Up to 8,191 input tokens. List price $0.13 per million
  tokens (OpenAI). Mammouth bills against its own credits.
- **Secrets**: `MAMMOUTH_API_KEY` sits in `.env` for the build (never committed) and is a Worker
  secret (`wrangler secret put MAMMOUTH_API_KEY`) for queries. It never reaches the device.

**Cost**: one full index is about 1.5 M tokens, about $0.20 at list price. The comparison
(three representations, R3) costs under $1. A query is about 15 tokens, so 10,000 queries cost
about $0.02. The rate limit (R9) and the edge cache keep a burst of traffic from draining the
credits.

**Risks**:

- If credits run out or the key is revoked, the Worker answers 503. Search by meaning shows
  "indisponible", and word search is unaffected (spec US2).
- Queries go to Mammouth, which forwards them to OpenAI. Only the query text is sent, with no
  user or device identity (FR-010). See R12.

**Alternatives considered**:

- Cloudflare Workers AI (`@cf/qwen/qwen3-embedding-0.6b`, `@cf/baai/bge-m3`): no secret and
  free tier, but the maintainer prefers to use existing Mammouth credits. It stays a fallback.
  `@cf/google/embeddinggemma-300m` is marked for deprecation on 2026-11-20.
- `text-embedding-3-small`: cheaper but weaker on non-English retrieval. It is not needed, given
  the tiny cost of the large model here.
- Running a model in the browser: a 100–600 MB download per device. It conflicts with
  SC-003/SC-004. Rejected.

## R2. What text is indexed for each stanza

**Decision**: Three representations are measured (FR-020). The winner is chosen by FR-021.

| Id | Text sent for each distinct stanza |
|----|------------------------------------|
| `stanza` | The stanza's lines joined with line breaks. |
| `title+stanza` | `<hymn title>\n\n<stanza>` |
| `title+theme+stanza` | `<hymn title> — <theme description>\n\n<stanza>` |

Rules shared by all three:

- **One vector per distinct stanza per hymn.** A section whose lines are identical to an earlier
  section of the same hymn (a chorus written out after each verse) is indexed once. Spec edge
  case: repeated choruses.
- **Short sections join a neighbour.** A section under 40 characters is indexed together with
  the section before it (or after it, if it comes first), so that "Alléluia ! Amen !" does not
  become a generic match for every query. Spec edge case: very short sections.
- The texts are the stored lyrics, unchanged. Only the indexed text is built; nothing is
  written back to the hymns.

**Rationale**: A stanza alone can lack context ("Il est là", "Lui seul"). The title often names
the theme ("Il est fidèle", "Noël"), which helps queries by theme. A theme description adds
words that the lyrics never use ("deuil", "baptême", "mission"), which matters most for
occasion queries. It is also the most costly option, so it must earn its place by measurement.

**Alternatives considered**: one vector per hymn (all lyrics together). Rejected: long hymns
dilute their themes, and FR-004 needs the matching stanza to show it. A sliding window over
lines: more vectors and more data, for no shown need.

## R3. The comparison (User Story 3)

**Decision**: `scripts/semantic/evaluate.ts` runs every combination of these candidates on
`tests/queries/meaning-queries.json` (at least 40 queries, FR-019):

- representation (R2) × dims (1,024 / 512 / 256, derived as in R7). The model is fixed (R1).
  1,024 dims can only ship if it clears the rule in R4. 3,072 dims is measured as a quality
  ceiling only;
- vectors as floats and as int8, to measure what quantization loses;
- for the winner, the blended ranking (R6) with a grid of weights, and word search alone as
  the baseline for SC-002.

For each candidate it reports the share of queries with an expected hymn at rank 1, in the top
10 and in the top 50, the MRR, and the size of the meaning data. The scores and the chosen
configuration go to `tests/queries/meaning-evaluation.json` (versioned, FR-021). A summary is
added at the end of this file.

The vectors made during the comparison go into the build's embedding cache (R7), so the chosen
configuration costs nothing more to build.

**Rationale**: This is the constitution's rule ("any search change is validated by a versioned
reference query set") applied to the open design questions. It also turns "should we add a
reranker" into a number we can check later (FR-007).

## R4. Size of the meaning data

**Decision**:

- Vectors are L2-normalised, then stored as **int8** with one float32 scale per row. Cosine
  similarity becomes `scale_i × Σ q_d · x_id`.
- **512 dims** is the target: 10,042 rows × 512 bytes ≈ 5.1 MB, plus 40 KB of scales and a
  small row map.
- The build fails above **10 MB** (SC-004), like the 5 MB check on catalog and index. The
  limit is `MeaningConfig.maxBytes`, so the build, the comparison and the tests read it from one
  place.
- **The comparison decides whether the limit is raised** (decision of 2026-11-18). If, at int8,
  1,024 dims beats 512 dims by **at least 3 points of top-10** on the reference set, the limit
  becomes **20 MB** and 1,024 dims ships (about 10.4 MB today, room for about 19,000 stanzas).
  Otherwise the limit stays at 10 MB with 512 dims. The rule and the scores are recorded in
  `meaning-evaluation.json` (FR-021).
- `text-embedding-3-large` vectors keep most of their quality when cut and re-normalised (R1),
  so no projection is needed. At 3,072 dims int8 the data would be 31 MB, and at 1,024 dims 10.3 MB, both over the
  limit. 512 is the largest size that fits, and 256 (2.6 MB) is measured in case it loses little.

**Rationale**: Raw float32 at 3,072 dims would be 123 MB. Int8 typically loses under one point
of recall, and the comparison measures it (R3). Binary data barely compresses, so the budget is
counted on raw bytes.

**Alternatives considered**: binary (1-bit) vectors with int8 rescoring. 8× smaller, but two
passes and more code for a size that int8 at 512 dims already meets. Product quantization: more
complex. Rejected (V).

## R5. Ranking on the device

**Decision**: An exhaustive dot product in the existing search Web Worker. The query vector is a
`Float32Array`, the stanza vectors are one `Int8Array`, and each row is multiplied by its scale.
Each hymn keeps its best row, the hymnal filter is applied, and the top 100 hymns go to fusion
(R6).

10,042 × 512 ≈ 5 M multiply-adds, about 10–30 ms in JavaScript on a mid-range phone. This is
far under SC-003. The test runs on a synthetic 20,000-row corpus (`tests/perf`).

The meaning data is loaded into the worker's memory at the first search by meaning, not at
startup. Word search's startup and its 200 ms budget are unchanged (SC-006).

**Alternatives considered**: an approximate index (HNSW). It is needed at millions of rows, not
10,000, and it adds a library and a larger file. Rejected. WebGPU: not available everywhere and
not needed at this size. Rejected.

## R6. Blending with word search (Q1: one blended list)

**Decision**: Weighted Reciprocal Rank Fusion at the hymn level:

```text
score(h) = w_m / (k + rank_meaning(h)) + w_w / (k + rank_words(h))     k = 60
```

- `rank_words` comes from the existing engine (feature 001) for the same query and filter, top
  100. `rank_meaning` comes from R5, top 100. A hymn missing from a list gets no term for it.
- **Pinned first**: word results of tier 1 (hymnal + number, which never reaches this path) and
  tier 2 (exact title) stay at the top, in their order (spec US1 scenario 2).
- `w_m` and `w_w` start at 1. The comparison (R3) sets them, then they are fixed in the meaning
  configuration.
- **Excerpt**: the source that gave the hymn its larger term. For meaning, the first two lines
  of the best stanza with no highlight. For words, the existing highlighted excerpt.
- At most 50 results (FR-004).

**Rationale**: RRF needs no calibration between two scores of different natures (a BM25-like
score and a cosine). It is robust and has one parameter, and it is the usual baseline for
hybrid search. Exact title pinning keeps the promise that a known title is found first.

**Alternatives considered**: a linear mix of normalised scores (fragile, since score scales
differ by query); meaning results with word matches only as a boost (loses lyric fragments
the user remembers).

## R7. Building and updating the meaning data (User Story 4)

**Decision**:

- `scripts/build-data.ts` calls a new step, `buildMeaningData`, after the catalog.
- **Embedding cache**: `.cache/embeddings/<model>.jsonl`, not committed. Each line is
  `{ key, vector }`, where `key = sha256(model + indexed text)` and `vector` is the full
  3,072-dim vector. Shorter dims are derived locally: cut, then re-normalise, which is what the
  API's `dimensions` parameter does for this model. So one call per text serves every dims
  candidate. Unchanged texts are never re-embedded (FR-018, SC-007). Another representation
  changes the indexed text, and so the keys. Another model means a new file. Either way,
  everything affected is re-embedded (US4 scenario 4).
- **Calls**: Mammouth API (R1), in batches of 100 texts, at most 4 in parallel, with retries
  and backoff on 429 and 5xx. Credentials come from `.env` (`MAMMOUTH_API_KEY`, plus optional
  `EMBEDDINGS_BASE_URL` and `EMBEDDINGS_MODEL`), never committed.
- **No credentials and an incomplete cache**: the build still succeeds. It writes no meaning
  data and warns once. The manifest then has no `meaning` entry, and the app hides the button.
  Development, unit tests and CI therefore need no network.
- Output: `static/data/meaning.<hash>.bin` and `meaning-rows.<hash>.bin`, listed in
  `manifest.json` (see [contracts/meaning-data.md](./contracts/meaning-data.md)). Only
  published hymns of that build are indexed (spec edge case: unpublished hymns).

**Alternatives considered**: committing the vectors (about 20 MB of floats in git for every
content change). Rejected. A vector database: there is no server-side query to serve. Rejected.

## R8. Background download (Q3: once idle, after install)

**Decision**:

- The meaning files are **left out of the service worker precache** (`globIgnores:
  ['**/meaning*']`), so installing or updating the app does not grow by 5 MB.
- A **runtime cache** (`CacheFirst`, cache `hymnia-meaning`, 4 entries at most) stores them
  when they are fetched. The file names are hashed, so a cached file is never stale and two
  builds never mix (FR-015).
- After the first screen is shown, the app waits for `requestIdleCallback`, falling back to a
  5 s timer. The search worker then fetches both files, reporting progress from the response
  stream. With `navigator.connection.saveData`, it waits for the first search by meaning
  instead (FR-016).
- Once the files are fetched, nothing more is needed: the next visits read them from the cache,
  offline.

**Alternatives considered**: precache (option B, rejected by the user); download on first use
(option A, rejected by the user, kept only for save-data mode).

## R9. The query service (online step)

**Decision**:

- One Worker in the same Cloudflare deployment. Add `main: "worker/index.ts"` and
  `assets.run_worker_first: ["/api/*"]` to `wrangler.jsonc`. Static assets and the SPA fallback
  are served as today. The Worker calls the Mammouth API with the `MAMMOUTH_API_KEY` secret
  (R1). It has no AI binding.
- The single route `POST /api/embed` is described in
  [contracts/embed-api.md](./contracts/embed-api.md).
- **Version check**: the request carries the device's `configId`. The Worker supports exactly
  the configuration it was deployed with and answers 409 otherwise (FR-009). App and Worker
  ship in one deploy, so only a device with stale data meets this.
- **Limits**: 500 characters (413 above that). A rate limit through the Workers rate-limiting
  binding: 30 requests per 60 s per client, keyed by the connecting IP, which the binding holds
  only in its counters (429 above that). Invalid JSON or a missing field gives 400.
- **Edge cache**: the Workers Cache API, keyed by `configId` and the normalised query text. A
  repeated popular query costs nothing. The key holds no user data.
- **Privacy (FR-010)**: Workers observability logs record only status and duration. The Worker
  never logs the query text or the IP and stores nothing else.

**Alternatives considered**: a separate Worker or domain (extra CORS, extra deploy for one
route); Cloudflare Pages Functions (the project already uses Workers with assets).

## R10. Query vectors on the device (offline repeats)

**Decision**: A small store, `src/lib/meaning/query-cache.ts`, keyed in `localStorage` like
`history` and `prefs`. It is an LRU of the last **50** queries (FR-013), keyed by
`configId + normalised query` (NFC, lower case, collapsed spaces). Each vector is stored as
base64 float32, about 2.7 KB, so about 140 KB in all. It is validated on read and dropped
whole if invalid or if its `configId` is not current.

**Alternatives considered**: IndexedDB (more code for 140 KB); the service worker cache on
`POST` (not cacheable as-is).

## R11. Theme descriptions (only if `title+theme+stanza` is measured)

**Decision**:

- Generated once by the maintainer with `scripts/semantic/generate-themes.ts`, using Claude
  (`claude-haiku-5-5`) through the Message Batches API. Each description is one or two French
  sentences on the hymn's themes and possible uses, quoting no lyrics.
- Stored in `content/generated/themes.json` as `{ hymnId: { text, lyricsHash, model,
  generatedAt } }`, versioned, apart from the hymns and marked as generated.
- Regenerated only for hymns whose `lyricsHash` changed.
- The catalog never contains them, so no screen can display them (FR-022, SC-008). A test
  checks this.
- A sample of 30 is reviewed by the maintainer before the comparison.

If the comparison does not choose this representation, the file is kept for later or deleted.
Nothing in the app depends on it.

**Rationale**: About 1.1 M input tokens through Batches is about one euro, once. A model that
reads the whole hymn writes better theme words than any keyword list.

**Alternatives considered**: hand-written tags for 2,730 hymns (too long); keyword extraction
(adds no new words, which is the point).

## R12. Rights and processors (Principle III)

At build time, the stanzas of published hymns are sent to Mammouth AI, which forwards them to
OpenAI for embeddings. If R11 runs, they are also sent to Claude for theme descriptions. This is processing to derive data, not publication. At query time only the user's query text leaves the device. It goes to the Worker, then to
Mammouth and OpenAI, with no identity attached. No lyrics leave the device, and the vectors shipped cannot be read back as text. The
build indexes only the hymns it publishes: a non-personal build never contains vectors of a hymn
whose rights are not confirmed.

---

## Evaluation results

Run on 2026-11-18 (`npx tsx scripts/semantic/evaluate.ts`, Mammouth, `text-embedding-3-large`)
on the 55 reference queries of `tests/queries/meaning-queries.json`. Each query names one target
stanza and shares no word with it or its title (FR-019), and expects only that stanza's hymn.
9,996 rows per representation (stanzas of 40+ characters, repeated sections once). Full output:
`tests/queries/meaning-evaluation.json`.

Two runs the same day. The first had no theme descriptions and chose `title+stanza/512/i8`.
The second added `title+theme+stanza`, once the maintainer approved a 30-hymn sample (T046):
`claude-haiku-5-5` through the Message Batches API wrote a description for 2,722 of the 2,730
hymns, in five passes. The other 8 were rejected every time, 2 for length and 6 for quoting
6+ consecutive words of the lyrics (short songs whose theme is their wording: Éphésiens 4,
« plus de condamnation », the list of the prophets…). They are indexed with their title alone,
as in `title+stanza`; the comparison accepts up to 1% of hymns without a description.

Meaning list alone (%, MRR, data size):

| Candidate | top 1 | top 10 | top 50 | MRR | MB |
|---|---|---|---|---|---|
| stanza / 256 / i8 | 16.4 | 43.6 | 81.8 | 0.268 | 2.5 |
| stanza / 512 / i8 | 16.4 | 45.5 | 81.8 | 0.272 | 5.0 |
| stanza / 1024 / i8 | 16.4 | 52.7 | 83.6 | 0.286 | 9.8 |
| stanza / 3072 / f32 (ceiling) | 20.0 | 54.5 | 85.5 | 0.313 | 117.2 |
| title+stanza / 256 / i8 | 23.6 | 43.6 | 70.9 | 0.307 | 2.5 |
| **title+stanza / 512 / i8** | 20.0 | **54.5** | 78.2 | 0.296 | **5.0** |
| title+stanza / 1024 / i8 | 20.0 | 54.5 | 85.5 | 0.317 | 9.8 |
| title+stanza / 3072 / f32 (ceiling) | 18.2 | 60.0 | 83.6 | 0.320 | 117.2 |
| title+theme+stanza / 256 / i8 | 12.7 | 49.1 | 74.5 | 0.255 | 2.5 |
| title+theme+stanza / 512 / i8 | 16.4 | 56.4 | 81.8 | 0.277 | 5.0 |
| **title+theme+stanza / 1024 / i8** | 12.7 | **61.8** | 81.8 | 0.263 | **9.8** |
| title+theme+stanza / 3072 / f32 (ceiling) | 12.7 | 54.5 | 81.8 | 0.266 | 117.2 |

int8 scores the same as float32 at every size, apart from stanza/512 (45.5 vs 47.3 top 10).

Blend with word search, `title+stanza/512/i8` (weights meaning:words, RRF k = 60; the same
pattern on `title+theme+stanza/1024/i8`, best blend 54.5 against 61.8 for the meaning order):

| Weights | top 1 | top 10 | top 50 | MRR |
|---|---|---|---|---|
| **1 : 0 (meaning order)** | **20.0** | **54.5** | **78.2** | **0.296** |
| 2 : 0.5 | 3.6 | 47.3 | 76.4 | 0.150 |
| 1.5 : 0.5 | 1.8 | 45.5 | 76.4 | 0.133 |
| 1 : 0.5 | 1.8 | 41.8 | 76.4 | 0.119 |
| 1 : 1 | 1.8 | 20.0 | 65.5 | 0.091 |
| 0.5 : 2 | 0 | 9.1 | 16.4 | 0.019 |
| words only | 0 | 1.8 | 7.3 | 0.006 |

**Decision**: `te3-large/title+theme+stanza/1024/i8/v1`, fusion 1 : 0, `maxBytes` 20 MB.

- With themes, 1,024 dims gains 5.4 top-10 points over 512 (rule: ≥ 3), so the 20 MB limit
  applies. Best top 10 among int8 candidates: 61.8 (title+theme+stanza/1024, 9.8 MB). No
  smaller candidate is within 5 points (title+theme+stanza/512: 56.4).
- Trade-offs of this choice, against `title+stanza/512` (54.5 top 10): top 1 falls from 20.0
  to 12.7 and MRR from 0.296 to 0.263, top 50 rises from 78.2 to 81.8; the meaning data doubles
  (5.0 to 9.8 MB, still under 10 MB today); new or changed hymns need a description
  (`generate-themes.ts`, `ANTHROPIC_API_KEY`) before `npm run data`, which fails on a
  description older than its lyrics (T053). The top-10 gain is 4 of 55 queries.
- Blend weights: the best of the grid on top 10. Any weight on word search lowered every
  measure, so the maintainer chose the meaning order alone (1 : 0): an exact title match from
  word search still comes first, and word-only hits fall after every meaning hit.

**Notes**

- SC-002 is met: search by meaning finds the target in the top 10 for 34 queries, word search
  alone for 1.
- SC-001 was lowered by the maintainer to 50% in the top 10 and 75% in the top 50 (from 80% and
  95%), as listing every relevant hymn per query is too much work. Measured: 61.8% and 81.8%.
- Why every blend scores below the meaning list alone: The words list, ranked by its word tiers,
  pushes up hymns that share common words with the query (Père, Éternel, foi…). Many of these
  are relevant answers that are not the single expected hymn: « Par la foi » for « la
  justification par la foi », « Comme une biche » for the paraphrase of Psalm 42, « Dieu répand
  le Saint-Esprit » for Pentecost. With one expected hymn per query, the set counts them as
  misses, so it understates both the blend and the meaning list. Listing the other relevant
  hymns in `expect` (the word rule then applying to the target stanzas only) would give a fairer
  measure.

