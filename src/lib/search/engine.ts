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
import { allowsPrefix, allowsTypo, allTokensMatch } from './match';
import { compactKey, normalizeText, tokenize } from './normalize';
import { parseQuery } from './query-parser';
import type { ResultRef, SearchRequest, SearchResponse, SearchResult, Tier } from './types';

export const DEFAULT_LIMIT = 50;

export type SearchEngine = {
	catalog: CatalogApi;
	search(request: SearchRequest): SearchResponse;
};

type Prepared = {
	hymn: PublishedHymn;
	title: string;
	titleWords: string[];
	firstLineWords: string[];
	lines: string[];
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createEngine(catalogData: Catalog, indexJson: string): SearchEngine {
	const catalog = createCatalog(catalogData);
	const index = MiniSearch.loadJSON<IndexDocument>(indexJson, INDEX_OPTIONS);

	const hymnals = catalog.getHymnals();
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
				title: normalizeText(hymn.title),
				titleWords: tokenize(hymn.title),
				firstLineWords: tokenize(hymn.firstLine),
				lines: hymn.sections.flatMap((s) => s.lines)
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

	/** Entry in the first selected hymnal, otherwise the hymnal with the lowest sortOrder. */
	function primaryEntry(entries: PublishedEntry[], selected: string[]): PublishedEntry {
		for (const id of selected) {
			const entry = entries.find((e) => e.hymnal === id);
			if (entry) return entry;
		}
		return entries[0];
	}

	function result(
		hymn: PublishedHymn,
		entries: PublishedEntry[],
		primary: PublishedEntry,
		tier: Tier
	): SearchResult {
		return {
			hymnId: hymn.id,
			title: hymn.title,
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

	function tierOf(p: Prepared, normalizedQuery: string, tokens: string[]): Tier {
		if (p.title === normalizedQuery) return 2;
		if (allTokensMatch(tokens, p.titleWords)) return 3;
		if (allTokensMatch(tokens, p.firstLineWords)) return 4;
		return 5;
	}

	type Ranked = { p: Prepared; tier: Tier; rank: number };

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
		return hits.map((hit, rank) => {
			const p = prepared.get(hit.id)!;
			return { p, tier: tierOf(p, normalizedQuery, tokens), rank };
		});
	}

	function rankShort(text: string, allowed: Set<string> | null): Ranked[] {
		const q = normalizeText(text);
		return [...prepared.values()]
			.filter((p) => p.title.startsWith(q) && isAllowed(p, allowed))
			.sort((a, b) => a.title.localeCompare(b.title))
			.map((p, rank) => ({ p, tier: p.title === q ? 2 : 3, rank }));
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
			.sort((a, b) => a.tier - b.tier || a.rank - b.rank)
			.slice(0, limit)
			.map(({ p, tier }) => {
				const entries = allowedEntries(p.hymn, allowed);
				const r = result(p.hymn, entries, primaryEntry(entries, selected), tier);
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
