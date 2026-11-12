// Recognising the same hymn (research R7, tasks T048/T051).
import { describe, expect, it } from 'vitest';
import { indexContent } from '../../../scripts/import/pipeline/content';
import {
	createMatcher,
	findDuplicates,
	jaccard,
	compareLyrics,
	MERGE_THRESHOLD,
	MIN_SIZE_RATIO,
	POSSIBLE_THRESHOLD,
	TITLE_MERGE_CONTAINMENT,
	shingles
} from '../../../scripts/import/pipeline/match';
import type { FetchedHymn } from '../../../scripts/import/sources/types';
import type { MergeDecision } from '../../../scripts/import/store/state';
import type { Hymn } from '../../../src/lib/domain/schema';

const GLOIRE = [
	'À toi la gloire, ô Ressuscité !',
	'À toi la victoire pour l’éternité !',
	'Brillant de lumière, l’ange est descendu,',
	'Il roule la pierre du tombeau vaincu.'
];
const AUTRE = [
	'Gloire à Dieu au plus haut des cieux',
	'Et paix sur la terre aux hommes qu’il aime',
	'Nous te louons, nous te bénissons',
	'Nous t’adorons, nous te glorifions'
];

function hymn(id: string, title: string, lines: string[], entries: [string, string][]): Hymn {
	return {
		id,
		title,
		entries: entries.map(([hymnal, number]) => ({ hymnal, number })),
		sections: [{ type: 'verse', number: 1, lines }],
		credits: [],
		source: { name: 'S', url: null, retrievedAt: '2026-11-11' },
		rights: 'unconfirmed',
		corrections: []
	};
}

function raw(title: string, lines: string[], hymnal = 'atg', number = '1'): FetchedHymn {
	return {
		source: 'cdl',
		hymnal,
		number,
		url: `https://example.org/${hymnal}/${number}`,
		title,
		sections: [{ type: 'verse', number: 1, lines }],
		credits: [],
		strippedMarkup: {},
		unknownCredits: [],
		retrievedAt: '2026-11-11'
	};
}

const index = (hymns: Hymn[]) =>
	indexContent({
		hymnals: { file: 'hymnals.json', data: [] },
		hymns: hymns.map((data) => ({ file: `hymns/${data.id}.json`, data })),
		redirects: { file: 'redirects.json', data: {} }
	});

const jemGloire = hymn('a-toi-la-gloire', 'À toi la gloire', GLOIRE, [['jem', '245']]);

describe('similarity', () => {
	it('compares word 3-grams of normalised lyrics', () => {
		expect(jaccard(shingles(GLOIRE), shingles(GLOIRE))).toBe(1);
		expect(jaccard(shingles(GLOIRE), shingles(AUTRE))).toBe(0);
		const accentless = GLOIRE.map((l) => l.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase());
		expect(jaccard(shingles(GLOIRE), shingles(accentless))).toBe(1);
	});

	it('uses the thresholds of research R7', () => {
		expect(MERGE_THRESHOLD).toBe(0.85);
		expect(TITLE_MERGE_CONTAINMENT).toBe(0.6);
		expect(MIN_SIZE_RATIO).toBe(0.4);
		expect(POSSIBLE_THRESHOLD).toBe(0.5);
	});

	it('measures containment against the smaller hymn', () => {
		const verse = shingles(GLOIRE.slice(0, 2));
		const c = compareLyrics(verse, shingles(GLOIRE));
		expect(c.containment).toBe(1);
		expect(c.similarity).toBeLessThan(1);
		expect(c.sizeRatio).toBeCloseTo(verse.size / shingles(GLOIRE).size);
	});
});

