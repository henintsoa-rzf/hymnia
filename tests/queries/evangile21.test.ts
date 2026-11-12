/**
 * Evangile21 in the real content (specs/004-evangile21-hymnal, tasks T026 and T036).
 * The reference queries of reference-queries.json run on the sample hymnals; these run on
 * content/ as the personal-use build publishes it, and check that a public build publishes no
 * Evangile21 hymn while its rights are not confirmed (SC-005).
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { buildData } from '../../scripts/build-data';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));

let engine: SearchEngine;
beforeAll(async () => {
	const { errors, catalog, indexJson } = await buildData(CONTENT, { personalUse: true });
	if (errors.length || !catalog || !indexJson) throw new Error(errors.join('\n'));
	engine = createEngine(catalog, indexJson);
});

const rank = (query: string, hymnId: string) => {
	const i = engine.search({ query }).results.findIndex((r) => r.hymnId === hymnId);
	return i < 0 ? Infinity : i + 1;
};

describe('Evangile21 search (personal-use build)', () => {
	it.each([
		['Evangile21 1', 'en-esprit-en-verite'],
		['E21 1', 'en-esprit-en-verite'],
		['Evangile 21 1', 'en-esprit-en-verite'],
		['evangile21 19', 'roc-des-ages'],
		['E21 22', 'sois-seul-ma-vision'],
		['E21 15', 'o-jesus-je-t-aime-evangile21-15'],
		['ATG 307', 'o-jesus-je-t-aime']
	])('hymnal + number "%s" → %s first', (query, hymnId) => {
		expect(rank(query, hymnId)).toBe(1);
	});

	it.each([
		['Sois seul ma vision', 'sois-seul-ma-vision'],
		['Folle nuit de la croix', 'folle-nuit-de-la-croix'],
		[
			'O Lord my Rock and my Redeemer',
			'seigneur-mon-roc-et-mon-redempteur-o-lord-my-rock-and-my-redeemer'
		]
	])('title "%s" → %s in the top 3', (query, hymnId) => {
		expect(rank(query, hymnId)).toBeLessThanOrEqual(3);
	});

	it.each([
		['Brise en moi tout autre désir Seigneur', 'sois-seul-ma-vision'],
		['Les mains vides je viens à toi pour m’accrocher à la croix', 'roc-des-ages'],
		['Heureux l’homme à qui Dieu pardonne', 'psaume-32']
	])('lyrics "%s" → %s in the top 3', (query, hymnId) => {
		expect(rank(query, hymnId)).toBeLessThanOrEqual(3);
	});

	it('the hymnal filter keeps only Evangile21 songs', () => {
		const results = engine.search({ query: 'croix', hymnals: ['evangile21'] }).results;
		expect(results.length).toBeGreaterThan(0);
		for (const r of results) expect(r.refs.every((e) => e.hymnal === 'evangile21')).toBe(true);
	});
});

describe('Evangile21 rights (SC-005)', () => {
	it('a public build publishes no Evangile21 hymn while rights are not confirmed', async () => {
		const { errors, catalog } = await buildData(CONTENT);
		expect(errors).toEqual([]);
		const published = catalog!.hymns.filter((h) =>
			h.entries.some((e) => e.hymnal === 'evangile21')
		);
		expect(published).toEqual([]);
	});
});
