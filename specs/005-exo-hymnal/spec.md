# Feature Specification: Exo Hymnal

**Feature Branch**: `005-exo-hymnal`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "I would like to add Exo songs. Their list are available at
https://www.conducteurdelouange.com/chants/recueil/6?page=x with x={1,2,3}"

## Context

Exo is a French-speaking worship group. Its songs are published on conducteurdelouange.com, a
site the app already imports from (feature 002: JEM, Ailes de la Foi, Célébrons Dieu). The hymnal
"Exo" is already declared in the app (abbreviation "Exo"), but it holds no songs: the importer
skips every Exo song, because the site gives them no number (002 research R13).

Facts observed on the site (2026-11-13) that shape this feature:

- The Exo list is the site's hymnal no. 6, `/chants/recueil/6`, on 3 pages of 20 rows.
- **The pages overlap**: 60 rows hold only **50 distinct songs**; 10 songs appear on two pages.
  The site's paging is not stable, so some songs may never appear on any page.
- Rows show only the title and the hymnal name: **no number**, no author, no album, no year.
- Each song has its own page (`/<id>`, ids seen: 698–795 and 1312–1326) with the lyrics, labelled
  sections ("Couplet", "Refrain", inline "(Refrain)"), the authors (no role) and a copyright line
  (e.g. "© 2000 CHRIS CHRISTENSEN/ADMINISTRÉ PAR LTC", "© Copyright 2006 Chris Christensen/SUISA").
- These pages use the same layout as the JEM, AdF and CD pages already imported from this site.
- Many Exo songs are also in JEM, with the same lyrics.

This feature fills the Exo hymnal from conducteurdelouange.com, using the import pipeline of
feature 002. The person who runs it is the **content maintainer**; end users see the result
through feature 001 (browse and search) and feature 003 (collections).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import the Exo songs (Priority: P1)

The maintainer runs the import for the Exo hymnal from conducteurdelouange.com. The import reads
the three list pages, keeps each song once, fetches each song page, extracts the title, the lyrics
with their sections and the credits, and writes the songs as entries of the Exo hymnal. Each song
gets a stable number, since the source has none. The import report lists what was imported, what
was skipped and what joined a hymn of another hymnal.

**Why this priority**: This is the whole request: the Exo songs become available in the app.

**Independent Test**: Run the import against saved copies of the three list pages and of a few
song pages, then check that the hymns pass the content validation and match their source pages
word for word.

**Acceptance Scenarios**:

1. **Given** the song page "Si tu veux le louer", **When** the import runs, **Then** a hymn exists
   with that title, an Exo entry with a number, its sections in source order with their type, its
   authors (Chris Christensen, Thierry Ostrini), the source URL and the retrieval date.
2. **Given** a song listed on two list pages, **When** the import runs, **Then** it is imported
   once, with one Exo number.
3. **Given** an imported Exo song, **When** its lyrics are compared with the source page, **Then**
   the text is identical apart from whitespace and line-break cleanup, and contains no chords.
4. **Given** the import is done, **When** the content is built, **Then** the Exo hymnal shows its
   songs in the app, and they follow the same rights rules as every other imported hymn.

---

### User Story 2 - Find Exo songs in the app (Priority: P1)

A user searches for "Exo 12", for a title such as "Dieu de l'impossible", or for a fragment of
lyrics, and finds the Exo song. They can filter results to the Exo hymnal and add its songs to a
collection.

**Why this priority**: An imported hymnal is only useful if the app finds and shows it like the
others. Features 001 and 003 already do this for any hymnal, so this is mostly a check.

**Independent Test**: After a content build, search by hymnal and number, by title and by lyrics;
filter by Exo; open a song and add it to a collection.

**Acceptance Scenarios**:

1. **Given** Exo is imported, **When** the user types "Exo" and a number, **Then** the matching
   song is the first result.
2. **Given** Exo is imported, **When** the user filters by hymnal, **Then** Exo is offered and
   shows only its songs.
3. **Given** an Exo song that is also in JEM, **When** the user opens it, **Then** they see one
   song with both references ("Exo n", "JEM n").

---

### User Story 3 - Keep Exo numbers stable over time (Priority: P2)

The site may add Exo songs or reorder its list. Weeks later, the maintainer re-runs the import.
New songs get new numbers; existing songs keep theirs; changed lyrics are proposed, not applied
silently; songs no longer listed are flagged, not deleted.

**Why this priority**: The numbers are made up by us. If they shift, saved collections and users'
memory of "Exo 12" break. Needed as soon as the hymnal is used.

**Independent Test**: Import the hymnal, then re-run it against list pages with one extra song,
one song missing and the rows in another order.

**Acceptance Scenarios**:

1. **Given** the hymnal is imported and the source is unchanged, **When** the import runs again,
   **Then** no content file changes.
2. **Given** the list pages show the same songs in another order, **When** the import runs again,
   **Then** no song changes number.
3. **Given** a new Exo song is listed, **When** the import runs again, **Then** it gets the next
   free number and no existing song changes number.
4. **Given** a numbered song is no longer listed, **When** the import runs again, **Then** the
   report says so; if its page is gone too, it is reported as a failure; in both cases the song is
   kept with its number.

### Edge Cases

