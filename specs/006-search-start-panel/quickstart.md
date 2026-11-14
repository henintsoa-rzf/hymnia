# Quickstart: validate the search screen start content

## Prerequisites

- `npm install` done.
- To see real hymns locally, a personal-use build (`HYMNIA_PERSONAL_USE=1` in `.env`). Without
  it, the public catalog is empty and only the e2e fixture has content.

## Automated checks

```bash
npm test                 # unit: history model, storage, resolution, pickExamples
npm run test:queries     # examples derived from the real content return results (SC-005)
npm run test:e2e         # recent hymns, collections, examples, a11y on the search screen
npm run check && npm run lint
```

Expected: all green. The old e2e "the search screen lists the hymnals" is replaced by one that
checks the hymnal list is gone.

## Manual scenarios (`npm run dev`)

Clear site data first (DevTools → Application → Clear storage).

1. **First visit** (US3): open `/`. No « Recueils » list. « Essayez » shows 3 buttons. Tap each:
   the field fills, results appear, the URL has `?q=`.
2. **Recent hymns** (US1): open 3 hymns (one by search, one from `/recueils`, one by next).
   Back on `/`: « Récemment consultés » lists them newest first; examples are gone. Reopen the
   oldest: it moves to the top, listed once.
3. **Cap**: open 10 different hymns → 8 shown.
4. **Effacer**: tap it → list gone, focus in the field, collections untouched.
5. **Collections** (US2): create 4 collections in `/repertoire`, edit one. On `/`: 3 shown, the
   edited one first, then « Tout le Répertoire ».
6. **Typing**: type in the field → only results; clear → blocks come back.
7. **Desktop** (≥ 1024 px): recent hymns and collections in the side column above the keyboard
   tips; examples under the help text.
8. **Private window / blocked storage**: `/` shows the first-visit content; hymns open normally.
9. Repeat 1–7 in light and dark mode, and at phone width (Principle VI / dev workflow).

Contracts: [ui.md](contracts/ui.md), [storage.md](contracts/storage.md).
