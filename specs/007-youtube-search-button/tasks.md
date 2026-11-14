---

description: "Task list for feature 007: search the hymn on YouTube"
---

# Tasks: Search the hymn on YouTube

**Input**: Design documents from `/specs/007-youtube-search-button/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: Included. The constitution (Principle V) requires automated tests, SC-002 and SC-004 are checkable automatically, and features 001–006 write tests first. Write each test task before its implementation and check that it fails.

**Organization**: One user story (US1, P1). It is the whole feature and the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 = search the hymn on YouTube from its page

## Path Conventions

Single SvelteKit app: `src/`, `tests/` at the repository root. E2E tests run on `tests/fixtures/sample-content` (hymnals `ce` « CE » and `he` « HE »; `CE 1` = `HE 7` = « À toi la gloire », `CE 2` = « C’est un rempart que notre Dieu »). The a11y suite (`tests/e2e/a11y.spec.ts`) already scans `/recueils/ce/1` in light and dark modes.

---

## Phase 1: Setup

**Purpose**: Branch

- [X] T001 Create and switch to branch `007-youtube-search-button` from `main` (git), with `specs/007-youtube-search-button/` and the `.specify/feature.json` update committed as the first commit

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure URL helper and the icon the link needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Write unit tests for `youtubeSearchUrl(title)` in `tests/unit/youtube-url.test.ts`, using the table in `specs/007-youtube-search-button/contracts/ui.md`: base is `https://www.youtube.com/results?search_query=`; `À Toi la gloire` → `%C3%80%20Toi%20la%20gloire`; `Ô Dieu, c'est toi` → `%C3%94%20Dieu%2C%20c'est%20toi`; `Mon Rédempteur  vit ` → `Mon%20R%C3%A9dempteur%20vit`; `« Gloire » !` → `%C2%AB%20Gloire%20%C2%BB%20!`; narrow NBSP (U+202F) becomes a space; `C’est un rempart` keeps the typographic apostrophe (encoded `%E2%80%99`); an empty or blank title still returns the base URL with an empty query. Run `npm test` and confirm they fail.
- [X] T003 Implement `export function youtubeSearchUrl(title: string): string` in a new module `src/lib/youtube.ts` (not `format.ts`: it imports `$app/paths`, which unit tests cannot load): collapse whitespace runs (`\s` covers U+00A0 and U+202F) to one space, trim, then return `'https://www.youtube.com/results?search_query=' + encodeURIComponent(text)`. Do not use `frenchSpaces()` (display only). Add a one-line doc comment citing feature 007 / FR-003. `npm test` passes T002.
- [X] T004 [P] Add an `'external'` icon to `src/lib/components/Icon.svelte`: extend the `IconName` union and add an `{:else if name === 'external'}` branch drawing an arrow out of a box in the existing 24 × 24, stroke 1.5 line style (e.g. `<path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />`). Stays `aria-hidden` like every icon.

**Checkpoint**: `npm test` green; helper and icon ready.

---

## Phase 3: User Story 1 - Hear a hymn from its page (Priority: P1) 🎯 MVP

**Goal**: A discreet « Rechercher sur YouTube » link under the credits on every hymn page opens a YouTube search for the displayed title in a new tab, with no YouTube request before the tap.

**Independent Test**: Open `/recueils/ce/1`, check the link under the credits points to the YouTube search for « À toi la gloire », opens in a new tab, and that loading the page made no request to a YouTube host.

### Tests for User Story 1 ⚠️

> Write these first and check that they FAIL before implementation.

