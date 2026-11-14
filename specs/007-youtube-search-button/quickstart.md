# Quickstart: validate the YouTube search link

## Prerequisites

- `npm install` done.
- To see real hymns locally, a personal-use build (`HYMNIA_PERSONAL_USE=1` in `.env`). Without
  it, only the e2e fixture has content.

## Automated checks

```bash
npm test                 # unit: youtubeSearchUrl (accents, punctuation, spaces)
npm run test:e2e         # us13: link present, href, new tab, no YouTube request, axe on hymn page
npm run check && npm run lint
```

Expected: all green. Search query sets are not affected.

## Manual scenarios (`npm run dev`)

1. **Phone width** (≈ 390 px): open any hymn. Under the credits: « Rechercher sur YouTube » with
   an outside-link icon. Top bar (back, bookmark) and reading bar (previous · size · next) are
   unchanged. Tap it: a new tab opens on YouTube results for the hymn's title; the Hymnia tab
   still shows the hymn at the same scroll and text size.
2. **Desktop** (≥ 1024 px): same link under the credits; the tools row still has only the text
   size and the bookmark.
3. **Accents and punctuation**: open a hymn whose title has accents, an apostrophe or guillemets;
   the YouTube search box shows the title exactly.
4. **Different title per hymnal**: open a hymn listed in two hymnals with different titles, from
   each reference; the search follows the title shown.
5. **Collection reading**: open a hymn from a Répertoire collection (`?collection=`); the link
   works and previous/next still follow the collection.
6. **No early request**: DevTools → Network, filter `youtube`; load a hymn page → no request.
7. **Keyboard / screen reader**: Tab reaches the link with a visible focus ring; it is announced
   « Rechercher sur YouTube, lien ».
8. **Themes**: check legibility in light and dark modes.
9. **Offline**: DevTools offline; the hymn page still works; the link opens a tab that fails to
   load, nothing else breaks.
