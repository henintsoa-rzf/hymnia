import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createBible } from '$lib/bible/bible';

const data = JSON.parse(
	readFileSync(new URL('../../content/bible/lsg1910.json', import.meta.url), 'utf8')
);
const bible = createBible(data);

describe('createBible', () => {
	it('gives chapters and verses', () => {
		expect(bible.name).toBe('Louis Segond 1910');
		expect(bible.chapter('PSA', 23)).toHaveLength(6);
		expect(bible.verseCount('JHN', 3)).toBe(36);
		expect(bible.verseCount('JHN', 22)).toBe(0);
		expect(bible.chapter('JHN', 0)).toBeUndefined();
		expect(bible.verseText('JHN.3.16')).toMatch(/^Car Dieu a tant aimé le monde/);
		expect(bible.verseText('JHN.3.99')).toBeUndefined();
	});

	it('moves to the next and previous chapter across books', () => {
		expect(bible.next('PSA', 23)).toEqual({ book: 'PSA', chapter: 24 });
		expect(bible.next('MAL', 4)).toEqual({ book: 'MAT', chapter: 1 });
		expect(bible.previous('MAT', 1)).toEqual({ book: 'MAL', chapter: 4 });
		expect(bible.previous('GEN', 1)).toBeUndefined();
		expect(bible.next('REV', 22)).toBeUndefined();
	});
});
