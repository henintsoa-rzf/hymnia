# Feature Specification: Collections in the Répertoire

**Feature Branch**: `003-repertoire-collections`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "The "Répertoire" should contain multiple lists and not just 1. So I would like : 1. to be able to create a collection of hymns when we are on the "Répertoire" menu, then name the collection, and then adding some hymns by doing a search 2. to be able to have multiple collections within the "Répertoire", not 1 only 3. when adding a hymn to the "Répertoire", choose the collection of our choice"

## Context

Today the Répertoire is a single list: the bookmark on a hymn adds it to, or removes it from,
that one list (feature 001, design decision D1). People prepare several sets of hymns at once:
next Sunday's service, a wedding, the choir's rehearsal, favourites. This feature replaces the
single list with named collections.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a named collection and fill it from a search (Priority: P1)

On the Répertoire screen, a user creates a collection, names it ("Culte du 16 novembre"), and
adds hymns to it by searching from inside the collection, the same way as on the search
screen: by number ("CE 12", "12"), title or lyrics. Each result can be added with one tap; the
user stays in the search to add several hymns in a row, then sees the collection with its
hymns.

**Why this priority**: This is the main request. On its own it lets a user prepare a set of
hymns for a service without leaving the Répertoire.

**Independent Test**: With an empty Répertoire, create a collection named "Culte", search
"CE 1" and "fleuve" from the collection, add one result of each, and check that the collection
lists both hymns, in the order they were added, and that they open on tap.

**Acceptance Scenarios**:

1. **Given** the Répertoire screen, **When** the user chooses "Nouvelle collection" and enters
   a name, **Then** the collection is created, empty, and opens ready to add hymns.
2. **Given** an open collection, **When** the user searches "CE 12" and adds the result,
   **Then** the hymn is added to that collection and the result shows it as added.
3. **Given** a collection search with several results, **When** the user adds three of them
   one after the other, **Then** all three are in the collection, in the order added, without
   the search being cleared in between.
4. **Given** a hymn already in the collection, **When** it appears in the collection search,
   **Then** it is shown as already added, and tapping it again does not add a duplicate.
5. **Given** the user tries to create a collection with an empty name, **When** they confirm,
   **Then** the collection is not created and a short message asks for a name.
6. **Given** a collection with hymns, **When** the user opens one of them, **Then** the hymn
   opens with the reference under which it was added (same hymnal and number).

---

### User Story 2 - Keep several collections (Priority: P1)

The Répertoire lists every collection the user has created, each with its name and number of
hymns. The user opens any of them, renames it, or deletes it.

**Why this priority**: Several collections is the core change from today's single list; it
comes with Story 1 to make the feature useful.

**Independent Test**: Create three collections, check that all three are listed with their
hymn counts; rename one; delete another after confirming; check the remaining list.

**Acceptance Scenarios**:

1. **Given** three collections, **When** the user opens the Répertoire, **Then** all three are
   listed with their name and hymn count, most recently changed first.
2. **Given** a collection, **When** the user renames it, **Then** the new name is shown
   everywhere at once (list, collection screen, add-to-collection choice).
3. **Given** a collection, **When** the user deletes it, **Then** they are asked to confirm,
   and after confirming the collection and its list of hymns are gone; the hymns themselves
   stay in the hymnals and in other collections.
4. **Given** no collection, **When** the user opens the Répertoire, **Then** a short
   explanation and a "Nouvelle collection" action are shown.
5. **Given** a collection, **When** the user removes one hymn from it, **Then** only that hymn
   leaves that collection.

---

### User Story 3 - Choose the collection when adding from a hymn (Priority: P2)

While reading a hymn, the user taps the bookmark. Instead of adding the hymn to a single list,
the app shows the user's collections, with a mark on those that already contain this hymn.
The user adds the hymn to one or several collections, removes it from one, or creates a new
collection on the spot and adds the hymn to it.

**Why this priority**: This is the second way to fill collections (request 3). It depends on
collections existing (Stories 1–2) but is how hymns are most often added while browsing.

**Independent Test**: With collections "Culte" and "Mariage", open CE 1, tap the bookmark,
choose "Mariage": CE 1 is in "Mariage" only. Tap the bookmark again, create "Noël" from there:
CE 1 is in "Mariage" and "Noël".

**Acceptance Scenarios**:

1. **Given** two collections, **When** the user taps the bookmark on a hymn, **Then** both
   collections are offered, each showing whether it already contains this hymn.
2. **Given** the choice is open, **When** the user selects a collection, **Then** the hymn is
   added to it and a short confirmation names the collection.
3. **Given** the hymn is already in a collection, **When** the user selects that collection in
   the choice, **Then** the hymn is removed from it (the choice works as a toggle).
4. **Given** the choice is open, **When** the user chooses "Nouvelle collection" and names it,
   **Then** the collection is created and the hymn is added to it.
5. **Given** the hymn is in at least one collection, **When** it is displayed, **Then** the
   bookmark appears filled; otherwise it appears empty.
6. **Given** the user has no collection yet, **When** they tap the bookmark, **Then** they can
   create a first collection directly from the choice.

---

### User Story 4 - Put the hymns of a collection in order (Priority: P3)

A collection for a service is played in a given order. The user moves hymns up or down in a
collection, and opening a hymn from a collection lets them go to the next hymn of the
collection.

**Why this priority**: Useful for services, but a collection is already usable in the order of
addition.

**Independent Test**: In a collection of three hymns, move the third to the top, check the new
order after leaving and reopening the app; open the first hymn and go to the next one in the
collection.

