# Feature Specification: Import Hymnals from Source Sites

**Feature Branch**: `002-hymnal-import`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "the import pipeline"

## Context

Feature 001 (browse and search) reads validated content files whose format is fixed by
`specs/001-hymnal-browse-search/contracts/content-schema.md`. This feature fills those files
from the identified source sites (constitution, "Contenu et sources"):

| Source | Hymnals | Extra data |
|--------|---------|------------|
| conducteurdelouange.com | AdF, JEM, Exo, CD, ATG | Authors, composers, (chords) |
| jemaf.fr | JEM, AdF, ATG | Authors, composers, (chords), MP3 audio |
| psalmodie.ch | Chorale Psalmodie | Authors, composers |
| ecrituremusique.com | Écritures | — |

The person using this feature is the **content maintainer**: the person who runs the import,
reviews its results and decides what gets published. End users only see the result through
feature 001.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import one hymnal from one source (Priority: P1)

The maintainer runs the import for one hymnal from one source (e.g. JEM from
conducteurdelouange.com). The import fetches every hymn of that hymnal, extracts title,
number, lyrics structure (verses, chorus, bridge) and credits, and writes content files in the
format feature 001 expects. Every imported hymn records its source URL and retrieval date, and
is marked "rights not confirmed" so nothing is published by accident.

**Why this priority**: Without this, the app has no content beyond the sample set. One hymnal
from one source is already a usable slice of value.

**Independent Test**: Run the import for one hymnal against a saved copy of a few source pages,
then check the produced files pass the content validation of feature 001 and match the source
pages word for word.

**Acceptance Scenarios**:

1. **Given** a source page for JEM 245, **When** the import runs, **Then** a hymn file exists
   with title, entry "JEM 245", sections in source order with their type and number, credits
   with their roles, source URL and retrieval date.
2. **Given** an imported hymn, **When** its lyrics are compared with the source page, **Then**
   the text is identical apart from whitespace and line-break cleanup (no rewording, no
   spelling changes).
3. **Given** a freshly imported hymn, **When** the content is built, **Then** the hymn has the
   rights status "not confirmed" and is not published.
4. **Given** a source page that cannot be parsed (unexpected layout, missing lyrics), **When**
   the import runs, **Then** that hymn is skipped, listed in the import report with the reason
   and URL, and the rest of the hymnal is imported.

---

### User Story 2 - Re-run an import safely (Priority: P1)

Weeks later the maintainer runs the same import again, to pick up new hymns or source fixes.
The re-run produces the same result when nothing changed at the source, adds new hymns, flags
hymns whose source text changed, and never overwrites manual work (corrections, rights
decisions, merges).

**Why this priority**: The constitution requires reproducible, idempotent imports. Without
this, every re-run risks destroying review work, so the maintainer could only import once.

**Independent Test**: Import a hymnal, make a manual correction and confirm rights on one hymn,
then re-run the import twice: the first re-run against unchanged sources, the second against a
modified source page. Check the outcomes below.

**Acceptance Scenarios**:

1. **Given** an import already done and unchanged sources, **When** the import runs again,
   **Then** no content file changes.
2. **Given** a new hymn appeared at the source, **When** the import runs again, **Then** it is
   added with rights "not confirmed" and listed as new in the report.
3. **Given** the source text of a hymn changed, **When** the import runs again, **Then** the
   report lists the hymn with a before/after comparison, and the stored text is only replaced
   once the maintainer accepts the change.
4. **Given** a hymn with a manual correction and a confirmed rights status, **When** the import
   runs again, **Then** the correction and the rights status are kept.
5. **Given** a hymn no longer exists at the source, **When** the import runs again, **Then** it
   is flagged as "missing at source" in the report and is not deleted.

---

### User Story 3 - Recognise the same hymn across hymnals and sources (Priority: P2)

