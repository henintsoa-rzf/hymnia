# Data model: Read the Bible and search by meaning from chosen verses

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Three kinds of data, kept apart (Principle IV):

- **Bible content**: committed under `content/bible/`, shipped in `static/data/`.
- **User data**: the reading position (preferences) and the verse selection (tab).
- **Queries**: verse query vectors, kept in the existing query cache.

No vector is stored for any verse.

---

## Bible content

### `content/bible/source.json` — BibleSource

| Field | Type | Rule |
|-------|------|------|
| `translation` | `"lsg1910"` | Id of the translation |
| `name` | `"Louis Segond 1910"` | Shown in the Bible section (FR-004) |
| `rights` | `"public-domain"` | Only value accepted by the build for now |
| `edition` | string | `"eBible.org fraLSG"` |
| `url` | string | URL of the archive downloaded |
| `retrievedAt` | ISO date | Day of the download |
| `sha256` | string | Checksum of the archive |
| `dropped` | string[] | USFM markers removed (research R2), e.g. `["\\f", "\\x", "\\s"]` |

### `content/bible/lsg1910.json` and `static/data/bible.<hash>.json` — BibleData

The same JSON in both, so the build only validates and hashes it.

```ts
type BibleData = {
	translation: 'lsg1910';
	name: string; // « Louis Segond 1910 »
	books: BibleBook[]; // 66, canonical order
};

type BibleBook = {
	code: BookCode; // 'GEN' … 'REV', the order of books.ts
	chapters: BibleChapter[]; // chapters[0] is chapter 1
};

type BibleChapter = string[]; // verse texts; [0] is verse 1 (Psalm titles are verse 1 in LSG)
```

**Validation** (import and build, `src/lib/bible/schema.ts`, zod as for hymns):

- 66 books, codes and order equal to `books.ts`. The number of chapters per book equals
  `books.ts` (e.g. Malachie 4, Psaumes 150).
- Every chapter has at least 1 verse. Every verse text is non-empty, NFC, and free of USFM
  markers (`\`) and of runs of spaces.
- The total verse count is reported, and the build fails if it moves by more than 1 % from the
  last value recorded in `source.json`, as a guard against a broken re-import.
- The build fails above 2 MB compressed (SC-006).

### `src/lib/bible/books.ts` — Book table (code, not data)

| Field | Example | Rule |
|-------|---------|------|
| `code` | `'1CO'` | USFM code, unique |
| `slug` | `'1-corinthiens'` | URL segment, unique |
| `name` | `'1 Corinthiens'` | Display name |
| `refName` | `'1 Corinthiens'` | Name in references (`'Psaume'` for PSA) |
| `abbreviations` | `['1 Co', '1Co', 'I Co']` | Compact keys unique across all books |
| `testament` | `'NT'` | `'AT'` or `'NT'` |
| `chapters` | `16` | Checked against the data |

### Manifest — `static/data/manifest.json`

```ts
type DataManifest = {
	// … existing fields
	/** Absent when the build had no Bible. Old clients ignore it. */
	bible?: { translation: 'lsg1910'; file: string; bytes: number; verses: number };
};
```

---

## Identifiers

- **VerseId**: `"<CODE>.<chapter>.<verse>"`, e.g. `"JHN.3.16"`. It is used in the selection and
  in sorting. Bible order means `books.ts` order, then chapter, then verse.
- **URL form of a selection** (`?versets=`): groups of consecutive verses, as
  `slug.chapter.first[-last]`, joined by `~`. Example: `psaumes.23.1-4~jean.10.11`. Parsing
  ignores unknown or out-of-range parts. If nothing is left, the screen shows "Aucun verset
  choisi".

---

## User data

### Reading position — `Prefs.bibleAt` (`localStorage` `hymnia.prefs`)

| Field | Type | Rule |
|-------|------|------|
| `bibleAt` | `{ book: BookCode; chapter: number } \| null` | Default `null`. Sanitized: an unknown book or out-of-range chapter becomes `null` |

It is updated each time a chapter is shown. Without storage it lasts for the visit only.

### Verse selection — `src/lib/bible/selection.ts` (`sessionStorage` `hymnia.bible.selection`)

| Field | Type | Rule |
|-------|------|------|
| `ids` | `VerseId[]` | Unique, kept in Bible order |
| (derived) `text` | string | The query text: « label — » then the verse texts in Bible order, joined by a space (labelled form, research R4) |
| (derived) `chars` | number | Code points of `text`; never above `MAX_EMBED_CHARS` (2,000) |
| (derived) `label` | string | « Psaume 23:1-4 ; Jean 10:11 » |

State transitions:

- `toggle(id)`: adds the verse, or refuses with `'too-long'` if `chars` would exceed 2,000.
  Removes it if already selected.
- `clear()`: empties the selection.
- Running the search does not clear it. Going back to the Bible keeps it (spec US2-4).

---

## Queries

### Verse query → QueryVector (existing, feature 011)

- The text is `selection.text`: the label, « — », then the verses' text (research R4 picked the labelled form). It is
  embedded by `POST /api/embed` with the shipped `configId`.
- It is stored in the existing query cache (`hymnia.meaning.queries`, last 50), keyed by
  `queryKey(text)`, like a typed query. Running the same selection again sends nothing.

---

## Constants (`src/lib/meaning/config.ts`)

| Name | Value | Use |
|------|-------|-----|
| `MAX_QUERY_CHARS` | 500 (unchanged) | Cut applied by the search field |
| `MAX_EMBED_CHARS` | 2,000 (new) | Worker limit, and verse selection limit |
