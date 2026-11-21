# Research: Settings menu, reading and offline sections

All unknowns from the Technical Context are resolved below. Each entry: decision, rationale,
alternatives considered.

## R1. One route per section

**Decision**: `/reglages` becomes the menu. Each section is its own static route:
`/reglages/affichage`, `/reglages/lecture`, `/reglages/recueils`, `/reglages/hors-ligne`. A catch-all
`/reglages/[...rest]` redirects any other address to `/reglages` (edge case « unknown section »).
The section list (slug, title, summary) lives in one pure module, `src/lib/settings/sections.ts`,
read by the menu and by each section's header.

**Rationale**: Static folders are the plainest SvelteKit shape: each page loads only what it needs
(the catalog for Recueils and the menu summary, nothing for Affichage), back/reload/bookmark work for
free (FR-004), and links can target a section (FR-005). The catch-all gives the spec's « unknown
address opens the menu » without a param matcher.

**Alternatives considered**: a single `[section]` route with a switch (one big page, every section's
imports loaded together); a query string `?section=` (not a real page in history, weaker bookmarks);
in-page disclosure (accordions): rejected by the request, which wants the content out of the menu.

## R2. Back control and focus return

**Decision**: Every section page has a header, at every width, with a back control labelled
« Réglages » and the section title as `h1`. The back control is a link to `/reglages`; when the
previous page in this visit was the menu (known through `afterNavigate`'s `from`), a click calls
`history.back()` instead, so the history does not grow menu → section → menu. On the menu,
`afterNavigate` reads `from.route.id`; if it is a section, focus moves to that section's entry
(FR-007, acceptance 1.3). The menu keeps its current phone header (« Recherche » back link).

The app navigation marks Réglages as current for `/reglages` and all its sections
(`routeId.startsWith('/reglages')`).

**Rationale**: Matches the device back gesture and the on-screen control, keeps the place in the
menu, and needs no stored state.

**Alternatives considered**: always `goto('/reglages')` (history grows, back gesture returns to the
section); store the last section in `sessionStorage` (state that `afterNavigate` already gives).

## R3. Menu summaries

**Decision**: `sections.ts` exports `SETTINGS_SECTIONS` and a pure `summaryOf(slug, ctx)` where
`ctx` holds `prefs`, the scope counts (hymnals in use / listed, from `createScope` of feature 014)
and the offline overview (R7). Strings per FR-002:

| Section | Summary |
|---------|---------|
| Affichage | « Thème système » / « Thème clair » / « Thème sombre » |
| Lecture | « Texte 110 % · Avec empattement » (`Math.round(textScale * 100)`) |
| Recueils | « Tous les recueils » or « 3 recueils sur 10 » (a partly used hymnal counts as in use) |
| Hors ligne | « Prêt hors ligne », else the first item not ready, e.g. « Bible : téléchargement en cours » ; « Vérification… » while the check of R7 runs |

**Rationale**: Pure and unit tested; the menu stays a list of links with text, the cheapest
accessible pattern (link name = title, description = summary through `aria-describedby`).

**Alternatives considered**: summaries computed inside each page (duplicated logic, menu would load
every section).

## R4. Lyrics font and line spacing

**Decision**: Two new prefs, `lyricFont: 'serif' | 'sans'` and `lineSpacing: 'tight' | 'normal' |
'loose'`. The app shell (`+layout.svelte`) sets them as `data-lyric-font` and `data-line-spacing` on
`<html>`, next to `--text-scale`. `app.css` defines two variables used by `.hb-stanza` and
`.hb-stanza__num`:

- `--lyric-font`: `var(--font-serif)` (default) or `var(--font-sans)`.
- `--lyric-leading`: `1.4` / `1.6` (default, today's value) / `1.85`, unitless so it scales with
  the text size. `.hb-stanza__num`'s line height becomes `calc(var(--lyric) * var(--lyric-leading))`
  so the number stays on the first line.

Only stanza text uses them: hymn header, credits and the Bible verse list keep their fonts (spec
assumption). No new font file: the sans font is already loaded for the interface.

**Rationale**: The same mechanism as theme and text size, applied before paint, works in every view
that prints `.hb-stanza` (hymn page and the settings preview) with no prop drilling.

**Alternatives considered**: props on `LyricsView` (the preview and any future view must repeat
them); a numeric line-height slider (more choice than needed, harder to keep lines from colliding).

## R5. Stanza numbers and chorus repetition: one pure layout function

**Decision**: Extract the block list of `LyricsView.svelte` into `src/lib/lyrics/layout.ts`:

```text
layoutSections(sections, { chorus: 'once' | 'each' }) → Block[]
Block = { section, index, repeat: boolean, key: string }
```

- `once` (default): today's rule, unchanged (a chorus is printed once, and again only where its
  words change).
- `each`: every source section is kept in order; after a `verse` that is not directly followed by a
  `chorus`, the last chorus printed so far is inserted as a block with `repeat: true`. A chorus that
  comes before the first verse counts as « printed so far ». Hymns with no chorus are unchanged.

`LyricsView` renders blocks with a new `Stanza.svelte` component (also used by the settings
preview). Repeated blocks are never marked by a search by meaning (`marked` is matched on
`!repeat`), and carry no `id` of their own. With `stanzaNumbers: false`, the visible number
(`hb-stanza__num`) is not rendered but the hidden « Strophe N » text stays, so screen readers still
hear where each stanza starts (FR-011); verse padding is kept so the layout does not jump.

**Rationale**: The rules have several cases (no chorus, chorus first, several choruses, explicit
repeats in the source); a pure function covers them in unit tests, and the view only renders.
Stored lyrics are never changed (Principle III, FR-015).

**Alternatives considered**: CSS-only repetition (impossible: the chorus text must be duplicated);
storing repeated choruses at build time (changes data, breaks fidelity).

## R6. Keep the screen on

**Decision**: Screen Wake Lock API (`navigator.wakeLock.request('screen')`), wrapped in
`src/lib/reading/wake-lock.ts`: `keepAwake(): () => void` requests the lock, requests it again on
`visibilitychange` back to `visible` (the browser drops it when the page is hidden), and the
returned function releases it and removes the listener. `wakeLockSupported()` is
`'wakeLock' in navigator`. The hymn page (`/recueils/[recueil]/[numero]`) calls it in an `$effect`
while `$prefs.keepAwake` is true; leaving the page runs the cleanup. Errors (denied, low battery)
are swallowed: the device just sleeps as usual. In Lecture, the switch is disabled with « Non
disponible sur cet appareil » when unsupported.

**Rationale**: Standard API, supported by current Chrome/Android and Safari/iOS (16.4+), no
dependency. Scoped to the hymn page per the spec assumption (battery).

**Alternatives considered**: the « silent looping video » trick (NoSleep-style): a hack, battery
heavy, against Principle V.

## R7. Offline status

**Decision**: `src/lib/offline/status.ts`:

- `probeOffline(manifest)` (browser only) checks Cache Storage with
  `caches.match(url, { ignoreSearch: true })` for: the catalog and index files (« Chants et
  recueils »), the Bible file (« Bible »), the meaning vectors and row map (« Recherche par le
  sens »). The meaning state also reads the search client's `meaningStatus`: `downloading` →
  « Téléchargement en cours ».
- `navigator.storage.estimate().usage`, shown in Mo (one decimal) when available (FR-017).
- A pure `offlineOverview(items)` gives the menu summary (R3) and is unit tested.

No `caches` (private mode, old browser) → every item « Pas encore téléchargé » and the note of the
storage edge case. Items absent from the build (no Bible, no meaning data) are not listed.

**Rationale**: Reads what the device really holds (SC-007), whatever the cache names used by the
service worker; `ignoreSearch` covers revision query strings.

**Alternatives considered**: trusting the service worker's « installed » event (does not tell which
files, nor the meaning cache filled later); listing cache names (couples to workbox internals).

