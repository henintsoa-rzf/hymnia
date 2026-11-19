/**
 * USFM → Bible text (specs/015-bible-verse-search, research R2). Keeps book, chapter, verse and
 * the verse text, word for word. Everything the edition adds around the 1910 text is dropped:
 * introductions, section headings, parallel references, cross-references and notes. Character
 * marks (`\w`, `\wj`, `\qs`, `\it`…) lose their markup and attributes but keep their words.
 */
import { bookByCode, bookIndex, type BookCode } from '../../src/lib/bible/books';

export type ParsedBook = { code: BookCode; chapters: string[][] };

export type ParseResult = {
	books: ParsedBook[];
	/** USFM markers whose content was left out, sorted. */
	dropped: string[];
	/** Books of the archive that are not in the 66 (front matter, deuterocanon…). */
	skipped: string[];
};

/** USFM book codes outside the Protestant canon: skipped, not an error. */
const NON_CANON = new Set([
	'FRT', 'BAK', 'OTH', 'INT', 'CNC', 'GLO', 'TDX', 'NDX', 'TOB', 'JDT', 'ESG', 'WIS', 'SIR',
	'BAR', 'LJE', 'S3Y', 'SUS', 'BEL', '1MA', '2MA', '3MA', '4MA', '1ES', '2ES', 'MAN', 'PS2',
	'ODA', 'PSS', 'DAG', 'XXA', 'XXB', 'XXC', 'XXD', 'XXE', 'XXF', 'XXG'
]); // prettier-ignore

/** Paragraph and poetry markers: the marker goes, the text on the line belongs to the verse. */
const PARAGRAPH = /^(p|m|b|nb|pm|pmo|pmc|pmr|pc|pr|mi|q\d?|qm\d?|qc|qr|pi\d?|li\d?|ph\d?)$/;

/** Notes and cross-references, removed with their content. */
const NOTES = /\\(f|fe|x)\s[\s\S]*?\\\1\*/g;

function cleanVerse(raw: string): string {
	return raw
		.replace(NOTES, ' ')
		.replace(/\|[^\\]*/g, '') // attributes: \w mot|strong="H1"\w*
		.replace(/\\\+?[a-z]+\d*(\*|\s|$)/g, '') // character marks, opening and closing
		.normalize('NFC')
		.replace(/\s+/gu, ' ')
		.trim();
}

export function parseUsfmBooks(files: { name: string; text: string }[]): ParseResult {
	const dropped = new Set<string>();
	const skipped: string[] = [];
	const books: ParsedBook[] = [];

	for (const file of files) {
		const id = /^\\id\s+(\S+)/m.exec(file.text)?.[1];
		if (!id) throw new Error(`${file.name}: no \\id line`);
		if (NON_CANON.has(id)) {
			skipped.push(id);
			continue;
		}
		const book = bookByCode(id);
		if (!book) throw new Error(`${file.name}: unknown book ${id}`);
		if (books.some((b) => b.code === book.code)) throw new Error(`${id}: book given twice`);
		const code = book.code;

		const chapters: string[][] = [];
		let pieces: string[][] = []; // pieces of each verse of the current chapter
		let chapter = 0;
		let verse = 0;

		const closeChapter = () => {
			if (chapter === 0) return;
			if (pieces.length === 0) throw new Error(`${code} ${chapter}: no verse`);
			chapters.push(
				pieces.map((parts, i) => {
					const joined = parts.join(' ');
					for (const m of joined.matchAll(NOTES)) dropped.add(`\\${m[1]}`);
					const text = cleanVerse(joined);
					if (!text) throw new Error(`${code} ${chapter}:${i + 1}: empty verse`);
					return text;
				})
			);
		};

		const addText = (text: string) => {
			const parts = text.split(/\\v\s+(\S+)\s?/);
			if (parts[0].trim()) {
				if (verse === 0) throw new Error(`${code} ${chapter}: text before verse 1`);
				pieces[verse - 1].push(parts[0]);
			}
			for (let i = 1; i < parts.length; i += 2) {
				const n = Number(parts[i]);
				if (!Number.isInteger(n) || n !== verse + 1) {
					throw new Error(`${code} ${chapter}:${parts[i]}: expected verse ${verse + 1}`);
				}
				verse = n;
				pieces.push([parts[i + 1]]);
			}
		};

		for (const line of file.text.split(/\r?\n/)) {
			const match = /^\\([a-z]+\d*)\s?(.*)$/.exec(line.trim());
			const marker = match?.[1];

			if (marker === 'c') {
				closeChapter();
				const n = Number(/^\d+/.exec(match![2])?.[0]);
				if (n !== chapter + 1) throw new Error(`${code} ${n}: expected chapter ${chapter + 1}`);
				chapter = n;
				verse = 0;
				pieces = [];
				continue;
			}
			if (chapter === 0) {
				// Identification and introduction, before chapter 1.
				if (marker && marker !== 'id') dropped.add(`\\${marker}`);
				continue;
			}
			if (!match) {
				if (line.trim()) addText(line);
				continue;
			}
			if (marker === 'v') addText(line.trim());
			else if (PARAGRAPH.test(marker!)) addText(match[2]);
			else dropped.add(`\\${marker}`);
		}
		closeChapter();
		books.push({ code, chapters });
	}

	books.sort((a, b) => bookIndex(a.code) - bookIndex(b.code));
	return { books, dropped: [...dropped].sort(), skipped };
}
