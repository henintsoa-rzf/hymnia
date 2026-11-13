/**
 * Adapter for conducteurdelouange.com (`cdl`). Page structure and selectors:
 * tests/import/fixtures/cdl/README.md.
 *
 * - Hymnals are listed by volume: JEM is split in 4 volumes with continuous numbering.
 * - Lyrics are rendered ChordPro: section labels (`.chordpro-comment`), verse markers, a
 *   `.chordpro-chorus` wrapper, one `.chordpro-verse` per line, possibly split into
 *   `.chordpro-chord` + `.chordpro-text` parts.
 * - Credits name the authors without saying who wrote the words or the music: role
 *   `unspecified`.
 * - Some hymnals are not numbered on the site (Exo). Their songs are identified by page id and
 *   get made-up numbers pinned in CDL_PINNED, oldest id first; pinned ids are always listed,
 *   because the site's pages overlap and can miss songs (specs/005-exo-hymnal research R2, R3).
 */
import { load, type CheerioAPI } from 'cheerio';
import type { Section } from '../../../src/lib/domain/schema';
import { cleanLine } from './clean';
import { registerAdapter } from './index';
import type { EntryRef, ParseResult, SourceAdapter } from './types';

export const CDL_BASE = 'https://www.conducteurdelouange.com';

/** Hymnal id → volumes on the site (`/chants/recueil/<volume>`). */
export const CDL_VOLUMES: Record<string, number[]> = {
	jem: [1, 3, 5, 44],
	adf: [19],
	cd: [11],
	exo: [6]
};

/** A made-up number pinned to a site page id (`/<id>`). */
export type PinnedId = { number: number; id: number };

/**
 * Hymnal id → pinned numbers, for hymnals the site does not number. Numbers never change and are
 * never reused; a new id gets the next free number (and should then be added here).
 */
export const CDL_PINNED: Record<string, PinnedId[]> = {
	/**
	 * Exo: 60 songs on 2026-11-13, by ascending page id. The 3 listing pages show only 50 of them
	 * (they overlap); the other 10 (736, 751, 768, 769, 786, 787, 788, 1317–1319) were found by
	 * checking each page id in 690–800 and 1300–1340 for the "Exo" hymnal in its credits.
	 */
	exo: [
		{ number: 1, id: 698 },
		{ number: 2, id: 704 },
		{ number: 3, id: 705 },
		{ number: 4, id: 706 },
		{ number: 5, id: 708 },
		{ number: 6, id: 736 },
		{ number: 7, id: 751 },
		{ number: 8, id: 752 },
		{ number: 9, id: 753 },
		{ number: 10, id: 754 },
		{ number: 11, id: 755 },
		{ number: 12, id: 756 },
		{ number: 13, id: 757 },
		{ number: 14, id: 758 },
		{ number: 15, id: 759 },
		{ number: 16, id: 760 },
		{ number: 17, id: 762 },
		{ number: 18, id: 764 },
		{ number: 19, id: 765 },
		{ number: 20, id: 766 },
		{ number: 21, id: 767 },
		{ number: 22, id: 768 },
		{ number: 23, id: 769 },
		{ number: 24, id: 770 },
		{ number: 25, id: 771 },
		{ number: 26, id: 773 },
		{ number: 27, id: 774 },
		{ number: 28, id: 776 },
		{ number: 29, id: 777 },
		{ number: 30, id: 778 },
		{ number: 31, id: 779 },
		{ number: 32, id: 780 },
		{ number: 33, id: 781 },
		{ number: 34, id: 782 },
		{ number: 35, id: 783 },
		{ number: 36, id: 784 },
		{ number: 37, id: 786 },
		{ number: 38, id: 787 },
		{ number: 39, id: 788 },
		{ number: 40, id: 789 },
		{ number: 41, id: 790 },
		{ number: 42, id: 791 },
		{ number: 43, id: 792 },
		{ number: 44, id: 794 },
		{ number: 45, id: 795 },
		{ number: 46, id: 1312 },
		{ number: 47, id: 1313 },
		{ number: 48, id: 1314 },
		{ number: 49, id: 1315 },
		{ number: 50, id: 1316 },
		{ number: 51, id: 1317 },
		{ number: 52, id: 1318 },
		{ number: 53, id: 1319 },
		{ number: 54, id: 1320 },
		{ number: 55, id: 1321 },
		{ number: 56, id: 1322 },
		{ number: 57, id: 1323 },
		{ number: 58, id: 1324 },
		{ number: 59, id: 1325 },
		{ number: 60, id: 1326 }
	]
};

const SECTION_TYPES: [RegExp, Section['type']][] = [
	[/^(strophe|couplet|verse|vers)\b/u, 'verse'],
	[/^(refrain|chorus|ch(œ|oe)ur)\b/u, 'chorus'],
	[/^(pont|bridge)\b/u, 'bridge']
];

