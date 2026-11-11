# Quickstart: Browse and Search the Multi-Hymnal Collection

How to run the app and check that the feature works end to end.

## Prerequisites

- Node.js 22 LTS and npm (`node --version` → v22.x)
- Playwright browsers for end-to-end tests: `npx playwright install chromium webkit`. WebKit (the
  `iphone` project) also needs system libraries: `sudo npx playwright install-deps webkit`.
  Without them, run `npm run test:e2e -- --project=android`.

## Setup and run

```bash
cd ~/1-projects/hymnia
npm install
npm run data       # validate content/ and build the data files + search index
npm run dev        # local development server
```

## Automated checks

| Command | What it proves | Expected |
|---------|----------------|----------|
| `npm run data` | Content follows [contracts/content-schema.md](./contracts/content-schema.md); hymns with unconfirmed rights are excluded | Exits 0; prints hymnal and hymn counts and the number of excluded hymns |
| `npm test` | Normalisation, query parsing, ranking tiers, excerpts ([contracts/search.md](./contracts/search.md)) | All pass |
| `npm run test:queries` | Reference query suite (≥ 50 queries) on the sample collection | ≥ 95% in top 3; 100% of hymnal+number queries ranked first (SC-003) |
| `npm run test:perf` | Search timing on a synthetic 6,000-hymn collection | Every query ≤ 200 ms on a throttled CPU (SC-002) |
| `npm run test:e2e` | One test per user story on a mobile viewport, light/dark mode, offline, accessibility | All pass; no WCAG 2.2 AA violations from axe |
| `npm run build && npm run serve` | Static production build with service worker, served like a static host (`vite preview` does not serve `index.html`, so the service worker cannot install there) | App installable; works offline |

## Manual validation scenarios

Using the sample collection on a phone-sized window:

1. **Number (US1)**: type `ce12`, then `CE n°12`. The same hymn is first. Type `12`:
   every hymn numbered 12 is listed with its hymnal. Type `CE 9999`: a clear "no hymn"
   message appears. (With real hymnals: `jem245`, `JEM n°245`, `245`, `JEM 9999`.)
2. **Lyrics (US2)**: type a line without accents and with one typo (e.g. `a toi la gloir o
   ressucite`). The hymn appears in the top 3, with matched words highlighted.
3. **Browse (US3)**: open *Recueils*, pick a hymnal, use "go to number" to jump to a hymn.
4. **Read (US4)**: open a hymn that is in both sample hymnals. Both references are shown.
   Increase text size, go to the next hymn: the size is kept. Check credits and source.
5. **Filter (US5)**: select one hymnal, search a word found in both. Only that hymnal's
   hymns appear. Clear the filter in one tap.
6. **Offline (SC-006)**: open the production build once, switch to airplane mode, reload.
   Steps 1–5 still work.
7. **Dark mode (FR-017)**: switch the theme in *Réglages*. All screens stay readable.
