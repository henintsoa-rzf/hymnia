# Contract: conducteurdelouange.com adapter, unnumbered hymnals (Exo)

This extends the `cdl` adapter contract (`specs/002-hymnal-import/contracts/source-adapter.md`).
The `SourceAdapter` interface does not change.

## `listEntries('exo', ctx)`

**Input**: listing pages `${BASE}/chants/recueil/6` and `?page=2..last`, read through `ctx.fetch`
only.

**Output**: `EntryRef[]`, sorted by number, one per distinct song:
`{ hymnal: 'exo', number: '<n>', url: 'https://www.conducteurdelouange.com/<id>' }`.

**Rules**:
1. A row is kept when its title link is `/<digits>`. In a hymnal of `CDL_PINNED`, the absence
   of `#number` does not exclude the row.
2. A song is identified by its id. Duplicate rows (same id, on one page or across pages) give
   one entry.
3. Number = pinned number. If the id is not pinned, it gets `max(pinned) + k`, in ascending id
   order.
4. Every pinned id is returned, whether or not it was listed in this run.
5. Logs (`ctx.log`), one line each:
   - `exo: <rows> rows, <distinct> songs listed`
   - `exo <n>: /<id> is not pinned yet: add it to CDL_PINNED`
   - `exo <n>: /<id> pinned but not in the list this run`
6. Numbered hymnals (`jem`, `adf`, `cd`) behave exactly as before. A row without a number is
   still skipped there with the existing log.

## `parseHymn(html, ref)` for Exo pages

This is the same function as for the other cdl hymnals (`parseCdlHymn`). The only addition: a
lyric line that is only a bracketed section label (`(Refrain)`, `(Pont)`, `(Couplet 2)`,
case-insensitive) is read as a label, not as lyrics. It is counted in
`strippedMarkup['section-marker']`. As the first line of a section, it retypes that section;
elsewhere, it labels the next section (research R4).

## Tests (`tests/import/adapters/cdl.test.ts`)

| Case | Fixture | Expected |
|------|---------|----------|
| Exo listing over 3 overlapping pages | `listing-exo-page{1,2,3}.html` | one entry per distinct id; log states rows and distinct count |
| Pinned numbers | same, with a test table | each id gets its pinned number; order is by number |
| Unpinned id | same, with a table missing one id | gets `max + 1`; "not pinned yet" logged |
| Pinned id not listed | test table with an extra id | still returned; "pinned but not in the list" logged |
| Shipped table | `CDL_PINNED.exo` | unique numbers and ids; numbers 1..N follow ascending ids |
| `sources.json` coverage | `import/sources.json` | `cdl.hymnals` equals the keys of `CDL_VOLUMES` (now including `exo`) |
| Exo song, two authors | `hymn-698.html` | title, verses numbered 1..n, the `(Refrain)` block typed `chorus`, no `(Refrain)` line, 2 `unspecified` credits |
| Exo song, one author | `hymn-1320.html` | chorus then verses; 1 credit |
| Numbered hymnal unchanged | existing JEM fixtures | existing assertions pass unchanged |
