/**
 * Adapter for psalmodie.ch (`psalmodie`), the site of the Chorale Psalmodie. Page structure and
 * selectors: tests/import/fixtures/psalmodie/README.md.
 *
 * - The site is not a hymnal: it publishes the lyrics of each concert programme on one page
 *   (`/paroles-du-programme-<slug>/`), one `h3` per song, then `p` paragraphs with `<br>` lines.
 * - Songs are numbered inside a programme on some pages ("1. Titre", "15’ / Titre") and not at
 *   all on others. Each programme gets a block of 100 numbers (`first`): entry number =
 *   `first` + printed number, or `first` + position on the page for unnumbered programmes.
 * - An entry's URL is the programme page plus `#chant-<i>`, the position of its `h3`. The
 *   fragment is never sent to the site; `parseHymn` uses it to find the song on the page.
 * - Section labels ("Refrain :", "Pont :"), repeat markers ("Refrain") and verse numbers
 *   ("1. ") are markup: removed and counted. Credits are labelled ("Paroles et musique :",
 *   "Adaptation française :", "Texte :", "Musique :").
 */
import { load, type CheerioAPI } from 'cheerio';
import type { CreditRole, Section } from '../../../src/lib/domain/schema';
import { cleanLine, mapCreditRole } from './clean';
import { registerAdapter } from './index';
import type { EntryRef, ParseResult, SourceAdapter } from './types';

export const PSALMODIE_BASE = 'https://psalmodie.ch';

export type Programme = {
	/** Page slug: `${PSALMODIE_BASE}/<slug>/`. */
	slug: string;
	/** Entry number = first + song number (1–99). */
	first: number;
	/** `printed`: the number written before the title; `position`: the order on the page. */
	numbering: 'printed' | 'position';
};

/**
 * Hymnal id → programmes, oldest first. Block 200 is "Paul" (2000), a musical with spoken
 * parts and speaker labels: not imported, by the maintainer's decision (research R13).
 */
export const PSALMODIE_PROGRAMMES: Record<string, Programme[]> = {
	psalmodie: [
		{ slug: 'paroles-du-programme-souffle-de-vie', first: 100, numbering: 'printed' },
		{ slug: 'paroles-du-programme-certitudes', first: 300, numbering: 'printed' },
		{ slug: 'paroles-du-programme-moments-deternite', first: 400, numbering: 'position' },
		{ slug: 'paroles-du-programme-ouvre-mes-yeux', first: 500, numbering: 'position' },
		{ slug: 'paroles-du-programme-te-rencontrer', first: 600, numbering: 'position' },
		{ slug: 'paroles-du-programme-parce-quil-vit', first: 700, numbering: 'printed' }
	]
};

export const programmeUrl = (slug: string) => `${PSALMODIE_BASE}/${slug}/`;

