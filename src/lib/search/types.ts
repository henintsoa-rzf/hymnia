/** Search contract types (specs/001-hymnal-browse-search/contracts/search.md). */

export type SearchRequest = {
	/** Raw text typed by the user. */
	query: string;
	/** Hymnal ids to restrict to; empty or missing = all (FR-010). */
	hymnals?: string[];
	/** Default 50. */
	limit?: number;
};

export type SearchKind = 'empty' | 'number' | 'hymnal-number' | 'text';

export type ResultRef = { hymnal: string; hymnalAbbr: string; number: string };

export type Tier = 1 | 2 | 3 | 4 | 5;

export type Excerpt = {
	/** One line or ~120 characters, original text (FR-020). */
	text: string;
	/** [start, end) ranges in `text`. */
	highlights: [start: number, end: number][];
};

export type SearchResult = {
	hymnId: string;
	title: string;
	/** All entries, filtered by the selected hymnals. */
	refs: ResultRef[];
	/** Entry used to open the hymn. */
	primaryRef: { hymnal: string; number: string };
	tier: Tier;
	/** Only for tiers 4–5 (FR-008). */
	excerpt?: Excerpt;
};

export type SearchResponse = {
	/** Echo of the request query, to drop stale responses. */
	query: string;
	kind: SearchKind;
	notFound?: { hymnal: string; number: string };
	/** `hymnal-number` only: hymns with the same number in the other (allowed) hymnals. */
	sameNumber?: SearchResult[];
	/** `text` only, with no results: the query looked like "<hymnal> <number>" ("JEM 245"). */
	unknownHymnal?: string;
	results: SearchResult[];
	tookMs: number;
};
