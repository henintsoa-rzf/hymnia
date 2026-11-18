# Quickstart: check the search-by-meaning mode

## Prerequisites

- Data built with meaning vectors (`npm run data`, feature 011). Without them, the button must be
  absent (scenario 6).
- Search by meaning online for scenario 2 (or the e2e mock `mockEmbed` in `tests/e2e/helpers.ts`).

## Automated

```bash
npm run check
npm test                                   # includes tests/unit/meaning-mode.test.ts
npm run test:e2e -- us15-meaning-search us16-meaning-mode
npm run lint
```

Expected: all green. `us16-meaning-mode.spec.ts` covers scenarios 1–5 and the axe checks;
`us15-meaning-search.spec.ts` (feature 011) passes with only its button and field helpers
adapted.

## Manual (phone width 360 px, then desktop; light then dark theme)

`npm run dev`, open `/`.

1. **Button visible at once**: with an empty field, the magnifier-with-sparkles button is right
   of the field. Hover (desktop): tooltip « Rechercher par le sens ».
2. **Enter the mode**: type « un chant d'espérance pour des funérailles », press the button. The
   field grows to about twice its height in a short animation, its frame turns ochre gold, the
   text wraps, the button looks pressed, and the search by meaning runs (« Recherche par le
   sens… », then « Résultats par le sens »). The URL has `sens=1`.
3. **Enter runs it**: edit the text; word results show. Press Enter: the search by meaning runs
   again. Paste a text with line breaks: it becomes one line.
4. **Leave the mode**: press the button. The field returns to one line with its usual frame, the
   text stays, word results show, `sens=1` is gone.
5. **No blinking**: in each mode, type « 245 grâce infinie de Dieu » quickly, then delete it.
   The field and the button never move or change size.
6. **Without meaning data**: build data without the meaning files (or remove `meaning` from
   `static/data/manifest.json` locally). No button, and the field takes the full width.
7. **Reduced motion**: with the system's reduced motion on, the size changes without animation.
8. **Reload**: in meaning mode with results by meaning, reload. The field opens in meaning mode
   with the same results.
