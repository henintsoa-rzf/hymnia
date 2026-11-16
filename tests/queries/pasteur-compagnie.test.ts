/**
 * Pasteur & Compagnie in the real content (specs/010-pasteur-compagnie-hymnal, tasks T032 and
 * T033). Runs on content/ as the personal-use build publishes it, and checks that a public
 * build publishes no P&C hymn while its rights are not confirmed (SC-006).
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { groupByPart } from '$lib/domain/parts';
import { sortKey } from '$lib/domain/numbering';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { buildData } from '../../scripts/build-data';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const HYMNAL = 'pasteur-compagnie';

type Entry = { hymnal: string; number: string };
let engine: SearchEngine;
let hymns: { id: string; entries: Entry[] }[];
let parts: { name: string; first: number }[];
beforeAll(async () => {
	const { errors, catalog, indexJson } = await buildData(CONTENT, { personalUse: true });
	if (errors.length || !catalog || !indexJson) throw new Error(errors.join('\n'));
	engine = createEngine(catalog, indexJson);
	hymns = catalog.hymns;
	parts = catalog.hymnals.find((h) => h.id === HYMNAL)!.parts!;
});

const rank = (query: string, hymnId: string) => {
	const i = engine.search({ query }).results.findIndex((r) => r.hymnId === hymnId);
	return i < 0 ? Infinity : i + 1;
};
const numbers = () =>
	hymns.flatMap((h) =>
		h.entries.filter((e) => e.hymnal === HYMNAL).map((e) => ({ id: h.id, number: e.number }))
	);

describe('Pasteur & Compagnie search (personal-use build, SC-003)', () => {
	it.each([
		['P&C 307', 'il-me-gardera-he-will-hold-me-fast'],
		['PC 307', 'il-me-gardera-he-will-hold-me-fast'],
		['p&c 101', 'sauve'],
		['P&C 105', 'coule-a-flots'],
		['P&C 505', 'coule-a-flots'],
		['P&C 209', 'a-l-agneau-sur-son-trone-pasteur-compagnie-209'],
		['P&C 402', 'l-evangile-c-est-de-la-bombe'],
		['P&C 411', 'papa-c-est-quoi-une-ame'],
		['pc 1005', 'grace-infinie-pasteur-compagnie-1005'],
		['P&C 1027', 'chantons-l-histoire-d-emmanuel']
	])('hymnal + number "%s" → %s first', (query, hymnId) => {
		expect(rank(query, hymnId)).toBe(1);
	});

	it.each([
		['Sa grâce est plus grande', 'sa-grace-est-plus-grande'],
		["L'évangile c'est de la bombe", 'l-evangile-c-est-de-la-bombe'],
		["Chantons l'histoire d'Emmanuel", 'chantons-l-histoire-d-emmanuel']
	])('title "%s" → %s first', (query, hymnId) => {
		expect(rank(query, hymnId)).toBe(1);
	});

	it.each([
		['Notre prière au nom de Jésus que reviennent au Père les âmes perdues', 'l-espoir'],
		["J'ai des fusées dans le dos pour aller bien haut", 'l-evangile-c-est-de-la-bombe']
	])('lyrics "%s" → %s in the top 3', (query, hymnId) => {
		expect(rank(query, hymnId)).toBeLessThanOrEqual(3);
	});

	it('the hymnal filter keeps only P&C songs', () => {
		const results = engine.search({ query: 'Jésus', hymnals: [HYMNAL] }).results;
		expect(results.length).toBeGreaterThan(0);
		for (const r of results) expect(r.refs.every((e) => e.hymnal === HYMNAL)).toBe(true);
	});
});

describe('Pasteur & Compagnie content (US1, US2)', () => {
	it('has 75 entries on 71 songs, and the 6 album tracks with no lyrics are missing', () => {
		const all = numbers();
		expect(all).toHaveLength(75);
		expect(new Set(all.map((e) => e.id)).size).toBe(71);
		for (const n of ['201', '210', '214', '305', '310', '504']) {
			expect(all.some((e) => e.number === n)).toBe(false);
		}
	});

	it('shows a song on two albums as one song with both numbers', () => {
		const coule = hymns.find((h) => h.id === 'coule-a-flots')!;
		expect(coule.entries.filter((e) => e.hymnal === HYMNAL).map((e) => e.number)).toEqual([
			'105',
			'505'
		]);
	});

	it('shows a song shared with Evangile21 with both references', () => {
		const merci = hymns.find((h) => h.id === 'jesus-merci')!;
		expect(merci.entries.map((e) => e.hymnal).sort()).toEqual(['evangile21', HYMNAL]);
	});

	it('keeps its own text when the words differ from a song already in the app', () => {
		// Same tune and translation, a few words different: two hymns, each with its original text.
		for (const [ours, theirs] of [
			['sa-grace-est-plus-grande', 'sa-grace-est-plus-grande-his-mercy-is-more'],
			['coule-a-flots', 'coule-a-flots-source-de-grace'],
			['viens-et-vois-pasteur-compagnie-304', 'viens-et-vois']
		]) {
			const a = hymns.find((h) => h.id === ours)!;
			const b = hymns.find((h) => h.id === theirs)!;
			expect(a.entries.every((e) => e.hymnal === HYMNAL)).toBe(true);
			expect(b.entries.some((e) => e.hymnal === HYMNAL)).toBe(false);
		}
	});

	it('groups the hymnal page by album, then "Hors album"', () => {
		const groups = groupByPart(numbers(), parts, (e) => sortKey(e.number));
		expect(groups.map((g) => [g.part?.name, g.items.length])).toEqual([
			['Hymnes21 2018', 9],
			['Impros louange', 11],
			['Dans ses mains', 8],
			['KIDS', 11],
			['Plus haut encore', 9],
			['Hors album', 27]
		]);
	});
});

describe('Pasteur & Compagnie rights (SC-006)', () => {
	it('a public build publishes no P&C hymn while rights are not confirmed', async () => {
		const { errors, catalog } = await buildData(CONTENT);
		expect(errors).toEqual([]);
		const published = catalog!.hymns.filter((h) => h.entries.some((e) => e.hymnal === HYMNAL));
		expect(published).toEqual([]);
	});
});
