/**
 * Adapter for evangile21.thegospelcoalition.org (`evangile21`): the songs of the "Chants
 * Hymnes21" series. Page structure and selectors: tests/import/fixtures/evangile21/README.md;
 * decisions: specs/004-evangile21-hymnal/research.md.
 *
 * - The site blocks the importer (Cloudflare challenge), so the source is `access:
 *   "saved-pages"`: pages are saved from a browser and loaded with `add-pages` (R1–R3). This
 *   adapter only ever reads them through `ctx.fetch`, which serves the cache.
 * - The songs have no number. Each one gets a number pinned in EVANGILE21_NUMBERS, oldest
 *   first (R5); a page that is not a song, or a second page for the same song, is listed in
 *   EVANGILE21_SKIPPED with its reason (R6).
 * - Song pages are hand-made WordPress posts with several layouts: one `<p>` per stanza with
 *   `<br>` lines and an `<em>` label ("Couplet 1"), one block per line with label lines
 *   between stanzas, unlabelled stanzas, or lyrics after an article. Download links, the
 *   "Paroles :" marker, labels and Bible verses quoted between stanzas are not lyrics (R7).
 * - Credits are prose ("Paroles par X, musique par Y. Tr. Z.") at the end of the lyrics, in a
 *   names line above them, or in the editor's note. The page author is never a credit.
 */
import { load, type CheerioAPI } from 'cheerio';
import type { Credit, CreditRole, Section } from '../../../src/lib/domain/schema';
import { normalizeText } from '../../../src/lib/search/normalize';
import { cleanLine } from './clean';
import { registerAdapter } from './index';
import type { EntryRef, ParseResult, SourceAdapter } from './types';

export const EVANGILE21_BASE = 'https://evangile21.thegospelcoalition.org';
export const EVANGILE21_SERIES_URL = `${EVANGILE21_BASE}/series/chants-hymnes21/`;

export type PinnedNumber = { number: number; path: string };
export type SkippedPage = { path: string; reason: string };

/**
 * Evangile21 numbers, oldest song first (the bottom of the series list is number 1). A number
 * is never changed or reused: a song removed from the site leaves a gap, and a new song is
 * pinned here with the next number in the same commit as its content (research R5).
 */
export const EVANGILE21_NUMBERS: PinnedNumber[] = [
	{ number: 1, path: '/article/en-esprit-en-verite/' },
	{ number: 2, path: '/article/alleluia-grand-sauveur-philip-bliss/' },
	{ number: 3, path: '/article/ame-eveille-toi-philippe-viguier/' },
	{ number: 4, path: '/article/enseigne-moi-r-demaurex-b-m-ramsey/' },
	{ number: 5, path: '/article/sauve/' },
	{ number: 6, path: '/article/toute-la-terre/' },
	{ number: 7, path: '/article/viens-suis-moi/' },
	{ number: 8, path: '/article/coule-a-flots-source-de-grace/' },
	{ number: 9, path: '/article/hymne-a-joie/' },
	{ number: 10, path: '/article/jesus-a-paye/' },
	{ number: 11, path: '/article/joie-dans-le-monde/' },
	{ number: 12, path: '/article/voix-seigneur-mappelle/' },
	{ number: 13, path: '/article/dieu-plus-pres-de-toi/' },
	{ number: 14, path: '/article/o-dieu-grace/' },
	{ number: 15, path: '/article/o-jesus-taime/' },
	{ number: 16, path: '/article/par-la-foi/' },
	{ number: 17, path: '/article/quel-amour-mysterieux/' },
	{ number: 18, path: '/article/redempteur-adorable/' },
	{ number: 19, path: '/article/roc-des-ages/' },
	{ number: 20, path: '/article/viens-decouvrir-cette-fontaine/' },
	{ number: 21, path: '/article/vois-lamour/' },
	{ number: 22, path: '/article/sois-seul-vision/' },
	{ number: 23, path: '/article/sacrifice-parfait/' },
	{ number: 24, path: '/video/je-mattends-a-toi/' },
	{ number: 25, path: '/video/parle-nous/' },
	{ number: 26, path: '/video/jesus-merci/' },
	{ number: 27, path: '/article/seigneur-mon-roc-et-mon-redempteur-o-lord-my-rock-and-my-redeemer/' },
	{ number: 28, path: '/pasteur-compagnie/folle-nuit-de-la-croix/' },
	{ number: 29, path: '/pasteur-compagnie/dieu-leternel-incree/' },
	{ number: 30, path: '/pasteur-compagnie/le-seul-dieu-trois-fois-saint/' },
	{ number: 31, path: '/article/psaume-32/' },
	{ number: 32, path: '/article/psaume-16-jesus-sois-mon-refuge/' },
	{ number: 33, path: '/article/psaume-150/' },
	{ number: 34, path: '/article/psaume-42-je-le-louerai-encore/' },
	{ number: 35, path: '/article/psaume-62-mon-coeur-sattend-a-toi/' },
	{ number: 36, path: '/article/tout-est-accompli-a-la-croix/' },
	{ number: 37, path: '/article/notre-esperance-est-en-christ/' },
	{ number: 38, path: '/pasteur-compagnie/en-memoire-de-ton-nom-chant/' }
];

