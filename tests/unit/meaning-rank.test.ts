import { describe, expect, it } from 'vitest';
import type { PublishedHymn } from '../../src/lib/domain/schema';
import type { MeaningData } from '../../src/lib/meaning/load';
import { rankMeaning } from '../../src/lib/meaning/rank';

const hymn = (id: string, hymnals: string[]): PublishedHymn =>
	({
		id,
		title: id,
		firstLine: id,
		sections: [{ type: 'verse', number: 1, lines: [id] }],
		credits: [],
		source: {},
		entries: hymnals.map((h) => ({ hymnal: h, number: '1', sortKey: [1] }))
	}) as unknown as PublishedHymn;

// 2 dims, unit rows: hymn 0 → rows 0 (x) and 1 (y); hymn 1 → row 2 (x+y); hymn 2 → row 3 (-x).
function data(): MeaningData {
	const s = Math.SQRT1_2;
	const rows = [
		[1, 0],
		[0, 1],
		[s, s],
		[-1, 0]
	];
	const scale = rows.map((r) => Math.max(...r.map(Math.abs)) / 127);
	return {
		configId: 'test',
		dims: 2,
		rows: 4,
		vectors: Int8Array.from(rows.flatMap((r, i) => r.map((x) => Math.round(x / scale[i])))),
		hymnIndex: Uint16Array.of(0, 0, 1, 2),
		section: Uint16Array.of(0, 1, 0, 0),
		scale: Float32Array.from(scale)
	};
}

const hymns = [hymn('a', ['ce']), hymn('b', ['he']), hymn('c', ['ce', 'he'])];

describe('rankMeaning', () => {
	it('keeps the best row per hymn, sorted by score', () => {
		const hits = rankMeaning(data(), Float32Array.of(0, 1), hymns);
		expect(hits.map((h) => [h.hymnIndex, h.section])).toEqual([
			[0, 1],
			[1, 0],
			[2, 0]
		]);
		expect(hits[0].score).toBeCloseTo(1, 2);
		expect(hits[1].score).toBeCloseTo(Math.SQRT1_2, 2);
	});

	it('drops hymns outside the allowed hymnals', () => {
		const hits = rankMeaning(data(), Float32Array.of(0, 1), hymns, { hymnals: ['he'] });
		expect(hits.map((h) => h.hymnIndex)).toEqual([1, 2]);
	});

	it('drops hymns the allow predicate rejects, together with the hymnal filter (feature 014)', () => {
		const allow = (h: number) => h !== 2;
		expect(
			rankMeaning(data(), Float32Array.of(0, 1), hymns, { allow }).map((h) => h.hymnIndex)
		).toEqual([0, 1]);
		expect(
			rankMeaning(data(), Float32Array.of(0, 1), hymns, { hymnals: ['he'], allow }).map(
				(h) => h.hymnIndex
			)
		).toEqual([1]);
	});

	it('cuts to the limit and breaks ties by catalog order', () => {
		const d = data();
		const tie = rankMeaning(d, Float32Array.of(0, 0), hymns, { limit: 2 });
		expect(tie.map((h) => h.hymnIndex)).toEqual([0, 1]);
	});

	it('refuses a query of another length', () => {
		expect(() => rankMeaning(data(), Float32Array.of(1, 0, 0), hymns)).toThrow(/dims/);
	});
});
