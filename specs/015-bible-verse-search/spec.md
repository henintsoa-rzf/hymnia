# Feature Specification: Read the Bible and search by meaning from chosen verses

**Feature Branch**: `015-bible-verse-search`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Is it feasible to create a bible section saved locally on the phone
and browse the verses, and semantical search based on a verse or multiple verses? … I would like
the Louis Segond 1910 translation and keep the same dimension as now which is 1024 dims. Ideally,
the user may select multiple verse and the vector would be create from the selected texts."

## Context

Hymnia is an offline-first hymnal. Since features 011 to 013, a user can search hymns by meaning:
the query text goes to the app's online service, which returns its meaning vector, and the device
ranks the hymn stanzas against it. The shipped configuration uses **1,024 dimensions**, stored as
int8 (`te3-large/title+theme+stanza/1024/i8/v1`).

Worship leaders often start from Scripture: the sermon text, the reading of the day, a psalm. They
then look for hymns that echo it. Today they must type the theme in their own words. The
constitution names "rapprochement chants/versets" as a planned extension (Principle V).

This feature adds a Bible section with the **Louis Segond 1910** translation (public domain):

1. **Read**: the whole Bible is stored on the device and can be browsed by book, chapter and verse,
   offline.
2. **Choose verses**: the user selects one or several verses.
3. **Search by meaning from them**: the text of the selected verses is turned into one meaning
   vector, in the same way and with the same dimensions (1,024) as the hymn search, and used as the
   query.

Facts that shape the feature (2026-11-19):

- Louis Segond 1910 has 66 books, 1,189 chapters and about 31,100 verses, about 4–5 MB of plain
  text (about 1.5 MB compressed for download).
- One 1,024-dimension int8 vector per verse would be about **32 MB**, more than the 20 MB limit set
  for the hymn meaning data (feature 011). This feature does not need it: the selected text is
  turned into a vector online, at search time, and compared with the hymn vectors already on the
  device. No Bible vector is computed in advance or stored.

## Clarifications

### Session 2026-11-19

- Q: What does a search from chosen verses return? → A: Hymns only (FR-013). Finding related
  verses, and free-text search over the Bible, are out of scope.
- Q: Are verse meaning vectors computed in advance? → A: No. The vector is made online from the
  selected text when the user runs the search (FR-012, FR-013).
- Q: May the query length limit be raised for verse searches? → A: Yes, to 2,000 characters
  (FR-011).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the Bible offline (Priority: P1)

A user opens the new Bible section, picks a book (Psaumes), then a chapter (23), and reads it. The
next time, the app reopens where they left off. On a plane or in a church with no network, it works
the same.

**Why this priority**: Everything else starts from a verse on screen. On its own it already makes
the app a single place for hymns and Scripture during a service.

**Independent Test**: With the network cut, open the Bible section, go to Jean 3, read verse 16.
Go to the next chapter and back. Close and reopen the app: it offers to resume at Jean 3.

**Acceptance Scenarios**:

1. **Given** the app is installed and has loaded once, **When** the user opens the Bible section
   with no network, **Then** every book, chapter and verse can be read.
2. **Given** the Bible section, **When** the user opens it, **Then** the 66 books are listed in
   canonical order, grouped into Ancien and Nouveau Testament.
3. **Given** a book, **When** the user picks it, **Then** its chapters are offered by number; picking
   one shows the whole chapter with each verse numbered.
4. **Given** a chapter on screen, **When** the user moves to the next or previous chapter, **Then**
   it is shown without returning to the book list, across book boundaries (Malachie 4 → Matthieu 1).
5. **Given** the user types a reference (« Jean 3:16 », « ps 23 », « 1 Co 13 »), **When** they
   confirm, **Then** the app opens that chapter with the verse in view.
6. **Given** the user left the Bible at a chapter, **When** they come back to the Bible section,
   **Then** it opens at that chapter.

---

### User Story 2 - Find hymns from chosen verses (Priority: P1)

Preparing Sunday, a worship leader opens Romains 8, selects verses 38 and 39, and asks for hymns by
meaning. The app sends the text of these two verses as the query and shows hymns whose stanzas echo
them ("rien ne pourra nous séparer de l'amour de Dieu"), with the matching stanza highlighted as in
feature 013.

