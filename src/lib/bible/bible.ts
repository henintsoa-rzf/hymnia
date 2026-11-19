/**
 * Lookups in the Bible text (specs/015-bible-verse-search, data-model.md). Pure, so the screens
 * and the Node tests share it.
 */
import { BOOKS, bookByCode, bookIndex, parseVerseId, type BookCode, type VerseId } from './books';
import type { BibleData } from './schema';

export type ChapterRef = { book: BookCode; chapter: number };

export type Bible = {
	name: string;
	/** Verse texts of a chapter ([0] is verse 1), or undefined. */
	chapter(book: BookCode, chapter: number): string[] | undefined;
	/** Number of verses of a chapter, 0 when it does not exist. */
	verseCount(book: BookCode, chapter: number): number;
	verseText(id: VerseId): string | undefined;
	/** The next chapter, across books; undefined after Apocalypse 22. */
	next(book: BookCode, chapter: number): ChapterRef | undefined;
	/** The previous chapter, across books; undefined before Genèse 1. */
	previous(book: BookCode, chapter: number): ChapterRef | undefined;
};

export function createBible(data: BibleData): Bible {
	const chapters = new Map(data.books.map((b) => [b.code, b.chapters]));
	const chapter = (book: BookCode, n: number) => chapters.get(book)?.[n - 1];

	return {
		name: data.name,
		chapter,
		verseCount: (book, n) => chapter(book, n)?.length ?? 0,
		verseText(id) {
			const ref = parseVerseId(id);
			return ref ? chapter(ref.book, ref.chapter)?.[ref.verse - 1] : undefined;
		},
		next(book, n) {
			const current = bookByCode(book);
			if (!current) return undefined;
			if (n < current.chapters) return { book, chapter: n + 1 };
			const following = BOOKS[bookIndex(book) + 1];
			return following ? { book: following.code, chapter: 1 } : undefined;
		},
		previous(book, n) {
			if (!bookByCode(book)) return undefined;
			if (n > 1) return { book, chapter: n - 1 };
			const before = BOOKS[bookIndex(book) - 1];
			return before ? { book: before.code, chapter: before.chapters } : undefined;
		}
	};
}
