# Quickstart: check the matching-stanza mark

## Prerequisites

- Data built with meaning vectors (`npm run data`, feature 011).
- Search by meaning online, or the e2e mock `mockEmbed` (`tests/e2e/helpers.ts`).

## Automated

```bash
npm run check
npm test                 # stanza-groups, passage and fuse tests
npm run test:e2e -- us15-meaning-search us17-stanza-mark
npm run lint
```

Expected: all green.

- `tests/unit/meaning-stanzas.test.ts`: `indexedStanzas` output unchanged on its existing cases;
  `stanzaGroups` gives joined short sections in one group.
- `tests/unit/meaning-passage.test.ts` (new): valid group start → its sections; `null`, `''`,
  `'x'`, `'-1'`, `'1.5'`, out of range, a non-start section → `[]`.
- `tests/unit/meaning-fuse.test.ts`: the `matchedSection` table of
  [contracts/stanza-mark.md](./contracts/stanza-mark.md).
- `tests/e2e/us17-stanza-mark.spec.ts` (new): scenarios 1–5 below, plus axe on a marked hymn in
  light and dark.

## Manual (phone width 360 px, then desktop; light then dark)

`npm run dev`, open `/`.

1. **Mark and scroll**: turn on search by meaning, search « la fidélité de Dieu dans l'épreuve »,
   launch. Note a result whose excerpt is not the first verse. Tap it. The stanza starting with that
   excerpt has a soft gold background and a gold bar on its left; no other stanza does; it is fully
   visible without scrolling, not hidden by the bottom reading bar. Scroll up: the title is there.
2. **No move when visible**: open a result whose excerpt is the first verse. The page does not
   scroll; the first verse is marked.
3. **Chorus**: open a result whose excerpt is a chorus repeated after each verse. The chorus is
   marked once, where it is printed.
4. **Mark belongs to the search**: from a marked hymn, press next, then previous: no mark. Use the
   browser back to the results and tap the same hymn: marked again. Open the same hymn from its
   hymnal list or from « Récemment consultés »: no mark.
5. **Word search**: search « Noël » in word mode, open a result: no mark, no `passage` in the URL.
6. **Bad parameter**: open `/recueils/ce/1?passage=999`, then `?passage=abc`: the hymn shows at
   the top, no mark, no message.
7. **Screen reader** (VoiceOver or TalkBack): read the hymn; the marked stanza is introduced by
   « Passage correspondant à votre recherche ».
8. **Text size**: change the size with the reading bar; the mark stays on the same stanza.
