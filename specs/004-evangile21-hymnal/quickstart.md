# Quickstart: Evangile21 Hymnal

How to import the Evangile21 hymnal and check that it works. Commands run from the repository
root. Details: [contracts/cli-add-pages.md](./contracts/cli-add-pages.md),
[contracts/evangile21-adapter.md](./contracts/evangile21-adapter.md).

## 1. Save the pages (browser)

1. Open https://evangile21.thegospelcoalition.org/series/chants-hymnes21/, click "EN VOIR PLUS"
   until every song shows (44 on 2026-11-12), and save it ("Save page as…", HTML complete) into
   `import/inbox/evangile21/` (git-ignored). The page only shows 14 songs before that: a copy of
   the server HTML is not enough.
2. Save each song page into the same folder. By hand, or from the browser console on the series
   page with a script that fetches each song link one every 2 seconds and downloads it with a
   `<!-- saved from url=(NNNN)URL -->` first line (the browser has passed the site's check, so
   the importer itself never sends a request).

## 2. Load them into the cache

```bash
npm run import -- add-pages --source evangile21 import/inbox/evangile21 --dry-run
npm run import -- add-pages --source evangile21 import/inbox/evangile21
```

Expected: `added 45` (list + songs), `refused 0` (2026-11-12). A "challenge page" refusal means the browser
saved the Cloudflare page: open the song again, wait for it to load, save again.

## 3. Import

```bash
npm run import -- run --source evangile21 --hymnal evangile21 --dry-run --yes
npm run import -- report
npm run import -- run --source evangile21 --hymnal evangile21 --yes
```

Expected in the report: "saved pages only, no request is sent"; 38 pages, 0 failures (38 new on the first
run; six Evangile21 versions of À Toi la Gloire hymns are kept apart by `distinct` decisions); six pages skipped with their reason in the
log (five articles about a song, the second "Psaume 150" page); no "not pinned yet" line;
possible duplicates with other hymnals listed for review (`npm run import -- duplicates`).

## 4. Validate

```bash
npm run import -- check          # text matches the saved pages, schemas valid
npm run test:import              # adapter, add-pages and numbering tests
npm run test:queries             # builds the data; Evangile21 search and rights checks
```

Then, in the personal-use build (`HYMNIA_PERSONAL_USE=1`):
- search `Evangile21 1`, `E21 1`: the oldest song is first;
- search `Sois seul ma vision` and a line of its lyrics: found;
- the hymnal filter offers "Evangile21" and shows only its songs;
- open "Roc des âges" (Evangile21): sections as on the site, credits, source link;
- add an Evangile21 song to a collection and reopen it.

## 5. Re-run safety (SC-004)

```bash
npm run import -- run --source evangile21 --hymnal evangile21 --yes
git status content/              # nothing changed
```

Then save one more song page (or edit a fixture in the integration test): it gets the next
number, and the others keep theirs.
