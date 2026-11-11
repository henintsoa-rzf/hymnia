# Research: Import Hymnals from Source Sites

**Feature**: `002-hymnal-import` | **Date**: 2026-11-11

Each decision lists what was chosen, why, and what was rejected.

## R1. Language and runtime

- **Decision**: TypeScript on Node.js 22 LTS, run with `tsx`, in the same repository as feature
  001.
- **Rationale**: Reuses feature 001's Zod content schemas and the `normalize` function, so the
  importer writes exactly what the build validates and matches text the same way search does.
  One language and one test runner (Vitest) for the whole project.
- **Alternatives**: Python + BeautifulSoup (good scraping tools, but schemas and normalisation
  would be duplicated in two languages and could drift apart); a separate repository (no
  benefit for a single maintainer).

## R2. Fetching and HTML parsing

- **Decision**: Node's built-in `fetch` for HTTP and `cheerio` for HTML parsing. No headless
  browser.
- **Rationale**: Checking the sites suggests their hymn pages are server-rendered HTML.
  `cheerio` is light and fast, and lets each source be tested against saved pages without a
  network.
- **Alternatives**: Playwright or Puppeteer scraping (heavy and slow, and only needed for pages
  rendered by JavaScript. If a source turns out to need it, that source's adapter can add it
  without affecting the others, per FR-025); regular expressions on raw HTML (break easily).

## R3. Respecting the sources (FR-021 to FR-023)

- **Decision**: One "polite fetcher" shared by all sources:
  - reads and follows `robots.txt` with `robots-parser`, checking our own user-agent;
  - waits at least the larger of 1 s and the site's `Crawl-delay` between requests to a host;
  - sends `User-Agent: HymniaImporter/<version> (+contact: <HYMNIA_CONTACT>)`. The contact
    address comes from an environment variable and is required. The import refuses to start
    without it;
  - retries 429 and 5xx responses at most 3 times with exponential backoff, and follows
    `Retry-After`;
  - caches every fetched page on disk (FR-008) and sends `If-Modified-Since`/`ETag` on re-runs.
- **What the robots.txt files said on 2026-11-11**:

  | Site | Relevant rules | Effect |
  |------|----------------|--------|
  | conducteurdelouange.com | `Disallow: /admin/`, `/maintenance/` | Hymn pages allowed; 1 req/s. |
  | jemaf.fr | Rule for Googlebot only | Allowed; 1 req/s. |
  | psalmodie.ch | `Crawl-delay: 10` | Allowed; 1 request every 10 s. |
  | ecrituremusique.com | Blocks a list of AI bots; for everyone, `/search`, `/api/`, `/static/`, `/config`… | Our user-agent is not on the list; hymn pages allowed; do not use `/search` or `/api/`. |

  The robots rules allow crawling. They are not permission to republish. Permission is
  recorded separately (FR-023, R8).
- **Alternatives**: Fetching with no rate limit (rude and likely to be blocked); a crawling
  framework such as Crawlee (too much for four sites and a few thousand pages).

## R4. Raw page cache (FR-008)

- **Decision**: `import/cache/<source>/<sha1(url)>.html`, plus a `.meta.json` file next to each
  page (URL, retrieval date, HTTP status, ETag, SHA-256 of the body). Git ignores the cache. Test
  fixtures (a handful of pages per source) are copied into `tests/import/fixtures/`.
- **Rationale**: Extraction can be re-run offline and repeatably. Copyrighted pages are not
  published in the repository beyond the minimum test fixtures.
- **Alternatives**: Committing the full cache (spreads copyrighted text); no cache (every parser
  fix means fetching thousands of pages again).

## R5. Source adapters

- **Decision**: One module per source with a fixed interface ([contracts/source-adapter.md](./contracts/source-adapter.md)):
  `listEntries(hymnal)` lists the (number, URL) pairs for a hymnal, and `parseHymn(html, url)`
  returns a `RawHymn`. All shared work (fetching, normalisation, matching, writing, reporting)
  stays outside the adapters.
- **Rationale**: Adding a source means writing one adapter and one config entry (FR-025, SC-007).
  An adapter that fails affects only its own source.
- **Alternatives**: CSS selectors in configuration only (not enough for the different page
  layouts, such as verse markers inside text or a chorus written once); a single generic parser
  (fragile).

## R6. Idempotence and protecting manual work (FR-009 to FR-013)

