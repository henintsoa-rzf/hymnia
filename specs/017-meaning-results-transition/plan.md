# Implementation Plan: Transition and color for results by meaning

**Branch**: `017-meaning-results-transition` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-meaning-results-transition/spec.md`

## Summary

When a search by meaning is launched, the search screen plays a short sequence instead of
swapping the list in place:

1. **Clearing** (180 ms): the list on screen fades out and is made `inert`.
2. **Waiting**: the list area shows a placeholder of three "rows being written" in the meaning
   color, with the sparkle glyph of the mode button. It lasts as long as the search, and at least
   until 400 ms after launch.
3. **Revealing**: the results by meaning come in from the top, one row after the other (30 ms
   apart, capped), all within 500 ms.

Results by meaning then carry a lasting **meaning marker**: the heading takes the meaning color and
the sparkle glyph, and each row gets a 3 px bar in the meaning color in the left gutter, outside
the text, so nothing reflows. Word results never carry it.

The timing lives in a small pure module (`src/lib/meaning/reveal.ts`) tested with Vitest. The page
holds one `reveal` state next to the existing `meaningPhase`. Motion is pure CSS, so reduced
motion only needs a media query. The sequence plays only for a launch (button or Enter, or a
reloaded link). It doesn't play for the hymnal filter re-run of feature 011. Ranking, fusion,
embedding and offline behaviour are unchanged.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (`adapter-static`, SSR off)

**Primary Dependencies**: Existing only. No new dependency, no animation library: CSS keyframes
and the `inert` attribute.

**Storage**: None. The sequence is transient screen state.

**Testing**: Vitest unit (`tests/unit/meaning-reveal.test.ts`), Playwright e2e (new
`tests/e2e/us24-meaning-transition.spec.ts`, `us15` and `us16` adapted where they assumed word
results stay visible during a search by meaning), axe through `@axe-core/playwright` with the
marker in light and dark.

**Target Platform**: Mobile browsers first (iOS Safari, Android Chrome), desktop browsers; PWA,
offline-first.

**Project Type**: Static web app (SvelteKit PWA) with a small Cloudflare Worker (not touched).

**Performance Goals**: Results show ≤ 600 ms after launch when the answer is immediate (400 ms
minimum + reveal start); ≤ 100 ms after the answer otherwise (SC-003). Animations use only
`opacity` and `transform`, so they stay on the compositor at 60 fps on a mid-range phone.

**Constraints**: No reflow of result text by the marker (FR-010); no movement of the search field
(FR-014); `prefers-reduced-motion` respected (FR-012); 3:1 contrast of the marker in both themes
(`--meaning` measures about 5:1 on `--paper` in light, about 9:1 in dark); fits 320 px wide.

**Scale/Scope**: One screen (`/`), one new component (`MeaningTransition.svelte`), one new pure
module, `ResultList.svelte` and `app.css` touched. No new color token.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Search at the heart | Word search is untouched and still computed during the sequence; it comes back on cancel or error. The 400 ms minimum applies only to the search by meaning, which already takes a network round trip. Lexical search latency (< 200 ms) unchanged. | Pass |
| II. Clean design | One sober marker for the whole list (bar + heading), no badge per row; motion short and only on demand (a launch). Light and dark use the existing tokens. Justified exception to feature 011's "no marker" choice: see research R6. | Pass |
| III. Text fidelity | No content touched. | N/A |
| IV. Multi-hymnal model | No data change; the filter applies as before. | N/A |
| V. Simplicity | No dependency; one pure module with unit tests; CSS-only motion. | Pass |
| VI. Accessibility | Marker not color-only (bar shape + heading text + glyph); focus stays in the field; no extra live announcements; `inert` on the leaving list; reduced motion; axe in both themes. | Pass |
| Workflow: reference queries | Ranking unchanged: the reference query sets (001, 011) are re-run, not changed. | Pass |
| Workflow: mobile, light and dark | Quickstart and e2e cover 320 px, both themes, and reduced motion. | Pass |

Re-check after Phase 1: unchanged, all pass. No entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/017-meaning-results-transition/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── meaning-reveal.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app.css                              # .hb-list--meaning bar, heading marker, leave/reveal keyframes, reduced motion
├── lib/
│   ├── components/
│   │   ├── MeaningTransition.svelte     # NEW: placeholder rows + sparkle, aria-hidden
│   │   └── ResultList.svelte            # meaning marker on heading, rows and empty state; leaving / revealing classes
│   └── meaning/
│       └── reveal.ts                    # NEW: reveal phases, timings, holdUntil, listView
└── routes/
    └── +page.svelte                     # reveal state; runMeaning(q, { sequence }); what the list area shows

tests/
├── unit/meaning-reveal.test.ts          # NEW
└── e2e/
    ├── us15-meaning-search.spec.ts      # adapted: list empty while waiting
    ├── us16-meaning-mode.spec.ts        # checked: no layout change during the sequence
    └── us24-meaning-transition.spec.ts  # NEW: order, minimum, cancel, error, filter, marker, reduced motion, axe
```

`design/handoff/maquette/SearchSemantic.dc.html` gets the waiting placeholder and the marked list
once the screen is done.

**Structure Decision**: The existing single SvelteKit app. Changes stay in the search screen, its
result list, one new presentational component and one pure module.

## Complexity Tracking

No violations.
