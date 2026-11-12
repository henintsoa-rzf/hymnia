/**
 * Adapter for jemaf.fr (`jemaf`). Page structure and selectors:
 * tests/import/fixtures/jemaf/README.md.
 *
 * - Each hymnal has one index page listing every hymn in number order
 *   (`/index/<recueil>&lt=0-9`); items are `a.resRech` with the printed code in a `span`
 *   ("AF309A", "JEM1000").
 * - A hymn page renders the lyrics as `.ancre` labels ("Strophe 1", "Refrain a", "Pont 2a",
 *   "Fin"), each followed by a `div.strophe` or `div.refrain` holding the lines separated by
 *   newlines. Verses start with their number written in the text ("1. …"): removed and counted.
 * - Credits: the page embeds its data as `var chant = {…}` (JSON). Its `author` field is shown
 *   as "Texte de …" and `composer` names the composer; both are mapped with `mapCreditRole`.
 *   The rendered HTML labels only the author, so the JSON is read for credits only.
 * - Chords are never in the rendered lyrics (the site draws them client-side from the JSON);
 *   `stripChords` still runs so any that appear are removed and counted.
 */
import { load, type CheerioAPI } from 'cheerio';
import type { Credit, Section } from '../../../src/lib/domain/schema';
import { cleanLine, mapCreditRole, stripChords } from './clean';
import { registerAdapter } from './index';
import type { EntryRef, ParseResult, SourceAdapter } from './types';

export const JEMAF_BASE = 'https://jemaf.fr';

/** Our hymnal id → the site's index id and the code prefix it prints before numbers. */
export type JemafHymnal = { index: string; code: string };

export const JEMAF_HYMNALS: Record<string, JemafHymnal> = {
	jem: { index: 'jem1-4', code: 'JEM' },
	adf: { index: 'af', code: 'AF' },
	atg: { index: 'atg', code: 'ATG' }
};

const SECTION_TYPES: [RegExp, Section['type']][] = [
	[/^(strophe|couplet|paroles)\b/u, 'verse'],
	[/^(refrain|ch(œ|oe)ur)\b/u, 'chorus'],
	[/^pont\b/u, 'bridge'],
	[/^(intro|introduction|fin|coda)\b/u, 'other']
];

function labelInfo(label: string | null): { type: Section['type'] | null; number: number | null } {
	if (label === null) return { type: null, number: null };
	const text = cleanLine(label).toLowerCase();
	const type = SECTION_TYPES.find(([re]) => re.test(text))?.[1] ?? null;
	// "Strophe 2", and "Pont 2a"/"Refrain b" variants: only the digits count.
	const n = /(\d+)[a-z]?$/u.exec(text);
	return { type, number: n ? Number(n[1]) : null };
}

type Node = Parameters<CheerioAPI>[0];

/** Lines of a lyrics block: `<br>` and newlines split lines, blank lines are dropped. */
function blockLines($: CheerioAPI, el: Node): string[] {
	const node = $(el).clone();
	node.find('br').replaceWith('\n');
	return node
		.text()
		.split(/\r?\n|\r/u)
		.map(cleanLine)
		.filter((line) => line !== '');
}

