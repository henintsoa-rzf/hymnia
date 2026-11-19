/**
 * Typed Bible references and reference labels (specs/015-bible-verse-search, research R5).
 * « jn 3:16 », « Jean 3,16 », « 1co13 », « I Co 13 », « ps 23 », « deut 6:4 »… Book names match
 * like hymnal names: no accents, no case, no spaces or dots (`compactKey`).
 */
import { compactKey } from '../search/normalize';
import {
	BOOKS,
	bookByCode,
	compareVerseIds,
	parseVerseId,
	type Book,
	type BookCode,
	type VerseId
} from './books';

export type Reference = { book: BookCode; chapter: number; verse?: number; adjusted: boolean };

const exact = new Map<string, Book>();
for (const book of BOOKS) {
	for (const label of [book.name, book.refName, book.slug, ...book.abbreviations]) {
		exact.set(compactKey(label), book);
	}
}
const names = BOOKS.map((book) => ({
	book,
	keys: [compactKey(book.name), compactKey(book.refName)]
}));

function findBook(text: string): Book | undefined {
	// « I Co », « II Rois »: Roman numerals before a space are book numbers.
	const arabic = text.replace(/^(i{1,3})\s+/i, (_, roman: string) => `${roman.length} `);
	const key = compactKey(arabic);
	if (!key) return undefined;
	const hit = exact.get(key);
	if (hit) return hit;
	if (key.length < 2) return undefined;
	const starts = names.filter(({ keys }) => keys.some((k) => k.startsWith(key)));
	return starts.length === 1 ? starts[0].book : undefined;
}

const PATTERN =
	/^((?:[1-3]|i{1,3})?\s*[^\d\s:,.-][^\d:,]*?)\s*(\d+)?\s*(?:[:,.]\s*(\d+)\s*(?:-\s*\d+)?)?$/iu;

/**
 * The chapter (and verse) a typed reference points to, or null for an unknown or ambiguous book.
 * Out-of-range numbers are clamped to the nearest existing chapter or verse (`adjusted`).
 * `verseCount` gives the number of verses of a chapter, so this module stays pure.
 */
export function parseReference(
	text: string,
	verseCount: (book: BookCode, chapter: number) => number
): Reference | null {
	// « 1 Cor. 13 »: a dot after a letter ends an abbreviation; after a digit it separates the verse.
	const tidy = text
		.trim()
		.replace(/[–—]/g, '-')
		.replace(/(\p{L})\.\s*/gu, '$1 ');
	const match = PATTERN.exec(tidy.trim());
	if (!match) return null;
	const book = findBook(match[1]);
	if (!book) return null;

	let chapter = match[2] === undefined ? 1 : Number(match[2]);
	let verse = match[3] === undefined ? undefined : Number(match[3]);
	// « Jude 24 »: in a one-chapter book, a single number above 1 is the verse.
	if (book.chapters === 1 && verse === undefined && chapter > 1) {
		verse = chapter;
		chapter = 1;
	}

	let adjusted = false;
	if (chapter < 1 || chapter > book.chapters) {
		chapter = Math.min(Math.max(chapter, 1), book.chapters);
		adjusted = true;
	}
	if (verse !== undefined) {
		const count = verseCount(book.code, chapter);
		if (count > 0 && (verse < 1 || verse > count)) {
			verse = Math.min(Math.max(verse, 1), count);
			adjusted = true;
		}
	}
	return verse === undefined
		? { book: book.code, chapter, adjusted }
		: { book: book.code, chapter, verse, adjusted };
}

/** Runs of consecutive verses: « 16-17, 21 ». */
function runs(verses: number[]): string {
	const parts: string[] = [];
	for (let i = 0; i < verses.length;) {
		let j = i;
		while (j + 1 < verses.length && verses[j + 1] === verses[j] + 1) j++;
		parts.push(i === j ? `${verses[i]}` : `${verses[i]}-${verses[j]}`);
		i = j + 1;
	}
	return parts.join(', ');
}

/**
 * The label of a set of verses, in Bible order: « Psaume 23:1-4 ; Jean 3:16-17, 21 ».
 * Chapters of the same book after the first omit the book name: « Jean 3:36 ; 4:1 ».
 */
export function formatLabel(ids: VerseId[]): string {
	const sorted = [...new Set(ids)].filter((id) => parseVerseId(id)).sort(compareVerseIds);
	const groups: { book: BookCode; chapter: number; verses: number[] }[] = [];
	for (const id of sorted) {
		const ref = parseVerseId(id)!;
		const last = groups.at(-1);
		if (last && last.book === ref.book && last.chapter === ref.chapter) last.verses.push(ref.verse);
		else groups.push({ book: ref.book, chapter: ref.chapter, verses: [ref.verse] });
	}
	return groups
		.map((g, i) => {
			const sameBook = i > 0 && groups[i - 1].book === g.book;
			const place = `${g.chapter}:${runs(g.verses)}`;
			return sameBook ? place : `${bookByCode(g.book)!.refName} ${place}`;
		})
		.join(' ; ');
}
