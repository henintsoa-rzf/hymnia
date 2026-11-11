# Feature Specification: Browse and Search the Multi-Hymnal Collection

**Feature Branch**: `001-hymnal-browse-search`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "browsing the multi-hymnal collection and searching it (number, title, lyrics)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a hymn by hymnal and number (Priority: P1)

During a service, the worship leader announces "JEM 245". A user types the hymnal and number
into the search field and the hymn opens directly, lyrics first, with its credits.

**Why this priority**: Numbers are how hymns are announced in church. This is the fastest and
most frequent path to a hymn, and on its own it already replaces a paper hymnal.

**Independent Test**: Load a sample collection, type "JEM 245" (and variants such as "jem245",
"JEM n°245"), and check that the matching hymn's lyrics are displayed.

**Acceptance Scenarios**:

1. **Given** the collection contains JEM 245, **When** the user types "JEM 245", **Then** that
   hymn is the first result and can be opened in one tap.
2. **Given** the user types "jem245" or "JEM n°245", **When** results are shown, **Then** the
   same hymn is the first result.
3. **Given** the user types only "245", **When** results are shown, **Then** every hymn numbered
   245 is listed, each labelled with its hymnal.
4. **Given** the user types "JEM 9999" and no such number exists, **When** results are shown,
   **Then** a clear "no hymn with this number in JEM" message appears, with no error.

---

### User Story 2 - Find a hymn by title or a lyric fragment (Priority: P1)

A user remembers part of a line ("à toi la gloire ô ressuscité") or a title but not the
number. They type what they remember and find the hymn, even with missing accents or a typo.

**Why this priority**: The second most common way people look for a hymn. It is the core of
the "advanced search" promise of the product.

**Independent Test**: With the sample collection, run a reference set of title and lyric
queries (including accent-free and misspelled ones) and check the expected hymn appears in the
top results.

**Acceptance Scenarios**:

1. **Given** a hymn titled "À toi la gloire", **When** the user types "a toi la gloire",
   **Then** it appears among the first results.
2. **Given** a hymn whose lyrics contain "Éternel, tu es mon berger", **When** the user types
   "eternel tu es mon berger", **Then** it appears among the first results.
3. **Given** a query with one typo ("gloir" or "berjer"), **When** results are shown, **Then**
   the intended hymn still appears among the first results.
4. **Given** results come from a lyric match, **When** they are displayed, **Then** each result
   shows the title, hymnal and number, and the matching excerpt with the matched words
   highlighted.
5. **Given** a title match and a lyrics-only match for the same query, **When** results are
   ranked, **Then** title matches appear before lyrics-only matches.

---

### User Story 3 - Browse a hymnal (Priority: P2)

A user without a specific hymn in mind picks a hymnal (e.g. "Ailes de la Foi") and scrolls
through its hymns in number order, or jumps to a number.

**Why this priority**: Useful for preparing a service or discovering hymns, but less urgent
than direct search.

**Independent Test**: Open the hymnal list, choose a hymnal, and check its hymns are listed in
number order with title and number, and that any hymn can be opened.

**Acceptance Scenarios**:

1. **Given** several hymnals are available, **When** the user opens the hymnal list, **Then**
   each hymnal is shown with its name and number of hymns.
2. **Given** the user opens a hymnal, **When** the list is shown, **Then** hymns appear in
   ascending number order with number and title.
3. **Given** a hymnal with hundreds of hymns, **When** the user enters a number in the
   hymnal's jump field, **Then** the list goes straight to that number.

---

### User Story 4 - Read a hymn comfortably (Priority: P2)

Once a hymn is open, the user reads it in a clean view: verses and chorus clearly separated,
adjustable text size, credits, and the other hymnals where the same hymn appears.

**Why this priority**: Reading is the end goal of every search, but a basic readable view is
already part of stories 1–3; this story adds the comfort features.

**Independent Test**: Open any hymn and check the structure, text-size control, credits, and
cross-hymnal references.

**Acceptance Scenarios**:

1. **Given** a hymn with verses and a chorus, **When** it is displayed, **Then** verses are
   numbered and the chorus is visually distinct.
2. **Given** the user increases the text size, **When** they open another hymn, **Then** the
   chosen size is kept.
3. **Given** the same hymn appears in JEM and in À Toi la Gloire, **When** it is displayed,
   **Then** both references (hymnal + number) are shown and either can be selected.
4. **Given** a hymn has known authors, composers or translators, **When** it is displayed,
   **Then** they are shown with the data source.
5. **Given** a hymn is open, **When** the user swipes or taps next/previous, **Then** the
   adjacent hymn of the same hymnal opens.

---

### User Story 5 - Narrow search to one or more hymnals (Priority: P3)

A church that only uses JEM restricts the search to that hymnal so results stay relevant.

**Why this priority**: Improves relevance but search already works without it.

**Independent Test**: Select a hymnal filter, run a query that matches hymns in several
hymnals, and check only the selected hymnals appear.

**Acceptance Scenarios**:

1. **Given** the user selects the "JEM" filter, **When** they search "gloire", **Then** only JEM
   hymns are shown.
2. **Given** a hymnal filter is active, **When** results are shown, **Then** the active filter is
   visible and can be cleared in one tap.
3. **Given** a filter is active and the user types "245", **When** results are shown, **Then**
   only number 245 of the selected hymnals is listed.

### Edge Cases

