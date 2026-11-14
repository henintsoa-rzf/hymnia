# Quickstart: validate drag-and-drop ordering

## Prerequisites

- `npm install` done.
- To see real hymns locally, a personal-use build (`HYMNIA_PERSONAL_USE=1` in `.env`). Without
  it, only the e2e fixture has content.

## Automated checks

```bash
npm test                 # unit: dropIndex / shiftOf (repertoire-reorder.test.ts)
npm run test:e2e         # us9 (arrows, unchanged) + us14 (drag: mouse, touch, cancel, scroll, axe)
npm run check && npm run lint
```

Expected: all green. Search query sets are not affected.

## Manual scenarios (`npm run dev`)

Create a collection « Culte » with 8 hymns or more, open it, menu → « Modifier l'ordre ».

1. **Look**: each row shows the muted up/down arrows and a grip handle at the end; first « Monter »
   and last « Descendre » are disabled.
2. **Phone, touch** (real device or DevTools touch at ≈ 390 px): press the last hymn's handle,
   drag it to the top, release. Rows slide as it moves; it lands first; others shifted by one.
3. **Desktop, mouse**: same with the mouse; cursor shows grab / grabbing.
4. **Persistence**: « Terminé », reload, and offline (DevTools offline) reload: the order is kept.
   « Lire dans l'ordre » then next follows the new order.
5. **Auto-scroll**: with a list longer than the screen, drag a hymn to the bottom edge; the page
   scrolls and the hymn can reach the last place.
6. **Cancel**: start a drag and press Escape; drag and release far outside the list; drag and
   drop at the start place: the order is unchanged.
7. **Scroll is safe**: swipe up/down on titles in ordering mode: the page scrolls, nothing moves.
8. **Arrows**: with the keyboard only, Tab to « Monter » of the 3rd hymn, press it twice: it is
   first, focus stays on its arrow, the screen reader announces « … déplacé en position 1 ».
9. **Themes and motion**: light and dark modes legible; with reduced motion, rows jump instead of
   sliding.
