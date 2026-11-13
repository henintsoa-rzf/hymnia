# Research: Exo Hymnal

Decisions for feature 005. They build on feature 002 (import pipeline, research R1–R13) and
feature 004 (pinned made-up numbers, research R5). Site facts were observed on 2026-11-13.

## R1. Which code reads the Exo songs

- **Decision**: Extend the existing `cdl` adapter (`scripts/import/sources/cdl.ts`). Do not
  write a new adapter.
- **Rationale**:
  - Exo song pages (`/<id>`) use the same layout as the JEM, AdF and CD pages: `section.body`
    with rendered ChordPro, and `section.credits .author`. `parseCdlHymn` already handles them.
  - The Exo list (`/chants/recueil/6?page=N`) uses the same markup as the other lists. The only
    difference is that rows have no `#number` in `.details .source`.
  - Today, `parseListing` skips rows that have no number. A test asserts this, using the fixture
    `listing-exo.html`.
- **Change**: `CDL_VOLUMES` gains `exo: [6]`. For hymnals listed in a new table of unnumbered
  hymnals, rows without a number are kept, identified by their page id, and numbered as in R2.
  Numbered hymnals behave exactly as before.
- **Alternatives**:
  - A separate `exo` source. It would duplicate the fetcher config, the terms and the parser for
    the same site.
  - Saved pages, as for Evangile21. Not needed: the site already answers the importer for JEM,
    AdF and CD.

## R2. Numbering

- **Decision**: Pin the numbers in an explicit table `CDL_PINNED.exo: { number, id }[]`, built
  once at implementation from the distinct song ids, **ascending id = oldest first**, starting
  at 1. A listed id that is not in the table gets `max(number) + k` (ascending id), and the
  adapter logs `exo N: /<id> is not pinned yet: add it to CDL_PINNED`. This is the same rule
  and the same log as Evangile21 (`numberEntries`).
- **Rationale**:
  - The site's ids grow as songs are added (seen: 698–795, then 1312–1326), so "ascending id"
    is a fair proxy for publication order.
  - A rule computed on each run is not enough. Because of the site's unstable paging (R3), an
    old id (e.g. 700) could first appear months later and would shift every number after it.
    The table freezes what has been assigned. A late old id gets the next free number.
  - The pattern already exists and is tested in feature 004. Reviewers can read the
    assignments in one place.
- **Alternatives**:
  - Numbers derived from `import/state/links.json`. That would be a new, cross-source mechanism
    in the pipeline for one hymnal (YAGNI).
  - Grouping by album (`parts`). The site does not show albums. This can be added later.
  - List order. It is unstable at the source.

## R3. Overlapping list pages (unstable paging)

- **Facts**: There are 3 pages of 20 rows. 60 rows give 50 distinct ids. 10 ids appear on two
  pages, and no order is visible. So some songs may appear on no page in a given run.
- **Decision**:
  1. Read every page up to the last one in `.pagination`, as today. Deduplicate by page id.
     Report "rows read / distinct songs" (FR-005) with `ctx.log`.
  2. **Pinned ids are always listed**: `listEntries` returns the union of the ids seen in the
     list and the ids in `CDL_PINNED.exo`. It logs the pinned ids that were not seen in this
     run (`exo N: /<id> pinned but not in the list this run`).
  3. At implementation, read the list several times (with the cache bypassed or expired). Also
     try the site's sort parameters if there are any. The aim is to collect every id before
     freezing the table. Record the final count in the fixtures README.
- **Result (2026-11-13)**:
  - Three reads gave the same 50 ids, and the site offers no sort parameter.
  - The author pages showed Exo songs missing from the list. Checking each page id in 690–800
    and 1300–1340 for "Exo" in its credits found **60 Exo songs**, which matches the 60 listing
    slots. The 10 hidden ones are 736, 751, 768, 769, 786, 787, 788, 1317, 1318 and 1319.
  - All 60 are pinned. The union in rule 2 is what imports the hidden 10, so this rule is
    needed for completeness, not only to avoid flapping.