/** "1.   Titre", "15’ / Titre", "A.   Acte" (a letter: not a song number). */
const PRINTED_NUMBER = /^(\d+)([’']?)\s*[./]\s*/u;

type Line = { text: string; italic: boolean };
type Token = { kind: 'heading'; text: string } | { kind: 'line'; line: Line } | { kind: 'break' };
type Node = Parameters<CheerioAPI>[0];

/**
 * The page content as a flat list: song headings, lines (with whether they are all in
 * italics) and paragraph breaks. Some headings wrap a stray `<p>`; their whole text counts.
 */
function tokenize($: CheerioAPI, root: Node): Token[] {
	const tokens: Token[] = [];
	let text = '';
	let plain = false;
	const endLine = () => {
		const line = cleanLine(text);
		if (line === '') tokens.push({ kind: 'break' });
		else tokens.push({ kind: 'line', line: { text: line, italic: !plain } });
		text = '';
		plain = false;
	};
	const walk = (node: Node, italic: boolean) => {
		$(node)
			.contents()
			.each((_, child) => {
				if (child.type === 'text') {
					text += child.data;
					if (!italic && child.data.trim() !== '') plain = true;
					return;
				}
				if (child.type !== 'tag') return;
				const tag = child.tagName.toLowerCase();
				if (tag === 'h3') {
					if (text.trim() !== '') endLine();
					tokens.push({ kind: 'heading', text: cleanLine($(child).text()) });
				} else if (tag === 'br') {
					endLine();
				} else if (tag === 'p' || tag === 'div' || /^h\d$/u.test(tag)) {
					if (text.trim() !== '') endLine();
					tokens.push({ kind: 'break' });
					walk(child, italic);
					if (text.trim() !== '') endLine();
					tokens.push({ kind: 'break' });
				} else if (tag !== 'script' && tag !== 'style' && tag !== 'iframe') {
					walk(child, italic || tag === 'em' || tag === 'i');
				}
			});
	};
	walk(root, false);
	if (text.trim() !== '') endLine();
	return tokens;
}

function contentOf(html: string) {
	const $ = load(html);
	const content = $('article .entry-content').first();
	return content.length === 0 ? null : tokenize($, content[0]);
}

const SECTION_LABEL =
	/^((?:derniers? )?refrains?|pré-refrain|pre-refrain|pont|bridge|chœur|choeur|coda|final|intro)(?!\p{L})\s*(\d*)\s*(?:(:)\s*(.*))?$/iu;

function sectionType(label: string): Section['type'] {
	const text = label.toLowerCase();
	if (/^((derniers? )?refrains?|chœur|choeur)$/u.test(text)) return 'chorus';
	if (/^(pont|bridge)$/u.test(text)) return 'bridge';
	return 'other';
}

const VERSE_NUMBER = /^(\d+)\.\s+(?=\S)/u;
const CREDIT = /^([^:]{2,40}?)\s*:\s*(.+)$/u;

/** Roles of a credit label ("Paroles et musique" → lyrics, music); null when one is unknown. */
function creditRoles(label: string): CreditRole[] | null {
	const roles: CreditRole[] = [];
	for (const part of label.split(/\s*(?:,|\bet\b|&|\/)\s*/u).filter(Boolean)) {
		const role = mapCreditRole(part);
		if (!role) return null;
		if (!roles.includes(role)) roles.push(role);
	}
	return roles.length > 0 ? roles : null;
}

/** "Samuel et Frédérique Jaccard" stays one name; "Etienne Demaurex et Marc Varidel" is two. */
function splitNames(value: string): string[] {
	const names: string[] = [];
	for (const part of value.split(/\s*,\s*/u)) {
		const pair = part.split(/\s+(?:et|&)\s+/u);
		if (pair.length > 1 && pair.every((p) => p.trim().split(/\s+/u).length >= 2)) {
			names.push(...pair);
		} else {
			names.push(part);
		}
	}
	return names;
}

type Credits = { credits: { name: string; role: CreditRole }[]; unknown: string[] };

/** One credit line; returns false when it is not one. */
function addCredit(line: string, out: Credits): boolean {
	if (line.startsWith('©')) return true;
	const m = CREDIT.exec(line);
	const roles = m ? creditRoles(m[1]) : null;
	if (!m || !roles) return false;
	// "Marc Varidel (d'après le Symbole des apôtres)": the note is not part of the name.
	const value = cleanLine(m[2].replace(/\([^)]*\)?/gu, ' '));
	// "La Bible, Jean 3.16": a reference, kept whole.
	const names = /^la bible\b/iu.test(value) ? [value] : splitNames(value);
	let current = roles;
	for (const raw of names) {
		// "Peter Strauch, trad. Etienne Demaurex": the translators follow "trad.".
		const trad = /^trad(?:uction)?\.?\s*:?\s*/iu.exec(raw);
		if (trad) current = ['translation'];
		const name = cleanLine(raw.slice(trad ? trad[0].length : 0));
		// "Marc Dirlewanger, 2000 et 2009": dates are not names.
		if (!/\p{L}/u.test(name.replace(/\bet\b/gu, ''))) continue;
		for (const role of current) {
			if (!out.credits.some((c) => c.name === name && c.role === role)) {
				out.credits.push({ name, role });
			}
		}
	}
	return true;
}

export function parsePsalmodieHymn(html: string, ref: EntryRef): ParseResult {
	const tokens = contentOf(html);
	const headings = tokens?.filter((t) => t.kind === 'heading') ?? [];
	if (!tokens || headings.length === 0) return { ok: false, reason: 'no lyrics block' };

	const position = Number(/#chant-(\d+)$/u.exec(ref.url)?.[1] ?? 0);
	if (position === 0) return { ok: false, reason: 'no song position in the URL' };
	const heading = headings[position - 1];
	if (!heading || heading.kind !== 'heading') return { ok: false, reason: 'no song at this position' };

	const title = cleanLine(heading.text.replace(PRINTED_NUMBER, ''));
	if (!title) return { ok: false, reason: 'no title' };

	const start = tokens.indexOf(heading) + 1;
	const next = tokens.findIndex((t, i) => i >= start && t.kind === 'heading');
	const body = tokens.slice(start, next === -1 ? undefined : next);

	// Paragraphs of lines; empty lines and `&nbsp;` paragraphs separate them.
	const paragraphs: Line[][] = [];
	let para: Line[] = [];
	for (const t of body) {
		if (t.kind === 'line') para.push(t.line);
		else if (para.length > 0) {
			paragraphs.push(para);
			para = [];
		}
	}
	if (para.length > 0) paragraphs.push(para);

	const strippedMarkup: Record<string, number> = {};
	const count = (kind: string) => (strippedMarkup[kind] = (strippedMarkup[kind] ?? 0) + 1);
	const credits: Credits = { credits: [], unknown: [] };

	const isLabel = (line: string) => SECTION_LABEL.test(line);
	const numbered = paragraphs.some((p) => p.some((l) => VERSE_NUMBER.test(l.text)));

	const sections: Section[] = [];
	let open: Section | null = null;
	let verses = 0;
	let inCredits = false;
	const begin = (type: Section['type'], number: number | null = null): Section => {
		if (type === 'verse' && number === null && !numbered) number = ++verses;
		open = { type, number, lines: [] };
		sections.push(open);
		return open;
	};

	for (const lines of paragraphs) {
		for (const [i, { text, italic }] of lines.entries()) {
			const first = i === 0;
			if (inCredits || addCredit(text, credits)) {
				// Everything after the first credit line is the credits block.
				if (inCredits && !addCredit(text, credits)) credits.unknown.push(text);
				inCredits = true;
				continue;
			}
			const label = SECTION_LABEL.exec(text);
			if (label) {
				const [, name, , colon, rest = ''] = label;
				// "Refrain" alone is a header only when lines follow it in the same paragraph.
				const following = lines[i + 1];
				const header = colon !== undefined || (following && !isLabel(following.text));
				if (!header) {
					// "Refrain" alone: the chorus is sung again; it is written once (rule 3).
					count('repeat-marker');
					open = null;
					continue;
				}
				count('section-label');
				const section = begin(sectionType(name));
				if (rest) section.lines.push(rest);
				continue;
			}
			const verse = VERSE_NUMBER.exec(text);
			if (verse) {
				count('verse-number');
				begin('verse', Number(verse[1])).lines.push(text.slice(verse[0].length));
				continue;
			}
			const current = open as Section | null;
			// A chorus in italics may span several paragraphs; in a song with numbered verses, an
			// unnumbered paragraph goes on with the verse or bridge before it.
			const goesOn =
				current !== null &&
				(!first ||
					(current.type === 'chorus' && italic) ||
					(current.type !== 'chorus' && numbered && !italic));
			// In a song with numbered verses, an unnumbered paragraph that starts a section is not
			// called a verse by the source.
			(goesOn ? current : begin(numbered ? 'other' : 'verse')).lines.push(text);
		}
	}

	const filled = sections.filter((s) => s.lines.length > 0);
	if (filled.length === 0) return { ok: false, reason: 'no lyrics' };

	return {
		ok: true,
		hymn: {
			source: 'psalmodie',
			hymnal: ref.hymnal,
			number: ref.number,
			url: ref.url,
			title,
			sections: filled,
			credits: credits.credits,
			strippedMarkup,
			unknownCredits: credits.unknown
		}
	};
}

/** (number, URL) pairs of one programme page. */
export function parseProgramme(
	html: string,
	hymnal: string,
	programme: Programme,
	log: (message: string) => void
): EntryRef[] {
	const headings = (contentOf(html) ?? []).filter((t) => t.kind === 'heading');
	const page = programmeUrl(programme.slug);
	const entries: EntryRef[] = [];
	headings.forEach((heading, i) => {
		const position = i + 1;
		let n: number;
		let suffix = '';
		if (programme.numbering === 'position') {
			n = position;
		} else {
			const printed = PRINTED_NUMBER.exec(heading.text);
			if (!printed) {
				log(`${hymnal}: "${heading.text}" (${page}) has no number on the page: skipped`);
				return;
			}
			n = Number(printed[1]);
			suffix = printed[2];
		}
		if (n < 1 || n > 99) {
			log(`${hymnal}: "${heading.text}" (${page}) is song ${n}, outside 1–99: skipped`);
			return;
		}
		entries.push({ hymnal, number: `${programme.first + n}${suffix}`, url: `${page}#chant-${position}` });
	});
	return entries;
}

export function createPsalmodieAdapter(
	programmes: Record<string, Programme[]> = PSALMODIE_PROGRAMMES
): SourceAdapter {
	return {
		id: 'psalmodie',
		async listEntries(hymnal, ctx) {
			const list = programmes[hymnal];
			if (!list) throw new Error(`psalmodie.ch does not cover hymnal "${hymnal}"`);
			const all: EntryRef[] = [];
			const seen = new Map<string, string>();
			for (const programme of list) {
				const html = await ctx.fetch(programmeUrl(programme.slug));
				for (const entry of parseProgramme(html, hymnal, programme, ctx.log)) {
					const previous = seen.get(entry.number);
					if (previous) {
						ctx.log(`${hymnal} ${entry.number}: listed twice (${previous}, ${entry.url}): kept the first`);
						continue;
					}
					seen.set(entry.number, entry.url);
					all.push(entry);
				}
			}
			return all;
		},
		parseHymn: parsePsalmodieHymn
	};
}

export const psalmodie = createPsalmodieAdapter();
registerAdapter(psalmodie);
