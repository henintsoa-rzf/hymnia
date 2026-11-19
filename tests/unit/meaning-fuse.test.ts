import { describe, expect, it } from 'vitest';
import { fuse, meaningExcerpt, type MeaningCandidate } from '../../src/lib/meaning/fuse';
import type { SearchResult, Tier } from '../../src/lib/search/types';

const res = (hymnId: string, tier: Tier, excerpt?: string): SearchResult => ({
	hymnId,
	title: hymnId.toUpperCase(),
	refs: [{ hymnal: 'ce', hymnalAbbr: 'CE', number: '1' }],
	primaryRef: { hymnal: 'ce', number: '1' },
	tier,
	...(excerpt ? { excerpt: { text: excerpt, highlights: [[0, 1]] as [number, number][] } } : {})
});

const cand = (hymnId: string, matchedSection = 2): MeaningCandidate => ({
	result: res(hymnId, 6),
	excerpt: { text: `stanza of ${hymnId}`, highlights: [] },
	matchedSection
});

const fusion = { k: 60, wMeaning: 1, wWords: 1 };

describe('fuse', () => {
	it('puts exact titles first, in word order', () => {
		const words = [res('t1', 2), res('w', 5, 'w line'), res('t2', 2)];
		const out = fuse({ meaning: [cand('m'), cand('t2')], words, fusion, limit: 50 });
		expect(out.slice(0, 2).map((r) => r.hymnId)).toEqual(['t1', 't2']);
		expect(out[1].matchedBy).toBe('both');
		expect(out[0].matchedBy).toBe('words');
	});

	it('sorts the rest by weighted reciprocal rank, ties by meaning rank', () => {
		// both: 1/63 + 1/61; m1: 1/61; m2 and w2: 1/62, tie broken by meaning rank.
		const words = [res('both', 5, 'b'), res('w2', 5, 'w')];
		const out = fuse({ meaning: [cand('m1'), cand('m2'), cand('both')], words, fusion, limit: 50 });
		expect(out.map((r) => r.hymnId)).toEqual(['both', 'm1', 'm2', 'w2']);
		// m1 (meaning 1) and a words-only hit at rank 1 tie: meaning rank wins.
		const tie = fuse({ meaning: [cand('m1')], words: [res('w1', 5, 'x')], fusion, limit: 50 });
		expect(tie.map((r) => r.hymnId)).toEqual(['m1', 'w1']);
	});

	it('lists a hymn found both ways once, matched by both', () => {
		const out = fuse({ meaning: [cand('x')], words: [res('x', 3)], fusion, limit: 50 });
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ hymnId: 'x', tier: 3, matchedBy: 'both' });
	});

	it('gives meaning-only hits tier 6 and the stanza excerpt', () => {
		const [hit] = fuse({ meaning: [cand('m')], words: [], fusion, limit: 50 });
		expect(hit).toMatchObject({ tier: 6, matchedBy: 'meaning' });
		expect(hit.excerpt).toEqual({ text: 'stanza of m', highlights: [] });
	});

	it('takes the excerpt from the source with the larger term', () => {
		// Words rank 1 (1/61) beats meaning rank 2 (1/62): word excerpt.
		const a = fuse({
			meaning: [cand('z'), cand('x')],
			words: [res('x', 5, 'word')],
			fusion,
			limit: 50
		});
		expect(a.find((r) => r.hymnId === 'x')!.excerpt!.text).toBe('word');
		// Meaning rank 1 beats words rank 2: meaning excerpt.
		const b = fuse({
			meaning: [cand('x')],
			words: [res('z', 5, 'z'), res('x', 5, 'word')],
			fusion,
			limit: 50
		});
		expect(b.find((r) => r.hymnId === 'x')!.excerpt!.text).toBe('stanza of x');
	});

	// Feature 013: the stanza is carried only when the list shows its excerpt.
	describe('matchedSection', () => {
		it('is set on a meaning-only result', () => {
			const [hit] = fuse({ meaning: [cand('m', 4)], words: [], fusion, limit: 50 });
			expect(hit.matchedSection).toBe(4);
		});

		it('is set on a result found both ways when the meaning excerpt wins', () => {
			const out = fuse({
				meaning: [cand('x', 3)],
				words: [res('z', 5, 'z'), res('x', 5, 'word')],
				fusion,
				limit: 50
			});
			const x = out.find((r) => r.hymnId === 'x')!;
			expect(x.excerpt!.text).toBe('stanza of x');
			expect(x.matchedSection).toBe(3);
		});

		it('is absent when the word excerpt wins', () => {
			const out = fuse({
				meaning: [cand('z'), cand('x')],
				words: [res('x', 5, 'word')],
				fusion,
				limit: 50
			});
			const x = out.find((r) => r.hymnId === 'x')!;
			expect(x.excerpt!.text).toBe('word');
			expect(x).not.toHaveProperty('matchedSection');
		});

		it('is set when words win but have no excerpt, so the stanza is shown', () => {
			const out = fuse({
				meaning: [cand('z'), cand('x', 1)],
				words: [res('x', 3)],
				fusion,
				limit: 50
			});
			const x = out.find((r) => r.hymnId === 'x')!;
			expect(x.excerpt!.text).toBe('stanza of x');
			expect(x.matchedSection).toBe(1);
		});

		it('is absent on a words-only result', () => {
			const out = fuse({ meaning: [cand('m')], words: [res('w', 5, 'w')], fusion, limit: 50 });
			expect(out.find((r) => r.hymnId === 'w')).not.toHaveProperty('matchedSection');
		});
	});

	it('cuts to the limit', () => {
		const out = fuse({
			meaning: ['a', 'b', 'c'].map(cand),
			words: [res('d', 5, 'd')],
			fusion,
			limit: 2
		});
		expect(out).toHaveLength(2);
	});
});

describe('meaningExcerpt', () => {
	it('keeps the first 2 lines, at most 160 characters, with no highlights', () => {
		expect(meaningExcerpt(['Un', 'Deux', 'Trois'])).toEqual({ text: 'Un / Deux', highlights: [] });
		const long = meaningExcerpt(['a'.repeat(100), 'b'.repeat(100)]);
		expect(long.text.length).toBeLessThanOrEqual(160);
		expect(long.text.endsWith('…')).toBe(true);
	});
});
