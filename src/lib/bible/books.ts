/**
 * The 66 books of the Bible in Protestant canonical order, with their French names and usual
 * abbreviations (specs/015-bible-verse-search, research R5, data-model.md "Book table").
 * Static code, not data: the books never change. Chapter counts follow Louis Segond 1910
 * numbering (Joël 3, Malachie 4).
 */

export const BOOK_CODES = [
	'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH',
	'2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK',
	'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
	'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH',
	'2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD',
	'REV'
] as const; // prettier-ignore

export type BookCode = (typeof BOOK_CODES)[number];

export type Book = {
	code: BookCode;
	/** URL segment: French name, lower case, no accents, spaces as hyphens. */
	slug: string;
	/** Display name: « 1 Corinthiens ». */
	name: string;
	/** Name in references: « Psaume 23 » (singular for the Psalms). */
	refName: string;
	/** Usual French abbreviations and common variants. */
	abbreviations: string[];
	testament: 'AT' | 'NT';
	chapters: number;
};

type Row = [BookCode, string, string, number, string[], string?];

// code, slug, name, chapters, abbreviations, refName (when different from name)
const ROWS: Row[] = [
	['GEN', 'genese', 'Genèse', 50, ['Gn', 'Ge', 'Gen']],
	['EXO', 'exode', 'Exode', 40, ['Ex', 'Exo']],
	['LEV', 'levitique', 'Lévitique', 27, ['Lv', 'Lé', 'Lev']],
	['NUM', 'nombres', 'Nombres', 36, ['Nb', 'No', 'Nom']],
	['DEU', 'deuteronome', 'Deutéronome', 34, ['Dt', 'De', 'Deut']],
	['JOS', 'josue', 'Josué', 24, ['Jos']],
	['JDG', 'juges', 'Juges', 21, ['Jg', 'Jug']],
	['RUT', 'ruth', 'Ruth', 4, ['Rt', 'Ru']],
	['1SA', '1-samuel', '1 Samuel', 31, ['1 S', '1 Sa', '1 Sam']],
	['2SA', '2-samuel', '2 Samuel', 24, ['2 S', '2 Sa', '2 Sam']],
	['1KI', '1-rois', '1 Rois', 22, ['1 R', '1 Ro']],
	['2KI', '2-rois', '2 Rois', 25, ['2 R', '2 Ro']],
	['1CH', '1-chroniques', '1 Chroniques', 29, ['1 Ch', '1 Chr']],
	['2CH', '2-chroniques', '2 Chroniques', 36, ['2 Ch', '2 Chr']],
	['EZR', 'esdras', 'Esdras', 10, ['Esd']],
	['NEH', 'nehemie', 'Néhémie', 13, ['Né', 'Ne', 'Néh']],
	['EST', 'esther', 'Esther', 10, ['Est']],
	['JOB', 'job', 'Job', 42, ['Jb']],
	['PSA', 'psaumes', 'Psaumes', 150, ['Ps', 'Psa', 'Psaume'], 'Psaume'],
	['PRO', 'proverbes', 'Proverbes', 31, ['Pr', 'Pro', 'Prov']],
	['ECC', 'ecclesiaste', 'Ecclésiaste', 12, ['Ec', 'Ecc', 'Qo']],
	['SNG', 'cantique-des-cantiques', 'Cantique des cantiques', 8, ['Ct', 'Ca', 'Cant', 'Cantique']],
	['ISA', 'esaie', 'Ésaïe', 66, ['És', 'Es', 'Is', 'Isaïe']],
	['JER', 'jeremie', 'Jérémie', 52, ['Jr', 'Jé', 'Jer']],
	['LAM', 'lamentations', 'Lamentations', 5, ['Lm', 'La', 'Lam']],
	['EZK', 'ezekiel', 'Ézékiel', 48, ['Éz', 'Ez', 'Ézé', 'Ézéchiel']],
	['DAN', 'daniel', 'Daniel', 12, ['Dn', 'Da', 'Dan']],
	['HOS', 'osee', 'Osée', 14, ['Os']],
	['JOL', 'joel', 'Joël', 3, ['Jl', 'Joë']],
	['AMO', 'amos', 'Amos', 9, ['Am']],
	['OBA', 'abdias', 'Abdias', 1, ['Ab', 'Abd']],
	['JON', 'jonas', 'Jonas', 4, ['Jon']],
	['MIC', 'michee', 'Michée', 7, ['Mi', 'Mic']],
	['NAM', 'nahum', 'Nahum', 3, ['Na', 'Nah']],
	['HAB', 'habacuc', 'Habacuc', 3, ['Ha', 'Hab']],
	['ZEP', 'sophonie', 'Sophonie', 3, ['So', 'Soph']],
	['HAG', 'aggee', 'Aggée', 2, ['Ag', 'Agg']],
	['ZEC', 'zacharie', 'Zacharie', 14, ['Za', 'Zac', 'Zach']],
	['MAL', 'malachie', 'Malachie', 4, ['Ml', 'Mal']],
	['MAT', 'matthieu', 'Matthieu', 28, ['Mt', 'Mat', 'Matt']],
	['MRK', 'marc', 'Marc', 16, ['Mc', 'Mr', 'Marc']],
	['LUK', 'luc', 'Luc', 24, ['Lc', 'Lu']],
	['JHN', 'jean', 'Jean', 21, ['Jn']],
	['ACT', 'actes', 'Actes', 28, ['Ac', 'Act', 'Actes des apôtres']],
	['ROM', 'romains', 'Romains', 16, ['Rm', 'Ro', 'Rom']],
	['1CO', '1-corinthiens', '1 Corinthiens', 16, ['1 Co', '1 Cor']],
	['2CO', '2-corinthiens', '2 Corinthiens', 13, ['2 Co', '2 Cor']],
	['GAL', 'galates', 'Galates', 6, ['Ga', 'Gal']],
	['EPH', 'ephesiens', 'Éphésiens', 6, ['Ép', 'Ep', 'Éph', 'Eph']],
	['PHP', 'philippiens', 'Philippiens', 4, ['Ph', 'Phil', 'Php']],
	['COL', 'colossiens', 'Colossiens', 4, ['Col']],
	['1TH', '1-thessaloniciens', '1 Thessaloniciens', 5, ['1 Th', '1 Thes', '1 Thess']],
	['2TH', '2-thessaloniciens', '2 Thessaloniciens', 3, ['2 Th', '2 Thes', '2 Thess']],
	['1TI', '1-timothee', '1 Timothée', 6, ['1 Tm', '1 Ti', '1 Tim']],
	['2TI', '2-timothee', '2 Timothée', 4, ['2 Tm', '2 Ti', '2 Tim']],
	['TIT', 'tite', 'Tite', 3, ['Tt', 'Tit']],
	['PHM', 'philemon', 'Philémon', 1, ['Phm', 'Phlm']],
	['HEB', 'hebreux', 'Hébreux', 13, ['Hé', 'He', 'Héb', 'Heb']],
	['JAS', 'jacques', 'Jacques', 5, ['Jc', 'Ja', 'Jac']],
	['1PE', '1-pierre', '1 Pierre', 5, ['1 P', '1 Pi', '1 Pie']],
	['2PE', '2-pierre', '2 Pierre', 3, ['2 P', '2 Pi', '2 Pie']],
	['1JN', '1-jean', '1 Jean', 5, ['1 Jn']],
	['2JN', '2-jean', '2 Jean', 1, ['2 Jn']],
	['3JN', '3-jean', '3 Jean', 1, ['3 Jn']],
	['JUD', 'jude', 'Jude', 1, ['Jud', 'Jd']],
	['REV', 'apocalypse', 'Apocalypse', 22, ['Ap', 'Apo', 'Apoc']]
];

