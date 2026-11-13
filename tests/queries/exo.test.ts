/**
 * Exo in the real content (specs/005-exo-hymnal, tasks T016 and T017).
 * Runs on content/ as the personal-use build publishes it, and checks that a public build
 * publishes no Exo hymn while its rights are not confirmed (SC-005).
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { buildData } from '../../scripts/build-data';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));

let engine: SearchEngine;
let hymns: { id: string; entries: { hymnal: string; number: string }[] }[];
beforeAll(async () => {
	const { errors, catalog, indexJson } = await buildData(CONTENT, { personalUse: true });
	if (errors.length || !catalog || !indexJson) throw new Error(errors.join('\n'));
	engine = createEngine(catalog, indexJson);
	hymns = catalog.hymns;
});

const rank = (query: string, hymnId: string) => {
	const i = engine.search({ query }).results.findIndex((r) => r.hymnId === hymnId);
	return i < 0 ? Infinity : i + 1;
};

describe('Exo search (personal-use build, SC-003)', () => {
	it.each([
		['Exo 1', 'si-tu-veux-le-louer'],
		['Exo 4', 'emmanuel-jem-1179'],
		['exo 44', 'a-toi-la-gloire'],
		['Exo 52', 'siyakudumisa'],
		['Exo 54', 'dieu-de-l-impossible-exo-54']
	])('hymnal + number "%s" → %s first', (query, hymnId) => {
		expect(rank(query, hymnId)).toBe(1);
	});

	it.each([
		['Si tu veux le louer', 'si-tu-veux-le-louer'],
		["Dieu de l'impossible", 'dieu-de-l-impossible-exo-54'],
		// Not shown by the site's Exo listing; imported through the pinned table.
		["Règne à l'envers", 'regne-a-l-envers']
	])('title "%s" → %s in the top 3', (query, hymnId) => {
		expect(rank(query, hymnId)).toBeLessThanOrEqual(3);
	});

	it.each([
		['Mes problèmes minuscules mes soucis ridicules', 'dieu-de-l-impossible-exo-54'],
		['Pa bizwen diplom pa bizwen latin', 'si-tu-veux-le-louer'],
		["Pour ces regards que l'on détourne", 'pardonne-nous']
	])('lyrics "%s" → %s in the top 3', (query, hymnId) => {
		expect(rank(query, hymnId)).toBeLessThanOrEqual(3);
	});

	it('the hymnal filter keeps only Exo songs', () => {
		const results = engine.search({ query: 'Jésus', hymnals: ['exo'] }).results;
		expect(results.length).toBeGreaterThan(0);
		for (const r of results) expect(r.refs.every((e) => e.hymnal === 'exo')).toBe(true);
	});

	it('has all 60 Exo songs, and a song shared with JEM shows both references', () => {
		const exo = hymns.filter((h) => h.entries.some((e) => e.hymnal === 'exo'));
		expect(exo).toHaveLength(60);
		const emmanuel = hymns.find((h) => h.id === 'emmanuel-jem-1179')!;
		expect(emmanuel.entries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ hymnal: 'jem', number: '1179' }),
				expect.objectContaining({ hymnal: 'exo', number: '4' })
			])
		);
	});
});

describe('Exo rights (SC-005)', () => {
	it('a public build publishes no Exo hymn while rights are not confirmed', async () => {
		const { errors, catalog } = await buildData(CONTENT);
		expect(errors).toEqual([]);
		const published = catalog!.hymns.filter((h) => h.entries.some((e) => e.hymnal === 'exo'));
		expect(published).toEqual([]);
	});
});
