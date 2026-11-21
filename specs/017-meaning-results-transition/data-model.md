# Data Model: Transition and color for results by meaning

No stored data changes. The feature adds one transient piece of screen state.

## Reveal phase

The step of the sequence the list area is in. Held by the search page next to `meaningPhase`
(feature 011).

| Value | List area shows | Ends when |
|-------|-----------------|-----------|
| `none` | Normal content: word results, or results by meaning with the meaning marker | A launch |
| `clearing` | The list that was on screen, fading out, `inert` | 180 ms elapsed → `waiting` |
| `waiting` | `MeaningTransition` placeholder (status line above, as today) | Answer ready and 400 ms since launch → `revealing`; cancel, error, mode left → `none` |
| `revealing` | Results by meaning, rows coming in, marker on | 500 ms elapsed → `none` |

### Transitions

```text
                 launch (list on screen)          180 ms
   none ───────────────────────────────▶ clearing ───────▶ waiting
     ▲  launch (nothing on screen) ───────────────────────▶   │
     │                                                        │ answer ready
     │                                                        │ and ≥ 400 ms since launch
     │   500 ms                                               ▼
     ├──────────────────────────────────────────────── revealing
     │
     └── cancel / error / mode left / field emptied (from clearing or waiting)
```

- A new launch while `clearing` or `waiting` keeps the phase and restarts the 400 ms clock.
- A new launch while `revealing` or `none` with results by meaning on screen goes through
  `clearing` again (same text validated twice replays).
- A filter re-run (feature 011, FR-006) never changes the phase.

### Related state (existing)

- `meaningPhase` (`idle` / `waiting` / `preparing` / `error`): drives the status line. Unchanged.
- `meaningResponse`, `meaningFor`, `meaningActive`: which list is the meaning list. The marker
  follows `shown.kind === 'meaning'`.
- `response`: word results, always kept up to date while typing; shown again when the phase
  returns to `none` without results by meaning.

## Validation rules

- `revealing` is entered only with a meaning response set (never on error or cancel).
- In `clearing` and `waiting`, no result row is reachable by tap, keyboard or screen reader.
- The 400 ms minimum counts from the last launch; it never applies after the answer of a search
  that took longer.
