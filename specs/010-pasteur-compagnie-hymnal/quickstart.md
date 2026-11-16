# Quickstart: Pasteur & Compagnie Hymnal

How to import the hymnal and check that it works. Run the commands from the repository root.
Rules: [contracts/petc-adapter.md](./contracts/petc-adapter.md). Shapes and initial numbers:
[data-model.md](./data-model.md).

## 1. Tests

```bash
npm run test:import    # petc adapter on fixtures, title rule on 68 titles, pinned-table and
                       # parts invariants, reconcile same-page rule; other adapters unchanged
npm test               # unit: parts grouping still fine with a 1000 part
```

## 2. Import

```bash
# .env must hold HYMNIA_CONTACT (the contact sent to sites), as for the other live sources
npm run import -- run --source petc --hymnal pasteur-compagnie --dry-run --yes
npm run import -- report
npm run import -- run --source petc --hymnal pasteur-compagnie --yes
npm run import -- duplicates   # review pairs with Evangile21, JEM, ATG…
```

Expected in the log and report:
- `pasteur-compagnie: 68 rows, 68 song pages`, `6 albums, 55 tracks, 48 matched` (the
  instrumental KIDS album is skipped without being fetched), plus 1 line for that album and 1
  for "L'espoir (instrumental)";
- no "not pinned yet" line;
- 81 refs, 75 parsed: 48 album entries for 44 songs, plus 27 "Hors album" songs, which makes
  71 songs. 6 refs are skipped with "no lyrics on the site" (201, 210, 214, 305, 310, 504);
- `toCheck` lists only the songs whose stanzas or notes are really doubtful. Read each one
  against its page and fix the adapter if a rule is wrong;
- most songs shared with Evangile21 are under `autoMerged`. The 4 songs on two albums show 2
  entries each.

## 3. Validate

```bash
npm run import -- check        # schemas, parts, text equals the cached pages
npm run import -- run --source petc --hymnal pasteur-compagnie --yes   # 2nd run: no file changes
git status content/            # nothing new after the 2nd run
npm run test:queries
```

In the personal-use build (`HYMNIA_PERSONAL_USE=1` in `.env`, then `npm run dev`), on mobile width, light and dark:
- the hymnal page shows 6 parts in order, "Dans ses mains" starts at 301, there is no 305, and
  "Hors album" comes last;
- "P&C 307" and "pc 307" give "Il me gardera" as the first result, and "Sa grâce est plus
  grande" gives that song first (JEM has another "Il me gardera", so that title is not a fair
  first-result test);
- "Coule à flots" shows P&C 105 and P&C 505 on one song page, separate from Evangile21 8;
- a song with the same text as Evangile21 (e.g. "Sauvé") shows both references ("P&C n", "E21 n");
- in the public build (without `HYMNIA_PERSONAL_USE`), no P&C song appears.

## First real run (2026-11-16)

- **Pages**: 81 refs, 75 parsed, 6 skipped with "no lyrics on the site" (201, 210, 214, 305, 310,
  504), as planned. No "not pinned yet" line, no difference between the pins and the albums.
- **Result**: 29 new hymns, 46 entries attached to existing hymns (Evangile21 for most, ATG, AdF,
  CD, JEM, Arc-en-ciel, Psalmodie for the others; the 3 other songs on two albums attached their
  second number by the same-page rule), 0 conflicts. 71 songs, 75 entries. Corrected the same
  day, see "Word differences" below.
- **Possible duplicates** (4) and decisions: `oui-je-crois` and `oui-je-crois-exo-39` vs P&C 403
  (other songs, similarity ≤ 0.02) → `distinct`; `grace-infinie` (JEM) vs P&C 1005 (another
  translation, 0.01) → `distinct`; Psalmodie 703 "Sa grâce est plus grande (His Mercy Is More)"
  vs P&C 1008 (same translation, a few words differ, 0.65) → `merge` into the Psalmodie hymn.
- **Missed by the matcher**: "Coule à flots" (P&C 105/505) is Evangile21 8 plus the "Par-dessus
  tout" bridge, which the site puts first. Neither the title nor the first line matched, so the
  pair was never compared (containment 1.00 when compared). Recorded as a `merge` into
  `coule-a-flots-source-de-grace`. A sweep of the 29 new hymns against all content found no other
  pair.
- **Not lyrics, removed**: 88 empty ChordPro rows, 16 chord lines and 12 syllable splits (O peuple
  fidèle), 271 labels, 33 blank lines inside a section, 10 copyright lines, 9 shop notes, 7
  "Paroles :" markers, 6 title headings, 2 recording credits, 1 hymnal reference.
- **To check by hand**: 0 after the rules above (1 copyright line before they existed).
- **Second run**: 75 unchanged, no change in `content/` or `import/state/`.

## Word differences (2026-11-16, maintainer decision)

Rule: a song whose words differ from an existing hymn, even by a few words, stays separate with
its own text. A word-by-word comparison of the 46 attached entries found 11 hymns with different
words, which were detached, recorded as `distinct`, and imported again as P&C hymns (the two
merges above were turned into `distinct`, and their redirects removed):

| P&C | New hymn | Kept apart from | Difference |
|-----|----------|-----------------|------------|
| 103 | `jesus-a-tout-paye-pasteur-compagnie-103` | Evangile21 10 | added chorus lines |
| 105, 505 | `coule-a-flots` | Evangile21 8 | "Par-dessus tout" bridge |
| 205 | `sur-le-mont-du-calvaire-pasteur-compagnie-205` | ATG 130 | other verses and chorus |
| 209 | `a-l-agneau-sur-son-trone-pasteur-compagnie-209` | ATG 67… | a verse missing, "dans sa main" |
| 304 | `viens-et-vois-pasteur-compagnie-304` | ATG 129 | "la tombe" / "sa tombe" |
| 309 | `non-par-moi-mais-par-christ-en-moi` | Psalmodie 707 | "L'amour parfait" |
| 501 | `le-seul-dieu-trois-fois-saint-pasteur-compagnie-501` | Evangile21 30 | "un mot de sa bouche" |
| 1002 | `alleluia-quel-grand-sauveur-pasteur-compagnie-1002` | Evangile21 2 | refrain and a verse |
| 1008 | `sa-grace-est-plus-grande` | Psalmodie 703 | about 7 lines |
| 1011 | `chef-couvert-de-blessures-pasteur-compagnie-1011` | ATG 117… | "par ta mort" |
| 1012 | `roc-des-ages-pasteur-compagnie-1012` | Evangile21 19 | "l'accrocher", "bourse" |

The other 35 attached entries have the same words (only line breaks, "œ"/"oe", syllable splits
or "2x" differ). Result: 40 new hymns, 35 entries on existing hymns; still 71 songs and 75
entries. `viens-et-vois-jem-82` vs P&C 304 (0.01) → `distinct`.
