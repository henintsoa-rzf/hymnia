/**
 * Adapter for the Arc-en-ciel hymnal (`arc`), read from a public Google Doc that lists the
 * lyrics of the 1995 edition (Pierre Muller). Page structure: tests/import/fixtures/arc/README.md.
 *
 * - The whole hymnal is one page: the doc's HTML export. Every entry points at that page with a
 *   fragment ("…/export?format=html#5A"), so the fetcher requests it once per run.
 * - `h1` = a section of the hymnal (Psaumes, Chants Bibliques, …; `ARC_PARTS` in
 *   content/hymnals.json), `h2` = a subsection (ignored), `h3` = one song: "Ps 5 A. Entends,
 *   Seigneur, ma plainte" or "367 A. Brillante étoile". Psalms keep their psalm number (1–150),
 *   the other songs start at 151, so numbers never collide. Two headings were typed as plain
 *   paragraphs ("592. Seigneur, tu es notre joie"): a paragraph starting with a number of three
 *   digits above the current song's is read as a heading too.
 * - Each `p` after the `h3` is a stanza, lines separated by `<br>`. A line starting with "1. "
 *   starts verse 1; "R. " (or "R1.", "Ref.", "Rif.", "Dernier refrain :") a chorus; "1-4. " a
 *   part sung after verses 1 to 4 (a chorus); "Final :" a closing stanza (`other`). These labels
 *   are removed and counted. A paragraph with no label is a stanza of its own (`other`).
 * - Notes to the reader are not lyrics: removed and counted. They are a paragraph starting
 *   with "* " or "Peut se chanter", or a line in brackets opening a paragraph ("(Pour le jour
 *   des Rameaux)"). Echo lines inside a stanza ("(L'hiver est fini)") are lyrics and stay.
 * - The doc names no authors: no credits.
 */
import { load } from 'cheerio';
import type { Section } from '../../../src/lib/domain/schema';
import { cleanLine } from './clean';
import { registerAdapter } from './index';
import type { EntryRef, ParseResult, SourceAdapter } from './types';

export const ARC_DOC = 'https://docs.google.com/document/d/1-ygNIoB_dR9PDsrlMzMBnKGh5NLIkJsN';
export const ARC_EXPORT = `${ARC_DOC}/export?format=html`;

/** "Ps 5 A. Entends, Seigneur", "Ps 42A. Comme un cerf", "367 A. Brillante étoile". */
const HEADING = /^(?:Ps\s*)?(\d+)\s*([A-Z])?\s*\.\s*(.+)$/u;
/** The same, typed as a paragraph: only song numbers (151 and up), never a verse number. */
const UNSTYLED_HEADING = /^(\d{3})\s*([A-Z])?\s*\.\s+(.+)$/u;
const VERSE = /^(\d+)\s*\.\s*/u;
/** "1-4. ", "1-2-3. ", "1 - 3 ": sung after each of these verses. */
const VERSE_RANGE = /^\d+(?:\s*-\s*\d+)+\s*(?:\.\s*|\s+)/u;
const CHORUS = /^(?:R\d?|Ref|Réf|Rif|Refrain|Dernier refrain)\s*[.:]\s*/iu;
const FINAL = /^Final\s*:\s*/iu;
/** A paragraph that is a note to the reader: "* Version originale : …", "Peut se chanter …". */
const NOTE_PARAGRAPH = /^(?:\*|Peut se chanter )/u;
/** A line in brackets: a note when it opens a paragraph ("(Pour le jour des Rameaux)"). */
const BRACKETED = /^\(.*\)$/u;

export type ArcSong = {
	number: string;
	title: string;
	/** The `h1` section the song is in. */
	part: string;
	/** One entry per paragraph: its cleaned, non-empty lines. */
	paragraphs: string[][];
};

/** "5", "A" → "5 A"; the anchor of an entry is the number without spaces ("5A"). */
const anchorOf = (number: string) => number.replace(/\s+/gu, '');

let lastHtml: string | undefined;
let lastSongs: ArcSong[] = [];