/** Hymn data embedded in the page (`var chant = {…};`), or null. Parsed, never executed. */
function embeddedData(html: string): Record<string, unknown> | null {
	const match = /^\s*var chant = (\{.*\});\s*$/mu.exec(html);
	if (!match) return null;
	try {
		const data = JSON.parse(match[1]) as { text?: unknown };
		return data.text && typeof data.text === 'object' ? (data.text as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

/** Fields of the embedded data that are not credits. */
const NOT_CREDITS = new Set([
	'title',
	'original',
	'reference',
	'comment',
	'copyright',
	'code',
	'subtitle'
]);
/** The label the page shows for a field, when it differs from the field name. */
const CREDIT_LABELS: Record<string, string> = { author: 'Texte' };

function credits(data: Record<string, unknown> | null) {
	const found: Credit[] = [];
	const unknown: string[] = [];
	for (const [field, value] of Object.entries(data ?? {})) {
		if (NOT_CREDITS.has(field) || typeof value !== 'string') continue;
		const name = cleanLine(value);
		if (!name) continue;
		const role = mapCreditRole(CREDIT_LABELS[field] ?? field);
		if (role) found.push({ name, role });
		else unknown.push(`${field}: ${name}`);
	}
	return { credits: found, unknownCredits: unknown };
}

export function parseJemafHymn(html: string, ref: EntryRef): ParseResult {
	const $ = load(html);
	const lyrics = $('#paroles-chant .paroles').first();
	if (lyrics.length === 0) return { ok: false, reason: 'no lyrics block' };

	const strippedMarkup: Record<string, number> = {};
	const count = (kind: string, n = 1) => (strippedMarkup[kind] = (strippedMarkup[kind] ?? 0) + n);

	const sections: Section[] = [];
	let label: string | null = null;
	let verses = 0;

	lyrics.children().each((_, el) => {
		const node = $(el);
		if (node.hasClass('ancre')) {
			label = node.text();
			return;
		}
		const isVerse = node.is('div.strophe');
		if (!isVerse && !node.is('div.refrain')) return;

		// The label decides the type: a "Pont" may be drawn as a strophe or a refrain block.
		const info = labelInfo(label);
		label = null;
		const type = info.type ?? (isVerse ? 'verse' : 'chorus');
		let number: number | null = null;
		if (type === 'verse') {
			number = info.number ?? verses + 1;
			verses = number;
		}

		let lines = blockLines($, el);
		// "1. Qu'on batte des mains !": the verse number written in the text is markup.
		if (number !== null && lines.length > 0) {
			const marker = new RegExp(`^${number}\\s*[.)]\\s+`, 'u');
			if (marker.test(lines[0])) {
				count('verse-number');
				lines[0] = lines[0].replace(marker, '');
			}
		}
		const stripped = stripChords(lines);
		for (const [kind, n] of Object.entries(stripped.counts)) count(kind, n);
		lines = stripped.lines.filter((line) => line !== '');
		if (lines.length > 0) sections.push({ type, number, lines });
	});

	if (sections.length === 0) return { ok: false, reason: 'no lyrics block' };

	// The h2 also holds the subtitle, original title and composer as child elements.
	const title = cleanLine(
		lyrics
			.find('h2')
			.first()
			.contents()
			.filter((_, n) => n.type === 'text')
			.text()
	);
	if (!title) return { ok: false, reason: 'no title' };

	return {
		ok: true,
		hymn: {
			source: 'jemaf',
			hymnal: ref.hymnal,
			number: ref.number,
			url: ref.url,
			title,
			sections,
			strippedMarkup,
			...credits(embeddedData(html))
		}
	};
}

function parseListing(html: string, hymnal: string, code: string, log: (m: string) => void) {
	const $ = load(html);
	const entries: EntryRef[] = [];
	const printed = new RegExp(`^${code}0*(\\d+[A-Za-z]*)$`, 'u');
	$('a.resRech').each((_, el) => {
		const link = $(el);
		const href = link.attr('href') ?? '';
		if (!/^\/?chant\/[a-z]+\d+[a-z]*$/u.test(href)) return;
		const label = cleanLine(link.children('span').first().text());
		const number = printed.exec(label)?.[1];
		if (!number) {
			const title = cleanLine(link.contents().first().text()) || cleanLine(link.text());
			log(`${hymnal}: "${title}" (${href}) has no number in the listing: skipped`);
			return;
		}
		entries.push({ hymnal, number, url: new URL(href, `${JEMAF_BASE}/`).href });
	});
	return entries;
}

export function createJemafAdapter(
	hymnals: Record<string, JemafHymnal> = JEMAF_HYMNALS
): SourceAdapter {
	return {
		id: 'jemaf',
		async listEntries(hymnal, ctx) {
			const config = hymnals[hymnal];
			if (!config) throw new Error(`jemaf.fr does not cover hymnal "${hymnal}"`);
			// "0-9" lists the whole hymnal in number order ("A-Z" gives the same, by title).
			const html = await ctx.fetch(`${JEMAF_BASE}/index/${config.index}&lt=0-9`);
			const all: EntryRef[] = [];
			const seen = new Map<string, string>();
			for (const entry of parseListing(html, hymnal, config.code, ctx.log)) {
				const previous = seen.get(entry.number);
				if (previous && previous !== entry.url) {
					ctx.log(`${hymnal} ${entry.number}: listed twice (${previous}, ${entry.url}): kept the first`);
					continue;
				}
				if (!previous) all.push(entry);
				seen.set(entry.number, entry.url);
			}
			return all;
		},
		parseHymn: parseJemafHymn
	};
}

export const jemaf = createJemafAdapter();
registerAdapter(jemaf);
