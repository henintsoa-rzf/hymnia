/**
 * Arc-en-ciel in the real content: search by number (psalms and lettered variants), title and
 * lyrics, the 632 songs, and no ARC hymn in a public build while rights are not confirmed.
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

describe('Arc-en-ciel search (personal-use build)', () => {
	it.each([
		['ARC 1', 'heureux'],
		['arc 5 A', 'entends-seigneur-ma-plainte'],
		['arc5a', 'entends-seigneur-ma-plainte'],
		['ARC 352', 'o-nuit-bienveillante'],
		// Its heading is a plain paragraph in the document.
		['ARC 592', 'seigneur-tu-es-notre-joie']
	])('hymnal + number "%s" → %s first', (query, hymnId) => {
		expect(rank(query, hymnId)).toBe(1);
	});

	it.each([
		['O nuit bienveillante', 'o-nuit-bienveillante'],
		['Entends, Seigneur, ma plainte', 'entends-seigneur-ma-plainte']
	])('title "%s" → %s in the top 3', (query, hymnId) => {
		expect(rank(query, hymnId)).toBeLessThanOrEqual(3);
	});

	it('lyrics → the song in the top 3', () => {
		expect(rank('Heureux celui dont la plus grande joie', 'heureux')).toBeLessThanOrEqual(3);
	});

	it('has all 632 songs; a song shared with ATG shows both references', () => {
		const arc = hymns.filter((h) => h.entries.some((e) => e.hymnal === 'arc'));
		expect(arc).toHaveLength(632);
		const quelAmi = hymns.find((h) => h.id === 'quel-ami-fidele-et-tendre')!;
		expect(quelAmi.entries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ hymnal: 'atg', number: '150' }),
				expect.objectContaining({ hymnal: 'arc', number: '604' })
			])
		);
	});
});

describe('Arc-en-ciel rights', () => {
	it('a public build publishes no ARC hymn while rights are not confirmed', async () => {
		const { errors, catalog } = await buildData(CONTENT);
		expect(errors).toEqual([]);
		const published = catalog!.hymns.filter((h) => h.entries.some((e) => e.hymnal === 'arc'));
		expect(published).toEqual([]);
	});
});
