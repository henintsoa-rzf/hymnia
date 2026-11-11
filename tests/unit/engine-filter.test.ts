import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { loadSample } from '../helpers/sample';

let engine: SearchEngine;
beforeAll(async () => {
	const { catalog, indexJson } = await loadSample();
	engine = createEngine(catalog, indexJson);
});

describe('hymnal filter (FR-010, US5)', () => {
	it('text search only returns hymns of the selected hymnals', () => {
		const all = engine.search({ query: 'gloire' }).results;
		const he = engine.search({ query: 'gloire', hymnals: ['he'] }).results;
		expect(he.length).toBeGreaterThan(0);
		expect(he.length).toBeLessThan(all.length);
		for (const r of he) {
			expect(r.refs.every((ref) => ref.hymnal === 'he')).toBe(true);
			expect(r.primaryRef.hymnal).toBe('he');
		}
		// Debout, sainte cohorte is only in CE
		expect(he.map((r) => r.hymnId)).not.toContain('debout-sainte-cohorte');
	});

	it('number alone only lists the selected hymnals (US5 scenario 3)', () => {
		const response = engine.search({ query: '12', hymnals: ['ce'] });
		expect(response.results.map((r) => r.primaryRef)).toEqual([{ hymnal: 'ce', number: '12' }]);
	});

	it('refs only list the selected hymnals', () => {
		const [first] = engine.search({ query: 'plus pres de toi', hymnals: ['he'] }).results;
		expect(first.refs).toEqual([{ hymnal: 'he', hymnalAbbr: 'HE', number: '2' }]);
	});

	it('primaryRef uses the first selected hymnal', () => {
		const [first] = engine.search({ query: 'plus pres de toi', hymnals: ['he', 'ce'] }).results;
		expect(first.primaryRef).toEqual({ hymnal: 'he', number: '2' });
		expect(first.refs.map((r) => r.hymnal)).toEqual(['ce', 'he']);
	});

	it('an explicitly typed hymnal + number still opens, even outside the filter', () => {
		const response = engine.search({ query: 'CE 1', hymnals: ['he'] });
		expect(response.results[0]).toMatchObject({
			hymnId: 'a-toi-la-gloire',
			tier: 1,
			primaryRef: { hymnal: 'ce', number: '1' }
		});
		// The text results that follow stay filtered.
		for (const r of response.results.slice(1)) {
			expect(r.refs.every((ref) => ref.hymnal === 'he')).toBe(true);
		}
	});

	it('an empty filter means all hymnals', () => {
		expect(engine.search({ query: '7', hymnals: [] }).results).toHaveLength(2);
	});
});
