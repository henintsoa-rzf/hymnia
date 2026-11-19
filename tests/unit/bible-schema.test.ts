import { describe, expect, it } from 'vitest';
import { BOOKS } from '$lib/bible/books';
import { BibleDataSchema, type BibleData } from '$lib/bible/schema';

/** A valid Bible: every book with its chapters, one verse each. */
function bible(): BibleData {
	return {
		translation: 'lsg1910',
		name: 'Louis Segond 1910',
		books: BOOKS.map((b) => ({
			code: b.code,
			chapters: Array.from({ length: b.chapters }, (_, i) => [`${b.name} ${i + 1}, verset 1.`])
		}))
	};
}

const issues = (data: unknown) => {
	const result = BibleDataSchema.safeParse(data);
	return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe('BibleDataSchema', () => {
	it('accepts a full Bible', () => {
		expect(issues(bible())).toEqual([]);
	});

	it('refuses a wrong book order', () => {
		const data = bible();
		[data.books[0], data.books[1]] = [data.books[1], data.books[0]];
		expect(issues(data).join()).toMatch(/GEN/);
	});

	it('refuses a missing book', () => {
		const data = bible();
		data.books.pop();
		expect(issues(data).join()).toMatch(/66/);
	});

	it('refuses a wrong chapter count', () => {
		const data = bible();
		data.books[42].chapters.push(['En trop.']);
		expect(issues(data).join()).toMatch(/JHN/);
	});

	it('refuses an empty chapter, an empty verse, markup, double spaces and non-NFC text', () => {
		for (const bad of [[], [''], ['a \\w b'], ['a  b'], ['Éternel'], [' a']]) {
			const data = bible();
			data.books[0].chapters[0] = bad;
			expect(issues(data).length, JSON.stringify(bad)).toBeGreaterThan(0);
		}
	});
});
