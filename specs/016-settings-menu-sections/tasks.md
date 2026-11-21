---

description: "Task list for the settings menu, reading and offline sections (feature 016)"
---

# Tasks: Settings menu, reading and offline sections

**Input**: Design documents from `/specs/016-settings-menu-sections/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R10), data-model.md, contracts/settings-ui.md,
quickstart.md

**Tests**: Included. Constitution principle V requires automated tests for critical behaviour, and
the workflow requires interface changes to be checked on mobile in light and dark mode. Write each
test task before the code it covers and see it fail first.

**Organization**: Tasks are grouped by user story (spec.md):
- US1: find a setting through a menu (P1);
- US2: adjust how lyrics are laid out, section « Lecture » (P2);
- US3: know what works offline and get the latest hymns, section « Hors ligne » (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single SvelteKit project at the repository root (plan.md, "Project Structure").

Values used everywhere (data-model.md, contracts/settings-ui.md):
- section slugs and titles, in this order: `affichage` « Affichage », `lecture` « Lecture »,
  `recueils` « Recueils », `hors-ligne` « Hors ligne »; addresses `/reglages/<slug>`; any other
  `/reglages/<x>` redirects to `/reglages`;
- new `Prefs` fields and defaults: `lyricFont: 'serif' | 'sans'` = `'serif'`;
  `lineSpacing: 'tight' | 'normal' | 'loose'` = `'normal'` (leading 1.4 / 1.6 / 1.85);
  `stanzaNumbers: boolean` = `true`; `chorus: 'once' | 'each'` = `'once'`;
  `keepAwake: boolean` = `false`; "any missing or invalid new field falls back to its default";
- `DataManifest.updatedAt?: string` (ISO `YYYY-MM-DD`): "latest `source.retrievedAt` among
  published hymns. Absent → no date shown";
- offline item ids `hymns` « Chants et recueils », `bible` « Bible », `meaning` « Recherche par le
  sens »; states `ready` « Disponible hors ligne », `downloading` « Téléchargement en cours »,
  `missing` « Pas encore téléchargé »;
- update check results: `'update' | 'up-to-date' | 'offline' | 'failed' | 'unavailable'`;
- every other French string is in contracts/settings-ui.md and must be used verbatim.

Test fixture reminder: `ce 1` « À toi la gloire » has sections verse, chorus, verse, verse;
`ce 20` starts with a chorus; `ce 2` has no chorus.

---

## Phase 1: Setup

No dependency, no config.

- [X] T001 Run `npm run check`, `npm test`, `npm run test:queries` and `npm run test:e2e` from the repository root and note any failure that exists before this feature

---

## Phase 2: Foundational

None. The menu (US1) is the frame the other stories plug into; US2 and US3 each depend on US1's
routes and `SettingsHeader`, see Dependencies.

---

## Phase 3: User Story 1 - Find a setting through a menu (Priority: P1) 🎯 MVP

**Goal**: `/reglages` shows four links with summaries and no control; each section opens on its own
address with a back control to the menu. Lecture and Hors ligne exist as sections from here, holding
for now only what exists (text size and its preview in Lecture; a placeholder line in Hors ligne).

**Independent Test**: Open Réglages: only titles and summaries. Open each section, change a
setting, go back: the summary changed and focus is on the entry. Reload or bookmark a section: it
opens. `/reglages/xyz` opens the menu.

### Tests for User Story 1

- [X] T002 [P] [US1] Write tests/unit/settings-sections.test.ts for `SETTINGS_SECTIONS` (order and titles above) and `summaryOf(slug, ctx)`: Affichage « Thème système » / « Thème clair » / « Thème sombre »; Lecture « Texte 100 % · Avec empattement » and « Texte 110 % · Sans empattement » (`Math.round(textScale * 100)`); Recueils « Tous les recueils » when nothing is left out, « 3 recueils sur 10 » otherwise (a partly used hymnal counts as in use); Hors ligne « Prêt hors ligne » when every listed item is `ready`, else « <label> : <state in lower case> » of the first item that is not, « Vérification… » while checking, and « Hors ligne non disponible » when `cacheAvailable` is false
- [X] T003 [P] [US1] Write tests/e2e/us21-settings-menu.spec.ts: (a) `/reglages` lists four links in order with their summaries and contains no button, checkbox or switch; (b) each link opens `/reglages/<slug>` with `h1` = title; (c) in Recueils uncheck one sample hymnal, press the back link « Réglages »: the URL is `/reglages`, the Recueils summary reads « 1 recueil sur 2 » and the Recueils link is focused; same with `page.goBack()`; (d) reload on `/reglages/lecture` shows Lecture; (e) `/reglages/xyz` lands on `/reglages`; (f) with a hymnal left out, the « Réglages » link on its hymnal page has `href` ending in `/reglages/recueils`; (g) the settings nav icon has `aria-current="page"` on `/reglages/affichage` (desktop project width) — run at phone width in light and dark

### Implementation for User Story 1

- [X] T004 [US1] Create src/lib/settings/sections.ts exporting `SectionSlug`, `SETTINGS_SECTIONS: { slug, title }[]` and pure `summaryOf(slug, ctx)` where `ctx = { prefs: Prefs; hymnalsInUse: number; hymnalsListed: number; offline?: OfflineOverview }` (`OfflineOverview` typed locally for now as `{ state: 'ready' | 'checking' | 'unavailable' | { label: string; state: string } }`, to be replaced by the import from `src/lib/offline/status.ts` in T024); make T002 pass
- [X] T005 [P] [US1] Create src/lib/components/SettingsHeader.svelte: props `title`; renders a header with a back link (visible « Réglages », `aria-label` « Retour aux Réglages », `Icon name="back"`, `href={resolve('/reglages')}`) shown at every width, then `<h1 class="hy-screen-title">{title}</h1>`; on click, if `afterNavigate` saw `from?.route.id === '/reglages'`, call `event.preventDefault(); history.back()`
- [X] T006 [US1] Create src/routes/reglages/affichage/+page.svelte with `<svelte:head><title>Affichage · Réglages · Hymnia</title></svelte:head>`, `SettingsHeader title="Affichage"` and the theme block moved verbatim from src/routes/reglages/+page.svelte (`THEMES`, `.hy-seg`, caption), its `h3` becoming `h2`
- [X] T007 [US1] Create src/routes/reglages/lecture/+page.svelte with `SettingsHeader title="Lecture"` and the text size block (control, preview, caption) moved verbatim from src/routes/reglages/+page.svelte, its `h3` becoming `h2` « Taille du texte »; move the matching styles (`.settings__size`, `.settings__preview`, `.settings__stanza`)
- [X] T008 [US1] Create src/routes/reglages/recueils/+page.ts (load `catalog` with `loadCatalog(fetch)`, as the current src/routes/reglages/+page.ts) and src/routes/reglages/recueils/+page.svelte with `SettingsHeader title="Recueils"` and `<HymnalScope hymnals={data.catalog.getHymnalsByName()} labelledby=<h1 id> />`
- [X] T009 [US1] Create src/routes/reglages/hors-ligne/+page.svelte with `SettingsHeader title="Hors ligne"` and, until US3, one caption « Les chants déjà chargés restent disponibles sans connexion. »
- [X] T010 [US1] Create src/routes/reglages/[...rest]/+page.ts that throws `redirect(307, resolve('/reglages'))` for any path
- [X] T011 [US1] Rewrite src/routes/reglages/+page.svelte as the menu: keep the phone header (back to Recherche) and `h1` « Réglages »; render `<ul class="settings-menu">` with one `<li><a href=/reglages/<slug> data-section=<slug>>` (name = title then summary, visible text) per section showing the title, the summary (`summaryOf`, with `hymnalsInUse`/`hymnalsListed` from `createScope($prefs.excluded, data.catalog.getHymnalsByName())`; offline summary omitted until US3) and a chevron icon; rows ≥ 44 px, full width, separated by `var(--line)`; in `afterNavigate`, when `from?.route.id` starts with `/reglages/`, focus `a[data-section=<that slug>]`; remove the old sections and their styles; keep src/routes/reglages/+page.ts (catalog) as is
- [X] T012 [US1] In src/routes/+layout.svelte, set `aria-current` on the settings icon link when `routeId.startsWith('/reglages')` instead of `routeId === '/reglages'`
- [X] T013 [P] [US1] Point every settings link about left-out hymnals to `resolve('/reglages/recueils')`: the two links in src/routes/recueils/[recueil]/+page.svelte and the two in src/lib/components/ResultList.svelte
- [X] T014 [US1] Update tests/e2e/us4-read.spec.ts (theme test goes to `/reglages/affichage`) and tests/e2e/us18-hymnal-scope.spec.ts (`/reglages` → `/reglages/recueils`; the link `href` check expects `/reglages/recueils$`; the « Affichage / Recueils headings » test becomes: menu lists both and each section opens with its `h1`); run T003, us4, us18 green
- [X] T015 [US1] In tests/e2e/a11y.spec.ts, replace `/reglages` in the page list by `/reglages`, `/reglages/affichage`, `/reglages/lecture`, `/reglages/recueils`, `/reglages/hors-ligne`, and move the « parts unfolded, last item kept » check to `/reglages/recueils`; run green in light and dark

**Checkpoint**: The menu works with the existing settings. Deliverable on its own (MVP).

---

## Phase 4: User Story 2 - Adjust how lyrics are laid out (Priority: P2)

**Goal**: Lecture offers font, line spacing, stanza numbers, chorus repetition and keep screen on,
with a live preview; every hymn follows them.

**Independent Test**: Change each setting, open `ce 1`: font, spacing, numbers and chorus match;
the wake lock is requested while the hymn is open and released when leaving. Reload: kept.

### Tests for User Story 2

- [X] T016 [P] [US2] Extend tests/unit/prefs.test.ts: defaults `lyricFont 'serif'`, `lineSpacing 'normal'`, `stanzaNumbers true`, `chorus 'once'`, `keepAwake false`; valid values kept; invalid ones (`'comic'`, `'huge'`, `'yes'`, `2`) fall back to the default; an object saved before this feature (only `textScale`, `theme`, `hymnalFilter`, `excluded`, `bibleAt`) keeps those values (FR-022, SC-008)
- [X] T017 [P] [US2] Write tests/unit/lyrics-layout.test.ts for `layoutSections(sections, { chorus })`: `once` gives exactly today's blocks (copy the cases of the current `blocks` in src/lib/components/LyricsView.svelte: identical consecutive chorus skipped, changed chorus kept); `each` on verse, chorus, verse, verse → verse, chorus, verse, chorus(repeat), verse, chorus(repeat); chorus first (chorus, verse, verse) → chorus, verse, chorus(repeat), verse, chorus(repeat); no chorus → unchanged; two different choruses → each repeat is the last chorus printed before that verse; a verse already followed by a chorus gets no repeat; source sections are never dropped in `each`; repeat blocks have `repeat: true`, the source `index` and keys unique across the list; `bridge`/`other` get no repeat after them
- [X] T018 [P] [US2] Write tests/e2e/us22-reading-settings.spec.ts with `page.addInitScript` installing a fake `navigator.wakeLock` that counts `request('screen')` calls and sentinel `release()` calls on `window.__wake`: (a) in `/reglages/lecture`, pick « Sans empattement », « Aéré », turn off « Numéros des strophes », pick « Après chaque strophe »: the preview's stanza `font-family` contains « Instrument Sans », its numbers are hidden, it shows the chorus twice; (b) open `/recueils/ce/1`: computed `line-height` of `.hb-stanza` / `font-size` ≈ 1.85, no visible `.hb-stanza__num`, text « Strophe » still present for screen readers, three `.hb-stanza--refrain` blocks; (c) with « Garder l'écran allumé » on, opening the hymn makes one request, navigating back to search releases it; with it off, no request; (d) without `navigator.wakeLock` (init script deletes it) the switch is disabled with « Non disponible sur cet appareil »; (e) reload keeps all choices; (f) at text scale 2.0 with « Aéré », no two `.hb-stanza__line` boxes overlap

### Implementation for User Story 2

- [X] T019 [US2] In src/lib/prefs/prefs.ts add the five fields to `Prefs` and `DEFAULT_PREFS` with the values above, exported types `LyricFont`, `LineSpacing`, `ChorusMode`, and sanitising in `sanitizePrefs` (each kept only when valid, else default); make T016 pass
- [X] T020 [P] [US2] Create src/lib/lyrics/layout.ts with `Block = { section: Section; index: number; repeat: boolean; key: string }` and `layoutSections(sections, { chorus })` per research R5 (moving the `once` logic out of LyricsView); make T017 pass
- [X] T021 [US2] Create src/lib/components/Stanza.svelte rendering one `Block` exactly as the current `{#each blocks}` body of src/lib/components/LyricsView.svelte (classes `hb-stanza`, `--refrain`, `--bridge`, `--match`, label, number, lines, the hidden « Passage correspondant » text), with props `block`, `numbers: boolean`, `marked: boolean`, `first: boolean`; when `numbers` is false render only `<span class="hb-sr">Strophe&nbsp;{n}</span>` instead of `.hb-stanza__num`; then make LyricsView use `layoutSections(hymn.sections, { chorus: $prefs.chorus })` and `Stanza` with `numbers={$prefs.stanzaNumbers}`, marking only blocks with `!block.repeat && marked.includes(block.index)`, keyed by `block.key`
- [X] T022 [US2] In src/app.css, define on `:root` `--lyric-font: var(--font-serif)` and `--lyric-leading: 1.6`, with `:root[data-lyric-font='sans'] { --lyric-font: var(--font-sans) }`, `:root[data-line-spacing='tight'] { --lyric-leading: 1.4 }`, `:root[data-line-spacing='loose'] { --lyric-leading: 1.85 }`; `.hb-stanza` uses `font-family: var(--lyric-font); line-height: var(--lyric-leading)` and `.hb-stanza__num` uses `line-height: calc(var(--lyric) * var(--lyric-leading))`; in src/routes/+layout.svelte set `root.dataset.lyricFont` and `root.dataset.lineSpacing` from `$prefs` in the existing effect
- [X] T023 [P] [US2] Create src/lib/reading/wake-lock.ts with `wakeLockSupported(): boolean` (`'wakeLock' in navigator`) and `keepAwake(): () => void` per research R6 (request, re-request on `visibilitychange` to visible, cleanup releases and removes the listener, all errors swallowed); in src/routes/recueils/[recueil]/[numero]/+page.svelte add `$effect(() => ($prefs.keepAwake ? keepAwake() : undefined))`
- [X] T024 [US2] Complete src/routes/reglages/lecture/+page.svelte in the contract order: « Taille du texte » (existing), « Police des paroles » (`.hy-seg`: « Avec empattement » / « Sans empattement »), « Interligne » (« Serré » / « Normal » / « Aéré »), « Numéros des strophes » (`<input type="checkbox" role="switch">` with label), « Refrain » (« Une seule fois » / « Après chaque strophe »), « Garder l'écran allumé » (switch, `disabled` with caption « Non disponible sur cet appareil » when `!wakeLockSupported()`, otherwise caption « Seulement pendant la lecture d'un chant. »), then the preview: replace the fixed stanza by `Stanza` blocks from `layoutSections` of a constant excerpt (verse 1 « À toi la gloire… », a chorus, verse 2) so it follows every Lecture setting; every change writes `$prefs` at once; make T018 pass
- [X] T025 [US2] Add the switch style (`.hy-switch`, 44 px target, visible focus ring, AA contrast in light and dark, `:disabled` state) to src/app.css next to `.hy-seg`, and use it in T024

