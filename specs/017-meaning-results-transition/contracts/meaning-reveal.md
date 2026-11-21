# Contract: Meaning results sequence and marker (UI)

Search screen `/`. Complements `specs/011-semantic-search/contracts/meaning-search.md` ("UI
states") and `specs/012-meaning-search-mode/contracts/search-mode.md`.

## Module `src/lib/meaning/reveal.ts`

```ts
export type RevealPhase = 'none' | 'clearing' | 'waiting' | 'revealing';

export const CLEAR_MS = 180;      // clearing → waiting
export const MIN_WAIT_MS = 400;   // launch → earliest reveal
export const REVEAL_MS = 500;     // revealing → none
export const ROW_STAGGER_MS = 30; // delay between rows
export const ROW_STAGGER_CAP = 10;// rows past this index share the last delay

/** Resolves when `minMs` have passed since `start` (at once if already passed). */
export function holdUntil(start: number, minMs: number, now?: () => number): Promise<void>;

/** First phase of a launch: clear what is on screen, or go straight to waiting. */
export function launchPhase(current: RevealPhase, listOnScreen: boolean): RevealPhase;

/** What the list area renders. */
export function listView(input: {
  reveal: RevealPhase;
  hasList: boolean;            // a ResultList would show (word or meaning)
}): 'none' | 'list' | 'leaving-list' | 'placeholder' | 'revealing-list'; // 'none': no list to show
```

`launchPhase`: `clearing` or `waiting` stay as they are; otherwise `clearing` if
`listOnScreen`, else `waiting`.

## DOM hooks (used by styles and e2e tests)

| Element | When | Hook |
|---------|------|------|
| Result list wrapper | Leaving | class `is-leaving`, attribute `inert` |
| Placeholder | `waiting` | `.meaning-transition`, `aria-hidden="true"` |
| Result list `<ul>` | Results by meaning | class `hb-list--meaning` |
| Result list `<ul>` | `revealing` | class `is-revealing`; each `<li>` has `style="--i: n"` |
| List heading `<h2>` | Results by meaning | class `hb-overline--meaning`, glyph `svg` before the text |
| Empty state | No result by meaning | glyph before « Aucun chant trouvé par le sens » |

## Timings and motion

| Step | Motion (default) | Reduced motion |
|------|------------------|----------------|
| Clearing | opacity 1 → 0, translateY 0 → 4 px, 180 ms ease-in | hidden at once |
| Waiting | sweep across 3 placeholder rows, 1.2 s loop, rows 150 ms apart | still rows |
| Revealing | each row opacity 0 → 1, translateY 6 px → 0, 160 ms ease-out, delay `min(i, 10) × 30 ms` | shown at once |

Results show no sooner than 400 ms after the last launch, and no later than one frame after the
answer when the search took longer.

## Triggers

| Event | Sequence |
|-------|----------|
| Launch button, Enter in meaning mode (text, not a number) | Yes |
| Page opened with `?sens=1&q=…` | Yes, starting at `waiting` if nothing is on screen |
| Hymnal filter changed with results by meaning shown | No (list updates in place, marker kept) |
| Typing, word mode, leaving the mode | No |
| Cancel, error, field emptied, mode left during the sequence | Phase `none`; word results (with the error line when failed) |

## Marker

- Bar: 3 px, `--meaning`, in the left gutter (`left: -10px` from the row), inset 12 px top and
  bottom, radius 2 px. Row box and text unchanged.
- Heading: `--meaning` color, 16 px sparkle glyph (`Icon name="meaning"`), text unchanged (« Résultats
  par le sens · N chants »).
- Contrast ≥ 3:1 against `--paper` in light and dark (measured ≈ 5.0:1 and ≈ 9.6:1).
- Shown on every list whose response is by meaning, so also on the hymns found from Bible verses
  (feature 015, `/bible/chants`), which uses the same `ResultList`; the sequence itself plays only
  on the search screen `/`.
- Absent from word results, the exact-number block and the add-to-collection list.
