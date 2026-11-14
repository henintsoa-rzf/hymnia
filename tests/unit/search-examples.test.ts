// Example searches derived from the loaded catalog (specs/006-search-start-panel/research.md R5,
// task T019).
import { beforeAll, describe, expect, it } from 'vitest';
import { createCatalog } from '$lib/data/catalog';
import type { Catalog } from '$lib/domain/schema';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { pickExamples } from '$lib/search/examples';
import { loadSample } from '../helpers/sample';

let data: Catalog;
let engine: SearchEngine;
beforeAll(async () => {
	const { catalog, indexJson } = await loadSample();
	data = catalog;
	engine = createEngine(catalog, indexJson);
});

const words = (s: string) => s.trim().split(/\s+/).length;

describe('pickExamples', () => {
	it('gives a number, a title and a lyrics fragment, in that order', () => {
		const examples = pickExamples(createCatalog(data));
		expect(examples.map((e) => e.kind)).toEqual(['number', 'title', 'lyrics']);
	});

	it('takes the first number of the first hymnal', () => {
		expect(pickExamples(createCatalog(data))[0].query).toBe('CE 1');
	});

	it('takes a title of 2 to 5 words from another hymn', () => {
		const [, title] = pickExamples(createCatalog(data));
		expect(title.query).toBe('Torrents d’amour et de grâce');
		expect(words(title.query)).toBeGreaterThanOrEqual(2);
		expect(words(title.query)).toBeLessThanOrEqual(5);
	});

	it('takes the first 3 words of a lyrics line that is not the title, from a third hymn', () => {
		const [, , lyrics] = pickExamples(createCatalog(data));
		// CE 2: its first line is its title, so the second line is used.
		expect(lyrics.query).toBe('Une invincible armure');
	});

	it('gives the same examples every time', () => {
		expect(pickExamples(createCatalog(data))).toEqual(pickExamples(createCatalog(data)));
	});

	it('gives what it can from a small catalog', () => {
		const first = data.hymns.find((h) =>
			h.entries.some((e) => e.hymnal === 'ce' && e.number === '1')
		)!;
		const one: Catalog = {
			...data,
			hymnals: data.hymnals.map((h) => ({ ...h, hymnCount: h.id === 'ce' ? 1 : 0 })),
			hymns: [{ ...first, entries: first.entries.filter((e) => e.hymnal === 'ce') }]
		};
		expect(pickExamples(createCatalog(one))).toMatchObject([{ kind: 'number', query: 'CE 1' }]);
		const none: Catalog = {
			...data,
			hymnals: data.hymnals.map((h) => ({ ...h, hymnCount: 0 })),
			hymns: []
		};
		expect(pickExamples(createCatalog(none))).toEqual([]);
	});

	it('only gives queries that find something', () => {
		for (const { query } of pickExamples(createCatalog(data))) {
			expect(engine.search({ query }).results.length, query).toBeGreaterThan(0);
		}
	});
});