- [X] T005 [US1] Write `tests/e2e/us13-youtube-search.spec.ts` (header comment: "Feature 007, User Story 1: search the hymn on YouTube (spec.md, US1; contracts/ui.md)"), with `const link = (page) => page.getByRole('link', { name: 'Rechercher sur YouTube', exact: true })`:
  1. On `/recueils/ce/1`, the link is visible and its `href` equals `https://www.youtube.com/results?search_query=%C3%80%20toi%20la%20gloire`; it has `target="_blank"` and its `rel` contains `noopener` and `noreferrer`.
  2. The link is inside the credits area: it comes after the `footer.hb-credits` element and inside `main` (e.g. `page.locator('main .hymn__youtube a')`), and it is not inside the phone top bar `.hymn-top` nor the reading bar `[role="toolbar"][aria-label="Lecture"]`.
  3. On `/recueils/ce/2`, the `href` follows that page's title (`C%E2%80%99est%20un%20rempart%20que%20notre%20Dieu`); after clicking « Chant suivant » / navigating from CE 1 to CE 2 in the same page, the `href` updates.
  4. Opened from a collection (`seedCollections` from `tests/e2e/helpers.ts`, then `/recueils/ce/1?collection=c1` or the seeded id), the link is present with the same `href`.
  5. No early request: register `page.on('request')` before `page.goto('/recueils/ce/1')`, wait for `networkidle`, and assert no request URL matches `/youtube\.com|ytimg\.com|googlevideo\.com/`.
  6. Clicking the link with `context.waitForEvent('page')` opens a new page whose URL starts with `https://www.youtube.com/results?search_query=` (route `**/www.youtube.com/**` to fulfil an empty 200 so the test stays offline), and the original page still shows `main h1` « À toi la gloire » at the same URL.
  7. Desktop width (1280 × 800): the link is visible under the credits and the `.hymn__tools` row does not contain it.
  8. Keyboard: tabbing from the credits' source link reaches the YouTube link next, and it is focused (`toBeFocused`).
  Run `npm run test:e2e -- us13` and confirm it fails.

### Implementation for User Story 1

- [X] T006 [US1] In `src/routes/recueils/[recueil]/[numero]/+page.svelte`: import `youtubeSearchUrl` from `$lib/youtube` (extend the existing import), and inside the `<LyricsView>` children, right after `<HymnCredits {hymn} />`, add `<p class="hymn__youtube"><!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external YouTube search (feature 007) --><a href={youtubeSearchUrl(title)} target="_blank" rel="noopener noreferrer">Rechercher sur YouTube<Icon name="external" /></a></p>`, where `title` is the existing `{@const title = entry.title ?? hymn.title}`. Do not add it to `.hymn-top`, `.hymn__tools` or `.hy-readbar`. Update the file's header comment with "Feature 007: a discreet YouTube search link under the credits."
- [X] T007 [US1] Style the link in the same file's `<style>` block (scoped): `.hymn__youtube` matches the credits look (`margin: var(--space-2) 0 0; font-size: 15px; line-height: 22px; font-style: italic; color: var(--ink-muted);`), the `a` uses `color: inherit`, `display: inline-flex; align-items: center; gap: 4px`, and the `:global(svg)` inside is `width: 16px; height: 16px; flex: none`. Keep the global focus ring; tap target at least 24 × 24 px (WCAG 2.5.8) via `min-height: 24px` on the link. If `<LyricsView>` renders the slot in a way that breaks the spacing after `footer.hb-credits`, adjust the selector rather than editing `HymnCredits.svelte`.
- [X] T008 [US1] Run `npm run test:e2e -- us13 a11y` and `npm test`; fix until green (axe on `/recueils/ce/1` must still report no violations in light and dark modes, SC-005).

**Checkpoint**: User Story 1 complete; feature shippable.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T009 Run `npm run check && npm run lint` and fix any type or lint issue (notably the `svelte/no-navigation-without-resolve` rule on the external link).
- [X] T010 Run the full suites `npm test` and `npm run test:e2e`; confirm no other e2e test broke (e.g. tests counting links in `main` on the hymn page, `tests/e2e/us4-read.spec.ts`).
- [ ] T011 Walk through `specs/007-youtube-search-button/quickstart.md` manual scenarios 1–9 at phone (≈ 390 px) and desktop (≥ 1024 px) widths, in light and dark modes, with `npm run dev`; note any deviation in the commit message. *Not done by the agent: needs a visual check by a person. Scenarios 1, 2, 5, 6 and 7 are covered by `us13` and the a11y suite on the Android project; the iPhone (WebKit) project cannot launch on this machine, already before this feature.*
- [X] T012 Commit on `007-youtube-search-button` with a message like "Add a YouTube search link on the hymn page (feature 007)", and mark tasks done in `specs/007-youtube-search-button/tasks.md`.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → **US1 (T005–T008)** → **Polish (T009–T012)**.
- T002 → T003 (test first). T004 is independent of T002/T003.
- T005 needs nothing from Phase 2 to be written, but runs green only after T003, T004, T006, T007.
- T006 → T007 (same file).

## Parallel Example

```text
# Phase 2, together:
T002 tests/unit/youtube-url.test.ts
T004 src/lib/components/Icon.svelte

# Then, while T003 is implemented:
T005 tests/e2e/us13-youtube-search.spec.ts
```

## Implementation Strategy

- **MVP = User Story 1** (the only story): Phases 1–3 deliver the whole feature.
- Ship after T008 if needed; Phase 4 is verification and commit.
