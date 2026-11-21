# Research: Transition and color for results by meaning

All points were settled from the code of features 011–013 and the spec. No open question remains.

## R1. Where the sequence state lives

- **Decision**: A pure module `src/lib/meaning/reveal.ts` defines the phases (`none`, `clearing`,
  `waiting`, `revealing`), the timings, `holdUntil(start, minMs, now)` and `listView(...)`, which
  says what the list area shows from the reveal phase, the meaning phase and the responses. The
  page keeps one `$state` for the phase and drives it from `runMeaning` and `cancelMeaning`.
- **Rationale**: `+page.svelte` already holds the meaning flow (`meaningPhase`, `meaningFor`,
  `runMeaning`). A separate pure module keeps the rules (what shows when, how long to hold) unit
  testable without a browser, as `mode.ts` did for feature 012.
- **Alternatives considered**: Svelte `{#key}` + `transition:` directives (out/in): they tie the
  timing to element mounting, can't express "hold at least 400 ms" or "skip on filter change", and
  outro timing blocks the DOM update. A store in its own file: more indirection for state used by
  one screen.

## R2. Clearing the previous list

- **Decision**: On launch, if a list is on screen, the phase becomes `clearing` for 180 ms. The
  current `ResultList` stays mounted with class `is-leaving` (keyframe: opacity 1 → 0, translateY
  0 → 4 px) and the `inert` attribute. Then the phase becomes `waiting` and the list is unmounted.
  If nothing is on screen (no result, idle, reload), the phase goes straight to `waiting`.
- **Rationale**: `inert` blocks taps, focus and the accessibility tree at once (FR-002), and is
  supported by the target browsers (Safari 15.5+, Chrome 102+). Fading in place avoids a layout
  jump before the placeholder takes the space.
- **Alternatives considered**: Unmount at once (no "clearing" seen, the request asks for it);
  `pointer-events: none` (keeps keyboard focus and screen reader access on the leaving rows).

## R3. The transition while the search runs

- **Decision**: New `MeaningTransition.svelte`, `aria-hidden="true"`: the sparkle glyph (`Icon
  name="meaning"`) in `--meaning`, and three placeholder rows shaped like result rows (title line,
  excerpt line) in `--meaning-soft`, each with a light sweep in `--meaning` running left to right
  (1.2 s loop, rows offset by 150 ms): "rows being written". The status line and « Annuler » of
  `MeaningStatus` stay above, unchanged. The placeholder has the height of three rows so the area
  doesn't collapse.
- **Rationale**: Reuses the mode's glyph and color, so the link with the button is direct (spec
  Story 1). Placeholder rows say "results are coming here" without a spinner. The status line
  already carries the text for screen readers, so the placeholder is hidden from them (FR-013).
- **Alternatives considered**: A spinner (generic, not "intelligent"); an animated sparkle alone
  (small, leaves a big empty area); a progress bar (the duration is unknown, except while the data
  downloads, which `MeaningStatus` already shows as a percentage).

## R4. Minimum duration without slowing slow searches

- **Decision**: `runMeaning` records `launchedAt` (`performance.now()`). When the answer is ready,
  it awaits `holdUntil(launchedAt, 400)`, which resolves at once if 400 ms have already passed,
  then checks `stale()` again and sets the response with phase `revealing`. A `revealing` timer
  (500 ms) then sets the phase to `none`.
- **Rationale**: Meets FR-004 both ways: a cached answer (≈ 30 ms) waits up to 400 ms; a 2 s answer
  shows at once. The `stale()` check after the hold keeps cancel and mode changes correct.