**Why this priority**: This is the heart of the request: a search whose query is Scripture rather
than the user's own words.

**Independent Test**: Select Psaume 23:1–4 and run the search. The first ten results include at
least one hymn based on Psaume 23. Select a single verse (Jean 3:16): results are shown in the same
way.

**Acceptance Scenarios**:

1. **Given** a chapter on screen, **When** the user taps a verse, **Then** it is marked selected and
   a bar shows how many verses are selected and the search action.
2. **Given** some verses are selected, **When** the user taps more verses (in the same chapter or,
   after moving, in other chapters or books), **Then** they are added to the selection; tapping a
   selected verse removes it.
3. **Given** one or more verses are selected, **When** the user runs the search, **Then** one query
   is made from the text of all the selected verses together, and the results are listed as for a
   search by meaning (hymns, each once, matching stanza highlighted).
4. **Given** the results, **When** the user looks at the top of the list, **Then** they see the
   references of the verses used as the query (« Romains 8:38–39 »), and can go back to the Bible
   with the selection kept.
5. **Given** the hymnal choice of feature 014, **When** results are shown, **Then** only hymns of
   the selected hymnals and parts are returned.
6. **Given** no network, **When** the user runs the search, **Then** the app says the search needs a
   connection, keeps the selection, and offers to retry; reading is unaffected.

---

### User Story 3 - Copy or share the chosen verses (Priority: P2)

The user selects verses and copies them with their reference, to paste in a service sheet or a
message.

**Why this priority**: Small and cheap once selection exists, and common after choosing a reading.

**Independent Test**: Select Jean 3:16–17, copy, paste in a note: the text and « Jean 3:16-17
(Louis Segond 1910) » are there.

**Acceptance Scenarios**:

1. **Given** verses are selected, **When** the user copies them, **Then** the text is copied in
   Bible order, followed by their references and the translation name.
2. **Given** the device offers sharing, **When** the user shares, **Then** the same text is passed
   to the share sheet.

---

### Edge Cases

- **Selection across chapters or books**: allowed. Verses are always used and shown in Bible order,
  whatever the order in which they were tapped. References are grouped (« Psaume 23:1–4 ;
  Jean 10:11 »).
- **Very long selection**: the service accepts 500 characters per query today (feature 011
  FR-011), less than Psaume 23 in full (about 650 characters). Queries made from verses get a
  higher limit of 2,000 characters (about 10 to 15 verses). When the limit is reached, further
  verses cannot be added and a note says why.
- **Selection kept while moving**: moving to another chapter keeps the selection. It is cleared only
  by an explicit action, or after the search if the user chooses to start over.
- **Verse numbering**: verses follow the Louis Segond 1910 numbering (Psaumes with titles counted as
  in that edition, Malachie with 4 chapters). A reference typed with another numbering opens the
  nearest existing chapter and verse.
- **Unknown reference**: a reference to a book, chapter or verse that does not exist shows a short
  message and stays on the current page.
- **Book names**: references accept full names, common French abbreviations (« Gn », « Ps »,
  « 1 Co », « Ap »), with or without accents, and « : » or « , » between chapter and verse.
- **Same query twice**: running the same selection again does not contact the service again
  (recent query vectors are kept, feature 011 FR-013).
- **Service unavailable or rate-limited**: the same messages as search by meaning (feature 011).
- **Text size and theme**: the Bible text follows the text size and light/dark settings.
- **Storage unavailable** (private mode): reading still works for the visit; the last position is
  not remembered.

## Requirements *(mandatory)*

### Functional Requirements

**Bible content**

- **FR-001**: The app MUST include the complete Louis Segond 1910 Bible (66 books), reproduced
  faithfully from a public-domain source, with the source and its retrieval date recorded
  (Principle III).
- **FR-002**: The Bible text MUST be built by a versioned, repeatable import, and stored apart from
  hymn data and from user data (Principle IV).
- **FR-003**: The Bible text MUST be available offline once the app has loaded it, like the hymns.
- **FR-004**: The Bible section MUST show the translation name (« Louis Segond 1910 ») and its
  public-domain status.

**Reading**

- **FR-005**: The app MUST offer a Bible section reachable from the main navigation.
- **FR-006**: The user MUST be able to reach any chapter in at most three taps from the Bible
  section (book, chapter), and to move to the next or previous chapter in one tap.
