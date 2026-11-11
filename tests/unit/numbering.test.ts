import { describe, expect, it } from 'vitest';
import { compareNumbers, normalizeNumber, sortKey } from '$lib/domain/numbering';

describe('sortKey and compareNumbers', () => {
	it('orders numbers numerically, then by suffix', () => {
		const shuffled = ['124', '123 bis', '10', '123a', '2', '123'];
		expect([...shuffled].sort(compareNumbers)).toEqual([
			'2',
			'10',
			'123',
			'123a',
			'123 bis',
			'124'
		]);
	});

	it('splits the numeric part and the suffix', () => {
		expect(sortKey('245')).toEqual([245, '']);
		expect(sortKey('12a')).toEqual([12, 'a']);
		expect(sortKey('12 bis')).toEqual([12, 'bis']);
		expect(sortKey('12A')).toEqual([12, 'a']);
	});

	it('puts numbers with no digits last', () => {
		expect(compareNumbers('Annexe', '999')).toBeGreaterThan(0);
	});
});

describe('normalizeNumber', () => {
	it('gives the same key for printed variants', () => {
		expect(normalizeNumber('12 bis')).toBe('12bis');
		expect(normalizeNumber('12bis')).toBe('12bis');
		expect(normalizeNumber('12A')).toBe('12a');
		expect(normalizeNumber('007')).toBe('7');
	});
});

describe('number kept as printed', () => {
	it('does not change the original value', () => {
		const n = '123 bis';
		sortKey(n);
		normalizeNumber(n);
		expect(n).toBe('123 bis');
	});
});
