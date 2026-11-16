# Feature Specification: Pasteur & Compagnie Hymnal

**Feature Branch**: `010-pasteur-compagnie-hymnal`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "I would like to add Pasteur & Compagnie songs. Their list are
available at https://pasteuretcompagnie.com/collections/partitions?page=x with x=[1;9]"

**Update (2026-11-16)**: "You will find the list of the albums that contains the songs here
https://pasteuretcompagnie.com/collections/digital-albums. For each album, you have the songs'
list. Please use those lists to distinguish the songs and fill in the « parts » field for each."

## Context

Pasteur & Compagnie is the music project of Philippe Viguier. It publishes French versions of
classic and modern hymns (Getty, Townend, Sovereign Grace…) and its own songs. Its shop,
pasteuretcompagnie.com, offers each song as a free leadsheet. The shop is a new source for the
app.

Facts observed on the site (2026-11-16) that shape this feature:

- The "Partitions" list spans **9 pages**: 8 songs per page, 4 on the last page, **68 songs**.
  Every song appears once; no song appears on two pages.
- Every item is a free leadsheet (PDF score). The page of each song shows the **full lyrics** as
  text, and the score is a separate download.
- Rows show only the title. Songs have **no number**. Each song has a stable shop identifier that
  grows as songs are added, and a publication date (2020-02-20 to 2026-02-12).
- Titles often add the English original title in brackets ("Grâce infinie (Amazing Grace)",
  "Il me gardera (He Will Hold me Fast)"). A few add another note: "(partition)", "(jazzy)",
  "(Psaume 139)".
- The lyrics text is **not uniform**. Most songs label their sections ("Couplet 1", "Refrain",
  "Pont", "Pré-refrain", "Intro"). About 10 songs have no labels at all ("Rédempteur adorable",
  "Par la foi", "Chef couvert de blessures"…), sometimes with blank lines between stanzas,
  sometimes without.
