# Feature Specification: Transition and color for results by meaning

**Feature Branch**: `017-meaning-results-transition`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "J'aimerais qu'il y ait une petite animation simple qui se lancerait
lorsqu'on appuie sur le bouton recherche par le sens. L'animation commencerait par vider la liste
des résultats de recherche précédente, puis une petite transition, puis affiche les résultats de
la recherche par le sens. Le but de cela est de faire comprendre que ces résultats sont ceux de la
recherche par le sens et qu'ils sont issus d'une recherche « intelligente ». Par ailleurs, on
pourrait changer la couleur pour qu'on comprenne d'un coup d'oeil que ce sont les résultats de la
recherche par le sens."

## Context

Feature 011 added search by meaning, and feature 012 made it a mode of the search field, with its
own frame color (the "meaning" color of the palette). Feature 013 marks, in the hymn, the stanza
that ranked it, with the same color.

Today, when a search by meaning runs, the word results for the same text stay on screen under a
status line (« Recherche par le sens… »). When the results by meaning arrive, they replace the
word results in place. Both lists look the same: same rows, same colors. The only difference is
the heading (« Résultats par le sens · 24 chants »). Since the user's text is the same, many hymns
appear in both lists, and the switch often goes unnoticed. Users can't tell which list they are
looking at, nor that the second one comes from a different, "intelligent" search.

This feature makes the switch visible:

1. **Clear**: when a search by meaning starts, the current list leaves the screen.
2. **Transition**: a short animation in the meaning color fills the empty space while the search
   runs.
3. **Reveal**: the results by meaning come in, marked with the meaning color, so that they read
   at a glance as results by meaning.

How results by meaning are made, ranked and blended (feature 011), the mode and its button
(feature 012), and the stanza marked in the hymn (feature 013) stay as they are.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the search by meaning happen (Priority: P1)

A worship leader is in the search-by-meaning mode with « un chant d'espérance pour des
funérailles » in the field. The list below shows word results. They validate. The word results
leave the list. In their place, a short animation in the meaning color plays with the words
« Recherche par le sens… ». Then the results by meaning come in, from top to bottom. They see that
a new search took place, and that these hymns come from it.

**Why this priority**: This is the request. Without it, users don't notice the switch from word
results to results by meaning.

**Independent Test**: With word results on screen in the search-by-meaning mode, validate the text
and check, in order: the list empties, the transition plays, the results by meaning appear.

**Acceptance Scenarios**:

1. **Given** the search-by-meaning mode with a text and a list of results on screen, **When** the
   user launches the search by meaning (validates, or presses the button with text in the field
   as in feature 012), **Then** the current list leaves the screen within a short moment (about
   200 ms), and none of its rows stay visible or can be opened.
2. **Given** the list has been cleared, **When** the search by meaning is still running, **Then**
   the list area shows a transition in the meaning color, together with the status line of
   feature 011 (« Recherche par le sens… », or the preparation progress) and its « Annuler » button.
3. **Given** the transition is playing, **When** the results by meaning arrive, **Then** they come
   in with a brief reveal (rows appearing one after the other from the top, the whole reveal
   lasting under half a second), and can be opened as soon as they are visible.
4. **Given** the search by meaning answers at once (for example from the cache of feature 011),
   **When** the user launches it, **Then** the clear and the transition still play, for a short
   minimum (about 400 ms in total) so the change is seen, before the results show.
5. **Given** the search by meaning takes several seconds, **When** the transition is playing,
   **Then** it keeps playing until the results arrive, without stopping, flashing or adding
   delay after they arrive.

---

### User Story 2 - Tell results by meaning at a glance (Priority: P1)

Later, the user comes back to the search screen and glances at the list. Without reading the
heading, they can tell from its color whether they look at results by meaning or at word results.

**Why this priority**: The animation is seen once; the color stays. It answers the second part of
the request and keeps the meaning clear after the animation is over.

