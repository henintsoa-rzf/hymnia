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
	cd: [11]
};

const SECTION_TYPES: [RegExp, Section['type']][] = [
	[/^(strophe|couplet|verse|vers)\b/u, 'verse'],
	[/^(refrain|chorus|ch(œ|oe)ur)\b/u, 'chorus'],
	[/^(pont|bridge)\b/u, 'bridge']
];

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
			open ??= start('verse');
			addLine(open, lineText($, el, count));
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

function parseListing(html: string, hymnal: string, log: (m: string) => void) {
	const $ = load(html);
	const entries: EntryRef[] = [];
	$('li').each((_, el) => {
		const li = $(el);
		const link = li.children('a[href^="/"]').first();
		const details = li.children('.details');
		if (link.length === 0 || details.length === 0) return;
		const href = link.attr('href')!;
		if (!/^\/\d+$/u.test(href)) return;
		const source = cleanLine(details.find('.source').text());
		const number = /#\s*(\S+)\s*$/u.exec(source)?.[1];
		if (!number) {
			log(`${hymnal}: "${cleanLine(link.text())}" (${href}) has no number in the listing: skipped`);
			return;
		}
		entries.push({ hymnal, number, url: `${CDL_BASE}${href}` });
	});
	const pages = $('.pagination a')
		.map((_, a) => Number(/[?&]page=(\d+)/u.exec($(a).attr('href') ?? '')?.[1] ?? 0))
		.get();
	return { entries, lastPage: Math.max(1, ...pages) };
}

export function createCdlAdapter(volumes: Record<string, number[]> = CDL_VOLUMES): SourceAdapter {
	return {
		id: 'cdl',
		async listEntries(hymnal, ctx) {
			const ids = volumes[hymnal];
			if (!ids) throw new Error(`conducteurdelouange.com does not cover hymnal "${hymnal}"`);
			const all: EntryRef[] = [];
			const seen = new Map<string, string>();
			for (const volume of ids) {
				const first = parseListing(
					await ctx.fetch(`${CDL_BASE}/chants/recueil/${volume}`),
					hymnal,
					ctx.log
				);
				const listed = [...first.entries];
				for (let page = 2; page <= first.lastPage; page++) {
					const next = await ctx.fetch(`${CDL_BASE}/chants/recueil/${volume}?page=${page}`);
					listed.push(...parseListing(next, hymnal, ctx.log).entries);
				}
				for (const entry of listed) {
					const previous = seen.get(entry.number);
					if (previous && previous !== entry.url) {
						ctx.log(`${hymnal} ${entry.number}: listed twice (${previous}, ${entry.url}): kept the first`);
						continue;
					}
					if (!previous) all.push(entry);
					seen.set(entry.number, entry.url);
				}
			}
			return all;
		},
		parseHymn: parseCdlHymn
	};
}

export const cdl = createCdlAdapter();
registerAdapter(cdl);
