# Data Model: Reorder a collection by drag-and-drop

## Stored data

No change. A collection keeps its ordered `entries` (feature 003, `src/lib/repertoire/schema.ts`).
A drop calls the existing `moveEntry(doc, id, from, to, now)`: same validation (indices in range,
`from ≠ to`), same `updatedAt`, same storage key `hymnia.repertoire.v2`.

## Transient drag state (in memory, never stored)

| Field | Meaning |
|-------|---------|
| `from` | Index of the row being dragged |
| `to` | Current landing index (`dropIndex`) |
| `startY`, `startScroll` | Pointer Y and window scroll at press |
| `rows` | Top and height of every row, read once at drag start |
| `lifted` | `false` until the pointer moved 4 px |
| `pointerId` | The captured pointer |

States: `idle → pressed → dragging → (committed | cancelled) → idle`.
`pressed → idle` when released before 4 px (no move). `dragging → cancelled` on Escape,
`pointercancel`, lost capture, release far outside the list, leaving ordering mode, destroy.

## Pure functions (`src/lib/repertoire/reorder.ts`)

- `dropIndex(from, rows, centerY) → number`: the index where the dragged row would land, given
  the other rows' midpoints and the dragged row's centre; clamped to `0 … rows.length - 1`.
- `shiftOf(i, from, to) → -1 | 0 | 1`: how many places row `i` slides while row `from` hovers at
  `to` (`-1` up for `from < i ≤ to`, `+1` down for `to ≤ i < from`, else `0`).
