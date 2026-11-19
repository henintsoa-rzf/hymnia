/**
 * Feature 015, SC-003: a chapter opens in under 300 ms on a common phone. Budget in Node (warm):
 * parse the Bible and build its lookups in under 150 ms, and 1,000 chapter lookups in under 5 ms.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BOOKS } from '$lib/bible/books';
import { createBible } from '$lib/bible/bible';

const text = readFileSync(new URL('../../content/bible/lsg1910.json', import.meta.url), 'utf8');
const compact = JSON.stringify(JSON.parse(text)); // as shipped in static/data

describe('Bible load and lookup', () => {
	it('parses the shipped JSON and builds the lookups under budget', () => {
		createBible(JSON.parse(compact)); // warm up
		const times: number[] = [];
		for (let i = 0; i < 5; i++) {
			const start = performance.now();
			createBible(JSON.parse(compact));
			times.push(performance.now() - start);
		}
		const median = times.sort((a, b) => a - b)[2];
		console.log(`Bible parse: median ${median.toFixed(1)} ms`);
		expect(median).toBeLessThan(150);
	});

	it('looks up 1,000 random chapters in under 5 ms', () => {
		const bible = createBible(JSON.parse(compact));
		let seed = 42;
		const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
		const picks = Array.from({ length: 1000 }, () => {
			const book = BOOKS[Math.floor(random() * BOOKS.length)];
			return { book: book.code, chapter: 1 + Math.floor(random() * book.chapters) };
		});
		const start = performance.now();
		let verses = 0;
		for (const p of picks) verses += bible.chapter(p.book, p.chapter)?.length ?? 0;
		const took = performance.now() - start;
		expect(verses).toBeGreaterThan(0);
		expect(took).toBeLessThan(5);
	});
});
