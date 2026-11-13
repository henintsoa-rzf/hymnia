# Research: Import Hymnals from Source Sites

**Feature**: `002-hymnal-import` | **Date**: 2026-11-11

Each decision lists what was chosen, why, and what was rejected.

## R1. Language and runtime

- **Decision**: TypeScript on Node.js 22 LTS, run with `tsx`, in the same repository as feature
  001.
- **Rationale**: Reuses feature 001's Zod content schemas and the normalisation functions (`normalizeText`,
  `tokenize` in `src/lib/search/normalize.ts`), so the
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
  (source, hymnal, number) to a hymn id and to the **fingerprint** (SHA-256 of the extracted
  text) of the source text last accepted. The fingerprint ignores only whitespace and the
  Unicode form, which is all that extraction may change (FR-004); punctuation, case and accents
  count. *(Implementation note, 2026-11-11.)* For each source hymn on a re-run:
  1. If the fingerprint is unchanged, the hymn file is not touched. Manual corrections made
     in `content/` are therefore never overwritten.
  2. If the fingerprint changed, a **pending change** is written to `import/pending/` with a
     line-by-line diff (`diff` package). Content changes only after `hymnia-import accept`.
  3. If there is no link yet, the hymn goes to matching (R7), then is created or attached.
  4. If a link's page is no longer listed at the source, it is reported as missing and nothing
     is deleted.

  Files are written to a temporary file and then renamed, and JSON is written in a stable form
  (tab indentation and keys in the order of the Zod schema, the format already used by
  `content/`, plus a final newline). An interrupted run leaves no half-written
  file, and the same input gives byte-identical output.
- **Alternatives**: A three-way merge of source, previous source and corrected text (powerful
  but complex; YAGNI given that pending changes are reviewed by hand); a database for state
  (unnecessary; files keep everything diffable in git).

## R7. Recognising the same hymn (FR-014 to FR-017)

