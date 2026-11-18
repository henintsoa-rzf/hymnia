# Feature Specification: Search-by-meaning mode

**Feature Branch**: `012-meaning-search-mode`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "In the search panel, for the semantical search or intelligent
search, directly make visible a small button with an icon (for example a Magnifying glass with
sparkles). Then when pressing that button, the search bar would double its size so that the user
understands that a longer text is prefered here. At the same time, change the color of the
borders of the search bar to show that's a whole other functionality. There is a bug when typing
into the search bar as it is blinking"

## Context

Feature 011 added search by meaning. Today, a text button « Par le sens » sits beside the search
field. It shows only once the query holds text that is not a hymnal number, and only after the
word search has answered for the current text. Pressing it runs a search by meaning on the
current text.

Two problems come from this:

- **Users don't find it.** The button is hidden until they have typed something, so nothing on
  the empty search screen says search by meaning exists. Once it shows, it looks like the
  word search: same field, same size, same frame. Nothing invites the longer, descriptive text
  (« un chant sur la fidélité de Dieu dans l'épreuve ») that works best for search by meaning.
- **The search bar blinks while typing.** After each keystroke, the button disappears until the
  word search answers for the new text, then shows again. Each time, the search field gets wider,
  then narrower again. When typing fast, this looks like blinking.

This feature turns search by meaning into a **mode** of the search field. A small icon button is
always beside the field. Pressing it switches the field to the search-by-meaning mode: the field
grows to about twice its height for longer text, and its frame takes another color. Since the
button no longer appears and disappears, the field stops jumping while the user types.

This feature changes the search-by-meaning button only. How results by meaning are made, blended
and shown, offline behaviour and data download all stay as in feature 011.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Notice and enter the search-by-meaning mode (Priority: P1)

A worship leader opens the app to prepare a service. Beside the empty search field they see a
small button: a magnifying glass with sparkles. They press it. The search field grows to about
twice its height, its frame changes color, and the placeholder invites them to describe what
they look for. They understand that this is a different kind of search that takes a sentence.
They type « un chant d'espérance pour des funérailles » and validate. The search by meaning runs
and the results show as in feature 011.

**Why this priority**: This is the request. Without a visible entry point, the search by meaning
of feature 011 is barely used.

**Independent Test**: Open the search screen with an empty field, check the button is there,
press it, check the field's size and frame change, type a sentence, validate, and check that
results by meaning show.

**Acceptance Scenarios**:

1. **Given** the search screen with an empty field, **When** it shows, **Then** a small icon
   button for search by meaning is visible beside the field, with no text label on screen and an
   accessible name (« Rechercher par le sens »).
2. **Given** word mode, **When** the user presses the button, **Then** the field switches to
   the search-by-meaning mode: it becomes about twice as tall, long text wraps over several lines
   instead of scrolling sideways, its frame takes a distinct color, its placeholder invites a
   description, the button shows as pressed, and the keyboard focus stays in the field.
3. **Given** the search-by-meaning mode with a text in the field, **When** the user validates
   (Enter key, or the search key of the phone keyboard), **Then** a search by meaning runs on that
   text, with the progress, cancel, offline and error behaviour of feature 011.
4. **Given** word mode with a text already typed, **When** the user presses the button,
   **Then** the field switches to the search-by-meaning mode, keeps the text, and runs the search
   by meaning on it right away (one press, as today).
5. **Given** the search-by-meaning mode with results by meaning shown, **When** the user edits
   the text, **Then** the results by meaning are no longer shown as current (feature 011) until
   the user validates again.

---

### User Story 2 - Return to word search (Priority: P1)

The user has looked up hymns by theme and now wants to find a hymn by its number. They press the
button again. The field goes back to its normal size and frame, and the word search works as
before on the text in the field.

**Why this priority**: A mode the user can't leave easily is a trap. This comes with Story 1.

**Independent Test**: In the search-by-meaning mode, press the button and check the field, frame,
placeholder and results are those of word search.

**Acceptance Scenarios**:

1. **Given** the search-by-meaning mode, **When** the user presses the button, **Then** the field
   returns to its word-search size, frame color and placeholder, the button no longer shows as
   pressed, the text is kept, and the list shows the word results for that text.
2. **Given** a search by meaning in progress, **When** the user leaves the mode, **Then** the
   search by meaning is cancelled and nothing about it is shown.
3. **Given** the search-by-meaning mode, **When** the user clears the field with the clear button,
   **Then** the text is cleared and the field stays in the search-by-meaning mode.

---

### User Story 3 - Type without blinking (Priority: P1)

A user types a hymn title quickly in the search field. The field, its buttons and the controls
around them stay still: nothing appears, disappears, moves or changes size while they type. Only
the result list below updates.

**Why this priority**: It is a visible bug on the main screen of the app, hit at every search.

**Independent Test**: Type a long text one character at a time, in both modes, including a
switch from a number (« 245 ») to text (« 245 grâce »), and check that the field and its buttons
keep the same position and size after every keystroke.

**Acceptance Scenarios**:

1. **Given** word mode, **When** the user types, deletes or pastes text at any speed, **Then** the
   field and the buttons beside it keep the same position and size throughout.
2. **Given** word mode, **When** the query changes between empty, a number and text, **Then** the
   search-by-meaning button stays visible and in place.
3. **Given** the search-by-meaning mode, **When** the user types, **Then** the field keeps its
   enlarged size; text that fills the visible lines scrolls inside the field and does not make
   the field grow further or shrink.

---

### Edge Cases

- **Search by meaning not available in this build** (the app data has no meaning data): the
  button is not shown at all, and the field is laid out as without the feature. It does not
  appear or disappear while typing.
- **Meaning data still downloading or the device offline**: the button stays visible and the
  mode can be entered. Validating gives the "being prepared" or "offline" message of feature 011.
- **Validating an empty text in the search-by-meaning mode**: nothing happens.
- **Validating a hymnal number (« 245 », « JEM 245 ») in the search-by-meaning mode**: no search
  by meaning runs; the list shows the word results for that number, as in feature 011 where search
  by meaning is not offered for numbers.
- **Text longer than the limit (500 characters)**: handled as in feature 011 (cut, and the user is
  told). The enlarged field shows a few lines; the rest scrolls inside the field.
- **Line breaks**: Enter validates and does not add a line break. Pasted text with line breaks is
  kept as one text (line breaks read as spaces).
- **Reload or shared link of a search by meaning** (feature 011): the page opens in the
  search-by-meaning mode, with the field enlarged and the results by meaning.
- **Narrow phone screen (320 px wide)**: the icon button fits beside the field, and the field
  keeps enough room to type without horizontal page scroll.
- **Reduced motion**: if the device asks for less motion, the field changes size without
  animation.
- **Dark mode**: the mode's frame color stays distinct from the word-search frame and readable
  in both light and dark themes.

## Requirements *(mandatory)*

### Functional Requirements

**The button**

- **FR-001**: When the build offers search by meaning (feature 011), the search screen MUST show
  a search-by-meaning button beside the search field at all times, whatever the field holds
  (empty, number or text). This replaces feature 011 FR-001, where the action showed only for a
  text query.
- **FR-002**: The button MUST be an icon only (a magnifying glass with sparkles, or a close
  equivalent in the app's icon set), smaller in width than today's « Par le sens » button, with an
  accessible name and a tooltip on devices that show tooltips.
- **FR-003**: The button MUST work as a switch: pressing it in word mode enters the
  search-by-meaning mode; pressing it in the search-by-meaning mode returns to word mode. It
  MUST show its state (pressed or not) both visually and to assistive technology.
- **FR-004**: When the build does not offer search by meaning, the button MUST NOT be shown.

**The search-by-meaning mode**

- **FR-005**: In the search-by-meaning mode the field MUST be about twice the height of the word
  search field (at least two lines of text visible), and text MUST wrap over lines instead of
  scrolling sideways.
- **FR-006**: In the search-by-meaning mode the field's frame MUST take a color distinct from the
  word-search frame, taken from the app's palette, with enough contrast against the background
  in light and dark themes (at least 3:1, as for other controls).
- **FR-007**: In the search-by-meaning mode the placeholder MUST invite a description (for
  example « Décrivez un thème, une idée, un passage… ») and the field's accessible name MUST say
  it is a search by meaning.
- **FR-008**: Entering the mode MUST keep the text and the keyboard focus in the field. If the
  field holds a text that is not a hymnal number, the search by meaning MUST run on it at once.
- **FR-009**: In the search-by-meaning mode, validating (Enter or the keyboard search key) MUST
  run the search by meaning on the current text. Enter MUST NOT insert a line break.
- **FR-010**: While the user types in the search-by-meaning mode, word search MUST keep updating
  as in feature 011 (FR-002), and no text MUST be sent to the service until the user validates
  (feature 011, FR-008).
- **FR-011**: Leaving the mode MUST cancel any search by meaning in progress, return the field to
  its word-search size, frame and placeholder, keep the text, and show the word results.
- **FR-012**: The mode MUST be part of the search the address describes, so that a reload, the
  back button or a shared link of a search by meaning opens in that mode (feature 011 already
  keeps a search by meaning in the address).
- **FR-013**: The change of size SHOULD be animated briefly (under 200 ms), and MUST NOT be
  animated when the device asks for reduced motion.

**No blinking**

- **FR-014**: While the user types, deletes or pastes, in either mode, the search field and the
  buttons beside it MUST NOT appear, disappear, move or change size. They change only when the
  user switches the mode.
- **FR-015**: The clear button inside the field MUST NOT change the field's outer size when it
  appears or disappears.

### Key Entities

- **Search mode**: word (default) or meaning. It belongs to the current search, alongside its text
  and hymnal filter, and is kept in the address.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the empty search screen, the search-by-meaning button is visible without typing
  or scrolling, on a 320 px wide phone and on a desktop screen.
- **SC-002**: In test sessions, at least 4 out of 5 first-time users, asked to "find a hymn on a
  theme without knowing its words", find and use the search-by-meaning button within 30 seconds.
- **SC-003**: Typing a 40-character text one character at a time, in both modes, the position and
  size of the search field and its buttons change 0 times.
- **SC-004**: Switching the mode takes one press, and the new size and frame show in under
  200 ms.
- **SC-005**: Everything the search by meaning did in feature 011 (results, progress, cancel,
  offline, errors, hymnal filter) still works, as checked by its existing tests, adapted only for
  the new button.

## Assumptions

- "Double its size" means the field's height (more lines for a longer text), not its width: on
  a phone the field already takes the full width.
- The search runs when the user validates, not as they type, since each search by meaning needs
  the online service (feature 011). Pressing the button with a text already in the field still
  runs the search by meaning at once, to keep today's one-press flow.
- The mode's frame color is a new color added to the app's palette. The existing accent cannot
  serve: it is already the frame of the focused field, and the field is focused on arrival, so
  word search would look the same. The exact shade is a design choice for the plan.
- The app opens in word mode. The search-by-meaning mode is kept only through the address (reload,
  back, shared link), not as a lasting preference.
- The cause of the blinking is the search-by-meaning button appearing and disappearing after each
  keystroke, which changes the field's width. A button that is always shown removes it. If other
  causes show up during planning, FR-014 still applies.
- The design mock-ups in `design/handoff/maquette/` (notably `SearchSemantic.dc.html`) will be
  updated or followed during planning; this spec does not depend on them.