const NO_LYRICS = 'no lyrics: article about the song';

/** Series pages that get no number, with the reason (logged on every run). */
export const EVANGILE21_SKIPPED: SkippedPage[] = [
	{ path: '/video/craignons-leternel/', reason: NO_LYRICS },
	{
		path: '/article/lhistoire-qui-est-derriere-o-come-all-you-unfaithful-o-viens-peuple-infidele/',
		reason: NO_LYRICS
	},
	{
		path: '/article/chantons-le-chant-demmanuel/',
		reason: 'no lyrics: article about the song, quotes one stanza only'
	},
	{ path: '/video/sa-grace-est-plus-grande/', reason: NO_LYRICS },
	{ path: '/article/nouveau-chant-par-ta-grace-infinie/', reason: NO_LYRICS },
	{ path: '/video/psaume-150/', reason: 'same song as /article/psaume-150/' }
];

// ---------------------------------------------------------------------------------------------
// Listing

/** Paths of the song cards of a series page, as listed (newest first), and the next page. */
export function parseSeriesPage(html: string): { paths: string[]; next: string | null } {
	const $ = load(html);
	const paths: string[] = [];
	$('article.left_image_article_card h2.article_title a.article_link').each((_, a) => {
		const href = $(a).attr('href');
		if (!href) return;
		const path = new URL(href, EVANGILE21_BASE).pathname;
		if (!paths.includes(path)) paths.push(path);
	});
	const nextHref = $('a.next.page-numbers').attr('href');
	return { paths, next: nextHref ? new URL(nextHref, EVANGILE21_BASE).href : null };
}

/**
 * Entry references for the listed paths (newest first): pinned numbers, skipped pages left
 * out, unpinned pages numbered after the highest pinned number, oldest first.
 */
export function numberEntries(
	listed: string[],
	hymnal: string,
	numbers: PinnedNumber[],
	skipped: SkippedPage[],
	log: (message: string) => void
): EntryRef[] {
	const pinned = new Map(numbers.map((n) => [n.path, n.number]));
	const skip = new Map(skipped.map((s) => [s.path, s.reason]));
	let next = Math.max(0, ...numbers.map((n) => n.number));
	const entries: EntryRef[] = [];
	for (const path of [...listed].reverse()) {
		const reason = skip.get(path);
		if (reason !== undefined) {
			log(`${hymnal}: ${path} skipped: ${reason}`);
			continue;
		}
		let number = pinned.get(path);
		if (number === undefined) {
			number = ++next;
			log(`${hymnal} ${number}: ${path} is not pinned yet: add it to EVANGILE21_NUMBERS`);
		}
		entries.push({ hymnal, number: String(number), url: `${EVANGILE21_BASE}${path}` });
	}
	return entries.sort((a, b) => Number(a.number) - Number(b.number));
}

// ---------------------------------------------------------------------------------------------
// Song page

type Node = Parameters<CheerioAPI>[0];
type Line = { text: string; linkOnly: boolean };
type Token = { kind: 'line'; line: Line } | { kind: 'break' };