"À toi la gloire" exists in JEM, in À Toi la Gloire, and on two different sites. The import
recognises these as one hymn with several hymnal entries, instead of creating duplicates.
Obvious matches are merged automatically; doubtful ones are proposed to the maintainer.

**Why this priority**: The constitution requires a unified multi-hymnal model (Principle IV);
duplicates would pollute search results. It only matters once at least two hymnals or two
sources are imported.

**Independent Test**: Import two hymnals that share known hymns, then check the shared hymns
exist once with both entries, and that a near-match (same title, different lyrics) is proposed
rather than merged.

**Acceptance Scenarios**:

1. **Given** JEM and ATG both contain "À toi la gloire" with the same lyrics, **When** both are
   imported, **Then** one hymn exists with entries for both hymnals.
2. **Given** two hymns share a title but their lyrics differ substantially, **When** the
   import runs, **Then** they are kept separate and the pair is listed as "possible duplicate"
   for review.
3. **Given** the maintainer confirms or rejects a proposed merge, **When** the import is re-run,
   **Then** the decision is kept and the pair is not proposed again.
4. **Given** the same hymn comes from two sources with slightly different text, **When** they
   are merged, **Then** one text is kept as reference according to a source priority per hymnal,
   and the other source is recorded.

---

### User Story 4 - Review an import and confirm rights (Priority: P2)

