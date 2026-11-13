# Adding a source

A source is one site the importer reads hymns from. Adding one needs four files and no change
to the app (`src/`) or to the other sources (FR-025). Interface and rules:
[specs/002-hymnal-import/contracts/source-adapter.md](../../../specs/002-hymnal-import/contracts/source-adapter.md).
Example to copy: `cdl.ts` and `tests/import/adapters/cdl.test.ts`.

1. **Describe the source** in `import/sources.json`: `id`, `name` (shown under each hymn),
   `baseUrl`, the `hymnals` it covers (ids from `content/hymnals.json`; add a new hymnal there
   first if needed), `minDelayMs` (at least 1000; the fetcher also honours the site's
   `Crawl-delay`), `terms` (URL and summary of the site's terms of use, date read) and
   `permission` (`unknown` until you have asked; `refused` blocks every request).
2. **Read the site's terms of use.** Nothing imported is published without a rights decision,
   but record what the terms say before fetching anything.
3. **Save a few pages politely** in `tests/import/fixtures/<id>/`: one or two listing pages and
   at least five hymn pages (verses and chorus, credits, chords or other markup, no credits if
   possible) plus one page that must fail to parse. Fetch them through the importer's fetcher so
   robots.txt, the delay and the User-Agent apply, and keep as few pages as the tests need: they
   are copyrighted. Write `index.json` (file → `{ url, retrievedAt }`) and a `README.md` with the
   page structure and selectors.
4. **Write the adapter** `scripts/import/sources/<id>.ts`: `listEntries(hymnal, ctx)` returns the
   `(number, url)` pairs of a hymnal using `ctx.fetch` only; `parseHymn(html, ref)` is pure and
   keeps the text as it is (only `cleanLine`, NFC, and markup removal counted in
   `strippedMarkup`). Use `mapCreditRole` for labelled credits, `unspecified` for names without
   a role. End the file with `registerAdapter(...)`, and add `import './<id>';` to `all.ts`.
5. **Test it**: `tests/import/adapters/<id>.test.ts` on the saved pages, then
   `npm run test:import`.
6. **Try it**: `npm run import -- run --source <id> --hymnal <hymnal> --dry-run --yes`, read the
   report (`npm run import -- report`), then run without `--dry-run`.
7. If the same hymnals come from another source too, set which one gives the reference text in
   `import/decisions/source-priority.json`.

Target: under 30 minutes for a site whose pages are already understood (SC-007).

## A hymnal the site does not number

Entries need a number, so give unnumbered songs made-up numbers and **pin** them in a table in
the adapter, oldest first, so they never move (`EVANGILE21_NUMBERS` in `evangile21.ts`,
`CDL_PINNED` in `cdl.ts`). A song missing from the table gets the next free number and the
adapter logs "not pinned yet": add it to the table. On conducteurdelouange.com (Exo), pinned
ids are always listed, because the site's listing pages overlap and hide some songs
(specs/005-exo-hymnal).

## A site that blocks the importer: saved pages

Some sites answer the importer with a challenge page (Cloudflare "Just a moment…", HTTP 403),
even for `robots.txt`. Do not work around it. Instead:

1. Set `"access": "saved-pages"` on the source in `import/sources.json`. The importer then never
   requests the site; `run` reads the cache only and needs no `HYMNIA_CONTACT`.
2. Save the listing pages and the hymn pages from a browser ("Save page as…") into
   `import/inbox/<id>/` (git-ignored).
3. Load them: `npm run import -- add-pages --source <id> import/inbox/<id>`. Each file's URL comes
   from the browser's "saved from url" comment, the canonical link or `og:url`. Challenge pages,
   pages of another site and files with no URL are refused and listed.
4. Run the import as usual. A page that was not saved is reported as `page not saved`.

Example: `evangile21.ts` (specs/004-evangile21-hymnal).
