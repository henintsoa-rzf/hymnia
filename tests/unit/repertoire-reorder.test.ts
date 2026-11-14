// Drag-and-drop ordering maths (specs/008-drag-reorder-collection/data-model.md).
import { describe, expect, it } from 'vitest';
import { dropIndex, shiftOf, type RowBox } from '$lib/repertoire/reorder';

const even: RowBox[] = [0, 50, 100, 150].map((top) => ({ top, height: 50 }));

describe('dropIndex', () => {
	it('moves down once the centre passes the next row’s midpoint', () => {
		expect(dropIndex(0, even, 25)).toBe(0);
		expect(dropIndex(0, even, 74)).toBe(0);
		expect(dropIndex(0, even, 76)).toBe(1);
		expect(dropIndex(0, even, 176)).toBe(3);
	});

	it('moves up once the centre passes the previous row’s midpoint', () => {
		expect(dropIndex(3, even, 126)).toBe(3);
		expect(dropIndex(3, even, 124)).toBe(2);
		expect(dropIndex(3, even, 20)).toBe(0);
	});

	it('clamps to the ends of the list', () => {
		expect(dropIndex(0, even, -100)).toBe(0);
		expect(dropIndex(0, even, 999)).toBe(3);
		expect(dropIndex(2, even, 999)).toBe(3);
	});

	it('uses each row’s own height', () => {
		const uneven: RowBox[] = [
			{ top: 0, height: 50 },
			{ top: 50, height: 90 },
			{ top: 140, height: 50 }
		];
		expect(dropIndex(0, uneven, 94)).toBe(0);
		expect(dropIndex(0, uneven, 96)).toBe(1);
	});

	it('handles a single row', () => {
		expect(dropIndex(0, [{ top: 0, height: 50 }], 500)).toBe(0);
	});
});

describe('shiftOf', () => {
	it('slides rows up when a row is dragged down', () => {
		expect([0, 1, 2, 3].map((i) => shiftOf(i, 1, 3))).toEqual([0, 0, -1, -1]);
	});

	it('slides rows down when a row is dragged up', () => {
		expect([0, 1, 2, 3].map((i) => shiftOf(i, 3, 1))).toEqual([0, 1, 1, 0]);
	});

	it('moves nothing when the row is at its start place', () => {
		expect([0, 1, 2, 3].map((i) => shiftOf(i, 2, 2))).toEqual([0, 0, 0, 0]);
	});
});
