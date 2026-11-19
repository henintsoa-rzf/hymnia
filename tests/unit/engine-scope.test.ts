// Hymnals and parts left out in Settings, in the search engine
// (specs/014-hymnal-scope-settings/contracts/scope.md §2). Sample data: HE has parts « Louange »
// (from 1) and « Noël » (from 10: HE 12 « Les anges », HE 13 « Douce nuit »).
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import type { Exclusions } from '$lib/scope/scope';
import { loadSample } from '../helpers/sample';

let engine: SearchEngine;
beforeAll(async () => {
	const { catalog, indexJson } = await loadSample();
	engine = createEngine(catalog, indexJson);
});

const NO_HE: Exclusions = { hymnals: ['he'], parts: {} };
const NO_NOEL: Exclusions = { hymnals: [], parts: { he: [10] } };
/** A response without its timing, to compare two responses. */
const strip = (response: { tookMs: number }) => ({ ...response, tookMs: 0 });
const ids = (query: string, excluded?: Exclusions) =>
	engine.search({ query, excluded }).results.map((r) => r.hymnId);

describe('nothing left out', () => {
	it('gives the same responses as before feature 014', () => {
		for (const query of ['gloire', '12', 'CE 12', 'HE 7', 'douce nuit']) {
			const before = strip(engine.search({ query }));
			expect(strip(engine.search({ query, excluded: { hymnals: [], parts: {} } }))).toEqual(before);
		}
	});
});

describe('a hymnal left out', () => {
	it('text search returns no reference to it', () => {
		const results = engine.search({ query: 'gloire', excluded: NO_HE }).results;
		expect(results.length).toBeGreaterThan(0);
		for (const r of results) expect(r.refs.every((ref) => ref.hymnal !== 'he')).toBe(true);
	});

	it('a hymn only in that hymnal is not found', () => {
		expect(ids('douce nuit')).toContain('douce-nuit-sainte-nuit');
		expect(ids('douce nuit', NO_HE)).not.toContain('douce-nuit-sainte-nuit');
	});

	it('a hymn also in another hymnal keeps only that one', () => {
		const r = engine
			.search({ query: 'à toi la gloire', excluded: NO_HE })
			.results.find((x) => x.hymnId === 'a-toi-la-gloire')!;
		expect(r.refs.map((ref) => ref.hymnal)).toEqual(['ce']);
		expect(r.primaryRef.hymnal).toBe('ce');
	});

	it('a number alone only lists hymnals in use', () => {
		const response = engine.search({ query: '12', excluded: NO_HE });
		expect(response.results.map((r) => r.primaryRef)).toEqual([{ hymnal: 'ce', number: '12' }]);
	});

	it('its hymnal and number says it is left out, not missing', () => {
		const response = engine.search({ query: 'HE 13', excluded: NO_HE });
		expect(response.results).toEqual([]);
		expect(response.outOfScope).toEqual({ hymnal: 'he', number: '13' });
		expect(response.notFound).toBeUndefined();
		const missing = engine.search({ query: 'HE 99', excluded: NO_HE });
		expect(missing.notFound).toEqual({ hymnal: 'he', number: '99' });
		expect(missing.outOfScope).toBeUndefined();
	});

	it('the same number in hymnals in use is still offered', () => {
		const response = engine.search({ query: 'HE 12', excluded: NO_HE });
		expect(response.outOfScope).toBeDefined();
		expect(response.sameNumber?.map((r) => r.primaryRef)).toEqual([{ hymnal: 'ce', number: '12' }]);
	});

	it('a filter on it alone means no filter (FR-014)', () => {
		const filtered = engine.search({ query: 'gloire', hymnals: ['he'], excluded: NO_HE });
		const unfiltered = engine.search({ query: 'gloire', excluded: NO_HE });
		expect(strip(filtered)).toEqual(strip(unfiltered));
	});
});

describe('a part left out', () => {
	it('its numbers are left out, the other parts are not', () => {
		expect(engine.search({ query: 'HE 12', excluded: NO_NOEL }).outOfScope).toEqual({
			hymnal: 'he',
			number: '12'
		});
		const found = engine.search({ query: 'HE 7', excluded: NO_NOEL });
		expect(found.results.map((r) => r.primaryRef)).toEqual([{ hymnal: 'he', number: '7' }]);
	});

	it('its hymns are not found by text', () => {
		expect(ids('les anges')).toContain('les-anges-dans-nos-campagnes');
		expect(ids('les anges', NO_NOEL)).not.toContain('les-anges-dans-nos-campagnes');
	});

	it('a number alone skips it', () => {
		const response = engine.search({ query: '12', excluded: NO_NOEL });
		expect(response.results.map((r) => r.primaryRef)).toEqual([{ hymnal: 'ce', number: '12' }]);
	});
});

describe('resultFor', () => {
	it('honours what is left out', () => {
		expect(engine.resultFor('douce-nuit-sainte-nuit', [], NO_HE)).toBeUndefined();
		expect(engine.resultFor('douce-nuit-sainte-nuit', [], NO_NOEL)).toBeUndefined();
		const r = engine.resultFor('a-toi-la-gloire', [], NO_HE)!;
		expect(r.refs.map((ref) => ref.hymnal)).toEqual(['ce']);
		expect(engine.resultFor('a-toi-la-gloire')!.refs.map((ref) => ref.hymnal)).toEqual([
			'ce',
			'he'
		]);
	});
});
