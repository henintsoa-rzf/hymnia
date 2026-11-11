# Quickstart: Collections in the Répertoire

Prerequisites, setup and run commands are those of
[feature 001](../001-hymnal-browse-search/quickstart.md).

## Automated checks

| Command | What it proves | Expected |
|---------|----------------|----------|
| `npm test` | Model operations, name rules, "one hymn per collection", ordering, loading, corrupt data ([data-model.md](./data-model.md), [contracts/storage.md](./contracts/storage.md)) | All pass |
| `npm run test:e2e -- --project=android` | The four user stories, reading in collection order, offline, axe on the new screens in light and dark, text at 200 % | All pass, no WCAG 2.2 AA violation |
| `npm run test:queries` | Search unchanged | Same results as before |

## Manual scenarios (phone-sized window, sample data)

1. **Create and fill (US1)**: Répertoire → "Nouvelle collection" → "Culte". On the add
   screen, type `CE 1` and add it, then `fleuve` and add the first result; type `CE 1` again:
   it is shown as added. "Terminé": the collection lists 2 hymns in that order.
2. **Several collections (US2)**: create "Mariage" and "Noël"; rename "Noël" to "Veillée de
   Noël"; try to create "mariage" (refused: "Une collection porte déjà ce nom."); delete
   "Mariage", then tap "Annuler": it is back.
3. **From a hymn (US3)**: open CE 5, tap the bookmark, tick "Culte": the bookmark is filled.
   Tap it again, "Nouvelle collection" → "Prière": CE 5 is in both. Open HE 2 (same hymn):
   the bookmark is filled too.
4. **Order (US4)**: in "Culte", "Modifier l’ordre", move the last hymn up to the top. "Lire
   dans l’ordre": the reader shows "Culte · 1 / 3" and next goes to the second hymn of the
   collection, not the next number.
5. **Offline and reload**: in airplane mode, reload; collections, names and order are kept.