After an import, the maintainer reads a report summarising what happened, then confirms the
rights status for a hymnal or a source as a whole (e.g. "permission obtained from JEM on
2026-12-01"), or hymn by hymn for exceptions such as public-domain hymns. Only then is the
content published.

**Why this priority**: The constitution forbids publishing content whose rights are not
confirmed (Principle III). This is the gate between importing and publishing.

**Independent Test**: Run an import, read the report, confirm rights for one hymnal, build the
content, and check that exactly that hymnal's hymns become published.

**Acceptance Scenarios**:

1. **Given** an import finished, **When** the maintainer opens the report, **Then** it shows,
   per hymnal: hymns imported, new, changed, unchanged, skipped (with reasons), missing at
   source, and possible duplicates.
2. **Given** the maintainer records a rights decision for a hymnal with its basis (permission,
   licence, public domain) and date, **When** content is built, **Then** that hymnal's hymns
   are published.
3. **Given** a rights decision exists for a hymnal, **When** a hymn is added to that hymnal by a
   later import, **Then** it inherits the decision and the report says so.
4. **Given** a single hymn is marked public domain, **When** the hymnal it belongs to is not
   confirmed, **Then** only that hymn is published.

---

### User Story 5 - Add a new source or hymnal (Priority: P3)

The maintainer adds a new hymnal (e.g. Arc-en-ciel) or a new source site. This requires
describing the hymnal and writing the extraction for that source, but no change to the app or
to the other sources.

**Why this priority**: The constitution requires that adding a hymnal never touches the app
code. Needed once the first sources are in place.

**Independent Test**: Add a hymnal definition and a source extraction for a test source, run
it, and check the app shows the new hymnal after a content build, with no app change.

**Acceptance Scenarios**:

1. **Given** a new hymnal definition (name, abbreviations, order) and its source, **When** the
   import runs, **Then** the hymnal appears in the content files and in the app after a build.
2. **Given** one source's extraction is broken, **When** the maintainer imports other sources,
   **Then** those imports are unaffected.

### Edge Cases

- A source site is unreachable or times out: the import stops cleanly for that source, keeps
  existing content untouched, and reports the failure.
- The source rate-limits or blocks requests: the import slows down and retries a bounded number
  of times, then reports which pages were not fetched.
- A source changes its page layout: most hymns fail to parse; the import detects a high failure
  rate, stops that source, and reports it rather than writing partial garbage.
- A hymnal number has a suffix ("123a", "123 bis") or a hymnal has gaps in its numbering: kept
  as in the source.
- The same hymnal number is found for two different hymns within one source: both are reported
  as a conflict and neither replaces existing content.
- Lyrics contain special characters (’ vs ', «  », œ, non-breaking spaces): stored in Unicode
  NFC without changing the visible text.
- Repeated chorus written once at the source vs. after each verse: stored as in the source; the
  structure is not invented.
- A hymn has no credits at the source: imported with empty credits, flagged in the report.
- Chord symbols or musical annotations mixed into the lyrics at the source: removed from the
  lyrics and not stored (chords are a later feature).
- An import is interrupted midway: the next run resumes or restarts without leaving
  half-written content files.
- A user saved a hymn in a collection (feature 003) and the import then merges it into another
  hymn, corrects its number, or unpublishes it: the saved entry follows the hymn it was saved
  for, or shows "Chant indisponible". It never opens a different hymn.
- The sample hymnals of feature 001 (`ce`, `he`) are fictional: they leave the published app
  before real hymnals are published, and their ids are never reused.

## Requirements *(mandatory)*

### Functional Requirements

**Importing**

- **FR-001**: The maintainer MUST be able to run an import for a chosen source and a chosen
  hymnal, or for all hymnals of a source.
- **FR-002**: The import MUST extract, for each hymn: title, hymnal and number, lyrics sections
  (type, number, lines) in source order, and credits (name and role).
- **FR-003**: The import MUST produce content files that follow the content schema of feature
  001; any file that fails that schema MUST NOT be written.
- **FR-004**: Imported lyrics MUST match the source text; only whitespace, line-break cleanup
  and Unicode normalisation (NFC) are allowed. Any other change MUST be recorded as a correction.
- **FR-005**: Each imported hymn MUST record its source name, source page URL and retrieval
  date.
- **FR-006**: A newly imported hymn MUST have the rights status "not confirmed", unless a rights
  decision already covers its hymnal or source.
- **FR-007**: Chords, audio and other musical data present at the source MUST NOT be imported
  in this feature.
- **FR-008**: The import MUST keep a local copy of each fetched source page, so that extraction
  can be re-run and tested without contacting the source again.

**Re-running**

- **FR-009**: Running the same import twice against unchanged sources MUST produce identical
  content files.
- **FR-010**: A re-run MUST NOT overwrite manual corrections, rights decisions or merge
  decisions.
- **FR-011**: When the source text of an existing hymn changes, the import MUST report the
  change with a before/after comparison and MUST apply it only after the maintainer accepts it.
- **FR-012**: A hymn no longer found at the source MUST be reported and MUST NOT be deleted
  automatically.
- **FR-013**: An interrupted import MUST NOT leave partially written content files.

**Matching across hymnals and sources**

- **FR-014**: The import MUST merge a hymn found in several hymnals or sources into one hymn
  with several hymnal entries when title and lyrics match after normalisation.
- **FR-015**: Pairs with a similar title or similar lyrics that do not meet the merge rule MUST
  be listed as possible duplicates for the maintainer to confirm or reject.
- **FR-016**: Merge and reject decisions MUST be kept and applied on every later run.
- **FR-017**: When two sources provide the same hymn, the reference text MUST come from the
  source with the highest priority for that hymnal; the maintainer MUST be able to set this
  priority per hymnal.

**Review and rights**

- **FR-018**: Each import run MUST produce a report listing, per hymnal: imported, new, changed,
  unchanged, skipped (with reason and URL), missing at source, possible duplicates and conflicts.
- **FR-019**: The maintainer MUST be able to record a rights decision for a source, a hymnal or
  a single hymn, with its basis (permission, licence, public domain), date and a free note.
- **FR-020**: Rights decisions MUST be stored with the content, versioned, and shown in the
  report.

**Respect of sources**

- **FR-021**: The import MUST respect each source site's robots rules and MUST limit its request
  rate (at most one request per second per site by default).
- **FR-022**: The import MUST identify itself to source sites with a name and a contact address.
- **FR-023**: For each source, the maintainer MUST be able to record its terms of use and the
  permission status; an import from a source with no recorded status MUST warn the maintainer
  before fetching.

**Robustness and extensibility**

- **FR-024**: A source whose extraction fails for more than 20% of its pages in a run MUST be
  stopped for that run and reported, without writing its results.
- **FR-025**: Adding a hymnal or a source MUST NOT require any change to the app; failure of one
  source MUST NOT affect the import of others.

**Protecting saved collections (feature 003)**

- **FR-026**: When two hymns are merged, the import MUST record that the removed hymn id now
  leads to the kept one, and the published data MUST carry this record, so the app can follow it.
- **FR-027**: A collection entry saved by a user MUST stay attached to the hymn it was saved for:
  if its hymnal and number later point to a different hymn, or to nothing, the app MUST open the
  saved hymn under one of its current references, or show it as unavailable. It MUST never
  open a different hymn.
- **FR-028**: Hymnal ids and hymn ids, once published, MUST never be reused for something else;
  the sample hymnal ids `ce` and `he` are reserved.

### Key Entities

- **Source**: A site hymns are imported from. Name, base address, hymnals it covers, terms of
  use, permission status, request limits.
- **Source page**: The saved copy of one fetched page. URL, retrieval date, content fingerprint.
- **Import run**: One execution of the import. Date, sources and hymnals covered, outcome, and
  its report.
- **Import report**: Per-hymnal summary and the detailed lists of FR-018.
- **Rights decision**: A ruling on publication rights for a source, hymnal or hymn. Scope,
  basis, date, note. Determines the "rights" status of hymns in the content files.
- **Merge decision**: A maintainer's confirmation or rejection that two imported hymns are the
  same hymn.
- **Pending change**: A difference between stored text and new source text, waiting for the
  maintainer's decision.
- **Hymn redirect**: The record that a hymn id removed by a merge now leads to another hymn id.
  Published with the hymn data.
- **Hymn, Hymnal, Hymnal entry, Section, Credit, Correction**: as defined in feature 001's data
  model; this feature produces them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each imported hymnal, at least 98% of its hymns at the source are imported
  without manual intervention; the rest are listed in the report with a reason.
- **SC-002**: On a manual check of 50 randomly chosen imported hymns, 100% have lyrics identical
  to the source page and 100% show their source URL and retrieval date.
- **SC-003**: Re-running an import against unchanged sources changes 0 content files.
- **SC-004**: After a re-run, 100% of manual corrections, rights decisions and merge decisions
  are still in place.
- **SC-005**: On a reference list of at least 30 hymns known to appear in several hymnals, at
  least 90% are merged automatically and none of the known distinct hymns is merged wrongly.
- **SC-006**: 0 hymns without a rights decision appear in the published app.
- **SC-007**: A maintainer can add a new hymnal from an already-supported source in under 30
  minutes, with no change to the app.
- **SC-008**: After any import (merges, number corrections, unpublished hymns), 0 saved
  collection entries open a hymn other than the one they were saved for.

## Assumptions

- The maintainer is a single technically comfortable person (the project owner); no multi-user
  review workflow, accounts or web back-office is needed. Review happens through the report and
  decision files.
- Obtaining permission from source sites and rights holders is done outside this feature; this
  feature records the decisions and enforces them. Until a decision is recorded, nothing
  imported is published.
- Imports are run on demand by the maintainer, not on a schedule.
- The content files remain the single source of truth for the app; the import writes into them
  and feature 001's build validates and publishes them.
- All four sources listed in the context are in scope; they can be delivered one after another,
  starting with the source that covers the most hymnals (conducteurdelouange.com).
- Hymnals not covered by any listed source (Arc-en-ciel, Getty hymns) are out of scope until a
  source is identified; story 5 makes adding them possible.
- Out of scope: chords, audio, themes/tags, Bible verse links, and editing lyrics through an
  interface (later features).
