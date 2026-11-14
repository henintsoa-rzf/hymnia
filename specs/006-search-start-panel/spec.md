# Feature Specification: Recent hymns on the search screen

**Feature Branch**: `006-search-start-panel`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "I would like to remove the list of Recueils in the search panel as they already appear in the Recueils panel. What could we replace that list by in the search panel?" Then, after the proposal (recently opened hymns, then recent Répertoire collections, then example searches, keyboard tips kept on desktop): "yes go ahead for this feature".

## Context

The search screen shows the list of hymnals twice over: on mobile, under the help text while
the field is empty; on desktop, in the side column. The same list is the whole point of the
Recueils screen, one tap away. On the search screen it takes room without helping the main job,
which is getting to a hymn fast (Principle I).

During a service or a rehearsal, people go back to the same few hymns again and again, and
today they type the number each time. This feature replaces the hymnal list with what the user
is most likely to want next: the hymns they opened recently, then their recent collections, and,
for a first visit, a few example searches that show how search works.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reopen a recently viewed hymn (Priority: P1)

A song leader opened « CE 12 », then « JEM 245 », then « AdF 80 » while preparing. Back on the
search screen, with the field empty, they see these hymns listed, the last one opened first, and
reopen one with a single tap, without typing.

**Why this priority**: This is the reason for the change. On its own it replaces the duplicated
hymnal list with something the user needs, and removes repeated typing.

**Independent Test**: Open three different hymns, return to the search screen, and check that
the three appear under « Récemment consultés », newest first, each showing its reference and
title, and that tapping one opens it.

**Acceptance Scenarios**:

1. **Given** the user has opened « CE 12 » then « JEM 245 », **When** they come back to the
   search screen with an empty field, **Then** « Récemment consultés » lists « JEM 245 » first
   and « CE 12 » second, each with its reference and title.
2. **Given** a hymn is in the recent list, **When** the user opens it again, **Then** it moves
   to the top and appears only once.
3. **Given** the user has opened more hymns than the list holds, **When** they view the search
   screen, **Then** only the most recent ones are shown and the oldest have dropped off.
4. **Given** a hymn appears in two hymnals and the user opened it as « AdF 80 », **When** it is
   listed, **Then** it is shown with the reference it was opened under (« AdF 80 ») and opens at
   that reference.
5. **Given** the user starts typing in the search field, **When** results appear, **Then** the
   recent list is no longer shown; clearing the field brings it back.
6. **Given** the recent list is shown, **When** the user chooses « Effacer », **Then** the list
   is emptied on this device and the screen falls back to what it shows with no history.

---

### User Story 2 - Jump to a recent collection (Priority: P2)

A user who prepares services in the Répertoire sees their most recently changed collections on
the search screen (« Culte du 16 novembre », 12 chants) and opens one in one tap, instead of
going through the Répertoire tab.

**Why this priority**: Cheap and useful for people who already use collections, and it keeps the
screen useful before any hymn has been opened. It depends on nothing from Story 1.

**Independent Test**: With two collections in the Répertoire, open the search screen with an
empty field and check that both appear, most recently changed first, with name and hymn count,
and that tapping one opens it.

**Acceptance Scenarios**:

1. **Given** the user has four collections, **When** they view the search screen with an empty
   field, **Then** the three most recently changed are listed with name and hymn count, followed
   by a link to the whole Répertoire.
2. **Given** the user has no collection, **When** they view the search screen, **Then** no
   collections block is shown (no empty heading, no prompt to create one).
3. **Given** a listed collection, **When** the user taps it, **Then** that collection opens.

---

### User Story 3 - Learn how to search on a first visit (Priority: P3)

A first-time user, with no history and no collection, sees a few example searches under the help
text: a number (« CE 12 »), a title and a word from the lyrics. Tapping one puts it in the search
field and shows its results.

**Why this priority**: Only useful the first few times, but it keeps the first visit from being
an empty screen and teaches the three ways to search.

**Independent Test**: On a device with no history and no collection, open the search screen and
tap each example; the field is filled with it and matching results appear.

**Acceptance Scenarios**:

1. **Given** no recent hymns and no collection, **When** the user views the search screen,
   **Then** three example searches are shown (one number, one title, one lyrics fragment).
2. **Given** an example is shown, **When** the user taps it, **Then** the search field contains
   that text, keeps focus, and its results are shown.
3. **Given** the user has at least one recent hymn or one collection, **When** they view the
   search screen, **Then** the examples are not shown.

---

### Edge Cases

- A hymn in the history is no longer in the catalog (hymnal removed, or a personal-use hymn
  absent from this build): it is left out of the list silently and does not count toward the
  limit shown.
