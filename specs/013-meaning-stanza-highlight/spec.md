# Feature Specification: Highlight the matching stanza

**Feature Branch**: `013-meaning-stanza-highlight`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "When searching with the semantical search and clicking on a result,
it would be great to highlight the stanza that has been selected to make the song go into the top"

## Context

Feature 011 added search by meaning, and feature 012 made it a mode of the search field. A hymn
found by meaning is ranked by its **best-matching stanza** (verse, chorus or bridge). The result
list shows the start of that stanza as the excerpt, to explain why the hymn came up.

Once the user opens the hymn, this link is lost. The hymn opens at the top, all stanzas look the
same, and the user has to read the whole hymn again to find the passage that answered their
search. On a long hymn, or one with a matching last verse, this takes time, and the user may
doubt the result.

This feature carries the matching stanza from the result to the reading view: when a hymn is
opened from a search-by-meaning result, the stanza that ranked it is marked and brought into
view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the stanza that matched (Priority: P1)

A user searches by meaning (« la fidélité de Dieu dans l'épreuve »). In the results, they tap a
hymn. The hymn opens, and the stanza that made it match is marked in a calm, visible way. If that
stanza is not on screen, the view brings it into view. The user reads it at once and decides
whether this hymn fits.

**Why this priority**: This is the whole request. It turns a result into an answer: the user sees
the passage that matched without searching for it.

**Independent Test**: Run a search by meaning whose best match for a hymn is its third verse. Tap
that hymn. The third verse is marked, is visible without scrolling, and no other stanza is marked.

**Acceptance Scenarios**:

1. **Given** a search-by-meaning result for a hymn, **When** the user opens it, **Then** the
   stanza that ranked the hymn is marked and no other stanza is.
2. **Given** the matching stanza is further down the hymn, **When** the hymn opens, **Then** the
   view shows that stanza without the user scrolling, with the hymn's header still reachable by
   scrolling up.
3. **Given** the matching stanza is already visible when the hymn opens, **When** it opens,
   **Then** the view does not move, and the stanza is marked.
4. **Given** the matching stanza is a chorus, **When** the hymn opens, **Then** the chorus is
   marked where it is printed (a chorus repeated after each verse is printed once, so it is
   marked once).
5. **Given** the result excerpt shown in the list, **When** the hymn opens, **Then** the marked
   stanza is the one that excerpt comes from.
6. **Given** the hymn is open with a marked stanza, **When** a screen reader user reaches that
   stanza, **Then** it is announced as the passage that matches their search.

---

### User Story 2 - The mark belongs to the search, not to the hymn (Priority: P2)

The mark is a help for this search only. When the user moves on (next hymn, another hymnal, a
collection, opening the same hymn again later from somewhere else), the hymn shows as usual, with
no mark.

**Why this priority**: Without this, the reading view would show marks that no longer mean
anything, against the calm reading view (Principle II).

**Independent Test**: Open a hymn from a search-by-meaning result (stanza marked), go to the next
hymn, then back to the first one through previous: no stanza is marked.

**Acceptance Scenarios**:

1. **Given** a hymn opened from a search-by-meaning result, **When** the user goes to the previous
   or next hymn, **Then** that hymn shows no mark.
2. **Given** a hymn opened from a hymnal list, a collection, the recent hymns or a word-search
   result, **When** it opens, **Then** no stanza is marked.
3. **Given** a hymn opened from a search-by-meaning result, **When** the user goes back to the
   results and opens another result, **Then** that hymn's own matching stanza is marked.
4. **Given** a hymn opened from a search-by-meaning result, **When** the user goes back to the
   results and opens the same hymn again, **Then** its matching stanza is marked again.

---

### Edge Cases

- **Hymn found both by words and by meaning**: when its list excerpt is the meaning stanza, that
  stanza is marked. When its excerpt is a word match (the word search ranked it higher), no stanza
  is marked: the mark must always match what the list showed.
- **Matching stanza not found in the hymn** (the hymn changed since the meaning data was built, or
  the hymn is read in another hymnal's version whose text differs): the hymn opens normally at the
  top, with no mark and no error.
- **Same stanza text twice in a hymn** (a verse repeated word for word, not a chorus): the first
  printed occurrence is marked.
- **Very long stanza**, taller than the screen: its start is shown at the top of the view.
- **Text size changed** while the stanza is marked: the mark stays on the stanza.
- **Dark mode**: the mark is as clear and as calm as in light mode.
- **Offline**: search by meaning needs the network (feature 011); once the results are shown, the
  mark works the same without the network.
- **Reload or shared link** of a hymn opened from a meaning result: the mark may stay or not; no
  requirement either way (a shared hymn link is not expected to carry a search).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a hymn is opened from a search-by-meaning result whose excerpt is the
  best-matching stanza, the reading view MUST mark that stanza, and only it.
- **FR-002**: The marked stanza MUST be the one whose start is the result's excerpt (the same
  stanza that ranked the hymn).
- **FR-003**: When the hymn opens and the marked stanza is not fully visible, the view MUST bring
  it into view, its start near the top of the reading area, without hiding the header bar. When it
  is already visible, the view MUST NOT move.
- **FR-004**: The mark MUST be calm and fit the reading view (Principle II): a soft background or
  side line, no animation that loops, no blinking. A short one-time appearance (under one second)
  is allowed and MUST be dropped when the user asks for reduced motion.
- **FR-005**: The mark MUST NOT rely on color alone and MUST meet WCAG 2.2 AA contrast in light
  and dark mode; the lyrics inside MUST stay as readable as unmarked lyrics.
- **FR-006**: Assistive technologies MUST announce the marked stanza as the passage matching the
  search (for example « Passage correspondant à votre recherche »).
- **FR-007**: The mark MUST NOT change the lyrics shown: same lines, same order, same labels
  (Principle III).
- **FR-008**: A chorus printed once for several repeats MUST be marked once, where it is printed.
- **FR-009**: The mark MUST only appear for a hymn opened from a search-by-meaning result. Moving
  to another hymn (previous, next, a reference in another hymnal, any other way in) MUST show no
  mark.
- **FR-010**: When the matching stanza cannot be found in the hymn as shown, the hymn MUST open
  normally (top of the hymn, no mark, no message).
- **FR-011**: Results found by words only, and results whose excerpt is a word match, MUST open
  as today, with no mark.
- **FR-012**: The hymn MUST open as fast as today: marking and bringing the stanza into view MUST
  NOT delay the display of the lyrics.

### Key Entities

- **Matching stanza**: The stanza of a hymn that ranked it in a search by meaning. Known for each
  meaning result (it is already the excerpt). Carried from the result to the reading view for this
  opening only; not stored, not part of the hymn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of search-by-meaning results whose excerpt is a meaning stanza, opening the
  hymn marks exactly the stanza the excerpt comes from (checked on the feature 011 evaluation
  queries).
- **SC-002**: When opened from a meaning result, the matching stanza is visible within 1 second,
  without any scroll by the user, on a phone and on a desktop screen.
- **SC-003**: In a test with users, someone who opens a meaning result can point to the passage
  that matched in under 3 seconds, against reading the whole hymn today.
- **SC-004**: 0 marks appear on hymns opened any other way (hymnal list, collections, recent
  hymns, word search, previous/next).
- **SC-005**: The marked stanza passes WCAG 2.2 AA contrast checks in light and dark mode, and a
  screen reader announces it as the matching passage.

## Assumptions

- The stanza to mark is the one that ranked the hymn in the search by meaning (its best stanza),
  which is the stanza the result list already shows as excerpt. No new ranking work is needed.
- Only search by meaning is in scope. Marking the matching line for word-search results could
  follow later with the same mark, but is out of scope here.
- The mark lasts as long as the user stays on this hymn from this result; there is no button to
  remove it. It is calm enough to stay while singing.
- The meaning data stores which stanza matched; if the reading view cannot find it (text changed,
  other version), the safe default is no mark rather than a wrong one.
- The hymn is shown in the hymnal of the reference the result opens, as today.
