# Quickstart: Transition and color for results by meaning

How to check the feature end to end. Behaviour is defined in
[contracts/meaning-reveal.md](./contracts/meaning-reveal.md) and [data-model.md](./data-model.md).

## Prerequisites

- Dependencies installed (`npm install`), data built with meaning vectors (as for feature 011).
- For a manual check of the online step, the embedding worker reachable, or the e2e fake embedder.

## Automated checks

```bash
npx vitest run tests/unit/meaning-reveal.test.ts
npx playwright test tests/e2e/us24-meaning-transition.spec.ts tests/e2e/us15-meaning-search.spec.ts tests/e2e/us16-meaning-mode.spec.ts
npx playwright test tests/e2e/a11y.spec.ts
npm run check && npm run lint
```

Expected: all pass. The reference query sets of features 001 and 011 are re-run unchanged (ranking
is not touched).

## Manual scenarios (phone width 360 px, then 320 px; light, then dark)

1. **Sequence**: type « un chant d'espérance pour des funérailles », turn on the meaning mode, wait
   for the word results, press the launch button. Expect: the list fades out; three gold
   placeholder rows with the sparkle appear under « Recherche par le sens… »; the results come in
   from the top; the heading is gold with the sparkle, each row has a thin gold bar on its left.
2. **Cache path**: validate the same text again. Expect the whole sequence again, short but
   visible (results after about half a second).
3. **Slow network** (DevTools "Slow 3G"): the placeholder keeps moving until the answer; results
   show as soon as it arrives.
4. **Cancel**: launch, then press « Annuler » during the placeholder. Expect the word results back
   at once, without gold bar.
5. **Offline**: go offline, launch. Expect the offline message and the word results below it.
6. **Filter**: with results by meaning shown, toggle a hymnal chip. Expect the list to update with
   no placeholder, and the gold marker kept.
7. **Edit and leave**: edit the text (marker stays until a number is typed or the mode is left),
   then leave the mode. Expect word results without marker and no sequence.
8. **Reload**: reload the page on a `?sens=1` address. Expect the placeholder then the marked
   results.
9. **Reduced motion** (OS setting or DevTools emulation): launch. Expect the same order with no
   movement: list gone at once, still placeholder, results at once.
10. **Layout**: during the whole sequence the search field and its buttons don't move; no
    horizontal scroll at 320 px; row text sits at the same place as in word results.

## User check (SC-001, SC-002)

Show 5 people a list of word results and a list of results by meaning in random order; ask which
is which without reading the heading (target 4/5). Ask 5 people to launch a search by meaning and
describe what happened (target 4/5 mention a new or different kind of search).
