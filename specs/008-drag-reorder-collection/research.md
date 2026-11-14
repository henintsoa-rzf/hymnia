# Research: Reorder a collection by drag-and-drop

## R1. Drag technique

- **Decision**: Pointer Events (`pointerdown` on the handle, `setPointerCapture`,
  `pointermove`, `pointerup`, `pointercancel`), written in the app, no library.
- **Rationale**: One code path for touch, mouse and pen. Pointer capture keeps the events on the
  handle even when the finger leaves it, so the release never lands as a click on a hymn link.
  The list is short (a service is 5 to 20 hymns) and vertical only, so the code stays small.
- **Alternatives considered**:
  - HTML5 Drag and Drop (`draggable`): unreliable on mobile touch, browser ghost image that
    cannot be styled, no auto-scroll control. Rejected.
  - SortableJS or svelte-dnd-action: solve more than needed (grids, lists across containers) and
    add a dependency, against Principle V. Rejected.

## R2. Starting a drag without breaking scroll

- **Decision**: Only the handle starts a drag. The handle has `touch-action: none`; the rest of
  the row keeps the default, so a swipe on the title scrolls. The drag starts on press with no
  long-press delay, but the row lifts only after the pointer moved 4 px, so a stray tap on the
  handle does nothing.
- **Rationale**: A dedicated handle makes intent clear; a long press would slow the main
  gesture and clash with the system's long-press menu on links.
- **Alternatives considered**: Whole-row drag after a long press (conflicts with link
  long-press and scroll); immediate whole-row drag (breaks scrolling). Rejected.

## R3. Landing place and the other rows

- **Decision**: At drag start, read each row's top and height once. While moving, the dragged
  row's centre is compared with the other rows' midpoints (`dropIndex`). Rows between the start
  and the landing place get `translateY(±draggedHeight)` (`shiftOf`); the dragged row gets
  `translateY(pointer delta + scroll delta)`. Rows may have different heights (long titles
  wrap), so the shift uses the dragged row's own height.
- **Rationale**: No DOM change until the drop, so Svelte's keyed `{#each}` stays the source of
  truth; transforms only, so no layout during the move.
- **Alternatives considered**: Moving the DOM node live (fights Svelte's keyed list); a separate
  floating clone (extra node, focus and style copies). Rejected.

## R4. Look during the drag

- **Decision**: The lifted row gets `.is-dragging`: raised background (`--paper-raised`),
  `--shadow-float`, above the others (`z-index`). The other rows slide with a 150 ms transform
  transition, removed under `prefers-reduced-motion: reduce`. The handle uses `--ink`, the arrows
  `--ink-muted` (already AA on `--paper` in both themes); disabled arrows keep `--line-strong`
  as today.
- **Rationale**: Clear "lifted" feedback with existing tokens; no new colours to check.

## R5. Auto-scroll

- **Decision**: While dragging, if the pointer is within 56 px of the top or bottom of the
  viewport, scroll the window each animation frame by a speed proportional to the depth into
  that band (max ~12 px per frame). The scroll delta is added to the dragged row's offset so it
  stays under the finger. The dragged centre is clamped to the list's bounds.
- **Rationale**: The collection page scrolls the window (the list is not a scroll box), and the
  fixed bottom bar / removal toast sit in the bottom band, so the band must be wide enough to
  reach them.

## R6. Commit and cancel

- **Decision**: On `pointerup` inside the list, if the landing index differs from the start,
  call `onmove(from, to)`, which the page wires to the existing `move()`: `repertoire.move`,
  then the live-region status « « titre » déplacé en position N ». The transforms are reset in
  the same frame as the store update, so the keyed list re-renders in the new order without a
  jump. Cancel (no move, transforms reset) on: Escape, `pointercancel`, `lostpointercapture`
  without `pointerup`, release more than one row height outside the list, leaving ordering
  mode, or page destroy.
- **Rationale**: Reuses the tested model path (`moveEntry`), storage and announcement; nothing
  new to persist.

## R7. Accessibility

- **Decision**: The arrows stay as they are (names « Monter « … » », « Descendre « … » »,
  disabled at the ends, focus kept after a move). The handle is a `<span aria-hidden="true">`,
  not focusable, with a `title`-free grip icon. After a drag, focus is not moved (pointer users),
  and the status line announces the move.
- **Rationale**: Option B chosen on 2026-11-14: the arrows satisfy 2.1.1 and 2.5.7, so a second
  keyboard pattern on the handle would duplicate them (Principle V). A hidden, unfocusable
  handle passes axe and does not add noise for screen readers.
- **Alternatives considered**: Focusable handle with Space/arrow-key pick-up (duplicate of the
  arrows); menu on the handle (option A, not chosen).

## R8. Testing

- **Decision**: Unit-test `dropIndex` and `shiftOf`. E2E with Playwright: mouse drag via
  `page.mouse.down/move/up` in steps; touch drag via synthetic `PointerEvent`s with
  `pointerType: 'touch'` dispatched on the handle (same approach as the swipe test in us9);
  checks for order after drop, after reload, cancel with Escape, auto-scroll on a long
  collection at phone size, swipe on a title not moving anything, axe in ordering mode.
- **Rationale**: Playwright's touchscreen API only taps; synthetic pointer events exercise the
  same handlers. Real-device feel is covered in the quickstart.
