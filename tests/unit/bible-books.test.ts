import { describe, expect, it } from 'vitest';
import {
	BOOKS,
	bookByCode,
	bookBySlug,
	compareVerseIds,
	parseVerseId,
	verseId
} from '$lib/bible/books';
import { compactKey } from '$lib/search/normalize';

describe('book table', () => {
	it('has the 66 books, 39 in the AT and 27 in the NT', () => {
		expect(BOOKS).toHaveLength(66);
		expect(BOOKS.filter((b) => b.testament === 'AT')).toHaveLength(39);
		expect(BOOKS.filter((b) => b.testament === 'NT')).toHaveLength(27);
		expect(BOOKS[0].code).toBe('GEN');
		expect(BOOKS[39].code).toBe('MAT');
		expect(BOOKS[65].code).toBe('REV');
	});

	it('has 1,189 chapters, with Louis Segond counts', () => {
		expect(BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
		expect(bookByCode('PSA')?.chapters).toBe(150);
		expect(bookByCode('MAL')?.chapters).toBe(4);
		expect(bookByCode('JOL')?.chapters).toBe(3);
		expect(bookByCode('OBA')?.chapters).toBe(1);
		expect(bookByCode('REV')?.chapters).toBe(22);
	});

	it('has unique codes and slugs', () => {
		expect(new Set(BOOKS.map((b) => b.code)).size).toBe(66);
		expect(new Set(BOOKS.map((b) => b.slug)).size).toBe(66);
		for (const b of BOOKS) expect(b.slug).toMatch(/^[1-3]?-?[a-z]+(-[a-z]+)*$/);
	});

	it('never gives two books the same name or abbreviation key', () => {
		const owner = new Map<string, string>();
		for (const b of BOOKS) {
			for (const label of [b.name, b.refName, ...b.abbreviations]) {
				const key = compactKey(label);
				const other = owner.get(key);
				expect(other === undefined || other === b.code, `${label}: ${other} / ${b.code}`).toBe(
					true
				);
				owner.set(key, b.code);
			}
		}
	});

	it('finds books by code and slug', () => {
		expect(bookByCode('1CO')?.name).toBe('1 Corinthiens');
		expect(bookBySlug('psaumes')?.refName).toBe('Psaume');
		expect(bookBySlug('cantique-des-cantiques')?.code).toBe('SNG');
		expect(bookByCode('XXX')).toBeUndefined();
		expect(bookBySlug('nope')).toBeUndefined();
	});
});

describe('verse ids', () => {
	it('builds and parses ids', () => {
		expect(verseId('JHN', 3, 16)).toBe('JHN.3.16');
		expect(parseVerseId('1CO.13.4')).toEqual({ book: '1CO', chapter: 13, verse: 4 });
		expect(parseVerseId('JHN.22.1')).toBeUndefined();
		expect(parseVerseId('JHN.0.1')).toBeUndefined();
		expect(parseVerseId('XXX.1.1')).toBeUndefined();
		expect(parseVerseId('JHN-3-16')).toBeUndefined();
	});

	it('sorts in Bible order', () => {
		expect(compareVerseIds('PSA.23.1', 'JHN.3.16')).toBeLessThan(0);
		expect(compareVerseIds('JHN.3.16', 'JHN.3.2')).toBeGreaterThan(0);
		expect(compareVerseIds('JHN.4.1', 'JHN.3.36')).toBeGreaterThan(0);
		expect(compareVerseIds('GEN.1.1', 'GEN.1.1')).toBe(0);
		const ids = ['REV.22.21', 'GEN.1.1', 'ROM.8.38', 'PSA.23.1'];
		expect(ids.sort(compareVerseIds)).toEqual(['GEN.1.1', 'PSA.23.1', 'ROM.8.38', 'REV.22.21']);
	});
});