**Checkpoint**: US1 and US2 work; reading layout follows the settings everywhere.

---

## Phase 5: User Story 3 - Know what works offline and get the latest hymns (Priority: P3)

**Goal**: Hors ligne shows what the device holds, the space used, the hymns date and what needs a
connection, and checks for an update on demand through the existing prompt.

**Independent Test**: On the built app, Hors ligne lists the items as available, shows space and
date; the update button answers « à jour », « mise à jour disponible » or « pas de connexion ».

### Tests for User Story 3

- [X] T026 [P] [US3] Extend tests/unit/build-data.test.ts: `writeOutput` writes `updatedAt` = the latest of every published hymn's `source.retrievedAt`; unpublished hymns are ignored; two builds of the same content give the same `manifest.json` bytes
- [X] T027 [P] [US3] Write tests/unit/offline-status.test.ts for the pure parts of src/lib/offline/status.ts: `offlineOverview` (all `ready` → `'ready'`; first non-ready item reported in item order; `cacheAvailable: false` → `'unavailable'`), `formatBytes(18_400_000)` → « 18,4 Mo », `formatBytes(undefined)` → `undefined`, item list built from a manifest without `bible` or `meaning` omits those items, and `meaningState 'downloading'` overrides a `missing` meaning item
- [X] T028 [P] [US3] Write tests/e2e/us23-offline-settings.spec.ts against the built app: after the service worker controls the page (reload once, as tests/e2e/offline.spec.ts does), `/reglages/hors-ligne` shows « Chants et recueils » and « Bible » « Disponible hors ligne », a line « Espace utilisé : … Mo », « Chants mis à jour le … »; the connection note lists search by meaning, YouTube and updates; with `context.setOffline(true)` the update button shows « Pas de connexion : la vérification est impossible pour le moment. » in a `role="status"`; online with no new build it shows « Hymnia est à jour (vérifié à … ) »; the menu summary reads « Prêt hors ligne » once meaning data is cached (wait for it)

