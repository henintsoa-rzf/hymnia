# Data Model: Choose the hymnals used by the app

No change to the content schema, the catalog, the search index or the meaning data. One field is
added to the per-device reading preferences.

## Exclusions (stored, per device)

Part of `Prefs` (`src/lib/prefs/prefs.ts`), stored under the existing `hymnia.prefs` key.

```ts
type Exclusions = {
	/** Hymnal ids left out entirely. */
	hymnals: string[];
	/** Hymnal id → `first` number of each part left out, for hymnals still partly in use. */
	parts: Record<string, number[]>;
};

type Prefs = {
	textScale: number;
	theme: Theme;
	hymnalFilter: string[];
	excluded: Exclusions; // NEW, default { hymnals: [], parts: {} }
};
```

**Validation on read** (`sanitizePrefs`, type only, no catalog needed):
- missing or not an object → default;
- `hymnals`: strings only, duplicates removed;
- `parts`: keys are strings, values arrays of positive integers, duplicates removed, empty arrays
  dropped.

**Normal form** (`cleanExclusions(excluded, hymnals)`, needs the catalog, research R2):
1. unknown hymnal ids and unknown part `first` values are dropped;
2. a hymnal in `hymnals` has no `parts` entry;
3. a hymnal whose every part is listed in `parts` moves to `hymnals`;
4. if no hymnal is left in use, the result is the default (everything in use).

Every write from the settings screen stores the normal form. Readers (search, lists) always clean
what they read, so a stale stored value (data update, hand edit) never breaks a screen.

## Hymnal state (derived)

| State | Condition | Checkbox |
|-------|-----------|----------|
| `all` | not in `hymnals`, no `parts` entry | checked |
| `some` | not in `hymnals`, has a `parts` entry | indeterminate |
| `none` | in `hymnals` | unchecked |

Transitions from the settings screen:

| From | Action | To |
|------|--------|----|
| `all` | uncheck hymnal | `none` (unless it is the last in use: disabled) |
| `some` / `none` | check hymnal | `all` |
| `all` | uncheck a part | `some`, or `none` if it was the only part |
| `some` | uncheck a part | `some`, or `none` when it was the last part in use |
| `some` / `none` | check a part | `some`, or `all` when every part is back |
| any | « Tout sélectionner » | everything `all` |

## Scope (derived, per request)

`createScope(excluded, hymnals)` → read-only object used by the engine, the lists and the examples:

| Member | Meaning |
|--------|---------|
| `isEmpty` | nothing is left out (fast path: every check returns true) |
| `hymnalState(id)` | `all` / `some` / `none` |
| `includesPart(hymnalId, first)` | part in use |
| `includesEntry({ hymnal, sortKey })` | entry in use (research R3) |
| `includesHymn(hymn)` | at least one entry in use |
| `canLeaveOut(target)` | false when `target` (a hymnal or a part) holds the last item in use |

Which part holds a number: the part with the greatest `first` ≤ `sortKey[0]`, as in `groupByPart`.
A number with no leading digit (`NO_NUMBER`) or below the first part is in no part and follows its
hymnal.

## Search request (in memory, UI → worker)

`SearchRequest` gains `excluded?: Exclusions` (absent = nothing left out).
`SearchResponse` gains `outOfScope?: { hymnal: string; number: string }` for a hymnal-number query
whose entry exists but is left out. See [contracts/scope.md](./contracts/scope.md).
