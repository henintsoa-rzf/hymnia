# Quickstart: Exo Hymnal

How to import the Exo hymnal and check that it works. Run the commands from the repository root.
Rules: [contracts/cdl-exo-listing.md](./contracts/cdl-exo-listing.md). Shapes:
[data-model.md](./data-model.md).

## 1. Tests

```bash
npm run test:import              # cdl adapter: Exo listing, numbering, Exo pages; JEM unchanged
```

## 2. Import

```bash
npm run import -- run --source cdl --hymnal exo --dry-run --yes
npm run import -- report
npm run import -- run --source cdl --hymnal exo --yes
npm run import -- duplicates     # review doubtful pairs with JEM and other hymnals
```

The report should show:
- `exo: 60 rows, 50 songs listed`, then 10 lines `pinned but not in the list this run`: the
  10 songs the overlapping listing pages hide (research R3);
- `exo: 60 hymns listed`, no "not pinned yet" line, 0 failures.

**First real run (2026-11-13)**: 60 pages, 0 failures. There were 56 new hymns and 4 merged into
existing ones: Emmanuel (JEM 1179), Je suivrai mon Seigneur, Béni soit le pas, and À toi la
gloire (the ATG/CD hymn). The 15 possible duplicates were all same-title songs with other lyrics
(similarity ≤ 0.39, "Notre Père" being another setting of the prayer), and all were recorded as
`distinct`. Labels written as a lyric line ("(Refrain)") were found 7 times in 6 songs. A second
run changed nothing.

## 3. Numbered hymnals still behave

```bash
npm run import -- run --source cdl --hymnal jem --dry-run --yes   # no change
npm run import -- check                                           # text matches cache, schemas valid
```

## 4. App

```bash
npm run test:queries             # builds the data; search reference queries and rights checks
```

Then, in the personal-use build (`HYMNIA_PERSONAL_USE=1`):
- search `Exo 1`: the song with the lowest site id comes first;
- search `Dieu de l'impossible` and a line of its lyrics: found;
- the hymnal filter offers Exo and shows only its songs;
- open an Exo song that is also in JEM: one song with both references;
- add an Exo song to a collection and reopen it.

## 5. Re-run safety (SC-004)

```bash
npm run import -- run --source cdl --hymnal exo --yes
git status content/ import/state/   # nothing changed
```