- A hymn was renumbered since it was opened: it is shown and opened at its current reference
  when the catalog can resolve it, the same way Répertoire entries are repaired.
- Storage on the device is unavailable (private browsing, blocked): the search screen works as
  for a first visit; opening hymns never fails because history cannot be saved.
- The hymnal filter is active: the recent list is not filtered (it is a history, not a search).
- The same hymn is opened several times in a row: it appears once.
- Hymns opened from a collection, a hymnal page, a search result or a shared link all count.
- Two tabs open at once: each shows the history as it was when the screen was displayed; no
  live sync is required.
- Desktop: the side column shows the recent hymns, then the collections, then the keyboard
  tips; the main column under the field shows only the help text and, when relevant, the
  examples. The hymnal list no longer appears anywhere on the search screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search screen MUST no longer show the list of hymnals, on mobile or desktop.
  Hymnals remain reachable from the Recueils screen.
- **FR-002**: The system MUST remember, on the device, each hymn the user opens, with the
  reference it was opened under and when.
- **FR-003**: With an empty search field, the search screen MUST show « Récemment consultés »:
  up to 8 hymns, most recently opened first, each with its reference and title, opening at that
  reference on tap.
- **FR-004**: A hymn MUST appear at most once in the recent list; reopening it moves it to the
  top.
- **FR-005**: The device MUST keep at most 20 history entries; older ones are dropped.
- **FR-006**: Users MUST be able to clear the recent list from the search screen in one action.
  Clearing MUST NOT affect collections or preferences.
- **FR-007**: With an empty search field and at least one collection, the search screen MUST
  show up to 3 collections, most recently changed first, with name and hymn count, plus a link
  to the Répertoire.
- **FR-008**: When there is no recent hymn and no collection, the search screen MUST show 3
  example searches (a number, a title, a lyrics fragment) that all return results in the
  current catalog; tapping one MUST fill the search field and run the search.
- **FR-009**: When the user types in the search field, the recent hymns, collections and
  examples MUST give way to the results, as the hymnal list did.
- **FR-010**: History MUST be stored apart from hymn data and from collections, stay on the
  device, and never be sent anywhere.
- **FR-011**: History entries that the catalog cannot resolve MUST be skipped silently; entries
  for renumbered hymns MUST resolve to the current reference.
- **FR-012**: If device storage is unavailable, the search screen MUST still work and show the
  first-visit content; opening a hymn MUST NOT fail or show an error because of history.
- **FR-013**: On desktop, the keyboard tips MUST stay in the side column, below the recent
  hymns and collections.
- **FR-014**: The new blocks MUST be usable with a keyboard and a screen reader: each block has
  a heading that labels its list, and « Effacer » has an explicit accessible name
  (« Effacer les chants récents »).

### Key Entities

- **History entry**: a hymn opened on this device — the hymn's identity, the hymnal and number
  it was opened under, and when. Ordered by time; one entry per hymn. Device-only user data.
- **Collection** (existing, feature 003): read only here, for name, hymn count and last change.
- **Example search**: a fixed short text (number, title or lyrics fragment) chosen so that it
  returns results with the published catalog.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can reopen any of their last 8 hymns from the search screen in one tap,
  with no typing.
- **SC-002**: The search screen shows no content that duplicates the Recueils screen.
- **SC-003**: The search screen never appears empty under the help text: every device state
  (history, collections, neither, storage blocked) shows at least one of the three blocks.
- **SC-004**: Reaching the search results is not slowed: the field is still focused on load and
  results still appear while typing, as before.
- **SC-005**: Each example search returns at least one result on the published catalog,
  checked by an automated test.
- **SC-006**: The screen passes the same accessibility checks as today (keyboard only, screen
  reader, light and dark modes, mobile and desktop widths).

## Assumptions

- "Opened" means the hymn's own page was displayed; seeing it in a list of results does not
  count.
- 8 shown / 20 kept is enough for a service plus its preparation; the numbers can be tuned
  without changing the feature.
- History is per device and per browser, like reading preferences; there is no account or sync.
- The recent list ignores the hymnal filter; the filter still applies to search results.
- Collections are shown read-only here; creating or editing them stays in the Répertoire.
- Example searches are derived from the catalog that is loaded (public, personal-use or test),
  not a fixed list: the public catalog may publish very few hymns while rights are confirmed,
  so fixed examples could return nothing (see research.md, R5). When the catalog yields no
  example, the examples block is hidden.
- No change to the Recueils screen, the hymn page layout or the search behaviour itself.
