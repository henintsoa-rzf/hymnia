/**
 * Adapter for ecrituremusique.com (`ecriture`). Page structure and selectors:
 * tests/import/fixtures/ecriture/README.md.
 *
 * - The site is not a numbered hymnal: songs are listed alphabetically and by album, with track
 *   numbers that restart on each album. Each album gets a fixed block of numbers in
 *   ECRITURE_ALBUMS (oldest album first), so a number never changes when a new album comes out.
 *   A song on an album that is not configured is skipped and logged.
 * - Lyrics are one Squarespace text block: an `h2` title, then lines separated by `<br>`, blank
 *   lines between stanzas. Verses start with "1. ", other stanzas with an upper-case label
 *   ("REFRAIN", "PRE-REFRAIN", "PONT", "DERNIER REFRAIN"). Both are removed and counted.
 * - Credits are in the next text block: "Paroles et musique : A, B, C." There are no chords.
 * - Never use `/search`, `/api/` or `?format=json`: robots.txt disallows them (research R3).
 */
import { load, type CheerioAPI } from 'cheerio';
import type { Credit, Section } from '../../../src/lib/domain/schema';
import { cleanLine, mapCreditRole } from './clean';
import { registerAdapter } from './index';
import type { EntryRef, ParseResult, SourceAdapter } from './types';

export const ECRITURE_BASE = 'https://www.ecrituremusique.com';

/** An album and the hymn number given to its track 1; tracks are numbered from there. */
export type EcritureAlbum = { title: string; first: number; tracks: number };

/** Hymnal id → albums, oldest first. A new album gets the numbers after the last one. */
export const ECRITURE_ALBUMS: Record<string, EcritureAlbum[]> = {
	ecriture: [
		{ title: 'Écriture Vol. 1', first: 1, tracks: 12 },
		{ title: 'Contemplez Christ', first: 13, tracks: 13 },
		{ title: 'En toutes choses, Pt. 1', first: 26, tracks: 7 }
	]
};

type Node = Parameters<CheerioAPI>[0];

