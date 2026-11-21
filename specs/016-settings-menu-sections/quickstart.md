# Quickstart: Settings menu, reading and offline sections

## Prerequisites

```bash
cd ~/1-projects/hymnia
npm install
npm run dev        # app at http://localhost:5173 (no service worker: Hors ligne shows « unavailable »)
npm run build && npm run serve   # built app with offline support, for story 3
```

## Automated checks

```bash
npx vitest run --project unit tests/unit/settings-sections.test.ts tests/unit/lyrics-layout.test.ts \
  tests/unit/offline-status.test.ts tests/unit/prefs.test.ts tests/unit/build-data.test.ts
npm test                 # whole unit suite
npm run test:queries     # unchanged: search is not touched
npx playwright test tests/e2e/us21-settings-menu.spec.ts tests/e2e/us22-reading-settings.spec.ts \
  tests/e2e/us23-offline-settings.spec.ts tests/e2e/us18-hymnal-scope.spec.ts \
  tests/e2e/us4-read.spec.ts tests/e2e/a11y.spec.ts
npm run check && npm run lint
```

Expected: all green. `us4-read` and `us18-hymnal-scope` pass after their settings addresses move to
the sections, with the same assertions otherwise.

## Manual scenarios (phone width 390 px, light and dark)

1. **Menu (Story 1)**: open Réglages. Four entries, Affichage · Lecture · Recueils · Hors ligne,
   each with a summary; no control visible; fits without scrolling. Open Recueils, uncheck one
   hymnal, go back with the device back gesture: the menu shows « 9 recueils sur 10 » and focus is on
   Recueils. Reload on `/reglages/lecture`: Lecture opens. Open `/reglages/xyz`: the menu opens.
2. **Links**: leave out a hymnal, open its page: « Réglages » leads to the Recueils section; back
   returns to the menu.
3. **Lecture (Story 2)**: in Lecture, change font, spacing, numbers, chorus: the preview follows at
   once. Open a hymn with a chorus and three stanzas: the chorus appears after each stanza; no
   number is shown; font and spacing match. Largest text with « Aéré »: no overlap. Text size changed
   from the hymn view shows the same value in Lecture.
4. **Keep screen on**: turn it on, open a hymn, leave the phone untouched past its sleep delay: the
   screen stays on; go back to search: normal sleep returns. On a browser without support, the switch
   is disabled with its note.
5. **Meaning mark**: with « Après chaque strophe », open a search-by-meaning result whose match is
   the chorus: only the first (original) chorus is marked.
6. **Hors ligne (Story 3)**, on the built app: after the first visit, the three items show
   « Disponible hors ligne » (meaning data may show « Téléchargement en cours » for a moment); space
   and hymns date are shown. Tap « Rechercher une mise à jour »: « Hymnia est à jour (vérifié à …) ».
   Rebuild with a content change, tap again: the update prompt appears. Cut the network, tap: the
   « Pas de connexion » message.
7. **Private window**: Hors ligne says the browser does not keep the app offline; no space line.
8. **Screen reader**: the menu announces each title with its summary; switches announce on/off; the
   update result is read out when it appears.