const BLOCK = /^(p|div|h[1-6]|li|ul|ol|blockquote|section|header|footer|table|tr|td)$/u;
const SKIP = /^(script|style|iframe|svg|noscript|figure|video|audio|button|form)$/u;
/** Text around download links that is not content: "Téléchargements :", "⎪", "–". */
const LINK_FILLER = /^[\s⎪|–—:-]*(?:t[ée]l[ée]chargements?)?[\s⎪|–—:-]*$/iu;

/**
 * The text of a node as lines and stanza breaks. A block holding `<br>` is a stanza on its own;
 * an empty block is a break; any other block is one line.
 */
function tokenize($: CheerioAPI, root: Node): Token[] {
	const tokens: Token[] = [];
	let text = '';
	let plain = '';
	const endLine = () => {
		const line = cleanLine(text);
		if (line !== '') tokens.push({ kind: 'line', line: { text: line, linkOnly: LINK_FILLER.test(plain) } });
		text = '';
		plain = '';
	};
	const walk = (node: Node, inLink: boolean) => {
		$(node)
			.contents()
			.each((_, child) => {
				if (child.type === 'text') {
					text += child.data;
					if (!inLink) plain += child.data;
					return;
				}
				if (child.type !== 'tag') return;
				const tag = child.tagName.toLowerCase();
				if (SKIP.test(tag)) return;
				if (tag === 'br') return endLine();
				if (BLOCK.test(tag)) {
					endLine();
					const stanza = $(child).find('br').length > 0;
					const empty = cleanLine($(child).text()) === '';
					if (stanza || empty) tokens.push({ kind: 'break' });
					walk(child, inLink);
					endLine();
					if (stanza) tokens.push({ kind: 'break' });
					return;
				}
				walk(child, inLink || tag === 'a');
			});
	};
	walk(root, false);
	endLine();
	return tokens;
}

const LABEL =
	/^(couplets?|strophe|pr[ée]-?\s?refrain|refrain|ch(?:œ|oe)ur|pont|bridge|introduction|intro|fin|coda|tag|final)\s*(\d+)?\s*:?$/iu;

function labelSection(label: RegExpExecArray): Pick<Section, 'type' | 'number'> {
	const name = normalizeText(label[1]);
	const n = label[2] ? Number(label[2]) : null;
	if (/^(couplets?|strophe)$/u.test(name)) return { type: 'verse', number: n };
	if (/^pre ?refrain$/u.test(name)) return { type: 'other', number: null };
	if (/^(refrain|choeur)$/u.test(name)) return { type: 'chorus', number: null };
	if (/^(pont|bridge)$/u.test(name)) return { type: 'bridge', number: null };
	return { type: 'other', number: null };
}

/** "Paroles :", "Les paroles", "Transcript": the lyrics follow. */
const LYRICS_MARKER = /^(?:les\s+)?paroles\s*:?$|^transcript$/iu;
/** A Bible verse quoted between stanzas ("4car nuit et jour…"). */
const BIBLE_VERSE = /^\d+\p{L}/u;
/** Longer than any lyric line: commentary around the song. */
const PROSE_LENGTH = 140;
const END_OF_LYRICS = /^(?:version anglophone|(?:les\s+)?partitions\s+(?:sont\s+)?disponibles)/iu;
const MIN_LYRIC_LINES = 4;

// Credits -------------------------------------------------------------------------------------

/** A line that holds credits starts with one of these. */
const CREDIT_START =
	/^(?:©|copyright\b|note de l|paroles?\b|musique\b|mélodie\b|air\b|tr\.|traduct|composition\b|auteurs?\s*:|titre original|production\b)/iu;

const CLAUSE = new RegExp(
	[
		"(?<both>parole?s?\\s+et\\s+musique|musique\\s+et\\s+paroles?)\\s*(?:par|de|d[’']|:)?",
		"(?<lyrics>paroles?)\\s*(?:par|de|d[’']|:)",
		"(?<music>musique)\\s*(?:par|de|d[’']|:)",
		'(?<translation>(?:(?<!\\p{L})|(?<=\\p{Ll}))tr\\.(?:\\s*et\\s+pont\\s+par)?|traduction\\s*(?:par|:)?|traducteurs?\\s*[:;]?|traduit\\s+par)',
		'(?<arrangement>(?<!\\p{L})ar\\.|arrangement\\s*(?:par|:)?)',
		'(?<unspecified>composition\\s*:|auteurs?\\s*:)',
		'(?<stop>©|copyright|creative commons|domaine? public|tous droits|utilisé avec|reproduction|titre original|production|interprétation|voix\\s*:|mix\\b|pont\\s+par|refrain\\s+par|note de l|atg\\s*#|recueil|—|\\(|«|/)'
	].join('|'),
	'giu'
);

