# Research: Highlight the matching stanza

## R1. What "the matching stanza" is, in the data we already have

**Decision**: The stanza is identified by `hit.section`, the index in `hymn.sections` that
`rankMeaning` already returns for each hymn's best row. The mark covers that section **and the
short sections joined to it at indexing time** (the whole embedded group), all of which are printed
in the reading view.

**Rationale**:
- `indexedStanzas` (feature 011, research R2) embeds one text per *group*: a distinct section,
  plus any section under `minSectionChars` (40) joined to its neighbour. The row keeps the group's
  first section index. So the text that matched may span 2 sections (for example a one-line « Alléluia ! »
  after a verse). Marking only the first section would hide part of what matched; marking a lone
  short first section would mark a single line.
- The excerpt shown in the list is `meaningExcerpt(hymn.sections[hit.section].lines)`, the start of
  that group. So "the stanza the excerpt comes from" (FR-002) is the group starting at `hit.section`.
- Every section in a group is a **first occurrence** of its text (groups are built from distinct
  sections). `LyricsView` only skips a chorus equal to the *previous* chorus, so a first occurrence
  is always printed (FR-008: a repeated chorus is marked once, where it is printed).

**How**: extract the grouping steps 1–2 of `indexedStanzas` into an exported pure function
`stanzaGroups(sections, minSectionChars)` returning `{ sections: number[]; lines: string[] }[]`.
`indexedStanzas` keeps its output byte for byte (same texts, same `section` = `sections[0]`), so the
meaning data and its version do not change. The reading view calls the same function to find the
group that starts at the given section.

**Alternatives considered**:
- Mark `hit.section` only: simpler, but wrong for joined short sections (see above).
- Store each row's section list in the meaning data: changes the binary format and its version, and
  forces a rebuild, for a value the client can recompute from the lyrics it already has.

## R2. How the stanza goes from the result to the reading view

**Decision**: A query parameter on the result link: `/recueils/<hymnal>/<number>?passage=<index>`,
`<index>` being the group's first section index (0-based, in `hymn.sections`).

**Rationale**:
- Results are plain `<a href>` links (`ResultList.svelte`); a parameter needs no new navigation code.
- It follows the existing pattern (`?collection=<id>` on the same page, `sens=1` on `/`).
- Every other way into a hymn (previous/next, the desktop index, other references, hymnals,
  collections, recent hymns) builds URLs with `hymnUrl` without the parameter, so FR-009 holds by
  construction. Back to the results then into the same hymn uses the same link, so the mark comes
  back (US2 scenario 4).
- Reload keeps the mark, a shared link carries it; the spec allows either.
- The hymn history (feature 006) records hymnal + number only, so the parameter never reaches the
  recent hymns.

**Alternatives considered**:
- URL hash `#strophe-3` with CSS `:target`: no JS, but the browser always scrolls the target to the
  top, even when already visible (against FR-003); `:target` matches one element, not a group; and
  SvelteKit's own hash handling would compete with the bottom reading bar offset.
- SvelteKit shallow routing state (`page.state`): needs `goto` instead of a link, lost on reload,
  harder to test.
- An in-memory store set on click: leaks into the next navigation unless cleared everywhere; lost
  on reload.

## R3. Which results carry the stanza

**Decision**: Add `matchedSection?: number` to `MeaningCandidate` and `SearchResult`. `fuse()` sets
it on a result **only when the excerpt it keeps is the meaning excerpt**: meaning-only results, and
`both` results where the meaning excerpt wins (`meaningWins`, or no word excerpt). The link gets
`?passage=` only when `matchedSection` is set.

**Rationale**: FR-011 and the "found by both" edge case: the mark must always match what the list
showed. `fuse()` is already where that excerpt choice is made, and it is unit-tested.

**Alternatives considered**: deciding in `ResultList` from `matchedBy`: it cannot tell which excerpt
won, so a `both` result showing a word line would mark a stanza the user never saw.

## R4. Validating the parameter

**Decision**: A pure function `markedSections(sections, param, minSectionChars)` returns the
section indices to mark, or an empty list when the parameter is absent, not a whole number, out of
range, or not the first section of a group. No error, no message (FR-010).

**Rationale**: The meaning data is built with the same catalog it ships with (`load.ts` already
drops rows whose section is out of range), so a mismatch is rare. When it happens, or the URL is
edited, no mark is safer than a wrong one.

## R5. Bringing the stanza into view

**Decision**: In the hymn page, `afterNavigate(({ type }) => …)`, skipping `type === 'popstate'`.
After `tick()`, take the first `.hb-stanza--match`. It is "fully visible" when its top is ≥ 0 and its
bottom is ≤ the window height minus the height of the fixed reading bar (`.hy-readbar`, phone only;
0 when absent). If not, `scrollIntoView({ block: 'start' })` (instant), with CSS
`scroll-margin-top: var(--space-6)` so it does not touch the top edge. A stanza taller than the
visible area is fully visible never, so its start goes to the top (edge case "very long stanza").

**Rationale**:
- `afterNavigate` runs after SvelteKit's own scroll handling (scroll to top on a new page), so our
  scroll is not undone. `$effect` could run before it.
- Skipping `popstate` keeps the scroll position the browser restores on back/forward, so returning
  to a hymn does not jump.
- Instant scroll: the page has just opened; a smooth scroll on open reads as motion with no purpose,
  and there is nothing to respect for reduced motion.
- The mobile header is not sticky, so only the bottom bar hides content. The header stays reachable
  by scrolling up (US1 scenario 2).

**Alternatives considered**: `block: 'center'`: hides the start of a long stanza and moves more than
needed; `block: 'nearest'`: would place a stanza under the fixed reading bar.

## R6. Look of the mark

**Decision**: Class `hb-stanza--match` on each marked stanza: background `--meaning-soft`, a 3 px
left bar in `--meaning`, small radius, padding so the text does not move horizontally (the bar sits
in the existing left padding). No animation.

**Rationale**:
- Reuses the meaning colours of feature 012: the mark visibly belongs to search by meaning, and
  light and dark tokens already exist.
- Not colour alone (FR-005): the left bar is a shape cue, plus the accessible text of R7.
- Contrast checked on the token values:

  | Pair | Light | Dark | Needed |
  |------|-------|------|--------|
  | `--ink` on `--meaning-soft` (lyrics) | 14.8:1 | 12.3:1 | 4.5:1 |
  | `--rubric` on `--meaning-soft` (verse number, labels) | 6.0:1 | 6.2:1 | 4.5:1 |
  | `--ink-muted` on `--meaning-soft` | 6.3:1 | 5.8:1 | 4.5:1 |
  | `--meaning` bar on `--paper` (non-text) | 5.0:1 | 9.4:1 | 3:1 |

- No animation: the spec allows a short one but does not need it; the scroll already shows the
  user where to look (Principle V).
- Text size changes only scale the text; the class stays on the element (edge case).

## R7. Screen readers

**Decision**: The first marked stanza starts with a visually hidden span (existing `hb-sr` class):
« Passage correspondant à votre recherche : ». Nothing changes focus.

**Rationale**: Stanzas are `<p>` elements; `aria-label` on a `<p>` is not reliably read. A hidden
text prefix is read in every reading mode and does not change the visible lyrics (FR-007). Moving
focus on open would break the usual reading order of the page (title first).