**Acceptance Scenarios**:

1. **Given** a collection of three hymns, **When** the user moves the last one to the top,
   **Then** the new order is shown and kept.
2. **Given** a hymn opened from a collection, **When** the user goes to the next hymn, **Then**
   the next hymn of the collection opens (not the next number of the hymnal), and the reader
   shows the collection's name and the position ("2 / 5").
3. **Given** the same hymn opened from search or from a hymnal, **When** the user goes to the
   next hymn, **Then** it behaves as before (next number in the hymnal).

---

### Edge Cases

- **Existing Répertoire**: the single list from feature 001 is not carried over; the
  Répertoire starts empty with this version (decided 2026-11-11: the app is not in use yet).
- **Same hymn in several collections**: allowed; the same hymn appears at most once per
  collection.
- **Same hymn under two references** (CE 1 and HE 7): it counts as the same hymn for "already
  added"; the collection keeps the reference under which it was added.
- **Two collections with the same name**: not allowed (ignoring case and accents); the user is
  asked for another name.
- **Very long name**: names are limited to 60 characters; longer names are refused with a
  message, never cut silently.
- **A hymn no longer in the published hymnals** (rights withdrawn, data update): it stays in
  the collection, shown as "Chant indisponible", and can be removed; it is not deleted
  silently.
- **Deleting a collection by mistake**: deletion is confirmed first, and can be undone for a
  few seconds afterwards.
- **Many collections or long collections**: the Répertoire stays usable with 50 collections
  and collections of 100 hymns.
- **Offline**: every action in this feature works without a network.
- **Storage unavailable** (private browsing): collections work for the visit, and the user is
  told once that they will not be kept.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Répertoire MUST list all of the user's collections, with name and hymn count,
  most recently changed first.
- **FR-002**: Users MUST be able to create a collection from the Répertoire by giving it a
  name (1–60 characters, unique ignoring case and accents).
- **FR-003**: Users MUST be able to rename and delete a collection; deletion MUST be confirmed
  and MUST be undoable for a few seconds.
- **FR-004**: From inside a collection, users MUST be able to search hymns with the same
  search as the search screen (hymnal + number, number, title, lyrics, hymnal filter) and add
  a result with a single action, without leaving the search.
- **FR-005**: Search results in a collection MUST show which hymns are already in it; adding a
  hymn already present MUST NOT create a duplicate.
- **FR-006**: A collection MUST keep, for each hymn, the hymnal reference under which it was
  added, and open the hymn with that reference.
- **FR-007**: Users MUST be able to remove a hymn from a collection without affecting other
  collections.
- **FR-008**: The bookmark on a hymn MUST open a choice of collections, marked with those that
  already contain the hymn, where each collection toggles the hymn in or out.
- **FR-009**: The choice of collections MUST allow creating a new collection and adding the
  hymn to it in the same step.
- **FR-010**: The bookmark MUST show whether the hymn is in at least one collection.
- **FR-011**: Users MUST be able to change the order of hymns in a collection; new hymns are
  added at the end.
- **FR-012**: A hymn opened from a collection MUST offer previous/next within that collection,
  and show the collection's name and the hymn's position.
- **FR-013**: *(Removed 2026-11-11: the single list from feature 001 is not migrated.)*
- **FR-014**: Collections MUST be kept on the device between visits and work fully offline.
  They are user data and MUST stay separate from hymn data (constitution, Principle IV): a
  hymn data update never deletes a collection or its entries.
- **FR-015**: Every screen and dialog in this feature MUST work with one hand on a phone, in
  light and dark mode, at text sizes up to 200 %, and meet WCAG 2.2 AA.

### Key Entities

- **Collection**: a named list of hymns made by the user. Attributes: name, creation date,
  date of last change, ordered list of entries.
- **Collection entry**: one hymn in a collection, identified by the hymnal reference it was
  added with (hymnal + number), its position, and the date added. The hymn it points to is
  the unique hymn of feature 001.
- **Répertoire**: all of the user's collections on this device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a named collection and add 5 hymns found by number or title in
  under 1 minute.
- **SC-002**: From a hymn, adding it to an existing collection takes at most 2 taps after the
  hymn is open.
- **SC-003**: A user with 50 collections of 100 hymns each opens the Répertoire and any
  collection with no noticeable wait (under 1 second on a mid-range phone).
- **SC-004**: After closing and reopening the app, including offline, 100 % of collections,
  their names, hymns and order are as the user left them.
- **SC-005**: *(Removed with FR-013.)*
- **SC-006**: Automated accessibility checks report no WCAG 2.2 AA violation on the Répertoire,
  a collection, the collection search and the choice of collections, in light and dark mode.

## Assumptions

- **On this device only**: collections are stored on the user's device, with no account; as
  today's Répertoire. Syncing between devices and sharing a collection with others are out of
  scope (possible later features).
- **Same search**: the collection search reuses the search of feature 001 (same parsing,
  tolerance, ranking and filter); this feature does not change search behaviour.
- **One hymn, one reference per collection**: if the same hymn is added from CE and HE, it is
  "already added"; the first reference is kept.
- **No limits** on the number of collections or hymns per collection beyond what the device
  can store; the success criteria use 50 × 100 as the reference size.
- **Ordering** is by moving hymns up and down (or dragging where supported); no sorting by
  title or number in this version.
- **Naming** in French in the interface: "Répertoire", "collection", "Nouvelle collection".
- **Out of scope**: notes or keys per hymn in a collection, dates of service, printing,
  exporting, playlists with audio.
