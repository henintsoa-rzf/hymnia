/**
 * Example searches on the real content (specs/006-search-start-panel, task T020, SC-005).
 * Runs on content/ as the personal-use build publishes it: each example must find its hymn.
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCatalog, type CatalogApi } from '$lib/data/catalog';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { pickExamples } from '$lib/search/examples';
import { buildData } from '../../scripts/build-data';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));

let catalog: CatalogApi;
let engine: SearchEngine;
beforeAll(async () => {
	const { errors, catalog: data, indexJson } = await buildData(CONTENT, { personalUse: true });
	if (errors.length || !data || !indexJson) throw new Error(errors.join('\n'));
	catalog = createCatalog(data);
	engine = createEngine(data, indexJson);
});

describe('example searches (personal-use build)', () => {
	it('gives three examples', () => {
		expect(pickExamples(catalog).map((e) => e.kind)).toEqual(['number', 'title', 'lyrics']);
	});

	it('each example finds its hymn among the first three results', () => {
		for (const { query, hymnId } of pickExamples(catalog)) {
			const ids = engine.search({ query }).results.map((r) => r.hymnId);
			expect(ids.length, query).toBeGreaterThan(0);
			expect(ids.slice(0, 3), query).toContain(hymnId);
		}
	});
});
