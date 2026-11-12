# Contract: Search

**Consumers**: the search screen (UI) and the reference query suite (tests). The search code
behind this contract runs in a Web Worker.

## Input

```ts
type SearchRequest = {
  query: string;          // raw text typed by the user
  hymnals?: string[];     // hymnal ids to restrict to; empty or missing = all (FR-010)
  limit?: number;         // default 50
};
```

## Query interpretation (in order)

1. **Empty after trimming** → no search; the screen shows the hymnal list.
2. **Hymnal + number** → matches `^<hymnal> *(n°|no|#)? *<number><suffix>?$` after
   normalisation, where `<hymnal>` is any abbreviation or full name and spaces are optional
   ("jem245", "JEM n°245", "Ailes de la foi 12"). If found, that entry is the only result. If
   not found → `notFound: { hymnal, number }` and no results (spec US1, scenario 4). No text
   search follows: on the sample, "CE 1" matched every lyric containing "ce", which only added
   noise. A hymnal typed explicitly is honoured even if a hymnal filter excludes it. The other
   hymns with the same number in the allowed hymnals come in `sameNumber` (the design shows
   them under "Autres chants n° 7"). A query whose hymnal part is unknown is treated as plain
   text; if that finds nothing and the hymnal part is a single word of up to 8 letters,
   `unknownHymnal` gives it in capitals ("JEM 245" → "JEM") for the message "Aucun recueil".
3. **Number alone** (`^\d+[a-z]?( ?bis)?$`) → every entry with that number in the allowed
   hymnals, ordered by hymnal `sortOrder` (FR-003).
4. **1–2 characters** → title-prefix matches only; no lyric search (edge cases).
5. **Otherwise** → text search on title, first line and lyrics.

## Text matching

- Normalisation: see research §3 (case, accents, punctuation, apostrophes, ligatures).
- Each query word may match by prefix (results while typing): from 3 letters, or from 2 for
  the word being typed (the last one). Single letters only match whole words.
- Fuzzy: one typo allowed for words of 5 letters or more, none below (FR-006).
- All query words count; documents matching more words rank higher.

## Ranking tiers (FR-007)

Results are grouped by tier, then by score within a tier:

1. Exact hymnal + number match
2. Exact title match (normalised)
3. Title match: **every** query word matches a word of the title
4. First-line match: every query word matches a word of the first line
5. Lyrics match: anything else found by the index. Within this tier, hymns whose lyrics hold
   the query as a phrase (its words one after the other, across line breaks) come first, then
   hymns whose lyrics hold every query word, then the rest by score. Only the 200 best lyrics
   hits are re-ordered this way (performance). *(Added after the first real import, feature
   002: a full line of lyrics ranked below titles holding one of its words.)*

"Title" means any title of the hymn: its own and the ones its hymnals print
(`HymnalEntry.title`, feature 002). A result found through a title opens on an entry that
prints that title, and `title` in the result is always the title printed by the hymnal of
`primaryRef`.

"Every word" keeps a common word ("la", "de") from lifting an unrelated title above the hymn
whose lyrics actually match. Tiers are computed for every hit; results, references and excerpts
are only built for the top `limit` results (performance).

## Output

```ts
type SearchResponse = {
  query: string;                 // echo, to drop stale responses
  kind: 'empty' | 'number' | 'hymnal-number' | 'text';
  notFound?: { hymnal: string; number: string };
  sameNumber?: SearchResult[];   // hymnal-number only: same number, other hymnals
  unknownHymnal?: string;        // text only, no results: "JEM" for "JEM 245"
  results: SearchResult[];
  tookMs: number;
};

type SearchResult = {
  hymnId: string;
  title: string;
  refs: { hymnal: string; hymnalAbbr: string; number: string }[]; // all entries, filtered
  primaryRef: { hymnal: string; number: string };                 // ref used to open it
  tier: 1 | 2 | 3 | 4 | 5;
  excerpt?: {                    // only for tiers 4–5 (FR-008)
    text: string;                // one line or ~120 characters, original text (FR-020)
    highlights: [start: number, end: number][]; // ranges in `text`
  };
};
```

- In text search, a hymn appears **once**, with all its references.
- `primaryRef` is the entry in the first selected hymnal, otherwise the hymnal with the lowest
  `sortOrder`.

## Performance

`tookMs` ≤ 200 for any query on a 6,000-hymn collection on a mid-range phone (SC-002). Each
new keystroke cancels any search still running.
