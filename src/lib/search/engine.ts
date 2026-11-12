/**
 * Search engine (contracts/search.md). Pure: built from the catalog and the serialised index,
 * so it runs the same in the Web Worker and in Node tests.
 */
import MiniSearch from 'minisearch';
import { createCatalog, type CatalogApi } from '../data/catalog';
import { normalizeNumber } from '../domain/numbering';
import type { Catalog, PublishedEntry, PublishedHymn } from '../domain/schema';
import { buildExcerpt } from './excerpt';
import { FIELD_BOOST, INDEX_OPTIONS, type IndexDocument } from './index-config';
import { allowsPrefix, allowsTypo, allTokensMatch, phraseMatches } from './match';
import { compactKey, normalizeText, tokenize } from './normalize';
import { parseQuery } from './query-parser';
import type { ResultRef, SearchRequest, SearchResponse, SearchResult, Tier } from './types';

export const DEFAULT_LIMIT = 50;
/** Lyrics hits re-ordered by phrase / every word (see lyricsStrength). */
const STRENGTH_CHECKS = 200;

export type SearchEngine = {
	catalog: CatalogApi;
	search(request: SearchRequest): SearchResponse;
};

/** One title of a hymn and the entries that print it (HymnalEntry.title). */
type PreparedTitle = { title: string; words: string[]; entries: PublishedEntry[] };

type Prepared = {
	hymn: PublishedHymn;
	/** The hymn's title first, then each other title its hymnals print. */
	titles: PreparedTitle[];
	firstLineWords: string[];
	lines: string[];
	/** Normalised words of all the lyrics, in order (phrase matching). */
	lyricsWords: string[];
};

