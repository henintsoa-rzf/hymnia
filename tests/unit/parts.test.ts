import { describe, expect, it } from 'vitest';
import { sortKey } from '$lib/domain/numbering';
import { groupByPart } from '$lib/domain/parts';

const parts = [
	{ name: 'JEM 1', first: 1 },
	{ name: 'JEM 2', first: 372 },
	{ name: 'JEM 3', first: 722 }
];
const group = (numbers: string[], p = parts) =>
	groupByPart(numbers, p, sortKey).map((g) => [g.part?.name, g.items]);

describe('groupByPart', () => {
	it('puts each number in the last part that starts at or before it', () => {
		expect(group(['1', '371', '371a', '372', '900'])).toEqual([
			['JEM 1', ['1', '371', '371a']],
			['JEM 2', ['372']],
			['JEM 3', ['900']]
		]);
	});

	it('leaves out parts with no entries', () => {
		expect(group(['1', '722'])).toEqual([
			['JEM 1', ['1']],
			['JEM 3', ['722']]
		]);
	});

	it('keeps numbers before the first part first, and unnumbered entries last, with no part', () => {
		const p = [{ name: 'Souffle de vie', first: 100 }];
		expect(group(['5', '101', 'Final'], p)).toEqual([
			[undefined, ['5']],
			['Souffle de vie', ['101']],
			[undefined, ['Final']]
		]);
	});

	it('makes one group with no part for a hymnal without parts', () => {
		expect(group(['1', '2'], [])).toEqual([[undefined, ['1', '2']]]);
		expect(groupByPart([], undefined, sortKey)).toEqual([]);
	});
});
