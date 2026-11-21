# Contract: Settings screens and modules

What other screens, tests and later features can rely on.

## Addresses

| Address | Screen | `h1` |
|---------|--------|------|
| `/reglages` | Menu: four links, no control | « Réglages » |
| `/reglages/affichage` | Theme | « Affichage » |
| `/reglages/lecture` | Text size, font, line spacing, stanza numbers, chorus, keep screen on, preview | « Lecture » |
| `/reglages/recueils` | Hymnal and part choice (`HymnalScope`, feature 014) | « Recueils » |
| `/reglages/hors-ligne` | Offline items, space, hymns date, connection note, update check | « Hors ligne » |
| `/reglages/<anything else>` | Redirects to `/reglages` | — |

Links about left-out hymnals (hymnal page notices, search result notices) point to
`/reglages/recueils`.

## Menu markup

- One `<ul>` of links in section order. Each link holds the title then the summary; its accessible
  name is that visible text (« Recueils Tous les recueils »), so the name matches what is seen
  (WCAG 2.5.3); `data-section="<slug>"`.
- On return from a section, focus is on that section's link.

## Section markup

- A header with a back link, accessible name « Retour aux Réglages », visible text « Réglages ».
- Section title as `h1`; setting names as `h2`.
- Choices with two or three values: the existing segmented control (`.hy-seg`, `aria-pressed`).
  On/off settings: native `<input type="checkbox" role="switch">` with a visible label.
- Hors ligne: update result in a `role="status"` element; the button has `aria-disabled` and the
  text « Vérification… » while a check runs.

## Lecture labels (exact)

| Setting `h2` | Choices |
|--------------|---------|
| « Taille du texte » | existing control |
| « Police des paroles » | « Avec empattement » · « Sans empattement » |
| « Interligne » | « Serré » · « Normal » · « Aéré » |
| « Numéros des strophes » | switch, on by default |
| « Refrain » | « Une seule fois » · « Après chaque strophe » |
| « Garder l'écran allumé » | switch, off by default; disabled with « Non disponible sur cet appareil » |

## Hors ligne labels (exact)

- Item labels: « Chants et recueils », « Bible », « Recherche par le sens ».
- States: « Disponible hors ligne », « Téléchargement en cours », « Pas encore téléchargé ».
- Space: « Espace utilisé : 18,4 Mo ».
- Date: « Chants mis à jour le 12 novembre 2026 ».
- Button: « Rechercher une mise à jour ». Results: « Une mise à jour est disponible. » (the update
  prompt opens), « Hymnia est à jour (vérifié à 14 h 05). », « Pas de connexion : la vérification
  est impossible pour le moment. », « La vérification a échoué. Réessayez plus tard. ».

## Root attributes (set by the app shell)

| Attribute / variable on `<html>` | From |
|----------------------------------|------|
| `--text-scale` | `textScale` (existing) |
| `data-theme` | `theme` (existing) |
| `data-lyric-font="serif\|sans"` | `lyricFont` |
| `data-line-spacing="tight\|normal\|loose"` | `lineSpacing` |

`.hb-stanza` reads `--lyric-font` and `--lyric-leading`, derived from these attributes in `app.css`.

## Modules

| Module | Exports |
|--------|---------|
| `src/lib/settings/sections.ts` | `SETTINGS_SECTIONS`, `SectionSlug`, `summaryOf(slug, ctx)` |
| `src/lib/lyrics/layout.ts` | `layoutSections(sections, { chorus })`, `Block` |
| `src/lib/reading/wake-lock.ts` | `wakeLockSupported()`, `keepAwake(): () => void` |
| `src/lib/offline/status.ts` | `probeOffline(manifest, meaningState)`, `offlineOverview(status)`, `formatBytes` |
| `src/lib/offline/sw.ts` | `needRefresh`, `updateServiceWorker`, `checkForUpdate(): Promise<UpdateResult>` |
| `src/lib/components/Stanza.svelte` | one stanza block; used by `LyricsView` and the Lecture preview |