describe('createMatcher', () => {
	it('merges a hymn with the same title and lyrics similarity ≥ 0.85', () => {
		const { match } = createMatcher(index([jemGloire]), []);
		const slightlyDifferent = [...GLOIRE.slice(0, 3), 'Il roule la pierre du tombeau vaincu !'];
		expect(match(raw('A toi la gloire', slightlyDifferent), 'x')).toEqual({
			kind: 'merge',
			hymnId: 'a-toi-la-gloire'
		});
	});

	it('merges the same title when one hymnal prints only some of the verses', () => {
		const long = hymn('long', 'À toi la gloire', [...GLOIRE, ...AUTRE], [['adf', '118']]);
		const { match } = createMatcher(index([long]), []);
		expect(match(raw('À toi la gloire', GLOIRE), 'x')).toEqual({ kind: 'merge', hymnId: 'long' });
	});

	it('merges identical lyrics under another title (hymnals retitle hymns)', () => {
		const { match } = createMatcher(index([jemGloire]), []);
		expect(match(raw('Victoire de Pâques', GLOIRE), 'x')).toEqual({ kind: 'merge', hymnId: 'a-toi-la-gloire' });
	});

	it('does not merge a short chorus into a much longer hymn that quotes it', () => {
		const chorus = hymn('chorus', 'À toi la gloire', GLOIRE.slice(0, 1), [['jem', '1']]);
		const long = [...GLOIRE.slice(0, 1), ...AUTRE, 'Une strophe de plus pour allonger ce chant', 'Et encore une autre ligne différente ici', 'Pour que le refrain ne soit qu’une petite partie'];
		const { match } = createMatcher(index([chorus]), []);
		expect(match(raw('À toi la gloire', long), 'x').kind).toBe('possible');
	});

	it('proposes, without merging, the same title with different lyrics', () => {
		const { match } = createMatcher(index([jemGloire]), []);
		const result = match(raw('À toi la gloire', AUTRE), 'a-toi-la-gloire-atg-1');
		expect(result).toEqual({
			kind: 'possible',
			candidates: [
				{ a: 'a-toi-la-gloire', b: 'a-toi-la-gloire-atg-1', similarity: 0, reason: 'same title' }
			]
		});
	});

	it('proposes similar lyrics under another title', () => {
		const { match } = createMatcher(index([jemGloire]), []);
		const half = [...GLOIRE.slice(0, 3), ...AUTRE.slice(0, 1)];
		const result = match(raw('Le Christ est ressuscité', half), 'le-christ');
		expect(result.kind).toBe('possible');
		if (result.kind === 'possible') {
			expect(result.candidates[0]).toMatchObject({ a: 'a-toi-la-gloire', reason: 'similar lyrics' });
			expect(result.candidates[0].similarity).toBeGreaterThanOrEqual(0.5);
		}
	});

	it('treats anything else as distinct', () => {
		const { match } = createMatcher(index([jemGloire]), []);
		expect(match(raw('Gloria', AUTRE), 'gloria')).toEqual({ kind: 'distinct' });
	});

	it('applies the maintainer’s decisions first', () => {
		const distinct: MergeDecision = { a: 'a-toi-la-gloire', b: 'a-toi-la-gloire-atg-1', decision: 'distinct', date: '2026-11-11' };
		const { match } = createMatcher(index([jemGloire]), [distinct]);
		expect(match(raw('À toi la gloire', GLOIRE), 'a-toi-la-gloire-atg-1')).toEqual({ kind: 'distinct' });

		const forced: MergeDecision = { a: 'a-toi-la-gloire', b: 'gloria', decision: 'merge', date: '2026-11-11' };
		const second = createMatcher(index([jemGloire]), [forced]);
		expect(second.match(raw('Gloria', AUTRE), 'gloria')).toEqual({ kind: 'merge', hymnId: 'a-toi-la-gloire' });
	});

	it('never matches a hymn that already has an entry in the same hymnal', () => {
		const { match } = createMatcher(index([jemGloire]), []);
		expect(match(raw('À toi la gloire', GLOIRE, 'jem', '300'), 'x').kind).not.toBe('merge');
	});

	it('merges a lettered variant (309A) into the hymn of the same number when the lyrics are the same', () => {
		const adf = hymn('a-toi-la-gloire', 'À toi la gloire', GLOIRE, [['adf', '309']]);
		const matcher = createMatcher(index([adf]), []);
		expect(matcher.match(raw('À toi la gloire, ô Ressuscité', GLOIRE, 'adf', '309A'), 'x')).toEqual({
			kind: 'merge',
			hymnId: 'a-toi-la-gloire'
		});
		// A variant of a variant: 309B joins the same hymn through 309A's base number.
		const only309a = hymn('a-toi-la-gloire', 'À toi la gloire', GLOIRE, [['adf', '309A']]);
		expect(createMatcher(index([only309a]), []).match(raw('À toi', GLOIRE, 'adf', '309B'), 'x')).toEqual({
			kind: 'merge',
			hymnId: 'a-toi-la-gloire'
		});
	});

	it('keeps a lettered variant separate when its lyrics differ, or when decided distinct', () => {
		const adf = hymn('a-toi-la-gloire', 'À toi la gloire', GLOIRE, [['adf', '309']]);
		expect(createMatcher(index([adf]), []).match(raw('À toi la gloire', AUTRE, 'adf', '309A'), 'x').kind).not.toBe('merge');
		expect(createMatcher(index([adf]), []).match(raw('À toi la gloire', GLOIRE, 'adf', '310A'), 'x').kind).not.toBe('merge');
		const distinct: MergeDecision[] = [{ a: 'a-toi-la-gloire', b: 'x', decision: 'distinct', date: '2026-11-11' }];
		expect(createMatcher(index([adf]), distinct).match(raw('À toi la gloire', GLOIRE, 'adf', '309A'), 'x').kind).not.toBe('merge');
	});

	it('ignores the sample hymns (hymnals ce and he), which leave content before publishing', () => {
		const sample = hymn('a-toi-la-gloire', 'À toi la gloire', GLOIRE, [['ce', '1'], ['he', '7']]);
		const { match } = createMatcher(index([sample]), []);
		expect(match(raw('À toi la gloire', GLOIRE), 'x')).toEqual({ kind: 'distinct' });
	});

	it('remembers hymns created during the run', () => {
		const matcher = createMatcher(index([]), []);
		matcher.remember(hymn('a-toi-la-gloire', 'À toi la gloire', GLOIRE, [['jem', '245']]));
		expect(matcher.match(raw('À toi la gloire', GLOIRE), 'x')).toEqual({ kind: 'merge', hymnId: 'a-toi-la-gloire' });
	});

	it('only compares candidates from the title and first-line indexes', () => {
		const many = Array.from({ length: 300 }, (_, i) =>
			hymn(`h${i}`, `Chant ${i}`, [`Ligne unique numéro ${i} du chant`, 'refrain commun à tous'], [['jem', String(i)]])
		);
		const matcher = createMatcher(index(many), []);
		matcher.match(raw('À toi la gloire', GLOIRE), 'x');
		expect(matcher.stats().compared).toBe(0);
	});
});

describe('findDuplicates', () => {
	it('lists undecided pairs already in content, best first', () => {
		const atg = hymn('a-toi-la-gloire-atg-1', 'À toi la gloire', AUTRE, [['atg', '1']]);
		const pairs = findDuplicates(index([jemGloire, atg]), []);
		expect(pairs).toEqual([
			{ a: 'a-toi-la-gloire', b: 'a-toi-la-gloire-atg-1', similarity: 0, reason: 'same title' }
		]);
		const decided: MergeDecision = { a: 'a-toi-la-gloire', b: 'a-toi-la-gloire-atg-1', decision: 'distinct', date: '2026-11-11' };
		expect(findDuplicates(index([jemGloire, atg]), [decided])).toEqual([]);
	});
});