- **Decision**: Normalise the title and lyrics with feature 001's `normalizeText` and `tokenize` (no accents, lower
  case, no punctuation), then compare the lyrics on word 3-grams with two measures: Jaccard
  similarity (shared ÷ all, reported to the maintainer) and **containment** (shared ÷ the
  smaller hymn's 3-grams), with the **size ratio** of the two hymns:
  - **Automatic merge**: same normalised title, containment ≥ 0.6 and size ratio ≥ 0.4; or any
    title, containment ≥ 0.85 and size ratio ≥ 0.4.
  - **Possible duplicate** (reported): same title, or Jaccard or containment ≥ 0.5.
  - Otherwise the hymns are treated as distinct.
  - A hymn is never matched with another hymn of the same hymnal, except a lettered variant
    ("309A") whose lyrics are the same (Jaccard ≥ 0.85) as the hymn of its base number.

  **Tuning (T055, 2026-11-11)**: the first rule (same title and Jaccard ≥ 0.85) failed on the
  first real import. Hymnals retitle hymns (JEM 232 "Ma joie de t'appartenir" is ATG 42 "C'est
  vers toi que je me tourne", word for word), and À Toi la Gloire often prints 3 of 5 verses,
  which caps Jaccard near 0.6. Across the 1,030 pairs of pages with the same title or first line,
  hymns with the same title and different lyrics never shared more than 25 % of their 3-grams,
  so 0.6 leaves a wide margin. The size ratio keeps a short chorus apart from a long hymn that
  quotes it (ATG 86 / JEM 281). On the reference list (38 shared groups, 16 distinct pairs, read
  and judged by hand), **35 of 38 groups merge (92 %) and no distinct pair merges**. The three
  misses are textual revisions under the same first line (ATG 391 / JEM 96, ATG 38 / JEM 60,
  ATG 260 / AdF 317); they are reported as possible duplicates.

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

## R12. Keeping saved collections pointed at the right hymn (FR-026 to FR-028)

Added 2026-11-11, after reviewing features 001 and 003.

- **Problem**: feature 003 stores a collection entry as hymnal + number only. If an import
  corrects a number, or a hymnal id is reused, the entry silently opens another hymn. A merge
  can also leave the same hymn twice in a collection.
- **Decision**:
  - Entries also store the `hymnId` they were saved for. The field is optional within storage
    version 2 (see the amended `specs/003-repertoire-collections/contracts/storage.md`), so
    older app versions still read the document.
  - Resolution goes through `hymnId` first. The spec's rules are in
    `specs/003-repertoire-collections/data-model.md` under "Resolving an entry".
  - When hymns are merged, the importer writes `content/redirects.json` (`{ "<removed id>":
    "<kept id>" }`). The build validates it (sources are not live hymn ids, targets exist,
    no chains or cycles) and publishes it in the catalog, so stored ids can follow merges.
  - Removing an entry takes out one entry only (done 2026-11-11 in `removeEntry`).
  - Hymnal ids and hymn ids are never reused. The sample ids `ce` and `he` are reserved, and
    the sample content moves to the test fixtures before real hymnals are published.
- **Alternatives**:
  - Storage version 3 with a migration. An older cached copy of the app (offline PWA) would
    treat a v3 document as unreadable and set it aside, so v3 is riskier for no benefit.
  - Storing only the hymn id. That would lose the reference the user chose (FR-006 of 003).
  - Never renumbering. Not under our control, because sources correct their numbering.

## R13. What the four sites turned out to be (2026-11-11, during implementation)

| Site | Hymnals | Numbering | Credits | Terms of use |
|------|---------|-----------|---------|--------------|
| conducteurdelouange.com | `jem` (4 volumes, continuous numbers), `adf`, `cd`. No À Toi la Gloire; Exo has no numbers: made-up numbers pinned by site id (feature 005). | As printed (`#245`) | Names only, no role → `unspecified` | Rights belong to the rights holders; no public use without permission. |
| jemaf.fr | `jem` (1–1200), `adf` (677), `atg` (400) | As printed without prefix (`AF309A` → `309A`) | Roles, from data embedded in the page | « Toute reproduction … ne peut se faire sans l'autorisation de l'éditeur. » |
| psalmodie.ch | `psalmodie`: 7 concert programmes, 122 songs | **Made up**: 100 per programme, oldest first (e.g. 702) | Labelled lines | No terms; most songs carry a publisher's ©. |
| ecrituremusique.com | `ecriture`: 32 songs on 3 albums | **Made up**: album blocks 1–12, 13–25, 26–32 | "Paroles et musique" | No terms; "© Écriture Musique" on each song. |

**Maintainer's decisions** (2026-11-11):
1. The made-up numbers for psalmodie.ch and ecrituremusique.com are kept. Entries need a
   number, and these numbers are ours, not the source's.
2. A lettered Ailes de la Foi variant (309A…) whose lyrics are the same as the hymn of its base
   number (similarity ≥ MERGE_THRESHOLD) is merged into that hymn: one hymn with both entries.
   A variant with other lyrics stays a separate hymn. The rule is in `pipeline/match.ts` and
   holds for any hymnal.
3. psalmodie.ch's musical "Paul" (speaker labels, spoken passages) is not imported.
4. Every source stays at `permission: "unknown"` until a site answers. Meanwhile the app is only
   used by its maintainer, so the local build publishes every hymn (`HYMNIA_PERSONAL_USE=1` in
   `.env`; constitution III, personal-use exception). Rights decisions are still recorded with
   `rights set` as permissions arrive.

The fetcher also requests each page once per run, without its `#fragment`, because psalmodie.ch
lists about 16 songs on one page.

**First real import (2026-11-11)**: jemaf.fr for ATG (400), AdF (677) and JEM (1,199), then
conducteurdelouange.com for Célébrons Dieu (368), psalmodie.ch (98 songs without "Paul") and
ecrituremusique.com (32): 2,774 pages, no failure, **2,106 hymns** (668 entries joined an
existing hymn), 48 possible duplicates left to decide, `check` clean. 19 AdF lettered variants
joined their base hymn; 2 (264A, 613A) have other lyrics and stay separate. Two bugs found and
fixed on the way: a hymn that gained an entry during a run could gain a second number of the
same hymnal (the matcher was not told about the new entry), and a hymnal with no source priority
fell back to the order of `sources.json`, which handed Célébrons Dieu's site the reference text
of hymns jemaf.fr already provided.

**Search on the real collection (T076)**: the reference queries of feature 001 still pass (they
run on the sample hymnals, now in `tests/fixtures/sample-content/`), and number queries are
instant on the real data ("JEM 232", "AF 309A"). Two problems showed up, both fixed in feature
001 on 2026-11-12:
1. **Lyrics ranked below titles**: a full line of lyrics ranked far down when its words appeared
   in other titles ("Brillant de lumière, l'ange est descendu" → "À toi la gloire" 10th). Fixed:
   within the lyrics tier, the query as a phrase of the lyrics comes first, then every word in
   the lyrics (001 contracts/search.md). Now 1st, with "Il roule la pierre du tombeau" too.
2. **A hymnal's own title was lost on merge**: "Ma joie de t'appartenir" (JEM 232) found nothing.
   Fixed: `HymnalEntry.title` keeps the title each hymnal prints (61 entries after the import);
   search finds it and opens that entry, and lists and the hymn page show it.

## Open points (do not block planning)

- **Permission from sites and rights holders**: handled outside the tool. Until it is
  recorded in `rights.json`, imported content stays unpublished, which the gates enforce.
- **Exact page layout of each site**: confirmed when each adapter is written, by saving fixture
  pages first.