- **Rationale**:
  - The pipeline flags as `missing` any linked entry absent from a hymnal's listing (reconcile).
    With flaky paging, songs would switch between missing and active on every run.
  - With the union, a song is reported only when its page actually fails to load (US3 #4, as
    amended).
- **Alternative**: Accept the flapping and let the maintainer ignore it. That would be noisy,
  and it would break SC-004 (byte-identical re-runs, since `status` is written to the links).

## R4. Sections in Exo pages

- **Facts**: Song pages label sections "Couplet" (no number) and "Refrain". They can also
  contain an inline "(Refrain)" line that marks a repeat of the chorus.
- **Initial decision (superseded below)**:
  - Unnumbered "Couplet" sections are already numbered in order by `start()`.
  - A line that is only `(Refrain)` (or `(Refrain x2)` / `(bis)`) would be a repeat marker: it
    ends the open section and is counted as `repeat-marker`.
- **Result (implementation, 2026-11-13)**: "(Refrain)" is a `.chordpro-verse` line, but it is
  a **label**, not a repeat marker. In `/698` it opens a "Couplet" block whose lines are the
  refrain. In `/771` it is alone in a "Couplet" block, which means "repeat the refrain here".
  So the rule became:
  - a line that is only a bracketed section label (`(Refrain)`, `(Pont)`, `(Couplet 2)`…) is
    read as a label (`strippedMarkup['section-marker']`);
  - if it is the first line of a section, it retypes that section (a verse becomes a chorus,
    and the verse count is corrected);
  - otherwise it closes the section and labels the next one;
  - an empty section is dropped as before.

  `(bis)` and `(x2)` stay in the lyrics: they annotate a line. The rule found 7 labels in 6 Exo
  songs. `check` re-parses all cached JEM/AdF/CD pages, and their text is unchanged.

## R5. Copyright line

- **Facts**: Exo pages carry `section.copyright` ("© 2000 CHRIS CHRISTENSEN/ADMINISTRÉ PAR
  LTC"). The content schema (`src/lib/domain/schema.ts`) has no copyright field. No hymnal
  stores one: the cdl fixtures README says "(not stored)".
- **Decision**: Not stored. The spec was amended (FR-008, US1 #1, SC-002).
- **Rationale**: Storing it needs a schema and UI change for every hymnal. Constitution IV says
  a new hymnal needs no app change. Credits (authors) and the source URL are still shown.
  Adding copyright notices for all hymnals is a separate feature.

## R6. Songs shared with JEM

- **Decision**: Rely on the matching of feature 002 (`pipeline/match.ts`). No source priority is
  added for `exo`, because it has a single source. When an Exo song joins an existing JEM hymn,
  the reference text stays the one already chosen (`merge.ts`: no priority means no change).
  Possible duplicates go to `npm run import -- duplicates` for review.
- **Expectation**: Most Exo songs merge with a JEM hymn (JEM 3 and 4 include many Exo songs).
  The count is recorded in the quickstart after the first real run.
- **Result**: Only 4 of the 60 merged. The other same-title pairs had different lyrics and were
  recorded as `distinct` (quickstart, section 2).

## R7. Terms and rights

- **Decision**: Reuse the `cdl` source entry, including its terms, which were checked on
  2026-11-11 (no public use without permission), and `permission: "unknown"`. Add `exo` to its
  `hymnals`. The songs are `unconfirmed`, so they appear only in the personal-use build
  (constitution III).

## R8. Fixtures

- **Decision**: Add these fixtures to `tests/import/fixtures/cdl/`:
  - `listing-exo-page1.html`, `-page2.html`, `-page3.html`, with real overlaps;
  - `hymn-698.html` ("Si tu veux le louer": two authors, the "(Refrain)" marker);
  - `hymn-1320.html` (one author, "Refrain" + "Couplet").
  The existing `listing-exo.html` is replaced by the page-1 file. Add the fixtures to
  `index.json` and the README, with the same copyright notice as the other fixtures (test use
  only).
