# Quickstart: validate the Bible section and search from verses

How to check, end to end, that feature 015 works. Details are in [data-model.md](./data-model.md),
[contracts/bible-ui.md](./contracts/bible-ui.md) and
[contracts/embed-api.md](./contracts/embed-api.md).

## Prerequisites

- Node and the repository's dependencies (`npm install`).
- `.env` with `MAMMOUTH_API_KEY` for the steps that embed (reference vectors, live search). Not
  needed for reading.
- Network access to `ebible.org` for the first import only.

## 1. Import the Bible (once, or to refresh it)

```bash
npm run bible          # tsx scripts/bible/import.ts
```

Expected:

- `import/cache/bible/fraLSG/` holds the downloaded archive (not committed).
- `content/bible/lsg1910.json` and `content/bible/source.json` are written. The report prints
  66 books, 1,189 chapters, the verse count (31,170), the dropped markers, and the raw and
  gzip sizes.
- Running it again with the same archive gives byte-identical files (idempotent).
- Sample check: Jean 3:16 reads « Car Dieu a tant aimé le monde qu’il a donné son Fils
  unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle. »

## 2. Build the app data

```bash
npm run data
```

Expected: `static/data/bible.<hash>.json` exists, and `manifest.json` has
`bible: { translation: "lsg1910", file, bytes, verses }`. The build log shows the Bible's
compressed size, ≤ 2 MB (SC-006).

## 3. Automated tests

```bash
npm test               # unit: books table, reference parser, selection, URL form, copy format,
                       #       prefs.bibleAt, schema, import parser (fixture USFM), embed limit
npm run test:queries   # verse reference set: ≥ 60 % with an expected hymn in the top 10 (SC-004)
npm run test:perf      # Bible JSON parse + chapter lookup under budget (SC-003)
npm run test:e2e       # reading offline, selection, search from verses (embed mocked), a11y
npm run check && npm run lint
```

The reference vectors for the verse set are made once with
`npx tsx scripts/semantic/query-vectors.ts` (needs the key) and committed.

## 4. Manual checks on a phone (or a narrow window), light and dark

1. **Offline reading (SC-001, US1)**: open the app once online, then turn on airplane mode.
   Go to Bible → Psaumes → 23. The chapter shows. Next goes to Psaume 24. From Malachie 4,
   next goes to Matthieu 1.
2. **Reference typing (SC-007)**: in « Aller à… », try `jn 3:16`, `Jean 3,16`, `1co13`,
   `ps 23`, `deut 6:4`, `apocalypse 22`. Each opens the right place. `jo 3` says
   « Référence introuvable ».
3. **Resume**: close the app on Romains 8, reopen it, tap Bible: it opens Romains 8.
4. **Select (US2)**: in Romains 8, tap verses 38 and 39. The bar reads « 2 versets ·
   Romains 8:38-39 ». Go to Psaume 23 and add verse 1. The bar reads
   « 3 versets · Psaume 23:1 ; Romains 8:38-39 » (Bible order).
5. **Limit**: select Psaume 119 verse by verse until the bar says the limit is reached.
   Fewer than 2,000 characters are selected.
6. **Search (SC-005)**: back online, with Romains 8:38-39 selected, tap « Chercher des chants ».
   Results show within about 3 s. Opening one marks the matching stanza. Back returns to
   Romains 8 with the selection kept. Running it again answers without a network call (check the
   network panel: no `/api/embed`).
7. **Offline search (US2-6)**: in airplane mode, run a new selection. The offline message shows,
   with « Réessayer ». The selection is kept.
8. **Settings (feature 014)**: leave out a hymnal and run a selection known to match one of its
   hymns. That hymn is not listed.
9. **Copy (US3)**: copy Jean 3:16-17 and paste it in a note. It shows the text, then
   « — Jean 3:16-17 (Louis Segond 1910) ».
10. **Screen reader**: on a chapter, verses are announced with their number and pressed state. The
    selection bar is announced as « Versets choisis ».

## 5. Deploy

The Worker gets the new 2,000 limit: `npx wrangler deploy` after `npm run build`. Check
`POST /api/embed` with a 1,500-character text: 200.
