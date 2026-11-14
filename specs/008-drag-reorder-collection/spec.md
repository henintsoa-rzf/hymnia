# Feature Specification: Reorder a collection by drag-and-drop

**Feature Branch**: `008-drag-reorder-collection`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "In the interface to change the order of the songs in a directory, rather than changing the order with the up and down arrows, you should rather be able to drag-and-drop"

## Context

Feature 003 (User Story 4) lets a user put the hymns of a collection in order: from the
collection's menu, « Modifier l'ordre » shows an up arrow and a down arrow on each hymn, and each
tap moves the hymn by one place. Moving the last hymn of a 12-hymn service to the top takes 11
taps, and the user has to follow the hymn as it climbs the list.

This feature makes drag-and-drop the main way to reorder: in ordering mode, the user grabs a
hymn by its handle and drops it where it belongs, in one gesture. The up and down arrows stay,
made discreet, as the way to move a hymn without dragging (keyboard, screen reader, single tap),
which WCAG 2.2 AA requires (Principle VI). The result is the same as today (the new order is kept
and drives « Lire dans l'ordre »); only the way of getting there changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Drag a hymn to its place (Priority: P1)

A song leader prepares « Culte du 16 novembre », 8 hymns, and decides the last one should open
the service. They open the collection's menu, choose « Modifier l'ordre », press the handle of the
last hymn, drag it to the top of the list and release. The hymn is now first, the others moved
down by one, and they tap « Terminé ».

**Why this priority**: This is the whole request. It turns a long series of taps into one
gesture, on a phone (touch) as on a computer (mouse).

**Independent Test**: In a collection of 5 hymns, enter ordering mode, drag the 5th hymn above
the 1st, and check the new order on screen, after leaving and reopening the collection, and when
reading in order.

**Acceptance Scenarios**:

1. **Given** a collection of 2 hymns or more in ordering mode, **When** the user looks at a hymn,
   **Then** it shows a drag handle, and the up and down arrows in a discreet, secondary style.
2. **Given** ordering mode on a phone, **When** the user presses the handle of a hymn and moves
   their finger, **Then** the hymn follows the finger and the other hymns make room for it where
   it would land.
3. **Given** the same on a computer, **When** the user drags a hymn by its handle with the
   mouse, **Then** it behaves the same way.
4. **Given** a hymn being dragged, **When** the user releases it between two hymns, **Then** it
   takes that place, the hymns in between shift by one, and the new order is saved at once.
5. **Given** a reordered collection, **When** the user leaves the app and comes back, or taps
   « Lire dans l'ordre » and goes to the next hymn, **Then** the new order is used.
6. **Given** a list longer than the screen, **When** the user drags a hymn near the top or bottom
   edge, **Then** the list scrolls so the hymn can reach any place.
7. **Given** a hymn being dragged, **When** the user drops it back where it started, or cancels
   the drag (Escape, or the gesture is interrupted), **Then** the order is unchanged.

---

### User Story 2 - Reorder without dragging (Priority: P2)

A user who navigates with the keyboard or a screen reader, or who cannot do a precise drag
gesture (one hand busy, tremor, switch control), still puts hymns in order with the up and down
arrows, as today. The arrows stay next to the handle, in a lighter style, so the drag stays the
obvious gesture.

**Why this priority**: Required by Principle VI (WCAG 2.2 AA, criteria 2.1.1 and 2.5.7):
reordering must stay possible with the keyboard, with a screen reader, and with a single tap or
click. It comes second because the arrows already exist; this story keeps them working next to
the drag.

**Independent Test**: With the keyboard only, in ordering mode, move the 3rd hymn to the 1st
place with the arrows, and check the order, the focus and the screen reader announcements.

**Acceptance Scenarios**:

1. **Given** ordering mode, **When** the user taps « Monter » or « Descendre » on a hymn, **Then**
   the hymn moves by one place, as today.
2. **Given** a keyboard user, **When** they move a hymn with the arrows, **Then** focus stays on
   the same arrow of the moved hymn (or the other one at the ends), as today.
3. **Given** a hymn moved by arrow or by drag, **When** it changes place, **Then** a screen
   reader announces the hymn and its new position (« … déplacé en position 2 »).
4. **Given** ordering mode, **When** the user looks at a row, **Then** the arrows are visibly
   lighter than the handle, but keep AA contrast and a 44 px tap target.

---

### Edge Cases

- Collection with 0 or 1 hymn: « Modifier l'ordre » is not offered, as today.
- Hymn marked « indisponible » (no longer in the catalogue): it can be dragged like any other.
- Tap on the hymn's title in ordering mode: it does not start a drag and does not open the hymn
  by accident; only the handle starts a drag.
- Scrolling the page on a phone: a swipe outside the handles scrolls the list and never moves a
  hymn.
- Drag released outside the list: the hymn goes back to its place, order unchanged.
- Hymns marked for removal: entering ordering mode clears the marks, as today.
- A drag in progress when the user taps « Terminé » or leaves the page: the drag is cancelled.
- Light and dark modes, phone and desktop widths: the handle, the dragged hymn and the drop
  place are clearly visible, with AA contrast.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In ordering mode, each hymn MUST show a drag handle; the up and down arrows MUST
  stay, in a discreet secondary style, still disabled at the ends of the list.
- **FR-002**: Users MUST be able to move a hymn to any place in the collection in a single drag,
  with touch and with a mouse.
- **FR-003**: While a hymn is dragged, the list MUST show where it would land, and the other
  hymns MUST make room for it.
- **FR-004**: A drag MUST start only from the handle; elsewhere, touches keep their usual effect
  (scrolling the list).
- **FR-005**: The list MUST scroll on its own when a dragged hymn reaches the top or bottom edge
  of the visible area.
- **FR-006**: Dropping a hymn MUST save the new order at once, with the same effect as the
  current arrows: kept after the app is closed, used by « Lire dans l'ordre » and
  previous/next inside the collection, and available offline.
- **FR-007**: Dropping a hymn at its starting place, cancelling the drag (Escape key, interrupted
  gesture), or releasing it outside the list MUST leave the order unchanged.
- **FR-008**: Reordering MUST stay possible with the keyboard alone, through the arrows, with
  focus kept on the moved hymn, as today.
- **FR-009**: Each move MUST be announced to screen readers with the hymn's title and new
  position.
- **FR-010**: The arrows MUST remain the way to move a hymn without a drag gesture, with a
  single tap or click (WCAG 2.5.7).
- **FR-011**: Everything else about ordering mode stays as today: entered from the collection's
  menu, left with « Terminé », offered only with 2 hymns or more.

### Key Entities

- **Collection order**: the ordered list of a collection's hymns, already stored (feature 003).
  This feature changes how the user edits it, not what is stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Moving a hymn from the last to the first place of a 12-hymn collection takes one
  gesture, against 11 taps today.
- **SC-002**: In a test with 5 users on a phone, each puts a 6-hymn collection in a given order
  on the first attempt, in under 30 seconds, without help.
- **SC-003**: No hymn is moved or opened by accident while scrolling a collection in ordering
  mode on a phone.
- **SC-004**: A keyboard-only user and a screen reader user can each reach any order with the
  arrows, with each move announced.
- **SC-005**: The order set by drag-and-drop is identical after closing and reopening the app,
  online and offline.

## Assumptions

- Drag-and-drop lives inside the existing « Modifier l'ordre » mode rather than in the normal
  collection view: outside that mode, a touch on a hymn opens it, and a press-and-drag there
  would conflict with opening and scrolling.
- The handle is the usual grip mark (six dots) at the end of the hymn's row, after the arrows.
  It is for pointer use only: the arrows already give keyboard and screen reader users a way to
  reorder, so the handle adds no second keyboard pattern (decision 2026-11-14, option B).
- No undo is added: a wrong move is fixed by dragging the hymn back, as it is fixed today with the
  arrows.
- Only the collection screen is affected; adding, removing, renaming and reading hymns, and the
  other screens, do not change.
- Existing tests for ordering (feature 003, US4) will be updated to the new interaction.
