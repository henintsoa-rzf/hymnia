# Implementation Plan: Highlight the matching stanza

**Branch**: `013-meaning-stanza-highlight` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-meaning-stanza-highlight/spec.md`

## Summary

A hymn opened from a search-by-meaning result shows the stanza that ranked it: soft gold
background, gold bar on its left, brought into view when it is not already visible.

The search already knows that stanza: `rankMeaning` returns the section index of each hymn's best
row, and the list shows its start as excerpt. `fuse()` now keeps that index on the result
(`matchedSection`) when the excerpt it shows is the meaning one (R3). The result link adds
`?passage=<index>` (R2). The hymn page validates it with a pure function that rebuilds the
indexing groups, so short sections joined at indexing are marked together (R1, R4). After
navigation, the page scrolls the stanza into view only if it is not fully visible (R5). Every
other link to a hymn lacks the parameter, so the mark never shows elsewhere.

No change to the meaning data, its version, the worker messages' shape (one optional field), the
embedding service or the ranking.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (`adapter-static`, SSR off)

**Primary Dependencies**: Existing only. No new dependency.

**Storage**: None. The passage lives in the hymn URL (`?passage=<n>`) for one page view.

**Testing**: Vitest unit (`meaning-stanzas`, new `meaning-passage`, `meaning-fuse`), Playwright e2e
(new `tests/e2e/us17-stanza-mark.spec.ts` with `mockEmbed`), axe through `@axe-core/playwright`.

**Target Platform**: Mobile browsers first (iOS Safari, Android Chrome), desktop browsers; PWA,
offline-first.

**Project Type**: Static web app (SvelteKit PWA). The Cloudflare Worker is not touched.

**Performance Goals**: Hymn display time unchanged (FR-012): `markedSections` is linear in the
hymn's sections (≤ ~20); one layout read and at most one scroll after render. Stanza visible within
1 s of the tap (SC-002).

**Constraints**: WCAG 2.2 AA in light and dark (contrasts in research R6); lyrics unchanged
(Principle III); fixed bottom reading bar on phone must not hide the stanza; back/forward keeps the
restored scroll.

**Scale/Scope**: One pure module (new), two small changes in `meaning/` (`stanzas.ts`, `fuse.ts`,
`search.ts`), one type field, two components (`ResultList`, `LyricsView`), the hymn page, one CSS
rule.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Search at the heart | Makes meaning results faster to judge; word search and its latency untouched. Meaning search still adds to word search. | Pass |
| II. Clean design | Mark shown only on demand (opening from a meaning result), calm, no animation, uses the existing meaning tokens in light and dark. The default reading view is unchanged. | Pass |
| III. Text fidelity | Lyrics, numbers and labels unchanged; the accessible prefix is hidden text, not content. | Pass |
| IV. Multi-hymnal model | No model change; one `sections` array per hymn whatever the hymnal, so the index holds in every hymnal. | N/A |
| V. Simplicity | No dependency, no stored state; a URL parameter on an existing link; grouping logic shared, not copied. Behaviour covered by unit and e2e tests. | Pass |
| VI. Accessibility | Not colour alone (bar), contrasts ≥ AA, screen reader prefix, no focus theft, works offline once results are shown. | Pass |
| Workflow: reference queries | Ranking unchanged; `indexedStanzas` output proven identical by its tests, so meaning data and reference query results do not move. | Pass |
| Workflow: mobile, light and dark | Quickstart and e2e cover phone width and both themes. | Pass |

Re-check after Phase 1: unchanged, all pass. No entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-meaning-stanza-highlight/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── stanza-mark.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app.css                              # .hb-stanza--match (background, left bar, scroll-margin)
├── lib/
│   ├── components/
│   │   ├── LyricsView.svelte            # blocks keep their source index; `marked` prop; sr prefix
│   │   └── ResultList.svelte            # text rows: ?passage=<matchedSection>
│   ├── meaning/
│   │   ├── stanzas.ts                   # stanzaGroups() extracted; indexedStanzas uses it
│   │   ├── passage.ts                   # NEW: markedSections()
│   │   ├── fuse.ts                      # matchedSection when the meaning excerpt is kept
│   │   └── search.ts                    # MeaningCandidate.matchedSection = hit.section
│   └── search/types.ts                  # SearchResult.matchedSection?
└── routes/recueils/[recueil]/[numero]/
    └── +page.svelte                     # marked from ?passage; afterNavigate scroll

tests/
├── unit/
│   ├── meaning-stanzas.test.ts          # stanzaGroups; indexedStanzas unchanged
│   ├── meaning-passage.test.ts          # NEW
│   └── meaning-fuse.test.ts             # matchedSection cases
└── e2e/us17-stanza-mark.spec.ts         # NEW
```

**Structure Decision**: The existing single SvelteKit app. Logic goes in `src/lib/meaning/` as pure,
tested functions; components only pass values and apply a class.

## Complexity Tracking

No violations.
