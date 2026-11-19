# Research: Choose the hymnals used by the app

No open question was left by the spec. Each decision below settles a design point raised by the
existing code.

## R1. How the choice is stored

**Decision**: A new field of the reading preferences, `excluded`, holding **what the user left
out**: `{ hymnals: string[]; parts: Record<string, number[]> }`. `hymnals` lists hymnal ids left out
entirely; `parts[hymnalId]` lists the `first` number of each part left out in a hymnal that is still
partly in use. Default `{ hymnals: [], parts: {} }` (everything in use, FR-020).

**Rationale**:
- Storing the left-out side makes a hymnal or part added later selected by default (FR-019) with
  no migration.
- `prefs` (`src/lib/prefs/prefs.ts`) already holds the per-device settings, is kept apart from hymn
  data (Principle IV), guards storage access and sanitises what it reads. Adding a field there gives
  saving, restoring and the private-mode fallback for free (FR-018, edge case "storage unavailable").
- Parts have no id in the schema (`{ name, first }`). `first` is the stable key: it defines the part
  (its numbers run from `first` to the next part's `first`), it is an integer, and the schema
  requires it to be unique and increasing within a hymnal. A part renamed keeps its choice; a part
  inserted between two others does not shift the keys of the others.

**Alternatives considered**:
- Store the selected side: a new hymnal would be hidden by default, against FR-019.
- Key parts by name: breaks on a typo fix in `content/hymnals.json`; names also carry typographic
  apostrophes.
- Key parts by index: inserting a part shifts every following choice.
- A separate storage key: duplicates the guarded storage code for no gain.

## R2. Normal form of the choice

**Decision**: Every change goes through one pure function, `cleanExclusions(excluded, hymnals)`,
that returns the normal form:
1. ids of hymnals and parts that no longer exist are dropped (edge case "removed");
2. a hymnal whose every part is left out moves to `hymnals` (FR-005, Story 2 scenario 4), and its
   `parts` entry is removed; a hymnal in `hymnals` has no `parts` entry;
3. if the result leaves nothing in use, the empty choice (everything in use) is returned instead.

**Rationale**: one place decides the three states of a hymnal (all / some / none, FR-005), so the
settings screen, the search and the lists can never disagree. Rule 3 is a safety net: the screen
already prevents removing the last item (FR-007, R6), but a stored value edited by hand or a data
update that removes the last selected hymnal must not leave an empty app.

**Note**: when a hymnal is fully left out, a part added to it later stays left out (it is in
`hymnals`). This matches the user's intent: they chose to leave out the whole hymnal.

## R3. What "in the selection" means for one entry

**Decision**: An entry (`hymnal`, `sortKey`) is in the selection when its hymnal is not in
`excluded.hymnals`, and either the hymnal has no parts, or its leading number falls outside every
part (no number, or below the first part), or the part that holds it is not left out. Same rule as
`groupByPart` (`src/lib/domain/parts.ts`) for which part holds a number.

A **hymn** is in the selection when at least one of its entries is (FR-010). Its results show only
those entries.

**Rationale**: hymns of a hymnal outside every part follow the hymnal (FR-012): they stay while the
hymnal is partly in use and go with it. Using the entry's `sortKey[0]` (already computed at build
time, `NO_NUMBER` for no leading digit) avoids parsing numbers again.

## R4. Where the choice is applied in search

**Decision**: The search request carries the choice: `SearchRequest.excluded?: Exclusions`. The
engine builds a `Scope` (R3) per request and applies it wherever it applies the hymnal filter today:
`allowedEntries`, `isAllowed`, `searchNumber`, `resultFor`. Search by meaning passes the same scope to
`rankMeaning` as a per-hymn predicate, so left-out hymns are skipped before scoring, like the filter.

The per-search filter (`hymnals`) stays and is intersected with the selection: filter ids not in use
are ignored; if none remains, no filter applies (FR-014).

A query naming a hymnal and number (« ARC 12 ») whose entry is outside the selection returns no
result and a new `outOfScope: { hymnal, number }` field, so the screen can say why and link to
Settings, instead of « introuvable ». Today a hymnal typed explicitly "wins over the filter"; it
does not win over the selection (Story 1 scenario 2).