- Credits are free text above the lyrics, in many forms: "Pat Sczebel", "Musique par John Wyeth,
  paroles par Robert Robinson. Pont par Shayne Barnard. Tr. Philippe Viguier.", "Domaine Public.
  Arrangement Philippe Viguier.", "ATG #258. Domaine public". Some lyrics text also holds notes
  that are not lyrics: product descriptions ("Le fichier en vente contient la grille
  d'accords…"), recording credits ("Violons: Obed Rajaiah", "DA, mix et mastering…"),
  "mp3 gratuit", "Paroles :".
- **Many songs are already in the app.** About 29 have the same title as an Evangile21 song
  (Evangile 21 also publishes Pasteur & Compagnie songs, feature 004), and about 12 more share a
  title with a JEM, ATG, AdF, CD, Arc-en-ciel or Exo song ("Grâce infinie", "O peuple fidèle",
  "Chef couvert de blessures"). Some of these are the same text; some are a different
  translation of the same hymn.
- One item, "Papa c'est quoi une âme ?", is a spoken dialogue between a father and his daughter
  around a sung part.

Facts observed in the shop's "Digital albums" list (2026-11-16), which gives the hymnal its
parts:

- It holds **6 album items**. Each one's description gives a numbered tracklist.

  | Album | Published | Tracks | Tracks with a song page |
  |-------|-----------|--------|-------------------------|
  | Hymnes21 2018 | 2020-02-21 | 9 | 9 |
  | Impros louange | 2020-11-21 | 14 | 11 |
  | Dans ses mains | 2020-11-29 | 10 | 8 |
  | KIDS | 2022-05-24 | 11 | 8 (+3 from the album's lyrics page) |
  | KIDS : pistes instrumentales | 2024-01-05 | 11 | the same tracks as KIDS |
  | Plus haut encore | 2026-02-12 | 11 | 9 (track 4 has no lyrics; track 11 is "L'espoir (instrumental)") |

- "KIDS : pistes instrumentales" is the instrumental version of KIDS, with the same tracklist.
  It is not a separate set of songs.
- Track titles are short forms of the song titles, sometimes with the singers in brackets
  ("Il me gardera (Alicia Roehrig & Philippe Viguier)", "A l'Agneau" for "A l'Agneau sur son
  trône", "Coule à flots (par-dessus tout)"). They match a song page by title.
- **4 songs are on two albums**: "Sois seul ma vision", "Viens suis-moi" and "Mon âme
  éveille-toi" (Hymnes21 2018 and Impros louange), and "Coule à flots" (Hymnes21 2018 and Plus
  haut encore).
- **27 song pages are on no album** (Christmas carols, psalms, single releases such as "Grâce
  infinie", "Psaume 150", "Notre espérance est en Christ").
- The KIDS album links to a lyrics page ("album-kids-paroles") with the lyrics of all 11 tracks.
  Three of them have no song page of their own: "L'évangile c'est de la bombe", "Cœur cassé" and
  "Bien dans ma peau".
- **6 tracks have no lyrics anywhere on the site**: "Dans la joie", "Rien ne peut sauver mon âme"
  and "Seigneur attire" (Impros louange), "Les cieux proclament" and "Entre tes mains" (Dans ses
  mains), and "C'était toujours toi" (Plus haut encore). Some may be hymns already in the app
  under the same title, but a title alone does not prove the same text.

This feature adds "Pasteur & Compagnie" as a new hymnal, split into parts that follow the
albums, and pasteuretcompagnie.com as a new source, using the import pipeline of feature 002. The person who runs it is the **content
maintainer**; end users see the result through feature 001 (browse and search) and feature 003
(collections).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import the Pasteur & Compagnie songs (Priority: P1)

The maintainer runs the import for the Pasteur & Compagnie hymnal. The import reads the 9 list
pages, fetches each song page, extracts the title, the lyrics with their sections and the
credits, and writes the songs as entries of the new hymnal. Each song gets a stable number,
since the source has none. The import report lists what was imported, what was skipped, what
joined a hymn of another hymnal and what needs a manual check.

**Why this priority**: This is the whole request: the Pasteur & Compagnie songs become available
in the app.

**Independent Test**: Run the import against saved copies of the list pages and of a few song
pages (one with labelled sections, one without, one with recording credits mixed in), then check
that the hymns pass the content validation and match their source pages word for word.

**Acceptance Scenarios**:

1. **Given** the song page "Jésus merci (Jesus Thank You)", **When** the import runs, **Then** a
   hymn exists titled "Jésus merci", with a Pasteur & Compagnie entry and a number, its sections
   in source order with their type (verse 1, chorus, verse 2, bridge…), the credit "Pat Sczebel",
   the source URL and the retrieval date.
2. **Given** the song page "L'espoir", **When** the import runs, **Then** "Violons: Obed
   Rajaiah" and "DA, mix et mastering: Cédric Dumoulin" are not in the lyrics, and "Philippe
   Viguier" is credited for words and music.
3. **Given** a song with no section labels and blank lines between its stanzas, **When** the
   import runs, **Then** each stanza becomes one section, in source order.
4. **Given** an imported song, **When** its lyrics are compared with the source page, **Then**
   the text is identical apart from whitespace and line-break cleanup, and contains no chords,
   section labels, credits or shop notes.
5. **Given** the import is done, **When** the content is built, **Then** the Pasteur & Compagnie
   hymnal shows its songs in the app, and they follow the same rights rules as every other
   imported hymn.

---

### User Story 2 - Browse the hymnal by album (Priority: P1)

A user opens the Pasteur & Compagnie hymnal and sees its songs grouped by album, oldest album
first, each album in its track order, then the songs that are on no album. The number of a song
tells its album and track: "P&C 307" is track 7 of the third album.

**Why this priority**: This is what the maintainer asked for: the albums are how the songs are
known and sung, and they give the songs numbers that mean something.

**Independent Test**: After a content build, open the hymnal page and check the parts, their
order and the songs in each, against the album tracklists.

**Acceptance Scenarios**:

1. **Given** the hymnal is imported, **When** the user opens it, **Then** they see the parts
   "Hymnes21 2018", "Impros louange", "Dans ses mains", "KIDS", "Plus haut encore" and "Hors
   album", and no part for the instrumental KIDS album.
2. **Given** the album "Dans ses mains", **When** the user looks at its part, **Then** "Il me
   gardera" is P&C 307 (track 7), and the songs follow the track order.
3. **Given** "Coule à flots" is track 5 of Hymnes21 2018 and track 5 of Plus haut encore, **When**
   the user opens the hymnal, **Then** it appears in both parts (P&C 105 and P&C 505), and both
   lead to the same song.
4. **Given** "Grâce infinie" is on no album, **When** the user opens the hymnal, **Then** it is in
   the "Hors album" part.
5. **Given** "Les cieux proclament" has no lyrics on the site, **When** the user opens the "Dans
   ses mains" part, **Then** number 305 is missing, and the import report lists the track.

---

### User Story 3 - Find Pasteur & Compagnie songs in the app (Priority: P1)

A user searches for "P&C 307", for a title such as "Sa grâce est plus grande", or for a fragment
of lyrics, and finds the song. They can filter results to the Pasteur & Compagnie hymnal and add
its songs to a collection.

**Why this priority**: An imported hymnal is only useful if the app finds and shows it like the
others. Features 001 and 003 already do this for any hymnal, so this is mostly a check.

**Independent Test**: After a content build, search by hymnal and number, by title and by
lyrics; filter by the hymnal; open a song and add it to a collection.

**Acceptance Scenarios**:

1. **Given** the hymnal is imported, **When** the user types "P&C" and a number, **Then** the
   matching song is the first result.
2. **Given** the hymnal is imported, **When** the user filters by hymnal, **Then** Pasteur &
   Compagnie is offered and shows only its songs.
3. **Given** a Pasteur & Compagnie song with the same text as an Evangile21 song, **When** the
   user opens it, **Then** they see one song with both references ("P&C n", "E21 n").
4. **Given** a Pasteur & Compagnie song that is a different translation of a hymn already in the
   app (e.g. "Grâce infinie" vs the JEM text), **When** the user searches its title, **Then**
   both songs are found, each with its own lyrics.

---

### User Story 4 - Keep the numbers stable over time (Priority: P2)

The shop adds songs and albums from time to time. Weeks later, the maintainer re-runs the import.
A new album becomes a new part; new songs get new numbers; existing songs keep theirs; changed
lyrics are proposed, not applied silently; songs no longer listed are flagged, not deleted.

**Why this priority**: The numbers are made up by us. If they shift, saved collections and
users' memory of "P&C 307" break. Needed as soon as the hymnal is used.

**Independent Test**: Import the hymnal, then re-run it against list pages with one extra song,
one song missing and the rows in another order.

**Acceptance Scenarios**:

1. **Given** the hymnal is imported and the source is unchanged, **When** the import runs again,
   **Then** no content file changes.
2. **Given** the list pages show the same songs in another order or over another number of
   pages, **When** the import runs again, **Then** no song changes number.
3. **Given** a new song on no album is listed, **When** the import runs again, **Then** it gets
   the next free "Hors album" number and no existing song changes number.
4. **Given** a new album is listed, **When** the import runs again, **Then** it becomes the next
   part (next free hundred), its songs are numbered by track, and no existing song changes
   number.
5. **Given** a song already numbered in "Hors album" appears on a new album, **When** the import
   runs again, **Then** it keeps its "Hors album" number and also gets its number in the new
   album.
6. **Given** a numbered song is no longer listed, **When** the import runs again, **Then** the
   report says so; in any case the song is kept with its number.

### Edge Cases

- **A song already in the app with the same text** (often Evangile21): it joins that hymn as an
  extra entry (feature 002 matching); the text already chosen for that hymn is kept, following
  the existing source priority. Doubtful pairs are listed as possible duplicates for the
  maintainer to decide.
- **A different translation of a hymn already in the app** (same title, different lyrics): it
  stays a separate hymn. The app already handles two hymns with the same title (e.g.
  "viens-et-vois" and "viens-et-vois-jem-82").
- **The same song with a few words different, or with lines added or missing** (e.g. "Sa grâce
  est plus grande" in Psalmodie, "Coule à flots" with the "Par-dessus tout" bridge): it stays a
  separate hymn, so each author's original version is kept. Only a text that differs in layout,
  punctuation, spelling of "œ" or section order joins an existing hymn (decision of 2026-11-16).
- **Titles with a bracketed note**: the English original title and "(partition)" are removed from
  the displayed title; any other note that tells versions apart or names a psalm ("(jazzy)",
  "(Psaume 139)") is kept. "Psaume 42 - Je le louerai encore (I will praise Him again)" becomes
  "Psaume 42 - Je le louerai encore".
- **Songs with no section labels**: stanzas separated by blank lines become separate sections,
  numbered as verses in order. A song whose stanzas cannot be told apart is imported as one
  section and listed in the report for a manual check.
- **Repeated sections written out in full** (a chorus after each verse): kept as in the source,
  with the chorus type when labelled.
- **Repeat marks** such as "(x4)" at the end of a line: kept as in the source, like in other
  hymnals.
- **Text that is not lyrics** inside the lyrics area (credits, shop descriptions, recording
  credits, "mp3 gratuit", "Paroles :", hymnal references like "A Toi Gloire 116", a repeated
  title heading): not kept as lyrics. Credits found there feed the hymn's credits. Lines the
  import cannot classify with confidence are listed in the report for a manual check rather than
  silently dropped or kept.
- **A song on two albums**: one hymn with one entry per album, one number in each part. The
  lyrics come from its single song page.
- **The instrumental KIDS album** and **instrumental tracks** ("L'espoir (instrumental)"): not
  parts or songs of their own. An album whose tracklist repeats another album's is reported and
  skipped.
- **An album track with no song page**: its lyrics are taken from a lyrics page that the album
  links to, when there is one (KIDS). Otherwise the track is skipped, its number stays free, and
  the report lists it with its album and track. The maintainer can then link it by hand to a
  hymn already in the app. The import never links it on title alone.
- **A KIDS song with both a song page and the album lyrics page**: the song page is the source,
  and the album lyrics page is not used for it.
- **A track title that matches no song page, or more than one**: the report lists it for a
  manual decision. The import does not guess.
- **An album description that changes** (a track added, removed or renumbered): existing
  numbers are kept, and the report lists the difference for a manual decision.
- **"Papa c'est quoi une âme ?"**, a spoken dialogue with a sung part: imported like any other
  song, with its text as published.
- **A song page with no lyrics** or that fails to load: skipped and listed in the report with its
  reason and URL; the rest is imported.
- **The source site is unreachable or blocks requests**: the import stops cleanly, keeps existing
  content and reports it (feature 002 rules).

## Requirements *(mandatory)*

### Functional Requirements

**Hymnal and source**

- **FR-001**: A new hymnal "Pasteur & Compagnie" MUST be declared, with the abbreviation "P&C"
  (search ignores punctuation, so "PC 307" finds it too), placed after the existing hymnals in the hymnal order, with the parts defined in
  FR-006a.
- **FR-002**: pasteuretcompagnie.com MUST be recorded as a new source of this hymnal, with its
  terms of use (checked on the import date) and a permission status of "unknown" until a
  decision is recorded.
- **FR-003**: Adding this hymnal MUST NOT require any change to the app (constitution IV); only
  data and the import's description of the shop's song list are added.

**Listing and numbering**

- **FR-004**: The import MUST read every page of the "Partitions" list (9 pages today, more or
  fewer if the list changes) and keep each song once, identified by its song page.
- **FR-004a**: The import MUST read the "Digital albums" list and, for each album, its numbered
  tracklist. It MUST match each track to a song page by title, ignoring brackets with singers or
  notes, case, accents and punctuation, and allowing a track title that is the start of the song
  title ("A l'Agneau" → "A l'Agneau sur son trône").
- **FR-004b**: An album whose tracklist repeats another album's (the instrumental KIDS album)
  and tracks marked "(instrumental)" MUST be skipped and listed in the report.
- **FR-004c**: For an album track with no song page, the import MUST take its lyrics from a lyrics
  page that the album links to, if there is one, and otherwise skip the track and list it in the
  report.
- **FR-005**: The import output (run log and report) MUST state the number of rows read, of distinct songs found, of albums
  and tracks read, of tracks matched, and list the tracks that are unmatched or have no lyrics.

**Parts and numbering**

- **FR-006a**: The hymnal MUST have one part per album, named after the album without "(album)",
  ordered by album publication date (oldest first), and then a last part "Hors album" for the
  songs on no album. Today: "Hymnes21 2018" from 100, "Impros louange" from 200, "Dans ses
  mains" from 300, "KIDS" from 400, "Plus haut encore" from 500, "Hors album" from 1000.
- **FR-006b**: A song on an album MUST be numbered as the album's hundred plus its track number
  (track 7 of the album at 300 is 307). Track numbers with no song keep their number free.
- **FR-006c**: A song on several albums MUST have one entry in each album's part.
- **FR-006d**: The songs on no album MUST be numbered from 1001, in the order of the shop's song
  identifiers (oldest first), which does not depend on the list order.
- **FR-007**: Once assigned, a song's number MUST never change or be reused, even if songs or
  albums are added, removed or reordered at the source. A new album takes the next free hundred
  below 1000. A new song on no album takes the next free "Hors album" number. A "Hors album" song
  that later appears on an album keeps its number and gets a new one in that album's part.

**Extraction**

- **FR-008**: For each song page, the import MUST extract the title (see Edge Cases for bracketed
  notes), the lyrics sections (type, number, lines) in source order, and the credits.
- **FR-009**: Section labels in French ("Couplet n", "Refrain", "Pré-refrain", "Pont", "Intro",
  "Fin"/"Coda") MUST set the section type and number, and MUST NOT appear as lyrics.
- **FR-010**: Credits MUST be taken from the credit text of the page. When the text states a role
  ("paroles", "musique", "paroles et musique", "Tr.", "traduction", "arrangement", "Ar.") the
  role MUST be kept; a line of names with no role gives credits with no role, as for other
  hymnals. As for Evangile21, "Domaine public", "©" lines, "Pont par …" and recording credits
  (instruments, mixing, mastering, production) MUST NOT be stored as credits: a credit is only a
  name and one of those roles (plan research R8).
- **FR-011**: Chords, credits, shop descriptions, recording credits, links and page furniture
  MUST NOT appear in the lyrics.
- **FR-012**: A song page with no lyrics MUST be skipped and listed in the report with its reason
  and URL. A song imported with doubts (no stanza split, unclassified lines) MUST be listed in
  the report for a manual check.
- **FR-013**: Scores (PDF leadsheets), chords and audio MUST NOT be imported (out of scope, as in
  feature 002).

**Rules inherited from feature 002**

- **FR-014**: The import MUST follow every rule of feature 002: lyrics faithful to the source,
  source URL and retrieval date per hymn, rights status "not confirmed" until a decision, local
  copy of each page, idempotent re-runs, no overwriting of manual work, reporting of changes and
  missing songs, matching with other hymnals, respect of the site's robots rules and a request
  rate of at most one per second.

### Key Entities

- **Pasteur & Compagnie hymnal**: New. Name "Pasteur & Compagnie", abbreviation "P&C",
  place in the hymnal order, and parts (one per album, then "Hors album"), each with a name and
  its first number.
- **Pasteur & Compagnie source**: The shop pasteuretcompagnie.com, its terms of use and
  permission status.
- **Song list**: The shop's "Partitions" list, split over several pages. Each row gives a title
  and a song page.
- **Album**: An item of the shop's "Digital albums" list. It has a title, a publication date, a
  numbered tracklist and sometimes a lyrics page. It becomes a part of the hymnal.
- **Track**: A numbered line of an album's tracklist. It matches a song page, takes its lyrics
  from the album's lyrics page, or has no lyrics.
- **Number assignment**: The lasting link between a song, its part (album or "Hors album") and
  its number. A song has one per part it appears in.
- **Hymn, Hymnal entry, Section, Credit, Source**: as defined in features 001 and 002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 68 songs listed on 2026-11-16, plus the 3 KIDS songs found only on the album
  lyrics page (71 songs), are either imported or listed in the report with a reason; none is
  imported twice.
- **SC-001a**: The hymnal shows 6 parts. Their songs match the tracklists of the 5 albums (54
  song tracks, 48 with lyrics, 44 distinct songs since 4 are on two albums) and the 27 songs on no album. All 6 tracks with
  no lyrics and the instrumental album are listed in the report.
- **SC-002**: On a manual check of 10 imported songs (at least 3 without section labels), 100%
  have lyrics identical to the source page, with no credit, chord or shop text mixed in, and
  show their credits and source URL.
- **SC-003**: After a content build, searching "P&C" plus a number, or a title, returns the right
  song as the first result for 100% of 10 test queries.
- **SC-004**: Every song whose text is already in the app (same lyrics) ends up as one hymn with
  both entries, or is listed as a possible duplicate; 0 silent duplicates on a check of the 29
  songs that share a title with an Evangile21 song.
- **SC-005**: Re-running the import against an unchanged source changes 0 content files; after
  the list is reordered or a song is added, 0 existing songs change number.
- **SC-006**: 0 songs without a rights decision appear in a published (non-personal) build.

## Assumptions

- This is a new hymnal, separate from Evangile21, even though both publish Philippe Viguier's
  songs: Pasteur & Compagnie is the project's own catalogue and holds about 30 songs Evangile21
  does not.
- Numbers are made up, since the source has none and every hymnal entry needs one. They follow
  the Chorale Psalmodie pattern: one hundred per album, track number inside it, so "P&C 307"
  reads as "album 3, track 7" and stays stable, because a released album's tracklist does not
  change. "Hors album" starts at 1000 so that 9 albums fit before it and the album parts come
  first on the hymnal page. Its 99 numbers leave room for many more singles. The shop's song
  identifiers grow as songs are added, so numbering them "oldest first" is stable too.
- Albums are ordered by their publication date in the shop, which is the closest thing to a
  release order the site gives.
- A song that is on two albums appears in both parts, as an album is listed in full on the
  hymnal page. The app already supports a hymn with two numbers in the same hymnal.
- Album track titles add singers in brackets. These are the performers of a recording, not
  credits of the song, so they are not stored.
- The abbreviation "P&C" is the one users will type. Search ignores punctuation, so "PC" and
  "P C" find it too, which matters because "&" is awkward to type on a phone.
- The English original title is not stored: hymns have a single title, and adding a field would
  need an app change. It can be added later as a feature of its own.
- Songs already in the app keep the text chosen by the existing source priority; this import only
  adds the Pasteur & Compagnie entry to them. A different translation stays a separate hymn.
- The live site is reachable by the importer and its robots rules allow reading the list and song
  pages; no saved pages are needed.
- The leadsheets are free, but that is not a permission to republish the lyrics. As with the
  other sources, the hymns stay "not confirmed" and only appear in the maintainer's personal-use
  build until a rights decision is recorded (constitution III).
- Out of scope: the PDF leadsheets, chords, audio and video, the English original titles,
  album covers and performer names. Also out of scope: songs of the shop that are in neither the
  "Partitions" list nor an album lyrics page, including the 6 album tracks without lyrics. They
  are only reported.
