/**
 * One search by meaning (contracts/meaning-search.md "Ranking"): meaning list, word list, then
 * the blend. Pure, so the search worker, the reference-query tests, the perf test and the
 * comparison script all run the same code.
 */
import type { SearchEngine } from '../search/engine';
import type { SearchRequest, SearchResponse } from '../search/types';
import { MEANING_CONFIG, type Fusion } from './config';
import { fuse, meaningExcerpt, type MeaningCandidate } from './fuse';
import type { MeaningData } from './load';
import { rankMeaning } from './rank';

/** Length of each list before the blend. */
export const CANDIDATES = 100;

export function searchByMeaning(
	engine: SearchEngine,
	data: MeaningData,
	vector: Float32Array,
	request: SearchRequest,
	hymns: SearchEngineHymns,
	fusion: Fusion = MEANING_CONFIG.fusion
): SearchResponse {
	const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const hymnals = request.hymnals ?? [];
	const hits = rankMeaning(data, vector, hymns, { hymnals, limit: CANDIDATES });
	const meaning: MeaningCandidate[] = [];
	for (const hit of hits) {
		const hymn = hymns[hit.hymnIndex];
		const result = engine.resultFor(hymn.id, hymnals);
		if (!result) continue;
		meaning.push({
			result,
			excerpt: meaningExcerpt(hymn.sections[hit.section].lines),
			matchedSection: hit.section
		});
	}
	const words = engine.search({ query: request.query, hymnals, limit: CANDIDATES });
	const results = fuse({
		meaning,
		words: words.kind === 'text' ? words.results : [],
		fusion,
		limit: request.limit ?? 50
	});
	const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
	return { query: request.query, kind: 'meaning', results, tookMs: now - started };
}

/** The catalog's hymns, in the order the meaning rows refer to. */
export type SearchEngineHymns = {
	id: string;
	sections: { lines: string[] }[];
	entries: { hymnal: string }[];
}[];