**Rationale**:
- The worker is stateless per request today (only the latest query runs). Sending the choice with
  each request keeps it so: no extra message type, no state to keep in sync when the user changes
  Settings, and the Node tests call the engine the same way. The payload is a few ids.
- Applying it inside the engine (not by filtering results afterwards) keeps the result count right
  (limit 50 after scope, not before) and the excerpts and primary references right (FR-010).
- With an empty choice, every path is the current code path: reference query results are unchanged.

**Performance**: the scope check is a set lookup plus, for hymnals with parts, a scan of at most 15
parts, on hits only. Lexical search stays well under the 200 ms target (SC-004); meaning ranking
caches the per-hymn answer as `rankMeaning` already does for the filter.

**Alternatives considered**:
- Send the choice to the worker once (`set-scope` message) and keep it there: one more piece of
  state in the worker, races with a search sent just before, and a different path in tests.
- Rebuild the index without left-out hymns: costly on the device, and the index is shared by every
  choice.
- Filter results on the UI side: wrong counts and wrong references for hymns in several hymnals.

## R5. Where the choice is applied outside search

| Place | Change |
|-------|--------|
| Search filter chips (`/`, `/repertoire/<c>/ajouter`) | Only hymnals in use (not `none`). Saved filter and `?recueils=` ignore ids not in use (FR-014). |
| Search examples (start panel) | `pickExamples(catalog, scope)` takes entries in the selection only (FR-013). |
| Recueils list (`/recueils`) | Hymnals in use only (FR-011). A partly used hymnal shows the count of hymns in use. |
| Hymnal page (`/recueils/<id>`) | Groups of left-out parts are not shown (FR-011); a line says how many parts are hidden, with a link to Settings. A fully left-out hymnal shows a notice with a link to Settings above its list (FR-017). « Aller au numéro » on a hidden number says it is in a hidden part. |
| Empty search result | When the choice is not empty, the empty state adds « Certains recueils sont masqués dans les Réglages. » with a link. |
| Hymn page, collections, recent hymns, direct links | Unchanged (FR-015, FR-016). |

**Rationale**: the user narrowed what the app *offers*; what they saved or open by link is theirs.
The two notices answer the likely question « why can't I find this hymn? » without adding anything
to screens when no choice is made (Principle II).

**Hymn page neighbours** (previous / next on desktop) are left unchanged: the spec keeps the reading
view as it is, and skipping across hidden parts would make the numbers jump without a visible
reason.

## R6. Settings screen layout and controls

**Decision**:
- Two `<section>`s on the same screen, each with an `h2`: « Affichage » (theme, text size and
  preview, unchanged) then « Recueils ». The current setting headings become `h3` (FR-001, Story 3
  scenario 3).
- « Recueils »: one row per hymnal in `getHymnalsByName()` order (FR-003), each a native checkbox
  with the hymnal name as label. A hymnal with parts shows « 3 parties sur 4 » under its name and a
  disclosure button (`aria-expanded`) that unfolds its parts as indented checkboxes, folded by
  default (FR-004).
- Partly selected: the native `indeterminate` state, read by screen readers as « mixed » / « partiellement coché » (FR-021). Clicking a partly selected or unchecked hymnal selects all of it;
  clicking a checked one leaves it out (FR-005).
- The last item in use is `disabled`, with « Gardez au moins un recueil. » as its description
  (`aria-describedby`) (FR-007).
- « Tout sélectionner » (text button) appears when the choice is not empty (FR-006).
- Changes write `prefs` at once (FR-008).

**Rationale**: native checkboxes give keyboard use, the three states and screen reader announcements
without custom ARIA, and the 44 px touch target comes from the existing row styles (`hy-row`).
Folding parts keeps the list short (Arc-en-ciel has 15 parts) while the count line says what is
inside.

**Alternatives considered**:
- Switches (`role="switch"`): they have no mixed state.
- Separate screens per subsection: more navigation for two short groups; the spec keeps one screen.
- Parts always unfolded: about 45 rows, the screen loses its purpose at a glance.
