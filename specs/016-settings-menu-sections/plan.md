# Implementation Plan: Settings menu, reading and offline sections

**Branch**: `016-settings-menu-sections` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-settings-menu-sections/spec.md`

## Summary

`/reglages` becomes a menu of four links with a one-line summary each; every section is its own
static route (`/reglages/affichage`, `lecture`, `recueils`, `hors-ligne`), with a back control that
returns to the menu and puts focus back on the entry (R1–R3). Section titles and summaries come from
one pure module, `src/lib/settings/sections.ts`.

**Lecture** gathers text size (moved from Affichage) and five new preferences. Font and line spacing
are attributes on `<html>` read by `.hb-stanza` through CSS variables (R4). Stanza numbers and chorus
repetition go through a new pure `layoutSections` function, extracted from `LyricsView`, and a
`Stanza` component shared with the Lecture preview (R5). « Garder l'écran allumé » uses the Screen
Wake Lock API on the hymn page only (R6).

**Hors ligne** reads what the device really holds in Cache Storage plus the meaning download state,
shows the space used and the date of the hymns (a new deterministic `updatedAt` in the data manifest,
R9), and offers « Rechercher une mise à jour » through the existing service worker registration,
moved into a module so the existing update prompt is reused (R7, R8).

Search, the catalog content, the meaning data and the worker are not touched.

## Technical Context

**Language/Version**: TypeScript 5.9, Svelte 5 (runes), SvelteKit 2 (`adapter-static`, SSR off)

**Primary Dependencies**: Existing only (`@vite-pwa/sveltekit` / `virtual:pwa-register/svelte` for
the update check). Browser APIs: Screen Wake Lock, Cache Storage, `navigator.storage.estimate`, all
feature-detected. No new dependency.

**Storage**: `localStorage` key `hymnia.prefs` (existing), five new fields with defaults (R10).
`manifest.json` gains optional `updatedAt`.

**Testing**: Vitest unit (new `settings-sections.test.ts`, `lyrics-layout.test.ts`,
`offline-status.test.ts`; additions to `prefs.test.ts`, `build-data.test.ts`); reference queries
unchanged; Playwright e2e (new `us21-settings-menu`, `us22-reading-settings` with a mocked
`navigator.wakeLock`, `us23-offline-settings` on the built app; `us4-read` and `us18-hymnal-scope`
moved to section addresses); axe on the menu and each section (`a11y.spec.ts`).

**Target Platform**: Mobile browsers first (iOS Safari, Android Chrome), desktop browsers; PWA,
offline-first.

**Project Type**: Static web app (SvelteKit PWA). The Cloudflare Worker is not touched.

**Performance Goals**: Menu and sections open instantly (static routes; only Recueils and the menu
load the catalog, already cached). Lecture changes repaint at once (FR-015). Update check answers in
≤ 10 s (SC-006, timeout). Lexical search unchanged (< 200 ms).

**Constraints**: WCAG 2.2 AA light and dark; 44 px targets; menu fits 360 × 640 without scrolling
(SC-001); default reading layout identical to today (all defaults = current behaviour); no
non-deterministic data in the build (R9).

**Scale/Scope**: 4 sections, 5 new preferences. New: 5 routes (+ catch-all), 5 modules
(`sections`, `layout`, `wake-lock`, `status`, `sw`), 2 components (`Stanza.svelte`,
`SettingsHeader.svelte`). Changed: `prefs.ts`, `schema.ts` (manifest type), `catalog.ts`,
`build-data.ts`, `app.css`, `+layout.svelte`, `LyricsView.svelte`, `UpdatePrompt.svelte`, the hymn
page, the hymnal page and `ResultList.svelte` (links to Recueils).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Search at the heart | Search untouched; still on the main screen. Reference queries and perf unchanged. | Pass |
| II. Clean design | Each settings screen has one purpose; the menu shows no control. Reading view unchanged by default; new layout options are opt-in (« s'active à la demande »). Light and dark covered. | Pass |
| III. Text fidelity | Chorus repetition and hidden numbers are display only; stored lyrics never change. Credits untouched. | Pass |
| IV. Multi-hymnal model | Preferences stay with user data, apart from hymn data. `updatedAt` is derived from content, no code change needed for new hymnals. | Pass |
| V. Simplicity | No dependency; static routes; pure tested modules for layout, summaries and offline overview; wake lock via the standard API, no hack. | Pass |
| VI. Accessibility, reading in situ | Directly served: line spacing, sans font, keep screen on for the music stand; offline status visible. Native switches and links, focus return, `role="status"` for the check. | Pass |
| Workflow: reference queries | Search not modified; existing set runs unchanged. | Pass |
| Workflow: mobile, light and dark | Quickstart and e2e at phone width, both themes. | Pass |

Re-check after Phase 1: unchanged, all pass. No entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/016-settings-menu-sections/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── settings-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
scripts/
└── build-data.ts                        # manifest.updatedAt (R9)

src/
├── app.css                              # --lyric-font, --lyric-leading from root attributes
├── lib/
│   ├── settings/sections.ts             # NEW: SETTINGS_SECTIONS, summaryOf
│   ├── lyrics/layout.ts                 # NEW: layoutSections (chorus once / each)
│   ├── reading/wake-lock.ts             # NEW: wakeLockSupported, keepAwake
│   ├── offline/
│   │   ├── status.ts                    # NEW: probeOffline, offlineOverview, formatBytes
│   │   └── sw.ts                        # NEW: registration owner, needRefresh, checkForUpdate
│   ├── prefs/prefs.ts                   # five new fields, sanitising
│   ├── domain/schema.ts                 # DataManifest.updatedAt
│   ├── data/catalog.ts                  # CatalogApi.updatedAt
│   └── components/
│       ├── Stanza.svelte                # NEW: one block (numbers on/off, repeat)
│       ├── SettingsHeader.svelte        # NEW: back to menu, h1, focus-friendly
│       ├── LyricsView.svelte            # uses layoutSections + Stanza
│       ├── UpdatePrompt.svelte          # reads offline/sw.ts stores
│       └── ResultList.svelte            # Réglages links → /reglages/recueils
└── routes/
    ├── +layout.svelte                   # root attributes; Réglages current on sub-routes
    ├── reglages/
    │   ├── +page.svelte / +page.ts      # menu (catalog for the Recueils summary)
    │   ├── affichage/+page.svelte       # theme
    │   ├── lecture/+page.svelte         # text size, font, spacing, numbers, chorus, awake, preview
    │   ├── recueils/+page.svelte, +page.ts   # HymnalScope (moved)
    │   ├── hors-ligne/+page.svelte, +page.ts # offline status, update check
    │   └── [...rest]/+page.ts           # redirect to /reglages
    └── recueils/
        ├── [recueil]/+page.svelte       # Réglages links → /reglages/recueils
        └── [recueil]/[numero]/+page.svelte   # keepAwake effect; Lecture prefs to LyricsView

tests/
├── unit/
│   ├── settings-sections.test.ts        # NEW
│   ├── lyrics-layout.test.ts            # NEW
│   ├── offline-status.test.ts           # NEW
│   ├── prefs.test.ts                    # new fields
│   └── build-data.test.ts               # updatedAt deterministic
└── e2e/
    ├── us21-settings-menu.spec.ts       # NEW
    ├── us22-reading-settings.spec.ts    # NEW
    ├── us23-offline-settings.spec.ts    # NEW
    ├── us4-read.spec.ts                 # theme at /reglages/affichage
    ├── us18-hymnal-scope.spec.ts        # /reglages/recueils
    └── a11y.spec.ts                     # menu + four sections
```

**Structure Decision**: The existing single SvelteKit app. Logic in pure modules under `src/lib/`
(tested in Node); browser APIs isolated in `wake-lock.ts`, `status.ts` (probe only) and `sw.ts`;
routes and components only render and wire preferences.

## Complexity Tracking

No violations.
