import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { loadSample } from '../helpers/sample';

let engine: SearchEngine;
beforeAll(async () => {
	const { catalog, indexJson } = await loadSample();
	engine = createEngine(catalog, indexJson);
});

describe('hymnal + number (FR-002, FR-004, US1)', () => {
	it.each(['CE 1', 'ce1', 'CE n°1', 'Cantiques d’exemple 1', 'cantiques d exemple 1'])(
		'%s opens the exact hymn first',
		(query) => {
			const response = engine.search({ query });
			expect(response.kind).toBe('hymnal-number');
			expect(response.notFound).toBeUndefined();
			expect(response.results[0]).toMatchObject({
				hymnId: 'a-toi-la-gloire',
				tier: 1,
				primaryRef: { hymnal: 'ce', number: '1' }
			});
		}
	);

	it('lists every reference of the hymn', () => {
		const [first] = engine.search({ query: 'HE 7' }).results;
		expect(first.primaryRef).toEqual({ hymnal: 'he', number: '7' });
		expect(first.refs).toEqual([
			{ hymnal: 'ce', hymnalAbbr: 'CE', number: '1' },
			{ hymnal: 'he', hymnalAbbr: 'HE', number: '7' }
		]);
	});

	it('finds suffixed numbers whatever their spelling', () => {
		for (const query of ['HE 3 bis', 'he3bis', 'HE 3BIS']) {
			expect(engine.search({ query }).results[0].primaryRef).toEqual({
				hymnal: 'he',
				number: '3 bis'
			});
		}
		expect(engine.search({ query: 'CE 12a' }).results[0].hymnId).toBe(
			'que-dieu-se-montre-seulement'
		);
	});

	it('reports a missing number without an error (US1 scenario 4)', () => {
		const response = engine.search({ query: 'CE 9999' });
		expect(response.kind).toBe('hymnal-number');
		expect(response.notFound).toEqual({ hymnal: 'ce', number: '9999' });
		expect(response.results.every((r) => r.tier !== 1)).toBe(true);
	});

	it('still recognises a hymnal with no published hymn yet', async () => {
		const { catalog, indexJson } = await loadSample();
		catalog.hymnals.push({
			id: 'jem',
			name: 'J’aime l’Éternel',
			abbreviations: ['JEM'],
			sortOrder: 9,
			hymnCount: 0
		});
		const response = createEngine(catalog, indexJson).search({ query: 'JEM 245' });
		expect(response.kind).toBe('hymnal-number');
		expect(response.notFound).toEqual({ hymnal: 'jem', number: '245' });
	});

	it('lists the other hymns with the same number, apart from the exact one', () => {
		const response = engine.search({ query: 'CE 7' });
		expect(response.results.map((r) => r.hymnId)).toEqual(['quel-ami-fidele-et-tendre']);
		expect(response.sameNumber?.map((r) => r.primaryRef)).toEqual([{ hymnal: 'he', number: '7' }]);
		expect(response.sameNumber?.[0].hymnId).toBe('a-toi-la-gloire');
	});

	it('applies the hymnal filter to the other hymns with the same number', () => {
		const response = engine.search({ query: 'CE 7', hymnals: ['ce'] });
		expect(response.results).toHaveLength(1);
		expect(response.sameNumber).toEqual([]);
	});

	it('names an unknown hymnal when nothing else matches', () => {
		// "XYZ" is not a hymnal in any collection.
		const response = engine.search({ query: 'XYZ 245' });
		expect(response.kind).toBe('text');
		expect(response.results).toEqual([]);
		expect(response.unknownHymnal).toBe('XYZ');
	});

	it('does not report an unknown hymnal when the text search finds something', () => {
		const response = engine.search({ query: 'gloire 1' });
		expect(response.unknownHymnal).toBeUndefined();
	});

	it('echoes the query and measures time', () => {
		const response = engine.search({ query: 'CE 1' });
		expect(response.query).toBe('CE 1');
		expect(response.tookMs).toBeGreaterThanOrEqual(0);
	});
});

describe('number alone (FR-003)', () => {
	it('lists every hymn with that number, ordered by hymnal sortOrder', () => {
		const response = engine.search({ query: '12' });
		expect(response.kind).toBe('number');
		expect(
			response.results.map((r) => [r.primaryRef.hymnal, r.primaryRef.number, r.hymnId])
		).toEqual([
			['ce', '12', 'debout-sainte-cohorte'],
			['he', '12', 'les-anges-dans-nos-campagnes']
		]);
	});

	it('labels each result with its hymnal', () => {
		const response = engine.search({ query: '7' });
		expect(response.results.map((r) => r.primaryRef)).toEqual([
			{ hymnal: 'ce', number: '7' },
			{ hymnal: 'he', number: '7' }
		]);
	});

	it('returns nothing for an unused number', () => {
		expect(engine.search({ query: '999' }).results).toEqual([]);
	});
});

describe('empty query', () => {
	it('runs no search', () => {
		expect(engine.search({ query: '  ' })).toMatchObject({ kind: 'empty', results: [] });
	});
});
