# Feature Specification: Evangile21 Hymnal

**Feature Branch**: `004-evangile21-hymnal`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "I would like to add a new Recueil which would be called
"Evangile21". You can find the list of all the songs and the links that leads to the lyrics for
each one of them in the following file. [File: Chants Hymnes21 Archives - Evangile 21.html]"

## Context

Evangile 21 (evangile21.thegospelcoalition.org, the French-speaking branch of The Gospel
Coalition) publishes the songs of its **Hymnes21** project in a series called "Chants
Hymnes21". Each song has its own page with the lyrics, the sections labelled ("Couplet 1",
"Refrain"…), and download links for scores and chords. The maintainer supplied a saved copy of
the series page (`Chants Hymnes21 Archives - Evangile 21.html`), which lists 44 song pages.

Facts observed in that list that shape this feature:

- Songs have **no number** at the source. The hymnal is ordered only by publication date.
- Song pages live under several paths (`/article/…`, `/video/…`, `/pasteur-compagnie/…`).
- The "author" shown in the list is the author of the page (often Philippe Viguier, Kevin
  Stauffer or "Hymnes21"), not always the author or translator of the song.
- "Psaume 150" appears twice: once as an article page, once as a video page.
- A few entries are articles *about* a song (its history or its making), e.g. "O Viens Peuple
  Infidèle", "Chantons le chant d'Emmanuel", "Par ta grâce infinie". They may or may not
  contain the full lyrics.
