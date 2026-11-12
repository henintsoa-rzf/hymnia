// Ranking on a collection shaped like the real one (feature 002, research R13): many hymns, and
// common words of the lyrics in many titles.
import { describe, expect, it } from 'vitest';
import { buildCatalog, buildIndex } from '../../scripts/build-data';
import { createEngine } from '$lib/search/engine';
import type { Hymn, HymnalEntry } from '$lib/domain/schema';

const hymnals = [
	{ id: 'jem', name: 'J’aime l’Éternel', abbreviations: ['JEM'], sortOrder: 1 },
	{ id: 'atg', name: 'À Toi la Gloire', abbreviations: ['ATG'], sortOrder: 2 }
];

function hymn(id: string, title: string, lines: string[], entries: HymnalEntry[]): Hymn {
	return {
		id,
		title,
		entries,
		sections: [{ type: 'verse', number: 1, lines }],
		credits: [],
		source: { name: 'Test', url: null, retrievedAt: '2026-11-12' },
		rights: 'public-domain',
		corrections: []
	};
}

function engineOf(hymns: Hymn[]) {
	const catalog = buildCatalog(hymnals, hymns);
	return createEngine(catalog, buildIndex(catalog));
}

const gloire = hymn(
	'a-toi-la-gloire',
	'À toi la gloire',
	[
		'À toi la gloire, ô Ressuscité !',
		'À toi la victoire pour l’éternité !',
		'Brillant de lumière, l’ange est descendu,',
		'Il roule la pierre du tombeau vaincu.'
	],
	[{ hymnal: 'atg', number: '1' }]
);
// Titles that hold one or two words of the lyrics above, with unrelated lyrics.
const decoys = [
	['Prince de lumière', 'Tu es le Prince de la paix'],
	['Il est un brillant paradis', 'Là-haut les saints chantent sans fin'],
	['Ouvrez-vous, portes du tombeau', 'Le Seigneur est sorti vainqueur'],
	['Il est sorti du tombeau', 'Christ est vivant pour toujours'],
	['L’ange du Seigneur', 'Les bergers veillaient dans les champs'],
	['La pierre angulaire', 'Sur ce rocher je bâtirai']
].map(([title, line], i) =>
	hymn(`decoy-${i}`, title, [line], [{ hymnal: 'jem', number: String(i + 1) }])
);

describe('lyrics ranking (research R13)', () => {
	const engine = engineOf([gloire, ...decoys]);
	const first = (query: string) => engine.search({ query }).results[0]?.hymnId;

	it('puts a hymn whose lyrics hold the query as a phrase before titles holding some of its words', () => {
		expect(first('Brillant de lumière, l’ange est descendu')).toBe('a-toi-la-gloire');
		expect(first('il roule la pierre du tombeau')).toBe('a-toi-la-gloire');
	});

	it('keeps the phrase rules of words: prefix on the last word, one typo in long words', () => {
		expect(first('il roule la pierre du tomb')).toBe('a-toi-la-gloire');
		expect(first('brilant de lumiere')).toBe('a-toi-la-gloire');
	});

	it('still puts a title holding every word first (tier 3)', () => {
		expect(first('prince de lumiere')).toBe('decoy-0');
	});
});

describe('titles printed by each hymnal (HymnalEntry.title)', () => {
	// The same hymn: ATG prints the hymn's title, JEM its own.
	const retitled = hymn(
		'c-est-vers-toi',
		'C’est vers toi que je me tourne',
		['C’est vers toi que je me tourne', 'Quand mon cœur est abattu'],
		[
			{ hymnal: 'atg', number: '42' },
			{ hymnal: 'jem', number: '232', title: 'Ma joie de t’appartenir' }
		]
	);
	const engine = engineOf([retitled, ...decoys]);
	const first = (query: string) => engine.search({ query }).results[0];

	it('finds a hymn by the title one hymnal prints, and opens that hymnal’s entry', () => {
		const r = first('ma joie de t’appartenir');
		expect(r).toMatchObject({
			hymnId: 'c-est-vers-toi',
			tier: 2,
			title: 'Ma joie de t’appartenir'
		});
		expect(r.primaryRef).toEqual({ hymnal: 'jem', number: '232' });
		expect(first('joie appartenir')).toMatchObject({ hymnId: 'c-est-vers-toi', tier: 3 });
	});

	it('opens the hymnal that prints the hymn’s own title when that title is searched', () => {
		// JEM comes first in the hymnal order, but prints another title.
		const r = first('C’est vers toi que je me tourne');
		expect(r).toMatchObject({ title: 'C’est vers toi que je me tourne', tier: 2 });
		expect(r.primaryRef).toEqual({ hymnal: 'atg', number: '42' });
	});

	it('shows the hymnal’s own title for a number search', () => {
		expect(engine.search({ query: 'JEM 232' }).results[0].title).toBe('Ma joie de t’appartenir');
		expect(engine.search({ query: 'ATG 42' }).results[0].title).toBe(
			'C’est vers toi que je me tourne'
		);
	});

	it('matches the start of any title for one or two characters', () => {
		expect(engine.search({ query: 'ma' }).results[0]).toMatchObject({ hymnId: 'c-est-vers-toi' });
	});
});
