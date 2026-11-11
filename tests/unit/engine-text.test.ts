import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { loadSample } from '../helpers/sample';

let engine: SearchEngine;
beforeAll(async () => {
	const { catalog, indexJson } = await loadSample();
	engine = createEngine(catalog, indexJson);
});

const ids = (query: string) => engine.search({ query }).results.map((r) => r.hymnId);
const top = (query: string, n = 3) => ids(query).slice(0, n);

describe('text matching (FR-005)', () => {
	it('ignores accents, case and punctuation', () => {
		expect(top('a toi la gloire')).toContain('a-toi-la-gloire');
		expect(top('ETERNEL DETOURNE SES COUPS')).toContain('c-est-un-rempart-que-notre-dieu');
		expect(top("c'est un rempart")).toContain('c-est-un-rempart-que-notre-dieu');
	});

	it('matches by prefix while typing', () => {
		expect(top('torrents d am')).toContain('torrents-d-amour-et-de-grace');
		expect(top('ressu')).toContain('a-toi-la-gloire');
	});

	it('expands ligatures', () => {
		expect(ids('noel voici le redempteur')[0]).toBe('minuit-chretiens');
	});
});

describe('typo tolerance (FR-006)', () => {
	it('allows one typo in words of 5 letters or more', () => {
		expect(top('berjer')).toEqual([]); // no "berger" in the sample: nothing invented
		expect(top('etendart de la croix')).toContain('debout-sainte-cohorte');
		expect(top('resuscite')).toContain('a-toi-la-gloire');
	});

	it('allows no typo in words of 4 letters or less', () => {
		// "paux" is one letter away from "paix" but only 4 letters long.
		expect(ids('paux')).not.toContain('a-toi-la-gloire');
	});
});

describe('ranking tiers (FR-007)', () => {
	it('puts an exact title first (tier 2)', () => {
		const [first] = engine.search({ query: 'tel que je suis' }).results;
		expect(first).toMatchObject({ hymnId: 'tel-que-je-suis', tier: 2 });
	});

	it('ranks title matches before lyrics-only matches', () => {
		const results = engine.search({ query: 'gloire' }).results;
		const tiers = results.map((r) => r.tier);
		expect(tiers).toEqual([...tiers].sort());
		expect(results[0]).toMatchObject({ hymnId: 'a-toi-la-gloire', tier: 3 });
		const lyricsOnly = results.find((r) => r.hymnId === 'debout-sainte-cohorte');
		expect(lyricsOnly?.tier).toBe(5);
	});

	it('uses tier 4 for a first-line match', () => {
		expect(engine.search({ query: 'heure solennelle' }).results[0]).toMatchObject({
			hymnId: 'minuit-chretiens',
			tier: 4
		});
		// Second line of the hymn: a lyrics match (tier 5), not a first-line match.
		expect(engine.search({ query: 'invincible armure' }).results[0]).toMatchObject({
			hymnId: 'c-est-un-rempart-que-notre-dieu',
			tier: 5
		});
	});

	it('adds excerpts only for tiers 4 and 5 (FR-008)', () => {
		for (const r of engine.search({ query: 'gloire' }).results) {
			if (r.tier >= 4) expect(r.excerpt).toBeDefined();
			else expect(r.excerpt).toBeUndefined();
		}
	});
});

describe('output', () => {
	it('returns each hymn once, with all its references', () => {
		const results = engine.search({ query: 'plus pres de toi' }).results;
		expect(results.filter((r) => r.hymnId === 'plus-pres-de-toi-mon-dieu')).toHaveLength(1);
		expect(results[0].refs.map((r) => `${r.hymnalAbbr} ${r.number}`)).toEqual(['CE 5', 'HE 2']);
	});

	it('opens on the hymnal with the lowest sortOrder by default', () => {
		const [first] = engine.search({ query: 'quel ami fidele' }).results;
		expect(first.primaryRef).toEqual({ hymnal: 'ce', number: '7' });
	});

	it('respects the limit', () => {
		expect(engine.search({ query: 'de', limit: 2 }).results.length).toBeLessThanOrEqual(2);
		expect(engine.search({ query: 'le', limit: 3 }).results.length).toBeLessThanOrEqual(3);
	});
});

describe('one or two characters (edge cases)', () => {
	it('only searches the start of titles', () => {
		const response = engine.search({ query: 'pl' });
		expect(response.kind).toBe('text');
		expect(response.results.map((r) => r.hymnId)).toEqual(['plus-pres-de-toi-mon-dieu']);
		// "de" appears in many lyrics, but only one title starts with it.
		expect(ids('de')).toEqual(['debout-sainte-cohorte']);
	});
});

describe('long pasted text (edge cases)', () => {
	it('still finds the hymn', () => {
		const verse =
			'Craindrais-je encore ? Il vit à jamais, Celui que j’adore, Le Prince de paix ; ' +
			'Il est ma victoire, Mon puissant soutien, Ma vie et ma gloire : Non, je ne crains rien !';
		expect(ids(verse)[0]).toBe('a-toi-la-gloire');
	});
});
