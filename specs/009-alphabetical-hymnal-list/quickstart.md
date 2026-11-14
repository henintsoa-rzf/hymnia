# Quickstart: Alphabetical order of the hymnal list

## Automated checks

```bash
npm run test -- tests/unit/catalog.test.ts      # order, ties, empty hymnal hidden
npm run test:e2e -- us3-browse us5-filter    # rows and chips in name order
npm run check && npm run lint
```

Expected: all pass. The existing engine tests (`engine-number`, `engine-text`) and
`search-examples` still pass unchanged, which shows the priority order is intact (FR-006).

## Manual check on the real catalog

1. `npm run dev`, open `/recueils`.
   Expected order: À Toi la Gloire, Ailes de la Foi, Arc-en-ciel, Célébrons Dieu,
   Chorale Psalmodie, Écritures, Evangile21, Exo, J’aime l’Éternel (SC-001).
2. Open the search screen: the filter chips follow the same order. Select « Exo »: it keeps its
   place, and « Tous les recueils » appears last.
3. Open a collection, then « Ajouter »: the chips follow the same order (SC-002).
4. Type `245` on the search screen: the results and their first number are the same as on `main`
   (SC-004).
5. On a first visit (no history, no collection), the number example on the start screen is still
   a JEM number.
