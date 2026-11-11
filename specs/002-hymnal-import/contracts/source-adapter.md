# Contract: Source adapter

One module per source in `scripts/import/sources/<id>.ts`. Adding a source means adding one
adapter and one entry in `import/sources.json`; nothing else changes (FR-025).

## Interface

```ts
interface SourceAdapter {
  id: string;                                   // matches import/sources.json
  /** Lists the (number, URL) pairs of a hymnal. Uses ctx.fetch only. */
  listEntries(hymnal: string, ctx: AdapterContext): Promise<EntryRef[]>;
  /** Pure function: no network, no file access. */
  parseHymn(html: string, ref: EntryRef): ParseResult;
}

interface EntryRef { hymnal: string; number: string; url: string }

type ParseResult =
  | { ok: true; hymn: RawHymn }                 // see data-model.md
  | { ok: false; reason: string };              // short, stable reason ("no lyrics block")

interface AdapterContext {
  fetch(url: string): Promise<string>;          // polite, cached fetcher (research R3/R4)
  log(msg: string): void;
}
```

## Rules for adapters

1. Adapters use only `ctx.fetch`; they never call the network directly.
2. `parseHymn` keeps the source text: it only trims whitespace, joins broken lines, converts to
   NFC, and removes chord or annotation markup (counted in `strippedMarkup`). It never rewords
   or fixes spelling.
3. Sections follow the source order. A chorus written once stays once.
4. Credit roles are mapped to `lyrics`, `music`, `translation`, `arrangement`. Unknown roles are
   dropped and reported.
5. Every adapter has fixture tests: at least 5 saved pages, including one with a chorus, one
   with no credits, and one that must fail with a reason.