- **Songs missing from every list page** because of the site's unstable paging: the report gives
  the number of distinct songs found, so a shortfall can be seen; a re-run picks up songs found
  later and gives them the next free numbers. A song that already has a number is still imported
  when a later run does not see it in the list, so it is not wrongly reported as missing.
- **An Exo song already in another hymnal** (often JEM): if the lyrics match, it joins that hymn
  as an extra entry (feature 002 matching); the text already chosen for that hymn is kept,
  following the existing source priority. Doubtful pairs are listed as possible duplicates.
- **The same song page is also listed in another hymnal of the site** (same page id): it is one
  hymn with both entries.
- **Inline section markers** such as "(Refrain)" inside a verse, or a section labelled only
  "Couplet" with no number: verses are numbered in order; an inline "(Refrain)" marks a repeat of
  the chorus and is not kept as a line of lyrics.
- **Repeated sections or lines** in the source: kept as in the source.
- **A song page with no lyrics** or that fails to load: skipped and listed in the report with its
  reason and URL; the rest is imported.
- **The source site is unreachable or blocks requests**: the import stops cleanly, keeps existing
  content and reports it (feature 002 rules).

## Requirements *(mandatory)*

### Functional Requirements

**Hymnal and source**

- **FR-001**: The existing Exo hymnal MUST receive the songs of the site's Exo list; its name,
  abbreviation ("Exo") and place in the hymnal order stay as they are.
- **FR-002**: conducteurdelouange.com MUST be recorded as a source of the Exo hymnal, with the
  terms of use and permission status already recorded for that site ("unknown" until a decision).
- **FR-003**: Adding Exo MUST NOT require any change to the app (constitution IV); only data and
  the import's description of the site's Exo list are added.

**Listing and numbering**

- **FR-004**: The import MUST read every page of the site's Exo list (3 pages today, more if the
  list grows) and keep each song once, identified by its song page.
- **FR-005**: The report MUST state the number of rows read and of distinct songs found.
- **FR-006**: Each song MUST receive a number in the Exo hymnal, starting at 1, assigned in the
  order of the site's song identifiers (oldest first), which does not depend on the list order.
- **FR-007**: Once assigned, a song's number MUST never change or be reused, even if songs are
  added, removed or reordered at the source; new songs take the next free number.

**Extraction**

- **FR-008**: For each song page, the import MUST extract the title, the lyrics sections (type,
  number, lines) in source order and the authors (role unspecified, as for the site's other
  hymnals). The copyright line is not stored, as for every other hymnal (plan research R5).
- **FR-009**: Chords, section markers that are not lyrics, links and page furniture MUST NOT appear
  in the lyrics.
- **FR-010**: A song page with no lyrics MUST be skipped and listed in the report with its reason
  and URL.
- **FR-011**: Scores, chords, ChordPro files and audio MUST NOT be imported (out of scope, as in
  feature 002).

**Rules inherited from feature 002**

- **FR-012**: The import MUST follow every rule of feature 002: lyrics faithful to the source,
  source URL and retrieval date per hymn, rights status "not confirmed" until a decision, local
  copy of each page, idempotent re-runs, no overwriting of manual work, reporting of changes and
  missing songs, matching with other hymnals, respect of the site's robots rules and a request
  rate of at most one per second.

### Key Entities

- **Exo hymnal**: Already declared. Name "Exo", abbreviation "Exo", place in the hymnal order.
- **Exo list**: The site's list of Exo songs (hymnal no. 6), split over several pages that may
  overlap. Each row gives a title and a song page.
- **Number assignment**: The lasting link between an Exo song and its made-up number.
- **Hymn, Hymnal entry, Section, Credit, Source**: as defined in features 001 and 002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All Exo songs of the site (60 on 2026-11-13, 50 of them visible in its list) are
  either imported or listed in the report with a reason; none is imported twice.
- **SC-002**: On a manual check of 10 imported Exo songs, 100% have lyrics identical to the source
  page, with no chord or page text mixed in, and show their authors and source URL.
- **SC-003**: After a content build, searching "Exo" plus a number, or a title, returns the right
  song as the first result for 100% of 10 test queries.
- **SC-004**: Re-running the import against an unchanged source changes 0 content files; after the
  list is reordered or a song is added, 0 existing songs change number.
- **SC-005**: 0 Exo songs without a rights decision appear in a published (non-personal) build.

## Assumptions

- Numbers are made up, like those of psalmodie.ch, ecrituremusique.com and Evangile21: the source
  has none, and every hymnal entry needs one. The site's song identifiers grow as songs are added,
  so "oldest first" by identifier is stable when new songs arrive and does not depend on the
  unstable list order.
- Exo albums are not shown on the site, so the Exo hymnal page is not split by album. Grouping by
  album can be added later from another source.
- The live site is reachable by the importer, as for the JEM, AdF and CD imports from the same
  site; no saved pages are needed.
- Exo songs already imported through JEM keep the text chosen by the existing source priority;
  the Exo import only adds the Exo entry to them.
- Permission to republish has not been obtained. As with the other sources, the hymns stay "not
  confirmed" and only appear in the maintainer's personal-use build until a rights decision is
  recorded (constitution III).
- Out of scope: chords and ChordPro files offered by the site, audio, and Exo songs not listed in
  the site's Exo list.