- Empty query: the search screen shows the hymnal list (and later, recent hymns), not an empty
  result list.
- Query of one or two characters: no lyric search is run; only number and title-start matches
  are shown.
- Ambiguous hymnal abbreviations (e.g. "CD", "ATG", "AdF") must map to the right hymnal; an
  unknown abbreviation is searched as ordinary text.
- Numbers with suffixes or variants in a hymnal (e.g. "123a", "123 bis"), if present in the
  source, are searchable and displayed as in the source.
- The same hymn appears in several hymnals: it is listed once per hymnal in browse view, and
  once (with all its references) in text-search results.
- Very long queries (a whole verse pasted in) still return the hymn.
- Punctuation, apostrophes (’ vs '), ligatures (œ) and capital letters are ignored for matching.
- Hymns whose content is marked "rights not confirmed" are not shown (constitution, Principle
  III).
- No network: hymns already available on the device remain browsable and searchable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search field MUST be reachable from the main screen without any prior
  navigation.
- **FR-002**: System MUST recognise a query of the form "<hymnal> <number>" in common variants
  (with/without space, "n°", "no", "#", any case) and return that hymn first.
- **FR-003**: System MUST accept a number alone and list every hymn with that number, each
  labelled with its hymnal.
- **FR-004**: System MUST support a recognised abbreviation and the full name for each hymnal
  (e.g. "JEM", "AdF"/"Ailes de la Foi", "ATG"/"À Toi la Gloire", "CD"/"Célébrons Dieu").
- **FR-005**: System MUST search hymn titles and full lyrics, ignoring case, accents,
  punctuation, apostrophe variants and ligatures.
- **FR-006**: System MUST tolerate at least one typo per query word of five or more letters.
- **FR-007**: System MUST rank results in this order: exact hymnal+number match, exact title
  match, title match, first-line match, lyrics match.
- **FR-008**: Each search result MUST show title, hymnal, number and, for lyric matches, an
  excerpt with matched words highlighted.
- **FR-009**: Search results MUST update as the user types, without requiring a "search" button.
- **FR-010**: Users MUST be able to restrict search to one or several hymnals and clear the
  restriction in one action.
- **FR-011**: Users MUST be able to list the available hymnals with their name and hymn count.
- **FR-012**: Users MUST be able to browse a hymnal's hymns in number order and jump to a number.
- **FR-013**: The hymn view MUST show the lyrics with numbered verses and a visually distinct
  chorus (and bridge, when present), in the order of the source.
- **FR-014**: The hymn view MUST show known credits (authors, composers, translators), the data
  source, and every hymnal + number where the same hymn appears.
- **FR-015**: Users MUST be able to adjust text size; the choice MUST persist across hymns and
  sessions.
- **FR-016**: Users MUST be able to go to the next/previous hymn of the current hymnal from the
  hymn view.
- **FR-017**: The interface MUST offer light and dark modes.
- **FR-018**: Browsing, search and reading MUST work without a network connection for content
  already on the device.
- **FR-019**: System MUST NOT display content marked as "rights not confirmed".
- **FR-020**: Displayed lyrics MUST be identical to the stored source text; normalisation is
  used only for matching.

### Key Entities

- **Hymn (Chant)**: A single song, independent of where it is published. Has a title, lyrics
  (ordered sections), credits, a source reference, and a rights status.
- **Lyrics section**: A verse, chorus or bridge, with its type, its position, and its text.
- **Hymnal (Recueil)**: A published collection (e.g. JEM, Ailes de la Foi). Has a full name,
  one or more abbreviations, and a hymn count.
- **Hymnal entry (Numérotation)**: The link between a hymn and a hymnal, with the number (as
  printed, possibly with suffix) of that hymn in that hymnal. A hymn can have several entries.
- **Contributor (Crédit)**: A person credited on a hymn, with a role (author, composer,
  translator).
- **Reading preferences**: Per-device settings (text size, light/dark mode), kept separate from
  hymn data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a hymn from its hymnal and number in under 5 seconds from opening
  the app.
- **SC-002**: Results appear while typing, with no noticeable delay (under 0.2 s) on a typical
  mid-range phone, for the full collection.
- **SC-003**: On a reference set of at least 50 queries (numbers, titles, lyric fragments,
  accent-free and misspelled), the expected hymn is in the top 3 results for at least 95% of
  queries and is the first result for 100% of "hymnal + number" queries.
- **SC-004**: In usability testing, at least 90% of participants find a hymn from a remembered
  lyric fragment on their first attempt.
- **SC-005**: 100% of displayed hymns show their hymnal reference(s) and data source.
- **SC-006**: Browsing, search and reading work in airplane mode for all hymns already on the
  device.

## Assumptions

- Users are French-speaking churchgoers, worship leaders and musicians; mobile phone is the
  primary device, with tablet and desktop also supported.
- No user account is needed for this feature; browsing and searching are anonymous.
- Importing the hymnals from source sites is a separate feature. This feature works with
  whatever validated content is available, starting with a sample set covering at least two
  hymnals and one hymn that appears in both.
- Hymnal abbreviations follow those used by the sources (JEM, AdF, ATG, CD, Exo…); the final
  list is set when each hymnal is imported.
- Out of scope for this feature: favourites, lists and playlists, theme/tag filters, semantic
  search, chords, audio, and hymn–Bible-verse linking (later features, per the constitution's
  delivery order).
- The interface language is French.
