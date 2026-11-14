# UI Contract: drag-and-drop in « Modifier l'ordre »

Route: `/repertoire/[collection]`, ordering mode (menu « Plus d'options » → « Modifier l'ordre »,
offered with 2 hymns or more; left with « Terminé »). Normal mode is unchanged.

## Row in ordering mode

```html
<li class="hb-item" data-row="{i}">
  <a class="hb-item__link …">…number, hymnal, title…</a>   <!-- unchanged -->
  <button class="hb-icon-btn collection__move" data-move="up"   aria-label="Monter « … »">…</button>
  <button class="hb-icon-btn collection__move" data-move="down" aria-label="Descendre « … »">…</button>
  <span class="collection__handle" aria-hidden="true"><svg>…grip…</svg></span>
</li>
```

| Element | Contract |
|---------|----------|
| Arrows | Same names, `data-move`, disabled at the ends, focus kept after a move (as feature 003). Colour `--ink-muted`; 44 px target. |
| Handle | Last in the row, 44 × 44 px, grip icon (six dots) in `--ink`, cursor `grab` / `grabbing`, `touch-action: none`. Not focusable, `aria-hidden="true"`. Present on every row, including « Chant indisponible ». |
| List | `<ol>` gets the drag attachment only while ordering. |

## Drag behaviour

| Step | Behaviour |
|------|-----------|
| Press on handle | Nothing visible; the pointer is captured. |
| Move ≥ 4 px | Row lifts (`.is-dragging`: raised background, shadow) and follows the pointer vertically. |
| Moving | Other rows slide one place (150 ms; none with reduced motion) to show the landing place. |
| Near viewport edge (56 px) | Window scrolls; the row stays under the pointer. |
| Release in the list | If the place changed: `repertoire.move(id, from, to)`, status « « titre » déplacé en position N » (live region). Else nothing. |
| Escape / pointer cancel / lost capture / release > 1 row outside the list / « Terminé » / leave page | Drag cancelled, rows back in place, order unchanged. |
| Swipe outside a handle | Scrolls the page; no drag. |
| Release over a hymn link | No navigation (pointer captured by the handle). |

## Accessibility

- Keyboard, screen reader and single-tap reordering: the arrows (WCAG 2.1.1, 2.5.7).
- Every move (arrow or drag) is announced in the existing `aria-live="polite"` status line.
- axe: no violation on the page in ordering mode, light and dark.

## Helpers

- `dropIndex`, `shiftOf` in `src/lib/repertoire/reorder.ts` — see [data-model.md](../data-model.md).
- `dragReorder({ onmove })` in `src/lib/repertoire/drag-reorder.ts` — Svelte attachment for the
  `<ol>`; looks up rows by `[data-row]` and handles by `.collection__handle`.