/** A label written as a lyric line, e.g. "(Refrain)" (Exo `/698`). */
const LINE_LABEL = /^\(\s*((?:refrain|chorus|ch(?:œ|oe)ur|pont|bridge|couplet|strophe)(?:\s*\d+)?)\s*\)$/iu;

function labelInfo(label: string): { type: Section['type']; number: number | null } {
	const text = label.trim().toLowerCase();
	const type = SECTION_TYPES.find(([re]) => re.test(text))?.[1] ?? 'other';
	const n = /(\d+)\s*$/u.exec(text);
	return { type, number: n ? Number(n[1]) : null };
}

/** Text of one `.chordpro-verse` line: its text parts joined, chords counted and left out. */
type Node = Parameters<CheerioAPI>[0];

function lineText($: CheerioAPI, el: Node, count: (kind: string) => void): string {
	const node = $(el);
	const parts = node.find('.chordpro-text');
	node.find('.chordpro-chord').each((_, chord) => {
		if ($(chord).text().trim() !== '') count('chord');
	});
	return cleanLine(parts.length > 0 ? parts.map((_, p) => $(p).text()).get().join('') : node.text());
}

export function parseCdlHymn(html: string, ref: EntryRef): ParseResult {
	const $ = load(html);
	const body = $('section.body').first();
	if (body.length === 0) return { ok: false, reason: 'no lyrics block' };

	const title = cleanLine(body.closest('.row').find('h2').first().text());
	if (!title) return { ok: false, reason: 'no title' };

	const strippedMarkup: Record<string, number> = {};
	const count = (kind: string) => (strippedMarkup[kind] = (strippedMarkup[kind] ?? 0) + 1);

	const sections: Section[] = [];
	let label: string | null = null;
	let open: Section | null = null;
	let verses = 0;

	const start = (fallback: Section['type']): Section => {
		const info = label === null ? { type: fallback, number: null } : labelInfo(label);
		const type = label === null ? fallback : info.type;
		let number: number | null = null;
		if (type === 'verse') {
			verses += 1;
			number = info.number ?? verses;
			verses = number;
		}
		label = null;
		const section: Section = { type, number, lines: [] };
		sections.push(section);
		return section;
	};

	/** An empty section whose real label comes as its first line: retype it. */
	const relabel = (section: Section, text: string) => {
		const info = labelInfo(text);
		if (section.type === 'verse' && info.type !== 'verse') verses -= 1;
		section.type = info.type;
		section.number = info.type === 'verse' ? (info.number ?? section.number) : null;
		if (info.type === 'verse') verses = section.number ?? verses;
	};

	const addLine = (section: Section, line: string) => {
		if (line === '') return;
		// "1. Ah ! qu'il est doux": the verse number written in the text is markup.
		if (section.lines.length === 0 && section.number !== null) {
			const marker = new RegExp(`^${section.number}\\s*[.)]\\s+`, 'u');
			if (marker.test(line)) {
				count('verse-number');
				line = line.replace(marker, '');
			}
		}
		section.lines.push(line);
	};

	body.children().each((_, el) => {
		const node = $(el);
		if (node.hasClass('chordpro-comment')) {
			label = node.text();
			open = null;
		} else if (node.hasClass('chordpro-start_of_verse')) {
			open = start('verse');
		} else if (node.hasClass('chordpro-end_of_verse')) {
			open = null;
		} else if (node.hasClass('chordpro-chorus')) {
			const chorus = start('chorus');
			if (chorus.type !== 'chorus') chorus.type = 'chorus';
			chorus.number = null;
			node.find('.chordpro-verse').each((_, line) => addLine(chorus, lineText($, line, count)));
			open = null;
		} else if (node.hasClass('chordpro-verse')) {
			const text = lineText($, el, count);
			const marker = LINE_LABEL.exec(text);
			if (marker) {
				count('section-marker');
				if (open && open.lines.length === 0) relabel(open, marker[1]);
				else {
					label = marker[1];
					open = null;
				}
				return;
			}
			open ??= start('verse');
			addLine(open, text);
		}
	});

	const filled = sections.filter((s) => s.lines.length > 0);
	if (filled.length === 0) return { ok: false, reason: 'no lyrics block' };

	const credits: { name: string; role: 'unspecified' }[] = [];
	const unknownCredits: string[] = [];
	$('section.credits .credit')
		.children()
		.each((_, el) => {
			const node = $(el);
			if (node.hasClass('source')) return;
			const name = cleanLine(node.text());
			if (!name) return;
			if (node.hasClass('author')) credits.push({ name, role: 'unspecified' });
			else unknownCredits.push(`${node.attr('class') ?? '?'}: ${name}`);
		});

	return {
		ok: true,
		hymn: {
			source: 'cdl',
			hymnal: ref.hymnal,
			number: ref.number,
			url: ref.url,
			title,
			sections: filled,
			credits,
			strippedMarkup,
			unknownCredits
		}
	};
}

