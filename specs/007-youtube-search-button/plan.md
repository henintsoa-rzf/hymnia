# Implementation Plan: Search the hymn on YouTube

**Branch**: `007-youtube-search-button` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-youtube-search-button/spec.md`

## Summary

Add a small « Rechercher sur YouTube » link under the credits on the hymn page
(`/recueils/[recueil]/[numero]`). It is a plain outside link to YouTube's public search page,
`https://www.youtube.com/results?search_query=<title>`, built from the title shown on the page,
opened in a new tab with `rel="noopener noreferrer"`. No embed, no script, no request to YouTube
before the tap. One pure helper (`youtubeSearchUrl`) builds the URL and is unit-tested; one new
icon (`external`) marks the link as leaving the app.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (static adapter, PWA)

**Primary Dependencies**: Existing only. No new dependency.

**Storage**: N/A (nothing stored)

**Testing**: Vitest (`unit` project), Playwright + axe (e2e on `tests/fixtures/sample-content`)

**Target Platform**: Mobile-first web app / PWA, offline-capable; desktop layout ≥ 1024 px

**Project Type**: Single SvelteKit web app (static), no backend

**Performance Goals**: No measurable change to the hymn page; one extra link, no network request

**Constraints**: No YouTube request until the tap (FR-005); WCAG 2.2 AA; light and dark modes;
lyrics area and reading bar untouched (FR-002)

**Scale/Scope**: 1 screen touched (hymn page), 1 helper in `src/lib/format.ts`, 1 icon added

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Recherche au cœur | Search screen untouched. | ✅ |
| II. Design épuré | One small link in the credits block, below the lyrics; nothing above the lyrics or in the reading bar; the reading view by default is unchanged ("audio… s'active à la demande"). | ✅ |
| III. Fidélité et droits | No content reproduced or hosted: Hymnia only hands a title to YouTube's search. Displayed text unchanged. | ✅ |
| IV. Modèle unifié | No data model change; the link derives from the displayed title, so it works for every hymnal with no per-hymnal code. | ✅ |
| V. Simplicité | Plain `<a>`, no SDK, no API key, no embed. The URL builder is a pure function covered by a unit test. | ✅ |
| VI. Accessibilité / hors ligne | Visible label = accessible name; keyboard focus; outside-link icon; axe check on the hymn page. Offline, the hymn page still works; only the outside link fails, like the source link. | ✅ |
| Flux qualité | Search unchanged, reference query sets unaffected; mobile + light/dark verified (quickstart). | ✅ |

Post-design re-check (after Phase 1): unchanged, all ✅. No Complexity Tracking entry.

## Project Structure

### Documentation (this feature)

```text
specs/007-youtube-search-button/
├── plan.md              # This file
├── research.md          # Phase 0: URL, title, placement, accessibility, privacy
├── data-model.md        # Phase 1: derived link only, no stored data
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── ui.md            # Phase 1: the link on the hymn page
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── format.ts                      # + youtubeSearchUrl(title)
│   └── components/
│       └── Icon.svelte                # + 'external' icon
├── routes/recueils/[recueil]/[numero]/
│   └── +page.svelte                   # + link under <HymnCredits>
└── app.css                            # + .hymn__youtube (or scoped style in the page)

tests/
├── unit/
│   └── youtube-url.test.ts            # URL building: accents, punctuation, spaces
└── e2e/
    └── us13-youtube-search.spec.ts    # link present, href, new tab, no request on load, axe
```

**Structure Decision**: Single SvelteKit app, as for features 001–006. The link lives in the hymn
page route, next to `<HymnCredits>`, rather than inside `HymnCredits`, because the search title
is the entry's title (`entry.title ?? hymn.title`), which only the page knows.

## Complexity Tracking

No violation; nothing to justify.