- **FR-007**: The user MUST be able to open a chapter and verse by typing a reference, with the
  tolerance described in Edge Cases.
- **FR-008**: The app MUST remember, per device, the last chapter read and reopen it.

**Selecting verses**

- **FR-009**: The user MUST be able to select and deselect verses one at a time, across chapters and
  books, and clear the whole selection in one action.
- **FR-010**: While verses are selected, the app MUST show the count, the references, and the
  search, copy and clear actions, without hiding the text being read.
- **FR-011**: The selected text MUST NOT exceed 2,000 characters; the service MUST accept queries
  of that length for verse searches, with the same rate limit as other queries.

**Search by meaning from verses**

- **FR-012**: The search from verses MUST make one query from the text of all the selected verses
  together, in Bible order, and turn it into a meaning vector by the same service, the same model
  and the same 1,024 dimensions as the hymn search by meaning.
- **FR-013**: The search MUST return hymns only. Bible verses are never search results, and no
  meaning vector is computed in advance for any verse: the only vector made is the query's, online,
  when the user runs the search.
- **FR-014**: Hymn results MUST follow the rules of search by meaning: each hymn once, matching
  stanza highlighted (feature 013), restricted to the hymnal choice (feature 014).
- **FR-015**: Only the text of the selected verses MUST be sent to the service, and only when the
  user runs the search; nothing identifying the user or device is sent (feature 011 FR-010).
- **FR-016**: Without network, the search MUST fail with a clear message and keep the selection;
  reading and selecting MUST keep working.
- **FR-017**: The quality of the search from verses MUST be checked with a versioned reference set
  of at least 20 verse selections, each with one or more expected hymns, and the scores recorded,
  as for the other searches.

**Copy and share**

- **FR-018**: The user MUST be able to copy or share the selected verses as text with references
  and the translation name.

**Accessibility**

- **FR-019**: Book, chapter and verse navigation and verse selection MUST be usable with the keyboard
  and a screen reader (each verse announces its number and selected state), and meet WCAG 2.2 AA in
  light and dark mode.

### Key Entities

- **Bible translation**: name (Louis Segond 1910), source, retrieval date, rights status.
- **Book**: canonical order, testament, full name, accepted abbreviations, number of chapters.
- **Verse**: book, chapter, verse number, text. Identified by its reference.
- **Verse selection**: the verses the user has chosen, kept while reading; temporary, not saved
  with the user's collections.
- **Reading position**: last chapter read, per device, kept with the other preferences.
- **Verse query**: the text made from a verse selection and its meaning vector (1,024 dimensions),
  kept among the recent query vectors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With no network, 100 % of the 1,189 chapters open and display all their verses.
- **SC-002**: A user reaches a given chapter from the Bible section in under 10 seconds, by
  navigation or by typing its reference.
- **SC-003**: A chapter opens in under 300 ms on a common mobile device.
- **SC-004**: On the verse reference set, at least 60 % of the selections have an expected hymn in
  the first 10 results (close to the 61.8 % top-10 of the hymn search by meaning).
- **SC-005**: From a selection, results by meaning appear in under 3 seconds on a common mobile
  connection.
- **SC-006**: The Bible text adds no more than 2 MB to the first download of the app.
- **SC-007**: 100 % of the reference typing tests (full names, abbreviations, no accents, « : » or
  « , ») open the expected chapter and verse.

## Assumptions

- Louis Segond 1910 is in the public domain and may be shipped in the public build; no other
  translation is part of this feature, but the model does not prevent adding one later.
- "Same dimension as now" means the query made from verses uses the hymn search's configuration:
  same model, same service, 1,024 dimensions, int8 comparison.
- The vector is made from the selected text itself, even for a single verse, as the user asked;
  the selected verses are joined into one text, not averaged as separate vectors.
- The Bible section is a new top-level section next to search, Recueils and Répertoire.
- Saving verse selections or verse lists (bookmarks, notes, highlights) is out of scope; the
  selection lasts while the app is open.
- Linking from a hymn to the verses it quotes is out of scope.
- Searching the Bible itself (verses as results, from verses or from free text) is out of scope;
  it would need verse vectors computed in advance, which the maintainer ruled out.