function prepareTitles(hymn: PublishedHymn): PreparedTitle[] {
	const byTitle = new Map<string, PreparedTitle>();
	const add = (raw: string, entry?: PublishedEntry) => {
		const title = normalizeText(raw);
		let t = byTitle.get(title);
		if (!t) byTitle.set(title, (t = { title, words: tokenize(raw), entries: [] }));
		if (entry) t.entries.push(entry);
	};
	add(hymn.title);
	for (const e of hymn.entries) add(e.title ?? hymn.title, e);
	return [...byTitle.values()];
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createEngine(catalogData: Catalog, indexJson: string): SearchEngine {
	const catalog = createCatalog(catalogData);
	const index = MiniSearch.loadJSON<IndexDocument>(indexJson, INDEX_OPTIONS);

	// Every hymnal, even one with no published hymn yet, so "JEM 245" reports "not found in JEM".
	const hymnals = catalogData.hymnals;
	const order = new Map(hymnals.map((h, i) => [h.id, i]));
	const abbr = new Map(hymnals.map((h) => [h.id, h.abbreviations[0]]));

	const hymnalKeys = new Map<string, string>();
	for (const h of hymnals) {
		for (const label of [...h.abbreviations, h.name]) hymnalKeys.set(compactKey(label), h.id);
	}
	const resolveHymnal = (label: string) => hymnalKeys.get(compactKey(label));

	const prepared = new Map<string, Prepared>(
		catalogData.hymns.map((hymn) => [
			hymn.id,
			{
				hymn,
				titles: prepareTitles(hymn),
				firstLineWords: tokenize(hymn.firstLine),
				lines: hymn.sections.flatMap((s) => s.lines),
				lyricsWords: tokenize(hymn.sections.flatMap((s) => s.lines).join(' '))
			}
		])
	);

	/* ---------- references ---------- */

	const byHymnalOrder = (a: PublishedEntry, b: PublishedEntry) =>
		(order.get(a.hymnal) ?? 0) - (order.get(b.hymnal) ?? 0);

	function allowedEntries(hymn: PublishedHymn, allowed: Set<string> | null) {
		return hymn.entries.filter((e) => !allowed || allowed.has(e.hymnal)).sort(byHymnalOrder);
	}

	const toRef = (e: PublishedEntry): ResultRef => ({
		hymnal: e.hymnal,
		hymnalAbbr: abbr.get(e.hymnal) ?? e.hymnal,
		number: e.number
	});

	/**
	 * Entry in the first selected hymnal, otherwise the hymnal with the lowest sortOrder. When the
	 * query matched a title that only some hymnals print, one of those entries.
	 */
	function primaryEntry(
		entries: PublishedEntry[],
		selected: string[],
		preferred?: PublishedEntry[]
	): PublishedEntry {
		const pool = preferred ? entries.filter((e) => preferred.includes(e)) : [];
		const candidates = pool.length > 0 ? pool : entries;
		for (const id of selected) {
			const entry = candidates.find((e) => e.hymnal === id);
			if (entry) return entry;
		}
		return candidates[0];
	}

	function result(
		hymn: PublishedHymn,
		entries: PublishedEntry[],
		primary: PublishedEntry,
		tier: Tier
	): SearchResult {
		return {
			hymnId: hymn.id,
			// The title printed by the hymnal the result opens on.
			title: primary.title ?? hymn.title,
			refs: entries.map(toRef),
			primaryRef: { hymnal: primary.hymnal, number: primary.number },
			tier
		};
	}

	/* ---------- number searches ---------- */

	function searchNumber(number: string, allowed: Set<string> | null): SearchResult[] {
		const key = normalizeNumber(number);
		const results: SearchResult[] = [];
		for (const hymnal of hymnals) {
			if (allowed && !allowed.has(hymnal.id)) continue;
			const found = catalog.getEntry(hymnal.id, key);
			if (!found) continue;
			results.push(result(found.hymn, allowedEntries(found.hymn, allowed), found.entry, 1));
		}
		return results;
	}

	/* ---------- text searches ---------- */

	/** Tier of a hit, and for a title match, the entries that print the matched title. */
	function tierOf(
		p: Prepared,
		normalizedQuery: string,
		tokens: string[]
	): { tier: Tier; entries?: PublishedEntry[] } {
		const exact = p.titles.find((t) => t.title === normalizedQuery);
		if (exact) return { tier: 2, entries: exact.entries };
		const words = p.titles.find((t) => allTokensMatch(tokens, t.words));
		if (words) return { tier: 3, entries: words.entries };
		if (allTokensMatch(tokens, p.firstLineWords)) return { tier: 4 };
		return { tier: 5 };
	}

	/**
	 * Order inside the lyrics tier (5): the query as a phrase of the lyrics, then every query word
	 * somewhere in the lyrics, then the rest. Without it, a full line of lyrics ranked below
	 * hymns that only had one of its words in their title (the title weighs 3 times more).
	 */
	function lyricsStrength(p: Prepared, tokens: string[]): number {
		if (tokens.length > 1 && phraseMatches(tokens, p.lyricsWords)) return 0;
		if (allTokensMatch(tokens, p.lyricsWords)) return 1;
		return 2;
	}

	type Ranked = {
		p: Prepared;
		tier: Tier;
		rank: number;
		strength?: number;
		/** Entries printing the title that matched (tiers 2–3). */
		entries?: PublishedEntry[];
	};

	const isAllowed = (p: Prepared, allowed: Set<string> | null) =>
		!allowed || p.hymn.entries.some((e) => allowed.has(e.hymnal));

	/** Ranking only: cheap, done for every hit. Results and excerpts are built for the top ones. */
	function rankText(text: string, allowed: Set<string> | null): Ranked[] {
		const tokens = tokenize(text);
		const normalizedQuery = tokens.join(' ');
		const hits = index.search(text, {
			boost: FIELD_BOOST,
			combineWith: 'OR',
			prefix: (term, i, terms) => allowsPrefix(term, i === terms.length - 1),
			fuzzy: (term) => (allowsTypo(term) ? 1 : false),
			filter: allowed ? (hit) => isAllowed(prepared.get(hit.id)!, allowed) : undefined
		});
		let checked = 0;
		return hits.map((hit, rank) => {
			const p = prepared.get(hit.id)!;
			const { tier, entries } = tierOf(p, normalizedQuery, tokens);
			// Only the best lyrics hits are re-ordered (performance): a hymn holding the whole
			// query is always among them, since the index already ranks it by the words it holds.
			const strength = tier === 5 && checked++ < STRENGTH_CHECKS ? lyricsStrength(p, tokens) : 2;
			return { p, tier, rank, strength, entries };
		});
	}

	function rankShort(text: string, allowed: Set<string> | null): Ranked[] {
		const q = normalizeText(text);
		const found: { p: Prepared; t: PreparedTitle }[] = [];
		for (const p of prepared.values()) {
			if (!isAllowed(p, allowed)) continue;
			const t = p.titles.find((x) => x.title === q) ?? p.titles.find((x) => x.title.startsWith(q));
			if (t) found.push({ p, t });
		}
		return found
			.sort((a, b) => a.t.title.localeCompare(b.t.title))
			.map(({ p, t }, rank) => ({ p, tier: t.title === q ? 2 : 3, rank, entries: t.entries }));
	}

	function toResults(
		ranked: Ranked[],
		text: string,
		allowed: Set<string> | null,
		selected: string[],
		limit: number
	): SearchResult[] {
		const tokens = tokenize(text);
		return ranked
			.sort((a, b) => a.tier - b.tier || (a.strength ?? 0) - (b.strength ?? 0) || a.rank - b.rank)
			.slice(0, limit)
			.map(({ p, tier, entries: matched }) => {
				const entries = allowedEntries(p.hymn, allowed);
				const r = result(p.hymn, entries, primaryEntry(entries, selected, matched), tier);
				if (tier >= 4) r.excerpt = buildExcerpt(p.lines, tokens);
				return r;
			});
	}

	/* ---------- entry point ---------- */

	function search(request: SearchRequest): SearchResponse {
		const started = now();
		const { query } = request;
		const limit = request.limit ?? DEFAULT_LIMIT;
		const selected = (request.hymnals ?? []).filter((id) => order.has(id));
		const allowed = selected.length > 0 ? new Set(selected) : null;
		const done = (response: Omit<SearchResponse, 'query' | 'tookMs'>): SearchResponse => ({
			query,
			...response,
			results: response.results.slice(0, limit),
			tookMs: now() - started
		});

		const parsed = parseQuery(query, resolveHymnal);
		switch (parsed.kind) {
			case 'empty':
				return done({ kind: 'empty', results: [] });

			case 'number':
				return done({ kind: 'number', results: searchNumber(parsed.number, allowed) });

			case 'hymnal-number': {
				// A hymnal typed explicitly wins over the filter.
				const found = catalog.getEntry(parsed.hymnal, parsed.number);
				if (!found) {
					return done({
						kind: 'hymnal-number',
						notFound: { hymnal: parsed.hymnal, number: parsed.number },
						results: []
					});
				}
				const entries = allowedEntries(found.hymn, allowed);
				if (!entries.includes(found.entry)) entries.push(found.entry);
				entries.sort(byHymnalOrder);
				return done({
					kind: 'hymnal-number',
					results: [result(found.hymn, entries, found.entry, 1)],
					sameNumber: searchNumber(parsed.number, allowed).filter(
						(r) => r.primaryRef.hymnal !== parsed.hymnal
					)
				});
			}

			case 'short':
			case 'text': {
				const ranked =
					parsed.kind === 'short'
						? rankShort(parsed.text, allowed)
						: rankText(parsed.text, allowed);
				const results = toResults(ranked, parsed.text, allowed, selected, limit);
				const unknownHymnal =
					parsed.kind === 'text' && results.length === 0 ? parsed.hymnalLabel : undefined;
				return done(
					unknownHymnal ? { kind: 'text', results, unknownHymnal } : { kind: 'text', results }
				);
			}
		}
	}

	return { catalog, search };
}