## R8. « Rechercher une mise à jour »

**Decision**: Move the `useRegisterSW` call out of `UpdatePrompt.svelte` into a module,
`src/lib/offline/sw.ts`, that keeps the registration (`onRegisteredSW`) and exports `needRefresh`,
`updateServiceWorker` and `checkForUpdate()`:

1. Offline (`navigator.onLine === false`) → `'offline'`.
2. No registration (dev server, no support) → `'unavailable'`.
3. Else `await registration.update()` with a 10 s timeout (SC-006); then if
   `registration.installing || registration.waiting` → `'update'` (the existing prompt appears
   through `needRefresh`); else `'up-to-date'`; timeout or error → `'failed'`.

`UpdatePrompt.svelte` reads the same stores, so the offer is the one users already know (FR-020).
The Hors ligne section shows the result in a `role="status"` region, with the time of the check, and
disables the button while a check runs.

**Rationale**: One registration owner, no second registration; reuses the existing prompt and the
« nothing reloads without consent » rule.

**Alternatives considered**: fetching `manifest.json` and comparing versions (misses app code
updates, duplicates what the service worker already does).

## R9. Version date of the hymns

**Decision**: `scripts/build-data.ts` adds `updatedAt` (ISO date) to `manifest.json`: the most
recent of all published hymns' `source.retrievedAt`. The catalog API
exposes it; Hors ligne shows « Chants mis à jour le 12 novembre 2026 ». Optional in the type: an
older manifest simply shows no date.

**Rationale**: Deterministic: the same content always gives the same date, so a rebuild with no
content change does not change `manifest.json` and does not trigger a needless update offer (a
build timestamp would). It is also the meaningful date for the user: when the hymns last changed.

**Alternatives considered**: build time (non-deterministic, false updates); git commit date (needs
git at build time, wrong for local content edits).

## R10. Preferences migration

**Decision**: `Prefs` gains `lyricFont`, `lineSpacing`, `stanzaNumbers`, `chorus`, `keepAwake`
with defaults `'serif'`, `'normal'`, `true`, `'once'`, `false`. `sanitizePrefs` keeps each only when
valid, else the default. Same storage key; nothing else moves (FR-021, FR-022, SC-008).

**Rationale**: The existing sanitiser already gives forward and backward compatibility; old values
pass through unchanged.

**Alternatives considered**: a separate storage key for reading layout (two stores to keep in sync
for one screen).
