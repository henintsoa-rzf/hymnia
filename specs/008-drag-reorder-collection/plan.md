# Implementation Plan: Reorder a collection by drag-and-drop

**Branch**: `008-drag-reorder-collection` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-drag-reorder-collection/spec.md`

## Summary

In « Modifier l'ordre » mode on `/repertoire/[collection]`, each row gets a grip handle at its
end. Pressing the handle (touch or mouse) and moving lifts the row: it follows the pointer, the
other rows slide by one place to show where it would land, the page scrolls on its own near the
screen edges, and releasing commits the move through the existing `repertoire.move(id, from, to)`
(same storage, same « déplacé en position N » announcement). Escape, an interrupted gesture, a
release outside the list or leaving ordering mode cancel the drag.

The up and down arrows stay (option B, 2026-11-14) in a muted style: they remain the keyboard,
screen reader and single-tap way to reorder (WCAG 2.1.1 and 2.5.7), so the handle is pointer-only
and hidden from assistive technologies.

Built with Pointer Events and no new dependency: a pure module computes the landing index and the
shift of each row (unit-tested), and a Svelte attachment on the list handles the pointer, the
visuals and the auto-scroll (e2e-tested).

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes, `{@attach}`), SvelteKit 2 (static
adapter, PWA)

**Primary Dependencies**: Existing only. No new dependency (no SortableJS, no svelte-dnd-action).

**Storage**: Unchanged: the collection's ordered `entries` in `localStorage`
(`hymnia.repertoire.v2`), written by the existing `moveEntry` / `repertoire.move`.

**Testing**: Vitest (`unit` project) for the drop maths; Playwright + axe for the drag (mouse
and synthetic touch pointer events) on `tests/fixtures/sample-content`

**Target Platform**: Mobile-first web app / PWA (iOS Safari, Android Chrome), desktop browsers;
offline-capable

**Project Type**: Single SvelteKit web app (static), no backend

**Performance Goals**: The dragged row follows the finger at the display's frame rate (one
`transform` per animation frame, no layout reads during the move); no change to page load

**Constraints**: WCAG 2.2 AA (2.1.1 keyboard and 2.5.7 dragging via the arrows; contrast, 44 px
targets); a swipe outside the handles keeps scrolling the page; `prefers-reduced-motion`
respected; light and dark modes

**Scale/Scope**: 1 screen touched (collection page), 2 new modules in `src/lib/repertoire/`,
1 icon added (`grip`), 1 e2e spec updated, 1 new e2e spec, 1 new unit test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Recherche au cœur | Search screens untouched. | ✅ |
| II. Design épuré | The change lives only in ordering mode, entered on demand from the menu. One handle per row; the arrows become lighter, so the row is no busier than today. | ✅ |
| III. Fidélité et droits | No content change. | ✅ |
| IV. Modèle unifié | No data model change; reordering stays per collection entry, whatever the hymnal. | ✅ |
| V. Simplicité | No dependency: Pointer Events + one attachment (~150 lines). Commit goes through the existing `repertoire.move`. Drop maths are a pure, unit-tested function. | ✅ |
| VI. Accessibilité / hors ligne | Arrows kept for keyboard, screen reader and single tap (2.1.1, 2.5.7); muted arrows still ≥ 4.5:1 / 3:1 and 44 px; handle `aria-hidden`; moves announced in the existing live region; works offline (local storage only). | ✅ |
| Flux qualité | Existing order e2e kept green (arrows unchanged); new e2e for drag; axe on the page in ordering mode; mobile + light/dark in quickstart. | ✅ |

Post-design re-check (after Phase 1): unchanged, all ✅. No Complexity Tracking entry.

## Project Structure

### Documentation (this feature)

```text
specs/008-drag-reorder-collection/
├── plan.md              # This file
├── research.md          # Phase 0: technique, gesture, visuals, scroll, cancel, a11y, tests
├── data-model.md        # Phase 1: no stored change; transient drag state
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── ui.md            # Phase 1: ordering-mode row, handle, drag behaviour
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── repertoire/
│   │   ├── reorder.ts                 # pure: dropIndex(), shiftOf() (new)
│   │   └── drag-reorder.ts            # attachment: pointer drag, visuals, auto-scroll (new)
│   └── components/
│       └── Icon.svelte                # + 'grip' icon (six dots)
└── routes/repertoire/[collection]/
    └── +page.svelte                   # handle in ordering mode, muted arrows, {@attach} on <ol>

tests/
├── unit/
│   └── repertoire-reorder.test.ts     # dropIndex / shiftOf: up, down, same place, ends, uneven rows
└── e2e/
    ├── us9-collection-order.spec.ts   # unchanged scenarios (arrows) + arrows still present
    └── us14-collection-drag.spec.ts   # mouse drag, touch drag, cancel, scroll, reload, axe
```

**Structure Decision**: Single SvelteKit app, as for features 001–007. The drag code sits with
the repertoire because it only serves collection ordering; the pure maths are split out so they
can be unit-tested without a DOM (the page imports `$app`, which unit tests cannot load).

## Complexity Tracking

No violation; nothing to justify.