const VERSE_NUMBER = /^(\d+)\.\s+/u;
/** A stanza label: one short line in capitals ("REFRAIN", "PRE-REFRAIN", "DERNIER REFRAIN"). */
const LABEL = /^[\p{Lu}][\p{Lu}\s'’-]{1,30}(?:\s\d+)?$/u;

function labelType(label: string): Section['type'] {
	const text = label.toLowerCase();
	if (/pr[eé]-?\s?refrain/u.test(text)) return 'other';
	if (/refrain|ch(œ|oe)ur/u.test(text)) return 'chorus';
	if (/pont/u.test(text)) return 'bridge';
	return 'other';
}

/** Lines of a text block: `<br>` and paragraph ends become line breaks; '' marks a blank line. */
function blockLines($: CheerioAPI, block: Node): string[] {
	const copy = $(block).clone();
	copy.find('br').replaceWith('\n');
	copy.find('p, h1, h2, h3, h4').each((_, el) => {
		$(el).append('\n\n');
	});
	return copy
		.text()
		.split('\n')
		.map((line) => cleanLine(line));
}

/** Splits lines into stanzas at blank lines. */
function stanzas(lines: string[]): string[][] {
	const out: string[][] = [];
	let current: string[] = [];
	for (const line of lines) {
		if (line === '') {
			if (current.length > 0) out.push(current);
			current = [];
		} else {
			current.push(line);
		}
	}
	if (current.length > 0) out.push(current);
	return out;
}

/** Names in "Adrian Price, Fiona Price et Naomi Pilgrem." */
function splitNames(text: string): string[] {
	return text
		.replace(/\.\s*$/u, '')
		.split(/\s*,\s*|\s+(?:et|&)\s+/u)
		.map((name) => cleanLine(name))
		.filter(Boolean);
}

function parseCredits(lines: string[]): { credits: Credit[]; unknownCredits: string[] } {
	const credits: Credit[] = [];
	const unknownCredits: string[] = [];
	for (const line of lines) {
		if (line === '' || line.startsWith('©')) continue;
		const match = /^([^:]{1,60}?)\s*:\s*(.+)$/u.exec(line);
		if (!match) continue;
		const [, label, names] = match;
		// "Paroles et musique": one role per part of the label.
		const roles = label.split(/\s+(?:et|&)\s+|\s*\/\s*|\s*,\s*/u).map((part) => mapCreditRole(part));
		if (roles.some((role) => role === null)) {
			unknownCredits.push(`${label}: ${names}`);
			continue;
		}
		for (const name of splitNames(names)) {
			for (const role of new Set(roles)) credits.push({ name, role: role! });
		}
	}
	return { credits, unknownCredits };
}

export function parseEcritureHymn(html: string, ref: EntryRef): ParseResult {
	const $ = load(html);
	const blocks = $('.sqs-html-content').toArray();
	const index = blocks.findIndex((block) => $(block).children().first().is('h2'));
	if (index === -1) return { ok: false, reason: 'no lyrics block' };
	const block = blocks[index];

	const title = cleanLine($(block).children('h2').first().text());
	if (!title) return { ok: false, reason: 'no title' };

	const strippedMarkup: Record<string, number> = {};
	const count = (kind: string) => (strippedMarkup[kind] = (strippedMarkup[kind] ?? 0) + 1);

	const body = $(block).clone();
	body.children('h2').first().remove();

	const sections: Section[] = [];
	let marked = 0;
	for (const stanza of stanzas(blockLines($, body.get(0)!))) {
		let lines = stanza;
		let type: Section['type'] = 'other';
		let number: number | null = null;
		const verse = VERSE_NUMBER.exec(lines[0]);
		if (verse) {
			type = 'verse';
			number = Number(verse[1]);
			count('verse-number');
			lines = [lines[0].replace(VERSE_NUMBER, ''), ...lines.slice(1)];
			marked++;
		} else if (lines.length > 1 && LABEL.test(lines[0])) {
			type = labelType(lines[0]);
			count('section-label');
			lines = lines.slice(1);
			marked++;
		}
		lines = lines.filter((line) => line !== '');
		if (lines.length > 0) sections.push({ type, number, lines });
	}
	// A heading followed by prose (the songs index, "À propos") has no verse and no label.
	if (sections.length === 0 || marked === 0) return { ok: false, reason: 'no lyrics block' };

	// Credits: the next text block, when it holds the copyright line or a known credit label.
	let credits: Credit[] = [];
	let unknownCredits: string[] = [];
	const next = blocks[index + 1];
	if (next) {
		const lines = blockLines($, next);
		const parsed = parseCredits(lines);
		if (lines.some((line) => line.startsWith('©')) || parsed.credits.length > 0) {
			({ credits, unknownCredits } = parsed);
		}
	}

	return {
		ok: true,
		hymn: {
			source: 'ecriture',
			hymnal: ref.hymnal,
			number: ref.number,
			url: ref.url,
			title,
			sections,
			credits,
			strippedMarkup,
			unknownCredits
		}
	};
}

const albumKey = (title: string) => cleanLine(title).toLowerCase();

/** (number, URL) pairs from the discography of `/chants`: one `h3` album title + track links. */
function parseListing(
	html: string,
	hymnal: string,
	albums: EcritureAlbum[],
	log: (m: string) => void
): EntryRef[] {
	const $ = load(html);
	const byTitle = new Map(albums.map((album) => [albumKey(album.title), album]));
	const entries: EntryRef[] = [];
	const listed = new Set<string>();
	$('.sqs-html-content').each((_, block) => {
		const heading = $(block).children('h3').first();
		if (heading.length === 0) return;
		const name = cleanLine(heading.text());
		const links = $(block).find('a[href]');
		if (links.length === 0) return;
		const album = byTitle.get(albumKey(name));
		if (!album) {
			log(`${hymnal}: album "${name}" has no numbers in ECRITURE_ALBUMS: ${links.length} songs skipped`);
			return;
		}
		links.each((_, a) => {
			const text = cleanLine($(a).text());
			const url = new URL($(a).attr('href')!, `${ECRITURE_BASE}/chants`).href;
			listed.add(url);
			const track = /^(\d+)\.\s/u.exec(text)?.[1];
			if (!track) {
				log(`${hymnal}: "${text}" (${url}) has no track number on "${name}": skipped`);
				return;
			}
			if (Number(track) > album.tracks) {
				log(`${hymnal}: "${text}" is track ${track} of "${name}", beyond its ${album.tracks} numbered tracks: skipped`);
				return;
			}
			entries.push({ hymnal, number: String(album.first + Number(track) - 1), url });
		});
	});
	// Songs in the alphabetical list that are on no album have no number.
	$('.accordion-item__description a[href]').each((_, a) => {
		const url = new URL($(a).attr('href')!, `${ECRITURE_BASE}/chants`).href;
		if (!listed.has(url)) {
			log(`${hymnal}: "${cleanLine($(a).text())}" (${url}) is on no album, so has no number: skipped`);
		}
	});
	return entries;
}

export function createEcritureAdapter(
	albums: Record<string, EcritureAlbum[]> = ECRITURE_ALBUMS
): SourceAdapter {
	return {
		id: 'ecriture',
		async listEntries(hymnal, ctx) {
			const list = albums[hymnal];
			if (!list) throw new Error(`ecrituremusique.com does not cover hymnal "${hymnal}"`);
			const listed = parseListing(await ctx.fetch(`${ECRITURE_BASE}/chants`), hymnal, list, ctx.log);
			const all: EntryRef[] = [];
			const byNumber = new Map<string, string>();
			const byUrl = new Map<string, string>();
			for (const entry of listed) {
				const sameNumber = byNumber.get(entry.number);
				const sameUrl = byUrl.get(entry.url);
				if (sameNumber !== undefined || sameUrl !== undefined) {
					ctx.log(
						`${hymnal} ${entry.number}: ${entry.url} already listed (as ${sameUrl ?? entry.number}): kept the first`
					);
					continue;
				}
				byNumber.set(entry.number, entry.url);
				byUrl.set(entry.url, entry.number);
				all.push(entry);
			}
			return all.sort((a, b) => Number(a.number) - Number(b.number));
		},
		parseHymn: parseEcritureHymn
	};
}

export const ecriture = createEcritureAdapter();
registerAdapter(ecriture);
