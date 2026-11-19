/**
 * Shape and rules of the Bible content (specs/015-bible-verse-search, data-model.md):
 * `content/bible/lsg1910.json` (= `static/data/bible.<hash>.json`) and `content/bible/source.json`.
 */
import { z } from 'zod';
import { BOOKS, type BookCode } from './books';

export type BibleChapter = string[];
export type BibleBook = { code: BookCode; chapters: BibleChapter[] };
export type BibleData = { translation: 'lsg1910'; name: string; books: BibleBook[] };

/** Why a verse text is not acceptable, or null. */
function verseProblem(text: string): string | null {
	if (!text) return 'empty verse';
	if (text !== text.normalize('NFC')) return 'not NFC';
	if (text.includes('\\')) return 'USFM markup left';
	if (/\s{2,}/u.test(text) || text !== text.trim()) return 'extra spaces';
	return null;
}

export const BibleDataSchema = z
	.object({
		translation: z.literal('lsg1910'),
		name: z.string().min(1),
		books: z.array(
			z.object({
				code: z.string(),
				chapters: z.array(z.array(z.string()))
			})
		)
	})
	.superRefine((data, ctx) => {
		if (data.books.length !== BOOKS.length) {
			ctx.addIssue({ code: 'custom', message: `expected 66 books, got ${data.books.length}` });
			return;
		}
		data.books.forEach((book, b) => {
			const expected = BOOKS[b];
			if (book.code !== expected.code) {
				ctx.addIssue({
					code: 'custom',
					path: ['books', b, 'code'],
					message: `book ${b + 1} should be ${expected.code}, got ${book.code}`
				});
				return;
			}
			if (book.chapters.length !== expected.chapters) {
				ctx.addIssue({
					code: 'custom',
					path: ['books', b, 'chapters'],
					message: `${book.code}: expected ${expected.chapters} chapters, got ${book.chapters.length}`
				});
			}
			book.chapters.forEach((verses, c) => {
				if (verses.length === 0) {
					ctx.addIssue({
						code: 'custom',
						path: ['books', b, 'chapters', c],
						message: `${book.code} ${c + 1}: no verse`
					});
				}
				verses.forEach((text, v) => {
					const problem = verseProblem(text);
					if (problem) {
						ctx.addIssue({
							code: 'custom',
							path: ['books', b, 'chapters', c, v],
							message: `${book.code} ${c + 1}:${v + 1}: ${problem}`
						});
					}
				});
			});
		});
	}) as unknown as z.ZodType<BibleData>;

export const BibleSourceSchema = z.object({
	translation: z.literal('lsg1910'),
	name: z.string().min(1),
	rights: z.literal('public-domain'),
	edition: z.string().min(1),
	url: z.string().url(),
	retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	sha256: z.string().regex(/^[0-9a-f]{64}$/),
	dropped: z.array(z.string()),
	skipped: z.array(z.string()),
	verses: z.number().int().positive()
});

export type BibleSource = z.infer<typeof BibleSourceSchema>;
