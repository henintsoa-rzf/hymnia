# Quickstart: Choose the hymnals used by the app

## Prerequisites

```bash
cd ~/1-projects/hymnia
npm install
npm run dev        # app at http://localhost:5173
```

## Automated checks

```bash
npx vitest run --project unit tests/unit/scope.test.ts tests/unit/engine-scope.test.ts \
  tests/unit/prefs.test.ts tests/unit/meaning-rank.test.ts tests/unit/search-examples.test.ts
npm test                 # whole unit suite
npm run test:queries     # reference queries: unchanged when nothing is left out
npm run test:perf        # lexical search under 200 ms, with and without a choice
npx playwright test tests/e2e/us18-hymnal-scope.spec.ts tests/e2e/a11y.spec.ts
npm run check && npm run lint
```

Expected: all green. `engine-*`, `meaning-*` and reference query tests that existed before pass
unchanged, which proves the default (nothing left out) gives the same results.

## Manual scenarios (phone width 390 px, then light and dark)

1. **Layout (Story 3)**: open Réglages. Two headings, « Affichage » then « Recueils ». Theme and
   text size work as before.
2. **Whole hymnal (Story 1)**: uncheck Arc-en-ciel. Go to Recherche: no Arc-en-ciel chip; type
   « ARC 12 »: message « Arc-en-ciel est masqué dans les Réglages » with a link. Open Recueils:
   Arc-en-ciel is absent. Reload: still unchecked. Check it again: back everywhere.
3. **Parts (Story 2)**: unfold JEM, uncheck « JEM 4 ». JEM row shows « 3 parties sur 4 » and a
   mixed checkbox. Search a JEM 4 number with « JEM »: hidden message; a JEM 1 number: found.
   Open the JEM page: no JEM 4 group, caption « 1 partie masquée ».
4. **Hymn in two hymnals**: leave out ATG; search a title that is in both JEM and ATG: the result
   shows only its JEM reference.
5. **Last hymnal**: uncheck all but one hymnal: its checkbox is disabled with « Gardez au moins un
   recueil. ». « Tout sélectionner » restores everything.
6. **User data untouched**: add an Exo hymn to a collection, then leave out Exo. The collection
   still lists it and opens it; a direct link `/recueils/exo/<n>` opens the hymn; `/recueils/exo`
   shows the « masqué » notice.
7. **Meaning search**: with Arc-en-ciel left out, run a search by meaning: no result shows only an
   ARC reference.
8. **Keyboard and screen reader**: Tab through the Recueils list; Space toggles; the partly selected
   hymnal is announced as mixed; the disclosure announces expanded / collapsed.