**Independent Test**: Show word results, then results by meaning for the same text, and compare:
the results by meaning carry the meaning color on their heading and rows; the word results don't.

**Acceptance Scenarios**:

1. **Given** results by meaning are shown, **When** the user looks at the list, **Then** its
   heading and each of its rows carry a marker in the meaning color (the color of the field's
   frame in that mode), visible in light and dark themes.
2. **Given** word results are shown, **When** the user looks at the list, **Then** none of the
   meaning markers are shown.
3. **Given** results by meaning are shown, **When** the user edits the text and the results by
   meaning are no longer current (feature 011), **Then** the list loses the meaning markers at the
   same time it stops being the result by meaning.
4. **Given** results by meaning are shown, **When** a person who cannot tell colors apart looks at
   the list, **Then** the heading still says « Résultats par le sens » and the marker has a shape
   (for example a side bar or a small sparkle mark), not only a color.

---

### User Story 3 - Return to word results (Priority: P2)

The user cancels a search by meaning, leaves the mode, or the search fails. The meaning color and
the transition go away, and the word results come back.

**Why this priority**: The clear must never leave the user with an empty screen when the search by
meaning does not end with results.

**Independent Test**: Start a search by meaning, then cancel it; start another and make it fail
(offline); check that each time the transition stops and the word results show again.

**Acceptance Scenarios**:

1. **Given** the transition is playing, **When** the user presses « Annuler » or leaves the
   search-by-meaning mode, **Then** the transition stops and the word results for the text show
   again, without meaning markers.
2. **Given** the transition is playing, **When** the search by meaning fails (offline, timeout,
   service unavailable…), **Then** the transition stops, the error message of feature 011 shows,
   and the word results for the text show again below it.
3. **Given** results by meaning are shown, **When** the user leaves the mode, **Then** the word
   results show without the clear-and-transition sequence (it is kept for the search by meaning).

---

### Edge Cases

- **Nothing to clear**: when the list is empty before the search (no word result for the text),
  the sequence starts with the transition.
- **No result by meaning**: the transition ends on the « Aucun chant trouvé par le sens » message
  of feature 011, shown in the meaning color.
- **Search launched again on the same text** (validated twice): the whole sequence plays again,
  since a new search runs.
- **Search launched while the transition plays**: the transition goes on, and only the results of
  the last search show.
- **Reload or shared link of a search by meaning** (feature 012): the results by meaning show with
  their meaning markers. The clear step is skipped since no previous list was shown; the transition
  plays while the search runs.
- **Hymnal filter changed while results by meaning are shown**: the list updates as in feature 011;
  the meaning markers stay, and the sequence does not play again unless a new search by meaning is
  sent.
- **Reduced motion**: when the device asks for less motion, nothing moves or slides. The list is
  cleared at once, a still placeholder in the meaning color stands for the transition with the
  status line, and the results show at once. The meaning markers are unchanged.
- **Long lists**: only the rows on screen take part in the reveal; rows further down are simply
  there when the user scrolls.
- **Screen readers**: the sequence does not add announcements beyond those of feature 011 (status
  line, then the heading with the count of results). Focus stays in the search field.
- **Narrow phone (320 px) and dark mode**: the transition and markers fit without horizontal
  scroll, and keep enough contrast in both themes.

## Requirements *(mandatory)*

### Functional Requirements

**The sequence**

- **FR-001**: When a search by meaning is launched (feature 012, FR-008 and FR-009), the list of
  results on screen MUST be cleared before the results by meaning show. This replaces, for the
  time of the search by meaning, feature 011's behaviour of keeping word results visible below the
  status line.
- **FR-002**: The clear MUST be brief (about 200 ms) and, once it starts, the cleared rows MUST NOT
  respond to taps or keyboard.
- **FR-003**: Between the clear and the results, the list area MUST show a transition in the
  meaning color that evokes the search by meaning (for example the sparkle of the mode's button,
  or rows being "written"), together with the status line and « Annuler » button of feature 011.