/** Every song of the doc, in order. The last result is kept: one page serves 630 entries. */
export function parseArcDocument(html: string): ArcSong[] {
	if (html === lastHtml) return lastSongs;
	const $ = load(html);
	const songs: ArcSong[] = [];
	let part = '';
	let song: ArcSong | undefined;
	// h1/h2 are inside list items (`ol > li > h1`), h3 and p are children of body.
	$('h1, h2, h3, body > p').each((_, el) => {
		const node = $(el);
		if (el.tagName === 'h1') {
			part = cleanLine(node.text());
			song = undefined;
			return;
		}
		if (el.tagName === 'h2') return;
		if (el.tagName === 'h3') {
			const match = HEADING.exec(cleanLine(node.text()));
			song = undefined;
			if (!match) return;
			const [, digits, letter, title] = match;
			song = { number: letter ? `${digits} ${letter}` : digits, title, part, paragraphs: [] };
			songs.push(song);
			return;
		}
		if (!song) return;
		const copy = node.clone();
		copy.find('br').replaceWith('\n');
		const lines = copy.text().split('\n').map(cleanLine).filter(Boolean);
		if (lines.length === 0) return;
		// A song whose heading was typed as plain text ("592. Seigneur, tu es notre joie").
		const heading = UNSTYLED_HEADING.exec(lines[0]);
		if (heading && Number(heading[1]) > parseInt(song.number, 10)) {
			const [, digits, letter, title] = heading;
			song = { number: letter ? `${digits} ${letter}` : digits, title, part, paragraphs: [] };
			songs.push(song);
			lines.shift();
			if (lines.length === 0) return;
		}
		song.paragraphs.push(lines);
	});
	lastHtml = html;
	lastSongs = songs;
	return songs;
}

/** Stanzas of a song from its paragraphs; removed labels and notes are counted. */
export function arcSections(paragraphs: string[][]): {
	sections: Section[];
	strippedMarkup: Record<string, number>;
} {
	const sections: Section[] = [];
	const strippedMarkup: Record<string, number> = {};
	const count = (kind: string) => (strippedMarkup[kind] = (strippedMarkup[kind] ?? 0) + 1);
	let open: Section | undefined;
	const begin = (type: Section['type'], number: number | null) => {
		open = { type, number, lines: [] };
		sections.push(open);
		return open;
	};

	for (let paragraph of paragraphs) {
		if (NOTE_PARAGRAPH.test(paragraph[0])) {
			count('note');
			continue;
		}
		if (BRACKETED.test(paragraph[0])) {
			count('note');
			paragraph = paragraph.slice(1);
		}
		for (const [i, line] of paragraph.entries()) {
			let rest: string;
			const range = VERSE_RANGE.exec(line);
			const verse = VERSE.exec(line);
			const chorus = CHORUS.exec(line);
			if (range) {
				count('verse-range');
				begin('chorus', null);
				rest = line.slice(range[0].length);
			} else if (verse) {
				count('verse-number');
				begin('verse', Number(verse[1]));
				rest = line.slice(verse[0].length);
			} else if (chorus) {
				count('section-label');
				begin('chorus', null);
				rest = line.slice(chorus[0].length);
			} else if (FINAL.test(line)) {
				count('section-label');
				begin('other', null);
				rest = line.replace(FINAL, '');
			} else {
				rest = line;
				if (!open || i === 0) begin('other', null);
			}
			if (rest) open!.lines.push(rest);
		}
	}
	return { sections: sections.filter((s) => s.lines.length > 0), strippedMarkup };
}

export function parseArcHymn(html: string, ref: EntryRef): ParseResult {
	const anchor = anchorOf(ref.number);
	const song = parseArcDocument(html).find((s) => anchorOf(s.number) === anchor);
	if (!song) return { ok: false, reason: `song ${ref.number} not in the document` };
	const { sections, strippedMarkup } = arcSections(song.paragraphs);
	if (sections.length === 0) return { ok: false, reason: 'no lyrics' };
	return {
		ok: true,
		hymn: {
			source: 'arc',
			hymnal: ref.hymnal,
			number: song.number,
			url: ref.url,
			title: song.title,
			sections,
			credits: [],
			strippedMarkup,
			unknownCredits: []
		}
	};
}

export const arc: SourceAdapter = {
	id: 'arc',
	async listEntries(hymnal, ctx) {
		if (hymnal !== 'arc') throw new Error(`The Arc-en-ciel document does not cover hymnal "${hymnal}"`);
		const songs = parseArcDocument(await ctx.fetch(ARC_EXPORT));
		const seen = new Set<string>();
		const refs: EntryRef[] = [];
		for (const song of songs) {
			const anchor = anchorOf(song.number);
			if (seen.has(anchor)) {
				ctx.log(`arc ${song.number}: number used twice in the document, kept the first`);
				continue;
			}
			seen.add(anchor);
			refs.push({ hymnal, number: song.number, url: `${ARC_EXPORT}#${anchor}` });
		}
		return refs;
	},
	parseHymn: parseArcHymn
};

registerAdapter(arc);