const ROLES: Record<string, CreditRole[]> = {
	both: ['lyrics', 'music'],
	lyrics: ['lyrics'],
	music: ['music'],
	translation: ['translation'],
	arrangement: ['arrangement'],
	unspecified: ['unspecified']
};

/** One name: two to five words, each starting with a capital ("R.K. Carter", "Rose D."). */
const NAME = /^\p{Lu}[\p{L}’'.-]*(?:\s+(?:van|von|de|du|d[’'])?\s*\p{Lu}[\p{L}’'.-]*){1,4}$/u;

function namesIn(text: string): string[] {
	// The clause ends at the first sentence end that is not an initial ("A. Humbert").
	const sentence = text.split(/(?<![\s.]\p{Lu}|^\p{Lu})\.\s+/u)[0];
	return sentence
		.split(/\s*,\s*|\s+et\s+|\s*&\s*/u)
		.map((part) => cleanLine(part.replace(/(?<!(?:^|[\s.])\p{Lu})[.,;:]+$/u, '')))
		.filter((part) => /\p{L}/u.test(part) && !/^\d/u.test(part));
}

function addCredits(text: string, credits: Credit[]) {
	const matches = [...text.matchAll(CLAUSE)];
	matches.forEach((match, i) => {
		const group = Object.entries(match.groups ?? {}).find(([, v]) => v !== undefined)?.[0];
		if (!group || group === 'stop') return;
		const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
		const clause = text.slice(match.index + match[0].length, end);
		for (const name of namesIn(clause)) {
			for (const role of ROLES[group]) {
				if (!credits.some((c) => c.name === name && c.role === role)) credits.push({ name, role });
			}
		}
	});
}

/** "Pete James et Aaron Keyes", "Jordan Kaufflin, Matt Merker,": a line of names only. */
function namesLine(text: string): string[] | null {
	const before = text.split('©')[0].replace(/[.,]\s*$/u, '');
	const parts = before.split(/\s*,\s*|\s+et\s+|\s*&\s*/u).map((p) => cleanLine(p)).filter(Boolean);
	return parts.length > 0 && parts.every((p) => NAME.test(p)) ? parts : null;
}

// Parse -----------------------------------------------------------------------------------------

export function parseEvangile21Hymn(html: string, ref: EntryRef): ParseResult {
	const $ = load(html);
	if (/^\s*Just a moment/iu.test($('title').text())) return { ok: false, reason: 'challenge page' };

	const strippedMarkup: Record<string, number> = {};
	const count = (kind: string) => (strippedMarkup[kind] = (strippedMarkup[kind] ?? 0) + 1);

	const container = $('.entry-content .content_container').first();
	if (container.length === 0) return { ok: false, reason: 'no lyrics' };
	const tokens = tokenize($, container[0]);
	const lines = tokens.flatMap((t, i) => (t.kind === 'line' ? [{ ...t.line, i }] : []));

	// Where the lyrics start (research R7).
	const marker = lines.find((l) => LYRICS_MARKER.test(l.text));
	const firstLabel = lines.find((l) => LABEL.test(l.text));
	const isFront = (l: Line) =>
		l.linkOnly || CREDIT_START.test(l.text) || namesLine(l.text) !== null || LYRICS_MARKER.test(l.text);
	let start: number;
	if (marker) {
		count('lyrics-marker');
		start = marker.i + 1;
	} else if (firstLabel) {
		start = firstLabel.i;
	} else {
		start = lines.find((l) => !isFront(l))?.i ?? tokens.length;
	}
	for (const l of lines) if (l.i < start && l.linkOnly) count('download-links');

	// The lyrics run until credits, links, commentary or the end of the post.
	// Unlabelled stanzas are numbered verses, unless the page labels its verses itself.
	const labelsVerses = lines.some((l) => {
		const label = l.i >= start ? LABEL.exec(l.text) : null;
		return label !== null && labelSection(label).type === 'verse';
	});
	const sections: Section[] = [];
	let open: Section | null = null;
	let pending: Pick<Section, 'type' | 'number'> | null = null;
	let verses = 0;
	let end = tokens.length;
	for (let i = start; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.kind === 'break') {
			open = null;
			continue;
		}
		const { text, linkOnly } = token.line;
		if (BIBLE_VERSE.test(text)) {
			count('bible-verse');
			continue;
		}
		if (linkOnly || CREDIT_START.test(text) || END_OF_LYRICS.test(text) || text.length > PROSE_LENGTH) {
			end = i;
			break;
		}
		const label = LABEL.exec(text);
		if (label) {
			count('section-label');
			if (pending) count('repeat-marker');
			pending = labelSection(label);
			open = null;
			continue;
		}
		if (!open) {
			const kind: Pick<Section, 'type' | 'number'> =
				pending ?? (labelsVerses ? { type: 'other', number: null } : { type: 'verse', number: ++verses });
			open = { ...kind, lines: [] };
			sections.push(open);
			pending = null;
		}
		open.lines.push(text);
	}
	if (pending) count('repeat-marker');

	const lyricLines = sections.reduce((n, s) => n + s.lines.length, 0);
	if (lyricLines < MIN_LYRIC_LINES) return { ok: false, reason: 'no lyrics' };

	// Credits: names above the lyrics, credit lines anywhere else, the editor's note.
	const credits: Credit[] = [];
	for (const l of lines) {
		if (l.i >= start && l.i < end) continue;
		if (l.i < start && !l.linkOnly && !CREDIT_START.test(l.text)) {
			const names = namesLine(l.text);
			if (names) {
				for (const name of names) {
					if (!credits.some((c) => c.name === name)) credits.push({ name, role: 'unspecified' });
				}
				continue;
			}
		}
		if (CREDIT_START.test(l.text)) addCredits(l.text, credits);
	}
	const note = $('.entry-content .article_editors_note').first();
	if (note.length > 0) {
		for (const t of tokenize($, note[0])) if (t.kind === 'line') addCredits(t.line.text, credits);
	}

	// Title: the page heading, without a site qualifier ("(chant)") or a credited name.
	let title = cleanLine($('h1.entry-title').first().text() || $('h1').first().text());
	if (!title) return { ok: false, reason: 'no title' };
	const qualifier = /\s*\(([^()]+)\)$/u.exec(title);
	if (
		qualifier &&
		(normalizeText(qualifier[1]) === 'chant' ||
			credits.some((c) => normalizeText(c.name) === normalizeText(qualifier[1])))
	) {
		title = title.slice(0, qualifier.index);
		count('title-qualifier');
	}

	return {
		ok: true,
		hymn: {
			source: 'evangile21',
			hymnal: ref.hymnal,
			number: ref.number,
			url: ref.url,
			title,
			sections,
			credits,
			strippedMarkup,
			unknownCredits: []
		}
	};
}

export function createEvangile21Adapter(
	numbers: PinnedNumber[] = EVANGILE21_NUMBERS,
	skipped: SkippedPage[] = EVANGILE21_SKIPPED
): SourceAdapter {
	return {
		id: 'evangile21',
		async listEntries(hymnal, ctx) {
			if (hymnal !== 'evangile21') {
				throw new Error(`evangile21.thegospelcoalition.org does not cover hymnal "${hymnal}"`);
			}
			const listed: string[] = [];
			const seen = new Set<string>();
			let url: string | null = EVANGILE21_SERIES_URL;
			while (url && !seen.has(url)) {
				seen.add(url);
				const page = parseSeriesPage(await ctx.fetch(url));
				for (const path of page.paths) if (!listed.includes(path)) listed.push(path);
				url = page.next;
			}
			return numberEntries(listed, hymnal, numbers, skipped, ctx.log);
		},
		parseHymn: parseEvangile21Hymn
	};
}

export const evangile21 = createEvangile21Adapter();
registerAdapter(evangile21);