### Implementation for User Story 3

- [X] T029 [US3] In scripts/build-data.ts compute `updatedAt` per research R9 (latest `source.retrievedAt` of the published hymns: corrections are not in the published catalog) and add it to the manifest in `writeOutput`; add `updatedAt?: string` to `DataManifest` in src/lib/domain/schema.ts and expose the loaded manifest as `CatalogApi.manifest` in src/lib/data/catalog.ts; make T026 pass
- [X] T030 [P] [US3] Create src/lib/offline/status.ts per research R7: types `OfflineItem`, `OfflineStatus`, `OfflineOverview`; pure `offlineItems(manifest)`, `offlineOverview(status)`, `formatBytes(bytes)` (French decimal comma, « Mo »); browser `probeOffline(manifest, meaningState)` using `caches.match(`${base}/data/${file}`, { ignoreSearch: true })` (`hymns` ready when catalog and index are cached, `bible` its file, `meaning` vectors and row map) and `navigator.storage?.estimate()`; every browser API feature-detected and wrapped in try/catch; make T027 pass; replace the local `OfflineOverview` type of src/lib/settings/sections.ts by this one
- [X] T031 [US3] Create src/lib/offline/sw.ts: call `useRegisterSW({ onRegisteredSW(_, r) { registration = r } })` once at module level (browser only), export `needRefresh`, `updateServiceWorker` and `checkForUpdate(): Promise<'update' | 'up-to-date' | 'offline' | 'failed' | 'unavailable'>` per research R8 (offline first, no registration → `unavailable`, `registration.update()` raced against a 10 s timeout, then `installing || waiting` → `update`); make src/lib/components/UpdatePrompt.svelte import `needRefresh` and `updateServiceWorker` from it instead of calling `useRegisterSW`
- [X] T032 [US3] Create src/routes/reglages/hors-ligne/+page.ts (load `catalog` and the data manifest) and complete src/routes/reglages/hors-ligne/+page.svelte per contracts/settings-ui.md: list of items with label and state; when `cacheAvailable` is false, the note « Ce navigateur ne garde pas Hymnia pour une utilisation hors ligne. » and no space line; « Espace utilisé : X Mo » when known; « Chants mis à jour le <date en toutes lettres> » when `updatedAt` is set; the connection note; « Rechercher une mise à jour » button (`aria-disabled` and text « Vérification… » while checking, a second click ignored) and its result in `role="status"` with the exact strings, « à HH h MM » from the check time; re-probe when `meaningStatus` changes; make T028 pass
- [X] T033 [US3] In src/routes/reglages/+page.svelte pass the offline overview to `summaryOf('hors-ligne', …)` (probe on mount, « Vérification… » meanwhile)

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 [P] Update the header comments of every changed file (src/routes/reglages/**, LyricsView.svelte, Stanza.svelte, UpdatePrompt.svelte, prefs.ts, app.css block) to cite feature 016 and the FR they serve, in the style of the existing comments
- [X] T035 [P] Check SC-001: at 360 × 640 the menu fits without scrolling, in light and dark (add the assertion to tests/e2e/us21-settings-menu.spec.ts)
- [X] T036 Run the whole of quickstart.md: `npm test`, `npm run test:queries`, `npm run test:e2e`, `npm run check && npm run lint`, then the manual scenarios at 390 px in light and dark; fix what fails
- [X] T037 Run `npm run data` to restore the real collection in static/data after the e2e build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **US1 (Phase 3)**: after Setup. Creates the routes and `SettingsHeader` that US2 and US3 fill.
- **US2 (Phase 4)**: after US1 (T007 Lecture route). Independent of US3.
- **US3 (Phase 5)**: after US1 (T009 Hors ligne route, T011 menu). Independent of US2.
- **Polish (Phase 6)**: after the stories you ship.

### Within Each Story

- Tests first, failing; then pure modules; then components and routes.
- US1: T004 before T011; T005 before T006–T009; T014–T015 last.
- US2: T019 before T021, T022, T024; T020 before T021 and T024; T025 with T024.
- US3: T029 before T032; T030 before T032–T033; T031 before T032.

### Parallel Opportunities

- US1: T002 ‖ T003; T005 ‖ T004; T013 alongside T006–T010.
- US2: T016 ‖ T017 ‖ T018; T020 ‖ T023 (after T019).
- US3: T026 ‖ T027 ‖ T028; T030 ‖ T029 ‖ T031.
- Once US1 is done, US2 and US3 can be built in parallel by two people.

## Parallel Example: User Story 2

```text
Task: "T016 Extend tests/unit/prefs.test.ts for the five new fields"
Task: "T017 Write tests/unit/lyrics-layout.test.ts for layoutSections"
Task: "T018 Write tests/e2e/us22-reading-settings.spec.ts with a fake navigator.wakeLock"
# then
Task: "T020 Create src/lib/lyrics/layout.ts"
Task: "T023 Create src/lib/reading/wake-lock.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. T001, then T002–T015.
2. **Stop and validate**: the menu with Affichage, Lecture (text size only), Recueils, Hors ligne
   (one caption). Usable and shippable: this is the user's request.

### Incremental Delivery

1. US1 → ship the menu.
2. US2 → ship Lecture (the most visible new value).
3. US3 → ship Hors ligne.
4. Polish.
