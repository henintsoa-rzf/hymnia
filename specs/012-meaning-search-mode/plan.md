# Implementation Plan: Search-by-meaning mode

**Branch**: `012-meaning-search-mode` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-meaning-search-mode/spec.md`

## Summary

Search by meaning becomes a mode of the search field. A small icon button (magnifier with
sparkles) sits right of the field from the first paint, whenever the data has meaning vectors.
Pressing it toggles the mode: the field becomes twice as tall, wraps text, and takes an ochre
gold frame. Enter runs the search by meaning. Pressing the button again returns to word search.

The blinking comes from the old « Par le sens » button: it disappeared after each keystroke
until the worker answered, so the field got wider and narrower at every key (research R1). The
new button depends only on the data manifest, read at page load (R2), so nothing moves while
typing.

The field becomes a single `<textarea>` in both modes, so switching never replaces the focused
element or closes the phone keyboard (R3). Ranking, fusion, the embedding service and offline
behaviour of feature 011 are unchanged.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (`adapter-static`, SSR off)

**Primary Dependencies**: Existing only. No new dependency.

**Storage**: None new. The mode is kept in the URL (`sens=1`), as feature 011 already does.

**Testing**: Vitest unit (`tests/unit/meaning-mode.test.ts` for `decideSubmit` and
`singleLine`), Playwright e2e (new `tests/e2e/us16-meaning-mode.spec.ts`; `us15` adapted), axe
through `@axe-core/playwright`.

**Target Platform**: Mobile browsers first (iOS Safari, Android Chrome), desktop browsers; PWA,
offline-first.

**Project Type**: Static web app (SvelteKit PWA) with a small Cloudflare Worker (not touched).

**Performance Goals**: Mode switch shows in under 200 ms (160 ms animation). Word search stays
under 200 ms (constitution I); this feature adds no work per keystroke, it removes some.

**Constraints**: 0 layout changes of the field and button while typing (SC-003); fits 320 px
wide; WCAG 2.2 AA in light and dark; reduced motion respected.

**Scale/Scope**: One screen (`/`), two components (`SearchBox`, `Icon`), one new small module,
two colour tokens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Search at the heart | Search stays on the first screen; meaning search still adds to word search, which keeps updating as you type in both modes (FR-010). Word search latency unchanged. | Pass |
| II. Clean design | One small icon replaces a wider text button; the enlarged field shows only on demand. Light and dark tokens defined together (R4). | Pass |
| III. Text fidelity | No content touched. | N/A |
| IV. Multi-hymnal model | No data model change; the hymnal filter applies as before. | N/A |
| V. Simplicity | No dependency, no new layer; one pure module (`mode.ts`) so Enter's rules are tested. Search behaviour covered by unit + e2e tests. | Pass |
| VI. Accessibility | `aria-pressed`, accessible names per mode, color not the only cue, 44 px+ targets, axe in both modes and themes, reduced motion. | Pass |
| Workflow: reference queries | Ranking unchanged, so the reference query sets (001, 011) are re-run, not changed. | Pass |
| Workflow: mobile, light and dark | Quickstart and e2e cover both themes at phone width. | Pass |

Re-check after Phase 1: unchanged, all pass. No entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/012-meaning-search-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── search-mode.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app.css                          # --meaning, --meaning-soft (light + dark); .hb-search with a textarea
├── lib/
│   ├── components/
│   │   ├── Icon.svelte              # 'meaning' glyph → magnifier with sparkles
│   │   └── SearchBox.svelte         # textarea, mode, mode button, sizes, animation
│   ├── data/catalog.ts              # fetchCatalog reads manifest.meaning; CatalogApi.meaningAvailable
│   ├── data/store.ts                # loadCatalog passes it on
│   └── meaning/mode.ts              # NEW: decideSubmit, singleLine
└── routes/
    └── +page.svelte                 # mode state, URL sens=1 = mode, Enter rules, keyboard help

tests/
├── unit/meaning-mode.test.ts        # NEW
└── e2e/
    ├── helpers.ts                   # searchField: role textbox; meaningButton by new name
    ├── us15-meaning-search.spec.ts  # adapted to the always-visible button and the mode
    └── us16-meaning-mode.spec.ts    # NEW: visibility, toggle, size ×2, frame colour, Enter, no layout change, axe
```

`design/handoff/maquette/SearchSemantic.dc.html` is updated to show the two modes once the
screen is done.

**Structure Decision**: The existing single SvelteKit app. Changes stay in the search screen,
its two components, the catalog loader and the CSS tokens.

## Complexity Tracking

No violations.
