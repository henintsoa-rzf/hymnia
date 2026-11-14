# Feature Specification: Alphabetical order of the hymnal list

**Feature Branch**: `009-alphabetical-hymnal-list`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Ordonne la liste des recueils dans l'ordre alphabétique"

## Context

Hymnia lists its hymnals (J'aime l'Éternel, Ailes de la Foi, À Toi la Gloire, Célébrons Dieu,
Exo, Écritures, Chorale Psalmodie, Evangile21, Arc-en-ciel) in a fixed editorial order. That
order means nothing to a reader: to find a given hymnal in the list, they have to read it from
the top. As more hymnals are added, this gets slower.

This feature shows the hymnals in alphabetical order of their name, wherever the user picks a
hymnal from a list. The editorial order stays in use where it acts as a priority, not as a
display order. For example, it still decides which hymnal's number a search result shows first
when a hymn appears in several hymnals.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a hymnal in the Recueils screen (Priority: P1)

A singer wants to browse the hymns of « Célébrons Dieu ». They open the Recueils screen and
read the hymnals in alphabetical order, so they know where « Célébrons Dieu » is without reading
the whole list.

**Why this priority**: The Recueils screen is the list the user asked about. It is the main
place where a user looks for a hymnal by name.

**Independent Test**: Open the Recueils screen and check that the hymnals appear in alphabetical
order of their displayed name.

**Acceptance Scenarios**:

1. **Given** the current catalog, **When** the user opens the Recueils screen, **Then** the
   hymnals appear in this order: À Toi la Gloire, Ailes de la Foi, Arc-en-ciel, Célébrons Dieu,
   Chorale Psalmodie, Écritures, Evangile21, Exo, J'aime l'Éternel.
2. **Given** a name starts with an accented capital (« À Toi la Gloire », « Écritures »),
   **When** the list is sorted, **Then** that name sorts as if the letter had no accent: it
   sits among the A or E names, not at the end of the list.
3. **Given** a new hymnal is added to the catalog, **When** the user opens the Recueils screen,
   **Then** it appears at its alphabetical place, without anyone having to set its position by
   hand.

---

### User Story 2 - Same order in the hymnal filter (Priority: P2)

A song leader searches for a hymn and wants to limit the results to « Exo ». The hymnal filter
chips, on the search screen and on the screen that adds hymns to a collection, follow the same
alphabetical order as the Recueils screen.

**Why this priority**: The filter is the other place where the user picks a hymnal from a list.
A different order there than on the Recueils screen would be confusing, but the filter is
usable without this change.

**Independent Test**: Open the search screen and the add-to-collection screen, and check that
the hymnal chips appear in the same order as on the Recueils screen.

**Acceptance Scenarios**:

1. **Given** the search screen, **When** the user looks at the hymnal filter, **Then** the chips
   appear in the same alphabetical order as the Recueils screen.
2. **Given** the screen that adds hymns to a collection, **When** the user looks at its hymnal
   filter, **Then** the chips appear in that same order.
3. **Given** the user has selected one or more hymnals in the filter, **When** they look at the
   chips, **Then** the chips keep their alphabetical place; selecting a chip does not move it,
   and the « Tous les recueils » clear chip stays last.

---

### Edge Cases

- Two names that differ only by accents or capitals: they keep a stable, predictable order from
  one visit to the next.
- A name that starts with a digit or a symbol: it sorts before the names that start with a
  letter.
- Names with typographic apostrophes (« J'aime l'Éternel »): the apostrophe does not change the
  place of the name among the J names.
- A hymnal with no published hymn: it stays hidden, as today; sorting does not make it appear.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Recueils screen MUST list hymnals in alphabetical order of their displayed name.
- **FR-002**: The order MUST follow French alphabetical rules: it ignores capitals and accents,
  so « À » sorts with « A » and « É » with « E ».
- **FR-003**: When two names are equal under these rules, the order MUST stay the same on every
  visit and on every device.
- **FR-004**: The hymnal filter chips, on the search screen and on the add-to-collection screen,
  MUST appear in the same order as the Recueils screen.
- **FR-005**: A newly added hymnal MUST take its alphabetical place automatically, with no manual
  setting of its position.
- **FR-006**: The order in which the app prefers a hymnal (which number a search result shows
  first, which other numbers of a hymn are listed first on its page) MUST stay as it is today.
  This feature only changes display order in hymnal lists.
- **FR-007**: The content of each list item (name, abbreviation, hymn count) and which hymnals
  are listed MUST stay as they are today.

### Key Entities

- **Hymnal**: a collection of numbered hymns. It has a displayed name, which now sets its place
  in lists, and an editorial priority, which keeps its current role in search and on the hymn
  page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the current catalog, 100% of the hymnals on the Recueils screen appear in the
  expected alphabetical order (see User Story 1, scenario 1).
- **SC-002**: The Recueils screen and both hymnal filters show the hymnals in the same order,
  on all three screens.
- **SC-003**: A user asked to open a named hymnal from the Recueils screen finds it without
  reading the list from the top: its position matches where they expect it from its name.
- **SC-004**: Search results and hymn pages show the same hymnal numbers, in the same order, as
  before the change.

## Assumptions

- « La liste des recueils » means the Recueils screen. The hymnal filter chips follow the same
  order so that the user meets one consistent order throughout the app.
- The sort uses the full displayed name (« J'aime l'Éternel »), not the abbreviation (« JEM »),
  because the name is what the list shows first.
- Leading articles (« À », « Le », « La ») are not skipped: « À Toi la Gloire » sorts under A.
- The editorial priority of hymnals is kept for search and for the hymn page, because it reflects
  which hymnals are used most, which is the point of that priority.
- No user setting to choose the order is needed.