- **Decision**: A versioned link file `import/state/links.json` maps each
  (source, hymnal, number) to a hymn id and to the **fingerprint** (SHA-256 of the normalised
  extracted text) of the source text last accepted. For each source hymn on a re-run:
  1. If the fingerprint is unchanged, the hymn file is not touched. Manual corrections made
     in `content/` are therefore never overwritten.
  2. If the fingerprint changed, a **pending change** is written to `import/pending/` with a
     line-by-line diff (`diff` package). Content changes only after `hymnia-import accept`.
  3. If there is no link yet, the hymn goes to matching (R7), then is created or attached.
  4. If a link's page is no longer listed at the source, it is reported as missing and nothing
     is deleted.

  Files are written to a temporary file and then renamed, and JSON is written in a stable form
  (sorted keys, 2-space indentation, final newline). An interrupted run leaves no half-written
  file, and the same input gives byte-identical output.
- **Alternatives**: A three-way merge of source, previous source and corrected text (powerful
  but complex; YAGNI given that pending changes are reviewed by hand); a database for state
  (unnecessary; files keep everything diffable in git).

## R7. Recognising the same hymn (FR-014 to FR-017)

- **Decision**: Normalise the title and lyrics with feature 001's `normalize` (no accents, lower
  case, no punctuation), then compare the lyrics with Jaccard similarity on word 3-grams:
  - **Automatic merge**: normalised titles are equal **and** lyrics similarity is ≥ 0.85.
  - **Possible duplicate** (reported): titles are equal, or lyrics similarity is ≥ 0.5.
  - Otherwise the hymns are treated as distinct.

  Candidates are found through an index of normalised titles plus an index of first-line
  3-grams, so the comparison is never all pairs. Maintainer decisions (`merge` / `distinct`) in
  `import/decisions/merges.json` override the rule and are applied first. The thresholds are
  tuned against the reference list of SC-005 (`tests/import/reference-duplicates.json`).
  **Reference text**: comes from the source ranked highest for that hymnal in
  `import/decisions/source-priority.json`. Other sources are recorded on the hymn in
  `alternateSources`.
- **Alternatives**: Exact match after normalisation only (misses small differences between
  sources and fails SC-005); edit distance on full lyrics (slow, and sensitive to verse order);
  embeddings (heavy, and not needed at this stage).

## R8. Rights decisions (FR-019, FR-020, FR-006)

- **Decision**: A versioned file `import/decisions/rights.json`. Each decision has a scope
  (`source`, `hymnal`, `hymn`), a basis (`permission`, `licence`, `public-domain`, `refused`),
  a date and a note. A hymn's `rights` field is computed with the most specific scope winning:
  hymn, then hymnal, then source. Without a decision it is `unconfirmed`. A `refused` decision
  also gives `unconfirmed`. The importer rewrites only the `rights` field of the hymn files,
  even when the text is not touched. Each source's terms of use and permission status are in
  `import/sources.json` (FR-023).
- **Alternatives**: Editing `rights` by hand in each hymn file (thousands of edits; nothing to
  inherit for new hymns; FR-006 not met).

## R9. Command-line interface

- **Decision**: A single `hymnia-import` command run with `npm run import -- <subcommand>`,
  parsed with `node:util` `parseArgs`. There is no extra dependency. Subcommands are listed in
  [contracts/cli.md](./contracts/cli.md).
- **Alternatives**: `commander`/`yargs` (not needed for a handful of subcommands); a web
  back-office (out of scope, as the spec assumes a single maintainer).

## R10. Failure threshold (FR-024)

- **Decision**: Extraction runs on every page first and the results are kept in memory. If
  more than 20% of the pages fail for a source, nothing is written for that source. The run is
  marked `aborted` in the report, with the most common failure reasons.
- **Rationale**: A layout change at the source never produces partial content.

## R11. Chord markings in lyrics

- **Decision**: Each adapter removes chord symbols and musical notes from the lines it extracts
  (for example `[Am]`, or a line of chords above the text). Each removal type is counted in the
  report. The removed data is not stored (FR-007). This counts as extraction, not a correction,
  because the source's displayed lyric text is unchanged.

## Open points (do not block planning)

- **Permission from sites and rights holders**: handled outside the tool. Until it is
  recorded in `rights.json`, imported content stays unpublished, which the gates enforce.
- **Exact page layout of each site**: confirmed when each adapter is written, by saving fixture
  pages first.