type ListedRow = { id: number; number: string | null; url: string };

/**
 * Rows of one listing page. In a numbered hymnal a row without `#number` is skipped (and
 * logged); in an unnumbered one (`unnumbered`), rows are kept with `number: null`.
 */
function parseListing(
	html: string,
	hymnal: string,
	log: (m: string) => void,
	unnumbered = false
): { rows: ListedRow[]; lastPage: number } {
	const $ = load(html);
	const rows: ListedRow[] = [];
	$('li').each((_, el) => {
		const li = $(el);
		const link = li.children('a[href^="/"]').first();
		const details = li.children('.details');
		if (link.length === 0 || details.length === 0) return;
		const href = link.attr('href')!;
		if (!/^\/\d+$/u.test(href)) return;
		const source = cleanLine(details.find('.source').text());
		const number = /#\s*(\S+)\s*$/u.exec(source)?.[1] ?? null;
		if (!number && !unnumbered) {
			log(`${hymnal}: "${cleanLine(link.text())}" (${href}) has no number in the listing: skipped`);
			return;
		}
		rows.push({ id: Number(href.slice(1)), number, url: `${CDL_BASE}${href}` });
	});
	const pages = $('.pagination a')
		.map((_, a) => Number(/[?&]page=(\d+)/u.exec($(a).attr('href') ?? '')?.[1] ?? 0))
		.get();
	return { rows, lastPage: Math.max(1, ...pages) };
}

/**
 * Entries of an unnumbered hymnal (specs/005-exo-hymnal contracts/cdl-exo-listing.md): one per
 * distinct page id, numbered from the pinned table (new ids after the highest pinned number, in
 * ascending id order), plus every pinned id the listing missed this run. Sorted by number.
 */
export function numberPinned(
	rows: ListedRow[],
	hymnal: string,
	pinned: PinnedId[],
	log: (message: string) => void
): EntryRef[] {
	const ids = [...new Set(rows.map((r) => r.id))];
	log(`${hymnal}: ${rows.length} rows, ${ids.length} songs listed`);
	const byId = new Map(pinned.map((p) => [p.id, p.number]));
	const listed = new Set(ids);
	let next = Math.max(0, ...pinned.map((p) => p.number));
	const entries: EntryRef[] = [];
	const url = (id: number) => `${CDL_BASE}/${id}`;
	for (const id of [...ids].sort((a, b) => a - b)) {
		let number = byId.get(id);
		if (number === undefined) {
			number = ++next;
			log(`${hymnal} ${number}: /${id} is not pinned yet: add it to CDL_PINNED`);
		}
		entries.push({ hymnal, number: String(number), url: url(id) });
	}
	for (const { id, number } of pinned) {
		if (listed.has(id)) continue;
		log(`${hymnal} ${number}: /${id} pinned but not in the list this run`);
		entries.push({ hymnal, number: String(number), url: url(id) });
	}
	return entries.sort((a, b) => Number(a.number) - Number(b.number));
}

export function createCdlAdapter(
	volumes: Record<string, number[]> = CDL_VOLUMES,
	pinned: Record<string, PinnedId[]> = CDL_PINNED
): SourceAdapter {
	return {
		id: 'cdl',
		async listEntries(hymnal, ctx) {
			const ids = volumes[hymnal];
			if (!ids) throw new Error(`conducteurdelouange.com does not cover hymnal "${hymnal}"`);
			const table = pinned[hymnal];
			const unnumbered = table !== undefined;
			const listed: ListedRow[] = [];
			for (const volume of ids) {
				const first = parseListing(
					await ctx.fetch(`${CDL_BASE}/chants/recueil/${volume}`),
					hymnal,
					ctx.log,
					unnumbered
				);
				listed.push(...first.rows);
				for (let page = 2; page <= first.lastPage; page++) {
					const next = await ctx.fetch(`${CDL_BASE}/chants/recueil/${volume}?page=${page}`);
					listed.push(...parseListing(next, hymnal, ctx.log, unnumbered).rows);
				}
			}
			if (unnumbered) return numberPinned(listed, hymnal, table, ctx.log);

			const all: EntryRef[] = [];
			const seen = new Map<string, string>();
			for (const { number, url } of listed) {
				const previous = seen.get(number!);
				if (previous && previous !== url) {
					ctx.log(`${hymnal} ${number}: listed twice (${previous}, ${url}): kept the first`);
					continue;
				}
				if (!previous) all.push({ hymnal, number: number!, url });
				seen.set(number!, url);
			}
			return all;
		},
		parseHymn: parseCdlHymn
	};
}

export const cdl = createCdlAdapter();
registerAdapter(cdl);