const NT_START = BOOK_CODES.indexOf('MAT');

export const BOOKS: readonly Book[] = ROWS.map(([code, slug, name, chapters, abbr, refName]) => ({
	code,
	slug,
	name,
	refName: refName ?? name,
	abbreviations: abbr,
	testament: BOOK_CODES.indexOf(code) >= NT_START ? 'NT' : 'AT',
	chapters
}));

const byCode = new Map(BOOKS.map((b) => [b.code, b]));
const bySlug = new Map(BOOKS.map((b) => [b.slug, b]));
const order = new Map(BOOKS.map((b, i) => [b.code, i]));

export const bookByCode = (code: string): Book | undefined => byCode.get(code as BookCode);
export const bookBySlug = (slug: string): Book | undefined => bySlug.get(slug);
export const bookIndex = (code: BookCode): number => order.get(code) ?? -1;

/* ------------------------------------------------------------ verse ids */

/** `"JHN.3.16"` (data-model.md, Identifiers). */
export type VerseId = string;

export const verseId = (code: BookCode, chapter: number, verse: number): VerseId =>
	`${code}.${chapter}.${verse}`;

export type VerseRef = { book: BookCode; chapter: number; verse: number };

export function parseVerseId(id: string): VerseRef | undefined {
	const match = /^([1-3A-Z]{3})\.(\d+)\.(\d+)$/.exec(id);
	if (!match) return undefined;
	const book = bookByCode(match[1]);
	const chapter = Number(match[2]);
	const verse = Number(match[3]);
	if (!book || chapter < 1 || chapter > book.chapters || verse < 1) return undefined;
	return { book: book.code, chapter, verse };
}

/** Bible order: book order, then chapter, then verse. Unknown ids sort last. */
export function compareVerseIds(a: VerseId, b: VerseId): number {
	const x = parseVerseId(a);
	const y = parseVerseId(b);
	if (!x || !y) return x ? -1 : y ? 1 : 0;
	return bookIndex(x.book) - bookIndex(y.book) || x.chapter - y.chapter || x.verse - y.verse;
}
