/**
 * Reference query suite (SC-003). Every change to search must keep these targets:
 * - at least 95% of queries have the expected hymn in the top 3 (or their own rank target);
 * - 100% of hymnal + number queries return the expected hymn first.
 * Add real-content queries here once hymnals are imported (feature 002).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { loadSample } from '../helpers/sample';
import queries from './reference-queries.json';

type RefQuery = { category: string; query: string; expect: string; rank: number | 'first' };

let engine: SearchEngine;
beforeAll(async () => {
	const { catalog, indexJson } = await loadSample();
	engine = createEngine(catalog, indexJson);
});

function rankOf(q: RefQuery): number {
	const i = engine.search({ query: q.query }).results.findIndex((r) => r.hymnId === q.expect);
	return i < 0 ? Infinity : i + 1;
}

const passes = (q: RefQuery) => rankOf(q) <= (q.rank === 'first' ? 1 : q.rank);

describe('reference queries (SC-003)', () => {
	const all = queries as RefQuery[];

	it('has at least 50 queries', () => {
		expect(all.length).toBeGreaterThanOrEqual(50);
	});

	it('returns the expected hymn first for 100% of hymnal + number queries', () => {
		const failures = all
			.filter((q) => q.category === 'hymnal-number')
			.filter((q) => rankOf(q) !== 1)
			.map((q) => `${q.query} → rank ${rankOf(q)}`);
		expect(failures).toEqual([]);
	});

	it('meets its rank target for at least 95% of queries', () => {
		const failures = all.filter((q) => !passes(q));
		const rate = (all.length - failures.length) / all.length;
		if (failures.length) {
			console.warn(
				'Reference queries below target:\n' +
					failures.map((q) => `  [${q.category}] "${q.query}" → rank ${rankOf(q)}`).join('\n')
			);
		}
		expect(rate).toBeGreaterThanOrEqual(0.95);
	});
});