- **Alternatives considered**: `Promise.all([search, sleep(400)])` (same effect, but the sleep
  can't see a cancel; the explicit hold + stale check is clearer); a longer minimum (600–800 ms)
  felt slow in quick trials on the cache path.

## R5. The reveal

- **Decision**: While the phase is `revealing`, the list gets class `is-revealing`. Each `<li>`
  sets `--i` to its index; the keyframe (opacity 0 → 1, translateY 6 px → 0, 160 ms ease-out) has
  `animation-delay: calc(min(var(--i), 10) * 30ms)` and `animation-fill-mode: backwards`. Worst
  case 10 × 30 + 160 = 460 ms < 500 ms (FR-005). The class is removed at the end of the phase, so
  rows added later (filter change, scroll) don't animate.
- **Rationale**: Pure CSS, compositor only. Rows below row 10 share the last delay, so long lists
  don't drag (spec edge case). A row is clickable as soon as it starts showing.
- **Alternatives considered**: Svelte `in:fly` with per-item delay (works, but replays on every
  keyed insert, including filter changes, unless guarded the same way); IntersectionObserver to
  animate only visible rows (unneeded with the cap).

## R6. The meaning marker

- **Decision**: When `response.kind === 'meaning'`, `ResultList` adds:
  - on the heading, class `hb-overline--meaning`: `--meaning` text color and the sparkle glyph
    (16 px) before « Résultats par le sens · N chants »;
  - on the list, class `hb-list--meaning`: each row has a `::before` bar, 3 px wide, color
    `--meaning`, placed in the page gutter at `left: -10px` from the row, the height of the row
    minus 12 px top and bottom, rounded. The row's own box, padding and text don't change;
  - on the « Aucun chant trouvé par le sens » empty state, the glyph in `--meaning` before the
    title.
  The marker follows `response.kind`, which is what the page shows: since feature 011, results by
  meaning stay current while the text is edited, until the next launch or until a number is typed
  (`meaningActive`). The marker goes away exactly when the list stops being the meaning list
  (FR-011). Because the marker lives in `ResultList`, the hymns found from Bible verses (feature
  015, also a meaning response) get it too: the same sign for the same kind of list. The sequence
  stays on `/` only.
- **Rationale**: The bar echoes the stanza mark of feature 013 (inset bar in `--meaning`), so the
  same visual sign means "found by meaning" across the app. Being in the gutter (16 px on phones,
  wider on desktop), it doesn't reflow anything (FR-010). Shape + heading text + glyph mean color
  isn't the only cue (FR-009). Contrast: `#8a6510` on `#faf8f4` ≈ 5.0:1; `#d9b45a` on `#141311` ≈
  9.6:1 (≥ 3:1 required for graphical objects).
  Feature 011 chose "no badge per result" to keep the list sober: one shared, thin marker for the
  whole list keeps that spirit while answering the user's request for a color cue.
- **Alternatives considered**: Tinted background on every row (`--meaning-soft`): heavy on a list
  of 50, and lowers the contrast of the excerpt highlight `<mark>`; a sparkle icon on each row:
  the per-row badge feature 011 rejected; coloring titles: hurts reading, and links would no
  longer look alike across the app.

## R7. When the sequence plays

- **Decision**: `runMeaning(q, { sequence })`. `sequence: true` for the launch button, Enter
  (`submit`), and the reload of a `?sens=1` link; `sequence: false` for the re-run caused by a
  hymnal filter change (feature 011, FR-006). A launch during a running sequence restarts the
  clock (`launchedAt`) but doesn't clear again: the phase stays `waiting`.
- **Rationale**: FR-007 and the spec edge cases (filter change, launch during transition, reload).
- **Alternatives considered**: Deciding inside `runMeaning` from whether the query changed (fails
  the "validated twice on the same text" case, which must replay).

## R8. Word results during and after the sequence

- **Decision**: Word search keeps running as you type, as today. During `clearing` the leaving list
  is the one that was on screen; during `waiting` the list area shows only the placeholder. On
  cancel, error or leaving the mode, the phase becomes `none` at once and the list area shows the
  word `response` again (it is already computed, so it shows in the next frame; SC-004). An error
  keeps the `MeaningStatus` message above the word list, as in feature 011.
- **Rationale**: FR-001 and FR-006: the screen is never empty after the search by meaning ends.
- **Alternatives considered**: Keep word results under the placeholder (the request asks to empty
  the list).

## R9. Reduced motion

- **Decision**: Under `@media (prefers-reduced-motion: reduce)`: `.is-leaving` gets `opacity: 0`
  with no animation; the placeholder sweep is off (still rows); `.is-revealing` rows have no
  animation. The JS timings stay the same, so the order (clear, placeholder, results) and the
  400 ms minimum are unchanged (FR-012).
- **Rationale**: One code path for timing; motion is the only thing removed. Matches how
  `SearchBox` and `HymnalScope` handle reduced motion.
- **Alternatives considered**: Reading `matchMedia` in JS to skip phases (two code paths, and the
  user would lose the "something new happened" cue entirely).

## R10. Screen readers and focus

- **Decision**: No new live region. The placeholder is `aria-hidden`; the leaving list is `inert`
  (out of the accessibility tree). The existing polite `status` reads « Résultats par le sens : N
  chants » once the results show, and `MeaningStatus` reads « Recherche par le sens… » at launch.
  Nothing calls `focus()`.
- **Rationale**: FR-013, unchanged announcements from feature 011.

## R11. Testing approach

- **Decision**: Unit: `holdUntil` (before/after the minimum), `listView` for every phase × meaning
  phase combination, reveal delay cap. E2E (`us24`): `mockEmbed(page, { delayMs: 1500 })` to
  observe the waiting phase (no `.hy-result`, placeholder visible, status line visible), then
  results with `.hb-list--meaning`; immediate answer (cached second launch) shows results no
  sooner than 400 ms and no later than 600 ms after launch (measured with `performance.now()` in
  the page); cancel and `status: 503` bring word results back; filter change shows no
  placeholder; word list has no marker; `emulateMedia({ reducedMotion: 'reduce' })` and
  `document.getAnimations()` empty during the sequence; field bounding box unchanged; axe in light
  and dark on the marked list.
- **Rationale**: Covers SC-003 to SC-006 automatically; SC-001 and SC-002 are user test sessions
  (quickstart).