- Many songs are French versions of classic hymns ("Roc des âges", "Mon Dieu plus près de
  toi", "Hymne à la joie") that also exist in other hymnals, often in a different translation.

This feature adds Evangile21 as a new hymnal and Evangile 21 as a new source, using the import
pipeline of feature 002. The person who runs it is the **content maintainer**; end users see the
result through feature 001 (browse and search) and feature 003 (collections).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import the Evangile21 hymnal (Priority: P1)

The maintainer runs the import for the Evangile21 hymnal. The import reads the list of songs of
the "Chants Hymnes21" series, fetches each song page, extracts the title, the lyrics with their
sections and the credits, and writes the hymns as content of a new hymnal "Evangile21". Each
song gets a stable number, since the source has none. The import report lists what was imported
and what was skipped.

**Why this priority**: This is the whole value of the request: the songs become available in
the app. Everything else refines it.

**Independent Test**: Run the import against saved copies of the series page and of a few song
pages, then check that the hymns pass the content validation and match their source pages word
for word.

**Acceptance Scenarios**:

1. **Given** the song page "Roc des âges", **When** the import runs, **Then** a hymn exists with
   the title "Roc des âges", an Evangile21 entry with a number, its sections in source order with
   their type and number ("Couplet 1" → verse 1, "Refrain" → chorus), the source URL and the
   retrieval date.
2. **Given** an imported song, **When** its lyrics are compared with the source page, **Then**
   the text is identical apart from whitespace and line-break cleanup.
3. **Given** a song page, **When** it is imported, **Then** the download links, page headings
   ("Téléchargements", "Partitions", "Accords", "Paroles :"), embedded videos and commentary
   around the lyrics are not part of the lyrics.
4. **Given** an entry of the series that holds no lyrics (an article about a song), **When** the
   import runs, **Then** it is skipped and listed in the report with the reason and URL, and the
   rest of the hymnal is imported.
5. **Given** the import is done, **When** the content is built, **Then** the hymnal
   "Evangile21" appears in the app with its songs, and its songs follow the same rights rules as
   every other imported hymn.

---

### User Story 2 - Find Evangile21 songs in the app (Priority: P1)

A user searches for "Evangile21 12", for a title such as "Sois seul ma vision", or for a
fragment of lyrics, and finds the Evangile21 song. They can filter results to the Evangile21
hymnal, and add its songs to a collection.

**Why this priority**: An imported hymnal is only useful if the app finds and shows it the same
way as the others. This comes for free from features 001 and 003 if the data is correct, so it
is mostly a check.

**Independent Test**: After a content build, search by hymnal and number, by title and by
lyrics; filter by the Evangile21 hymnal; open a song and add it to a collection.

**Acceptance Scenarios**:

1. **Given** Evangile21 is imported, **When** the user types the hymnal abbreviation and a
   number, **Then** the matching song is the first result.
2. **Given** Evangile21 is imported, **When** the user filters by hymnal, **Then** Evangile21 is
   offered as a filter and shows only its songs.
3. **Given** an Evangile21 song is open, **When** the user reads its credits, **Then** they see
   "Evangile21" with its number, the known authors and translators, and the source page.

---

### User Story 3 - Keep the hymnal stable over time (Priority: P2)

Evangile 21 publishes new songs from time to time. Weeks later, the maintainer re-runs the
import. New songs are added with new numbers; existing songs keep their numbers; changes to the
text of a song are proposed, not applied silently; songs removed from the series are flagged,
not deleted.

**Why this priority**: The numbers are made up by us. If they shift when a song is added, saved
collections and users' memory of "Evangile21 12" break. Needed as soon as the hymnal is used.

**Independent Test**: Import the hymnal, then re-run it against a series list with one extra,
newer song and one modified song page.

**Acceptance Scenarios**:

1. **Given** the hymnal is imported and the source is unchanged, **When** the import runs again,
   **Then** no content file changes.
2. **Given** a new song was published, **When** the import runs again, **Then** it gets the next
   free number and no existing song changes number.
3. **Given** the text of a song changed at the source, **When** the import runs again, **Then**
   the change is listed in the report and applied only after the maintainer accepts it.
4. **Given** a song was removed from the series, **When** the import runs again, **Then** it is
   reported as "missing at source" and kept.

---

### User Story 4 - Link Evangile21 songs to the same hymn in other hymnals (Priority: P3)

When an Evangile21 song is the same text as a hymn already in another hymnal, the app shows one
hymn with both entries. When it is a different translation of the same original hymn (common for
classics), it stays a separate hymn, and the doubtful pairs are proposed to the maintainer.

**Why this priority**: The matching rules of feature 002 already handle this; this story only
checks that they behave well on this hymnal, whose translations are often new.

**Independent Test**: Import Evangile21 alongside the existing hymnals and check the report's
merges and possible duplicates against a short list of known pairs.

**Acceptance Scenarios**:

1. **Given** an Evangile21 song whose lyrics match a hymn of another hymnal, **When** the import
   runs, **Then** one hymn exists with both entries.
2. **Given** an Evangile21 song with the same title as a hymn of another hymnal but different
   lyrics (a new translation), **When** the import runs, **Then** they stay separate and the
   pair is listed as a possible duplicate.

### Edge Cases

- The same song is listed twice in the series (e.g. "Psaume 150" as an article page and a video
  page): if the lyrics are the same, one hymn with one Evangile21 number is kept and the second
  page is recorded as an extra source; if they differ, both are kept as separate songs with their
  own numbers.
- A title carries an English original or a qualifier in parentheses ("Seigneur, mon Roc et mon
  Rédempteur (O Lord, my Rock and my Redeemer)", "En mémoire de ton nom (chant)",
  "Alléluia, quel grand Sauveur (Philip Bliss)"): the title is kept as printed, so the English
  original can be searched; a site qualifier such as "(chant)" is removed.
- Section labels vary between pages ("Couplet 1", "COUPLET 1", "Refrain", "Pont", "Fin",
  "Intro"): each is mapped to a known section type; an unknown label is kept as its own section
  and flagged in the report rather than dropped.
- Lines are repeated in the source ("Pour une vie nouvelle" three times): kept as in the source.
- The lyrics are interrupted by download links, images, a video or ads: these are removed, the
  lyrics are kept whole.
- The page credits are missing or name only the page author: the hymn is imported with the
  credits found in the lyrics page (authors, translators, composers), and with empty credits if
  none, flagged in the report. The page author alone is not recorded as the song's author.
- The series list is longer than one page at the source: all pages of the list are read.
- The source site is unreachable or blocks requests: the import stops cleanly, keeps existing
  content, and reports it (feature 002 rules).

## Requirements *(mandatory)*

### Functional Requirements

**Hymnal and source**

- **FR-001**: The app MUST offer a new hymnal named "Evangile21", with the abbreviation
  "Evangile21" (and "E21" as an alternative), placed after the existing hymnals in the hymnal
  order.
- **FR-002**: Evangile 21 MUST be recorded as a new source, with its address, the hymnal it
  covers, its terms of use as found on the site, and the permission status "unknown" until a
  decision is recorded.
- **FR-003**: Adding this hymnal and source MUST NOT require any change to the app (constitution
  IV); only data, the source description and its extraction are added.

**Listing and numbering**

- **FR-004**: The import MUST build the list of songs from the "Chants Hymnes21" series of the
  site, reading every page of that list.
- **FR-005**: Each song MUST receive a number in the Evangile21 hymnal, assigned in order of
  publication, oldest first, starting at 1.
- **FR-006**: Once assigned, a song's number MUST never change or be reused, even if songs are
  added, removed or reordered at the source; new songs take the next free number.

**Extraction**

- **FR-007**: For each song page, the import MUST extract the title, the lyrics sections (type,
  number, lines) in source order, and the credits found on the page (authors, composers,
  translators, with their roles when stated).
- **FR-008**: Download links, headings that are not lyrics, embedded media, commentary and
  advertising MUST NOT appear in the lyrics.
- **FR-009**: A series entry with no lyrics MUST be skipped and listed in the report with its
  reason and URL.
- **FR-010**: Two series entries carrying the same lyrics MUST produce one hymn with one
  Evangile21 number; both pages are recorded as its sources.
- **FR-011**: An English original title given in the page title MUST stay searchable; it is
  kept in the hymn title as printed. Site qualifiers such as "(chant)" are removed.
- **FR-012**: Scores, chords, audio and video found on the page MUST NOT be imported (out of
  scope, as in feature 002).

**Rules inherited from feature 002**

- **FR-013**: The import MUST follow every rule of feature 002: lyrics faithful to the source,
  source URL and retrieval date per hymn, rights status "not confirmed" until a decision, local
  copy of each page, idempotent re-runs, no overwriting of manual work, reporting of changes and
  missing songs, matching with other hymnals, respect of the site's robots rules and a request
  rate of at most one per second.

### Key Entities

- **Evangile21 hymnal**: The new hymnal. Name "Evangile21", abbreviations, place in the hymnal
  order.
- **Evangile 21 source**: The site the songs come from. Address, hymnal covered, terms of use,
  permission status, request limits.
- **Series entry**: One item of the "Chants Hymnes21" list. Title, page URL, publication date,
  page author. Several entries may lead to the same song.
- **Number assignment**: The lasting link between a song and its made-up Evangile21 number.
- **Hymn, Hymnal entry, Section, Credit**: as defined in features 001 and 002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every song page of the series that holds lyrics is imported; with the supplied list
  (44 entries), every entry is either imported or listed in the report with a reason.
- **SC-002**: On a manual check of 10 imported Evangile21 songs, 100% have lyrics identical to
  the source page, with no download link or heading mixed in, and show their source URL.
- **SC-003**: After a content build, searching "Evangile21" plus a number, or a title, returns
  the right song as the first result for 100% of 10 test queries.
- **SC-004**: Re-running the import against an unchanged source changes 0 content files; after
  adding a newer song at the source, 0 existing songs change number.
- **SC-005**: 0 Evangile21 songs without a rights decision appear in a published (non-personal)
  build.

## Assumptions

- The hymnal is called "Evangile21" as requested, even though the site calls the project
  "Hymnes21". The site name stays visible through the source of each song.
- Numbers are made up, like those of psalmodie.ch and ecrituremusique.com (feature 002 research):
  the source has none, and every hymnal entry needs one. Oldest first keeps them stable when new
  songs arrive.
- The live series list on the site is the source of truth; the supplied saved page is the
  baseline used to check completeness and to build test fixtures.
- The site blocks automated requests (Cloudflare challenge). By the maintainer's decision
  (2026-11-12), the importer never requests it: the maintainer saves the series page and the song
  pages from a browser, and the import works from those saved pages.
- Permission to republish has not been obtained from Evangile 21. As with the other sources, the
  hymns stay "not confirmed" and only appear in the maintainer's personal-use build until a
  rights decision is recorded (constitution III).
- No other change to the app is expected: browse, search, filters and collections already work
  for any hymnal.
- Out of scope: scores, chords, audio and video offered by the site, and the other series of the
  site (podcasts, articles, "Chantons les Psaumes" outside the "Chants Hymnes21" series).
