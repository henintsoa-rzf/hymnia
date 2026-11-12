# Quickstart: Import Hymnals from Source Sites

How to run the importer and check that it meets the spec. Commands are in
[contracts/cli.md](./contracts/cli.md) and file formats in
[contracts/import-files.md](./contracts/import-files.md).

## Prerequisites

- Node.js 22, `npm install` done (feature 001 set up).
- `HYMNIA_CONTACT` set in `.env` at the repository root (git-ignored); the CLI loads it.
- `import/sources.json` filled in for the source you import, including its permission status.

## 1. Offline checks (no network)

```bash
npm run test:import               # adapters on fixtures, matching, idempotence, rights
npm run import -- check           # schemas, links, decisions, text vs cache
```

Expected: everything passes. The fixture tests cover US1 scenario 4 (page that cannot be
parsed), the 20% abort threshold, and an interrupted write.

## 2. First import of one hymnal (US1)

```bash
npm run import -- run --source cdl --hymnal jem --dry-run --yes   # report only
npm run import -- run --source cdl --hymnal jem --yes
npm run import -- report
npm run data
```

`--yes` is needed while the source's `permission` is `unknown` in `import/sources.json`; the
run warns that nothing will be published until rights are recorded. JEM on
conducteurdelouange.com is about 1,500 hymns over 4 volumes: at 1 request per second, a first
run takes about half an hour; later runs reuse the cache.

Expected:
- The report shows imported/skipped counts, with a reason and URL for each skipped page; at
  least 98% of hymns are imported (SC-001).
- The new files in `content/hymns/` have `rights: "unconfirmed"`, a source URL and a date.
- The build lists them as excluded: nothing new is published yet (SC-006).
- Spot check: open 5 hymns next to their source pages; the text is identical (SC-002).

## 3. Re-run (US2)

```bash
npm run import -- run --source cdl --hymnal jem --offline --yes
git status content/ import/state/          # expect: no changes (SC-003)
```

Then edit one cached page (change one word), re-run with `--offline`, and check that
`npm run import -- pending` shows the diff, that `content/` is unchanged until
`accept <hymnId>`, and that a manual correction made beforehand on another hymn is still there
(SC-004).

## 4. Second hymnal and duplicates (US3)

```bash
npm run import -- run --source cdl --hymnal adf --yes
npm run import -- duplicates
npx vitest run --project import tests/import/reference-duplicates.test.ts   # SC-005
```

Expected: hymns shared by JEM and Ailes de la Foi exist once with two entries; near matches are
listed, not merged. (À Toi la Gloire is not on conducteurdelouange.com.) The SC-005 test is
skipped until `tests/import/reference-duplicates.json` lists at least 30 shared hymns and 10
distinct pairs.

## 5. Rights and publishing (US4)

```bash
npm run import -- rights set --scope hymnal --target jem --basis permission --note "…"
npm run data && npm run preview
```

Expected: JEM hymns appear in the app, and AdF-only hymns do not. A later import that adds a
JEM hymn marks it confirmed and reports `rightsInherited`.

## 6. New source (US5)

Add an adapter and an entry in `sources.json` (see
[contracts/source-adapter.md](./contracts/source-adapter.md)) with its fixtures, then run its
tests and an import. No file under `src/` changes (SC-007).