- **FR-004**: The transition MUST last as long as the search by meaning runs, and at least a short
  minimum (about 400 ms from launch to results) when the search answers at once. It MUST NOT add
  more than that minimum to a search that answers at once, and MUST NOT add any delay after the
  results of a slower search arrive.
- **FR-005**: The results by meaning MUST come in with a short reveal from the top, the whole
  reveal lasting under 500 ms. A row MUST be usable as soon as it is visible.
- **FR-006**: If the search by meaning is cancelled, fails, or the mode is left, the transition
  MUST stop and the word results for the current text MUST show again (with the error message of
  feature 011 when it failed).
- **FR-007**: The sequence MUST play for each search by meaning sent, and only for it: not when
  word results update while typing, not when leaving the mode, not when the hymnal filter changes
  the results already found by meaning.

**The color**

- **FR-008**: While results by meaning are shown, the list heading and each result row MUST carry
  a marker in the meaning color of the palette (the color of the field's frame in that mode,
  feature 012). Word results MUST NOT carry it.
- **FR-009**: The marker MUST NOT rely on color alone: it MUST have a shape (such as a side bar,
  a tinted band or a sparkle mark), and the heading keeps its « Résultats par le sens » text.
- **FR-010**: The marker MUST keep the results easy to read and MUST NOT move or reflow the text of
  the rows compared with word results (same title, references and excerpt layout). Its contrast
  against the background MUST be at least 3:1 in light and dark themes.
- **FR-011**: The marker MUST disappear as soon as the results by meaning stop being current
  (text edited, mode left; feature 011).

**Motion and accessibility**

- **FR-012**: When the device asks for reduced motion, the sequence MUST play without movement
  (instant clear, still placeholder, instant results), keeping the same order and meaning colors.
- **FR-013**: The sequence MUST NOT move the keyboard focus out of the search field nor add screen
  reader announcements beyond those of feature 011.
- **FR-014**: The search field and its buttons MUST NOT move or change size during the sequence
  (feature 012, FR-014).

### Key Entities

- **Display state of the results**: word results, clearing, transition (search by meaning
  running), results by meaning. It follows the search by meaning of feature 011; no new data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In test sessions, at least 4 out of 5 users shown a list of results can say, without
  reading the heading, whether it comes from the search by meaning or from the word search.
- **SC-002**: In test sessions, at least 4 out of 5 users who launch a search by meaning notice that
  the list changed, and describe the new results as coming from a different kind of search.
- **SC-003**: For a search by meaning that answers at once, the results show in under 0.6 seconds
  after launch; for a slower search, they show in under 0.1 second after the answer arrives.
- **SC-004**: In 100% of cancelled or failed searches by meaning, the word results are back on
  screen in under 0.5 second.
- **SC-005**: With reduced motion on, no element of the list moves or slides during the sequence.
- **SC-006**: Everything the search by meaning did in features 011 to 013 (results, progress,
  cancel, offline, errors, filter, stanza marked in the hymn) still works, as checked by their
  existing tests, adapted only for the cleared list during the search.

## Assumptions

- The "meaning color" is the one feature 012 added to the palette for the field's frame in the
  search-by-meaning mode, with its soft variant used by feature 013. No new color is needed.
- Coloring results by meaning is a deliberate, sober exception to feature 011's "no badge per
  result" choice: one shared marker for the whole list, not a label on each row, in line with the
  constitution's clean design (principle II).
- "Vider la liste" means the previous rows leave the screen, not that the word search stops: word
  results are still computed and come back if the search by meaning does not end with results.
- The exact shapes of the transition and of the marker (sparkle, rows being written, side bar,
  tinted band) are design choices for the plan, within the durations and rules above. The mock-ups
  in `design/handoff/maquette/` may be updated during planning.
- The sequence applies to the main search screen. Other lists that reuse search results (adding a
  hymn to a collection, the Bible search of feature 015) are out of scope unless they show results
  by meaning.
