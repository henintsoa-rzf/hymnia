/**
 * Adapter for pasteuretcompagnie.com (`petc`): the hymnal "Pasteur & Compagnie"
 * (`pasteur-compagnie`), the shop of Philippe Viguier's music project. Page structure and
 * selectors: tests/import/fixtures/petc/README.md; decisions:
 * specs/010-pasteur-compagnie-hymnal/research.md.
 *
 * - The "Partitions" list (several pages of product cards) gives the song pages. The
 *   "Digital albums" list gives the albums; each album's description holds a numbered
 *   tracklist. Albums are the hymnal's parts (content/hymnals.json).
 * - Numbers are made up and pinned in PETC_NUMBERS (R4): an album song is the album's hundred
 *   plus its track number (P&C 307 = album at 300, track 7); a song on no album is numbered from
 *   1001 ("Hors album"). A song on two albums has two numbers (one hymn, two entries: R5).
 * - A track with no song page takes its lyrics from the lyrics page its album links to (KIDS),
 *   or is returned as `<album>#track-<n>` and reported as skipped with its reason (R6).
 * - Song pages are Shopify rich text written like the Evangile21 posts (same author): the
 *   Evangile21 tokenizer, section labels and credit parser are reused (R8). Lines that are not
 *   lyrics (shop notes, recording credits, hymnal references) are counted, never kept; doubts
 *   are returned as warnings, listed in the report as "À vérifier à la main" (R7).
 */
import { load, type CheerioAPI } from 'cheerio';
import type { Credit, Section } from '../../../src/lib/domain/schema';
import { normalizeText } from '../../../src/lib/search/normalize';
import { cleanLine, isChordLine } from './clean';
import {
	addCredits,
	CREDIT_START,
	LABEL,
	labelSection,
	namesLine,
	tokenize,
	type Node,
	type Token
} from './evangile21';
import { registerAdapter } from './index';
import type { AdapterContext, EntryRef, ParseResult, SourceAdapter } from './types';

export const PETC_BASE = 'https://pasteuretcompagnie.com';
export const PETC_HYMNAL = 'pasteur-compagnie';
export const PETC_LIST_URL = `${PETC_BASE}/collections/partitions`;
export const PETC_ALBUMS_URL = `${PETC_BASE}/collections/digital-albums`;
export const PETC_KIDS_LYRICS = `${PETC_BASE}/pages/album-kids-paroles`;
/** "Hors album": the part of the songs on no album. Its numbers start at 1001. */
export const HORS_ALBUM_FIRST = 1000;
const MAX_LIST_PAGES = 50;

/**
 * A pinned number. `page` is a song handle (`grace-infinie`), a track of an album's lyrics
 * page (`album-kids-paroles#2`), or an album track with no lyrics (`dans-ses-mains#track-5`).
 */
export type PinnedNumber = { number: number; page: string };
export type PetcAlbum =
	| { handle: string; first: number; name: string }
	| { handle: string; skip: string };

/**
 * The albums, in release order. Each one is a part of the hymnal in content/hymnals.json with
 * the same name and first number (checked by tests). A new album is added here with the next
 * free hundred, in the same commit as its part and its content (data-model "Album").
 */
export const PETC_ALBUMS: PetcAlbum[] = [
	{ handle: 'hymnes21-2018', first: 100, name: 'Hymnes21 2018' },
	{ handle: 'impros-louange', first: 200, name: 'Impros louange' },
	{ handle: 'dans-ses-mains', first: 300, name: 'Dans ses mains' },
	{ handle: 'kids', first: 400, name: 'KIDS' },
	{ handle: 'kids-album-pistes-instrumentales', skip: 'same tracklist as KIDS (instrumental)' },
	{ handle: 'plus-haut-encore-album', first: 500, name: 'Plus haut encore' }
];

/**
 * Pinned numbers, frozen on 2026-11-16 (data-model "Initial numbers"). Never change or reuse a
 * number; a new song is pinned here in the same commit as its content (data-model "Pinned
 * number"). A song on two albums has one row per album.
 */
export const PETC_NUMBERS: PinnedNumber[] = [
	// Hymnes21 2018
	{ number: 101, page: 'sauve-1' }, // 1. Sauvé
	{ number: 102, page: 'vois-lamour-here-is-love' }, // 2. Vois l'amour
	{ number: 103, page: 'jesus-a-tout-paye-jesus-paid-it-all' }, // 3. Jésus a tout payé
	{ number: 104, page: 'la-aussi-psaume-139' }, // 4. Là aussi
	{ number: 105, page: 'coule-a-flots-come-thou-fount' }, // 5. Coule à flots
	{ number: 106, page: 'mon-ame-eveille-toi-1' }, // 6. Mon âme éveille-toi
	{ number: 107, page: 'sois-seul-ma-vision-1' }, // 7. Sois seul ma vision
	{ number: 108, page: 'purifie-1' }, // 8. Purifié
	{ number: 109, page: 'viens-suis-moi-1' }, // 9. Viens suis-moi
	// Impros louange
	{ number: 201, page: 'impros-louange#track-1' }, // 1. Dans la joie (no lyrics on the site)
	{ number: 202, page: 'sois-seul-ma-vision-1' }, // 2. Sois seul ma vision
	{ number: 203, page: 'mon-dieu-plus-pres-de-toi-nearer-my-god-to-thee' }, // 3. Mon Dieu plus près de toi
	{ number: 204, page: 'viens-suis-moi-1' }, // 4. Viens suis-moi
	{ number: 205, page: 'sur-le-mont-du-calvaire-the-old-rugged-cross' }, // 5. Sur le mont du Calvaire
	{ number: 206, page: 'enseigne-moi' }, // 6. Enseigne-moi
	{ number: 207, page: 'hymnes-a-la-joie-joyful-joyful-we-adore-thee' }, // 7. Hymne à la joie
	{ number: 208, page: 'tel-que-je-suis' }, // 8. Tel que je suis
	{ number: 209, page: 'a-l-agneau-sur-son-trone' }, // 9. A l'Agneau
	{ number: 210, page: 'impros-louange#track-10' }, // 10. Rien ne peut sauver mon âme (no lyrics on the site)
	{ number: 211, page: 'mon-ame-eveille-toi-1' }, // 11. Mon âme éveille-toi
	{ number: 212, page: 'jesus-christ-est-ma-sagesse' }, // 12. Jésus-Christ est ma sagesse
	{ number: 213, page: 'par-la-foi' }, // 13. Par la foi
	{ number: 214, page: 'impros-louange#track-14' }, // 14. Seigneur attire (no lyrics on the site)
	// Dans ses mains
	{ number: 301, page: 'je-mattends-a-toi-i-will-wait-for-you' }, // 1. Je m'attends à toi (Sébastien Demrey)
	{ number: 302, page: 'la-gloire-du-calvaire' }, // 2. La gloire du Calvaire (Philippe Viguier)
	{ number: 303, page: 'jesus-merci-jesus-thank-you' }, // 3. Jésus merci (Elyne Jeannet & Philippe Viguier)
	{ number: 304, page: 'viens-et-vois-were-you-there' }, // 4. Viens et vois (Philippe Viguier & Darlène Rizzitelli)
	{ number: 305, page: 'dans-ses-mains#track-5' }, // 5. Les cieux proclament (Tendry) (no lyrics on the site)
	{ number: 306, page: 'o-jesus-je-taime-my-jesus-i-love-thee' }, // 6. Ô Jésus je t'aime (Louise Zbinden)
	{ number: 307, page: 'il-me-gardera-he-will-hold-me-fast' }, // 7. Il me gardera (Alicia Roehrig & Philippe Viguier)
	{ number: 308, page: 'saint-esprit-holy-spirit' }, // 8. Saint-Esprit (Elyne Jeannet & Philippe Viguier)
	{ number: 309, page: 'non-par-moi' }, // 9. Non par moi mais par Christ en moi (Philippe Viguier)
	{ number: 310, page: 'dans-ses-mains#track-10' }, // 10. Entre tes mains (Tendry) (no lyrics on the site)
	// KIDS
	{ number: 401, page: 'de-generation-en-generation' }, // 1. De génération en génération
	{ number: 402, page: 'album-kids-paroles#2' }, // 2. L'évangile c'est de la bombe
	{ number: 403, page: 'oui-je-crois' }, // 3. Oui je crois
	{ number: 404, page: 'au-ciel' }, // 4. Au ciel
	{ number: 405, page: 'album-kids-paroles#5' }, // 5. Coeur cassé
	{ number: 406, page: 'album-kids-paroles#6' }, // 6. Bien dans ma peau
	{ number: 407, page: 'que-tout-ce-qui-respire' }, // 7. Que tout ce qui respire
	{ number: 408, page: 'quand-je-songe-a-cette-croix' }, // 8. Quand je songe à cette croix
	{ number: 409, page: 'il-me-tient-par-la-main' }, // 9. Il me tient par la main
	{ number: 410, page: 'psaume-131' }, // 10. Psaume 131
	{ number: 411, page: 'papa-cest-quoi-une-ame-partition' }, // 11. Papa, c'est quoi une âme?
	// Plus haut encore
	{ number: 501, page: 'le-seul-dieu-trois-fois-saint' }, // 1. Le seul Dieu trois fois saint
	{ number: 502, page: 'plus-haut-encore' }, // 2. Plus haut encore
	{ number: 503, page: 'est-il-digne-is-he-worthy' }, // 3. Est-il digne ?
	{ number: 504, page: 'plus-haut-encore-album#track-4' }, // 4. C'était toujours toi (no lyrics on the site)
	{ number: 505, page: 'coule-a-flots-come-thou-fount' }, // 5. Coule à flots (par-dessus tout)
	{ number: 506, page: 'en_memoire_de_ton_nom' }, // 6. En mémoire de ton nom
	{ number: 507, page: 'psaume-32' }, // 7. Psaume 32
	{ number: 508, page: 'je-me-confie-en-mon-sauveur-i-will-trust-my-savior-jesus' }, // 8. Je me confie en mon Sauveur
	{ number: 509, page: 'nous-voici' }, // 9. Nous voici
	{ number: 510, page: 'lespoir-1' }, // 10. L'espoir
	// Hors album (oldest product first)
	{ number: 1001, page: 'au-dessus-des-royaumes' },
	{ number: 1002, page: 'alleluia-quel-grand-sauveur' },
	{ number: 1003, page: 'glorieux-tout-puissant-glorious-and-mighty' },
	{ number: 1004, page: 'o-dieu-ta-grace-grace-greater-than-our-sins' },
	{ number: 1005, page: 'grace-infinie' },
	{ number: 1006, page: 'lamour-de-dieu' },
	{ number: 1007, page: 'vous-creatures-du-grand-roi-all-creatures-of-our-god-and-king' },
	{ number: 1008, page: 'sa-grace-est-plus-grande-his-mercy-is-more' },
	{ number: 1009, page: 'viens-decouvrir-cette-fontaine' },
	{ number: 1010, page: 'joie-dans-le-monde-joy-to-the-world' },
	{ number: 1011, page: 'chef-couvert-de-blessures-1' },
	{ number: 1012, page: 'roc-des-ages-roc-of-ages' },
	{ number: 1013, page: 'quel-amour-mysterieux-what-wondrous-love-is-this' },
	{ number: 1014, page: 'redempteur-adorable' },
	{ number: 1015, page: 'parle-nous' },
	{ number: 1016, page: 'seigneur-mon-roc-et-mon-redempteur-o-lord-my-roc-and-my-redeemer' },
	{ number: 1017, page: 'voici-noel-jazzy' },
	{ number: 1018, page: 'folle-nuit-de-la-croix' },
	{ number: 1019, page: 'dieu-leternel-incree' },
	{ number: 1020, page: 'psaume-150' },
	{ number: 1021, page: 'psaume-42' },
	{ number: 1022, page: 'christ-notre-esperance' },
	{ number: 1023, page: 'o-peuple-fidele' },
	{ number: 1024, page: 'et-se-peut-il-and-can-it-be' },
	{ number: 1025, page: 'minuit-chretiens' },
	{ number: 1026, page: 'noel-jesus-est-ne' },
	{ number: 1027, page: 'chantons-lhistoire-demmanuel' },
];

// ---------------------------------------------------------------------------------------------
// Page keys and URLs

const TRACK_KEY = /^(?<album>[^#]+)#track-(?<track>\d+)$/u;
const LYRICS_KEY = /^(?<page>[^#]+)#(?<track>\d+)$/u;

/** The URL of a pinned page key (see PinnedNumber). */
export function pageUrl(page: string): string {
	if (TRACK_KEY.test(page)) return `${PETC_BASE}/products/${page}`;
	if (LYRICS_KEY.test(page)) return `${PETC_BASE}/pages/${page}`;
	return `${PETC_BASE}/products/${page}`;
}

// ---------------------------------------------------------------------------------------------
// Listing

export type Card = { handle: string; title: string };

/** The product cards of a collection page (grid only: menus link to other products). */
export function parseListPage(html: string): Card[] {
	const $ = load(html);
	const cards: Card[] = [];
	$('.grid-view-item').each((_, item) => {
		const href = $(item).find('a.grid-view-item__link').attr('href');
		const handle = href ? /\/products\/([^/?#]+)/u.exec(href)?.[1] : undefined;
		if (!handle || cards.some((c) => c.handle === handle)) return;
		cards.push({ handle, title: cleanLine($(item).find('.product-card__title').first().text()) });
	});
	return cards;
}

export type Track = { track: number; title: string };

const TRACK_LINE = /^(\d+)\s*\.\s*(.+)$/u;

/** The numbered tracklist of an album page, and the lyrics pages its description links to. */
export function parseTracklist(html: string): { tracks: Track[]; lyricsPages: string[] } {
	const $ = load(html);
	const description = $('.product-single__description').first();
	const tracks: Track[] = [];
	if (description.length > 0) {
		for (const token of tokenize($, description[0])) {
			if (token.kind !== 'line') continue;
			const m = TRACK_LINE.exec(token.line.text);
			if (m) tracks.push({ track: Number(m[1]), title: cleanLine(m[2]) });
		}
	}
	const lyricsPages: string[] = [];
	description.find('a[href*="/pages/"]').each((_, a) => {
		const page = /\/pages\/([^/?#]+)/u.exec($(a).attr('href') ?? '')?.[1];
		if (page && !lyricsPages.includes(page)) lyricsPages.push(page);
	});
	return { tracks, lyricsPages };
}

const withoutBrackets = (text: string) => text.replace(/\([^()]*\)/gu, ' ');
const matchKey = (text: string) => normalizeText(withoutBrackets(text));

export type TrackMatch =
	| { kind: 'song'; handle: string }
	| { kind: 'none' }
	| { kind: 'several'; handles: string[] }
	| { kind: 'instrumental' };

/**
 * The song page of an album track: same title, ignoring brackets (singers, notes), case,
 * accents and punctuation; or a title that starts with the other one ("A l'Agneau").
 */
export function resolveTrack(title: string, songs: Card[]): TrackMatch {
	if (/\(\s*instrumental\s*\)/iu.test(title)) return { kind: 'instrumental' };
	const key = matchKey(title);
	if (!key) return { kind: 'none' };
	const exact = songs.filter((s) => matchKey(s.title) === key);
	const found =
		exact.length > 0
			? exact
			: songs.filter((s) => {
					const other = matchKey(s.title);
					return other.startsWith(`${key} `) || key.startsWith(`${other} `);
				});
	if (found.length === 1) return { kind: 'song', handle: found[0].handle };
	if (found.length === 0) return { kind: 'none' };
	return { kind: 'several', handles: found.map((s) => s.handle) };
}

// ---------------------------------------------------------------------------------------------
// Titles

/** Words that mark a bracket as the English original title ("(Amazing Grace)"). */
const ENGLISH = new Set(
	`the thee thou you your my me i is are am was were be it its of our and but not yet to with for
	in on all as just will can he him his there here this what than only lord god king holy grace
	love mercy praise sing song speak come joy joyful amazing worthy glorious mighty wondrous
	glories crown crowns rugged cross nearer savior saviour paid hold fast wait thank trust again
	higher throne spirit creatures fount ages rock redeemer`.split(/\s+/u)
);

/**
 * The hymn title of a product title: without a trailing English original title or
 * "(partition)"; other notes ("(jazzy)", "(Psaume 139)") stay (research R9).
 */
export function cleanTitle(productTitle: string): { title: string; removed?: string } {
	const title = cleanLine(productTitle);
	const m = /\s*\(([^()]*)\)\s*$/u.exec(title);
	if (!m || m.index === 0) return { title };
	const words = normalizeText(m[1]).split(' ');
	const english = words.some((w) => ENGLISH.has(w));
	if (english || (words.length === 1 && words[0] === 'partition')) {
		return { title: title.slice(0, m.index), removed: m[1] };
	}
	return { title };
}

// ---------------------------------------------------------------------------------------------
// Lyrics

/** Lines that are not lyrics, by kind (research R8). Counted in `strippedMarkup`. */
const NOTES: [kind: string, test: RegExp][] = [
	[
		'shop note',
		/^(?:l[ae] fichier en vente|une version jazz|arrangement piano|un arrangement simple|partitions?\b|bénéficiez|retrouvez)|\bleadsheet\b/iu
	],
	[
		'recording credit',
		/^(?:violons?|violoncelles?|piano|guitares?|batterie|basse|claviers?|voix|ch(?:œ|oe)urs?|chant|cordes)\s*:|^d\.?a\.?\s*,|\bmix(?:é|age)?\b|\bmaster|^produit par|^réalis/iu
	],
	['marker', /^(?:les\s+)?paroles\s*:?$|^mp3 gratuit$/iu],
	['copyright', /\badm\.?\s+by\b|\(prs\)|\bccli\b|all rights reserved|tous droits réservés/iu],
	['hymnal reference', /^(?:atg|(?:à|a) toi (?:la )?gloire)\s*#?\s*\d+\s*\.?$/iu]
];

/** A line that holds credits ("Tr Philippe Viguier.", "Saillens. G. Elvey. Domaine Public."). */
const CREDIT_LINE =
	/domaine public|©|\btr\.?\s+\p{Lu}|(?:^|[\s.])ar\.\s|\b(?:paroles|musique)\s+(?:et\s+\p{L}+\s+)?(?:par|de|d[’']|:)|\barrangement\s+(?:par|de|:|\p{Lu})|^cantique de|^traduction|^rec\.\s|\bair\s+(?:anglais|allemand|écossais|irlandais|traditionnel|populaire|gallois)\b/iu;

/** One name, initials allowed ("R.K. Carter", "Saillens", "Ludwig van Beethoven"). */
const NAME = /^\p{Lu}[\p{L}’'.-]*(?:\s+(?:van|von|de|du|d[’'])?\s*\p{Lu}[\p{L}’'.-]*){0,4}$/u;
/** Where the role clauses of a credit line start. */
const ROLE_START = /(?:^|[\s.,])(?:tr\.|traduction|ar\.|arrangement|paroles|musique|pont|domaine|©|atg)/iu;

function isCreditLine(text: string) {
	return CREDIT_START.test(text) || CREDIT_LINE.test(text);
}

function noteKind(text: string): string | undefined {
	return NOTES.find(([, test]) => test.test(text))?.[0];
}

/** Adds the credits of one credit line: names with no role, then role clauses. */
function creditsOf(line: string, credits: Credit[]) {
	const text = line
		.replace(/\s*\/\s*/gu, ', ')
		.replace(/\btr\s+(?=\p{Lu})/giu, 'Tr. ')
		.replace(/^cantique de\s+/iu, 'Paroles de ');
	const before = credits.length;
	const add = (name: string, role: Credit['role']) => {
		if (!credits.some((c) => c.name === name && c.role === role)) credits.push({ name, role });
	};
	// Names with no role: each sentence with no role clause, and the text before the first one
	// ("Saillens. G. Elvey. Domaine Public.", "Amazing Grace © 1760 Domaine public. John Newton.").
	for (const sentence of text.split(SENTENCE_END)) {
		const role = ROLE_START.exec(sentence);
		const names = sentence.slice(0, role ? role.index : sentence.length);
		for (const part of names.split(NAME_SEPARATOR)) {
			const name = cleanLine(part.replace(/[.,;:]+$/u, ''));
			if (isName(name)) add(name, 'unspecified');
		}
	}
	const named = credits.length;
	addCredits(text, credits);
	// Role clauses: "par" or "et" left in front of a name ("Traduction par E. Oemkens").
	for (const c of credits.slice(named)) c.name = c.name.replace(/^(?:par|et|de)\s+/iu, '');
	// "Steve & Vikki Cook", "Keith & Kristyn Getty": a first name alone shares the next surname.
	const added = credits.slice(before);
	added.forEach((c, k) => {
		const next = added.slice(k + 1).find((o) => o.role === c.role);
		if (/^\p{Lu}\p{Ll}+$/u.test(c.name) && FIRST_NAMES.has(c.name) && next?.name.includes(' ')) {
			c.name = `${c.name} ${next.name.split(' ').at(-1)}`;
		}
	});
	// A name given a role by the clauses is not also a credit with no role; no duplicates.
	const kept = credits.filter(
		(c, k) =>
			!NOT_A_NAME.test(c.name) &&
			!(c.role === 'unspecified' && credits.some((o) => o.name === c.name && o.role !== 'unspecified')) &&
			credits.findIndex((o) => o.name === c.name && o.role === c.role) === k
	);
	credits.splice(0, credits.length, ...kept);
}

/** First names that share a surname in "Steve & Vikki Cook" (the only ones on the site). */
const FIRST_NAMES = new Set(['Steve', 'Keith', 'Matt', 'Rich', 'Jonny', 'Tsiry']);
/** The end of a sentence, not an initial ("A. Humbert", "R.K. Carter"). */
const SENTENCE_END = /(?<=\p{Ll}{2})\.\s+/u;
const NAME_SEPARATOR = /\s*,\s*|\s+et\s+|\s*&\s*|\s+-\s+/u;

/** Licences, publishers and words in capitals ("JEUNESSE EN MISSION"): not people. */
const NOT_A_NAME = {
	test: (name: string) =>
		/^(?:creative commons|domaine public)/iu.test(name) || /^[\p{Lu}\s.'’-]+\s[\p{Lu}\s.'’-]+$/u.test(name)
};

/** A credited name: one to five capitalised words; one word needs 5 letters ("Rec" is not). */
function isName(name: string): boolean {
	if (!name || !NAME.test(name)) return false;
	if (!name.includes(' ') && !name.includes('.') && name.length < 5) return false;
	// An English title in the credit line ("Amazing Grace ©…") is not a name.
	return !normalizeText(name)
		.split(' ')
		.every((w) => ENGLISH.has(w));
}

type Extracted = {
	sections: Section[];
	credits: Credit[];
	strippedMarkup: Record<string, number>;
	warnings: string[];
};

/** A section label, also with a note in brackets ("Refrain (femmes)"). */
function labelOf(text: string): RegExpExecArray | null {
	return LABEL.exec(text) ?? LABEL.exec(text.replace(/\s*\([^()]*\)\s*(:?)$/u, '$1'));
}
const isLabel = (text: string) => labelOf(text) !== null;

/** "Intro :" in front of a chord line. */
const CHORD_LINE_LABEL = /^(?:intro|outro|interlude|instrumental|pont|fin)\s*:\s*/iu;
/** A syllable split under a chord, in a chord sheet ("appel - le"). */
const SYLLABLE_SPLIT = /(\p{L}) [-‐–] (\p{L})/gu;

/** More lines than this in one unlabelled section: the stanzas were probably not split. */
const LONG_SECTION = 12;

/** Lyrics, credits and notes of a description, as tokens (research R8). */
export function extractLyrics(tokens: Token[], title: string): Extracted {
	const strippedMarkup: Record<string, number> = {};
	const count = (kind: string) => (strippedMarkup[kind] = (strippedMarkup[kind] ?? 0) + 1);
	const warnings: string[] = [];
	const credits: Credit[] = [];
	const titleKey = matchKey(title);

	/** Prelude: credits, notes, the title repeated or in English, until a label or a lyric. */
	const prelude = (text: string): 'credit' | 'note' | 'title' | null => {
		if (noteKind(text)) return 'note';
		if (isCreditLine(text) || namesLine(text) !== null) return 'credit';
		const key = matchKey(text);
		if (key === titleKey || /^\(.*\)$/u.test(text) || (key === '' && /\(/u.test(text))) return 'title';
		return null;
	};

	let chordLines = 0;
	/** A line of chords ("G D/G G D/A", "Intro : G D/G Em/G"): never lyrics, never a start. */
	const isChords = (text: string) => isChordLine(text.replace(CHORD_LINE_LABEL, ''));

	let start = tokens.length;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.kind === 'break') continue;
		const text = token.line.text;
		if (isLabel(text)) {
			start = i;
			break;
		}
		if (isChords(text)) {
			chordLines += 1;
			continue;
		}
		let kind = prelude(text);
		// The title as the first lyric line ("Noël ! Jésus est né.") is lyrics: a heading is
		// followed by more prelude (credits, notes) or a label, never by a lyric line.
		if (kind === 'title' && !/^\(.*\)$/u.test(text)) {
			const next = tokens.slice(i + 1).find((t) => t.kind === 'line');
			const nextText = next?.kind === 'line' ? next.line.text : '';
			if (next && !isLabel(nextText) && prelude(nextText) === null) kind = null;
		}
		if (kind === null) {
			start = i;
			break;
		}
		if (kind === 'credit') creditsOf(text, credits);
		else if (kind === 'note') count(noteKind(text)!);
		else count('title heading');
	}

	// A song with no labels: each stanza is a verse. A song with labels: a stanza with no label
	// continues the section before it (these pages put blank lines inside sections), or is
	// "other" when it comes first.
	const labelled = tokens.some((t, i) => i >= start && t.kind === 'line' && isLabel(t.line.text));
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
		const text = token.line.text;
		if (token.line.linkOnly || noteKind(text) || isCreditLine(text)) {
			end = i;
			break;
		}
		if (isChords(text)) {
			chordLines += 1;
			continue;
		}
		const label = labelOf(text);
		if (label) {
			count('section-label');
			if (pending) count('repeat-marker');
			pending = labelSection(label);
			open = null;
			continue;
		}
		if (!open && !pending && labelled && sections.length > 0) {
			open = sections[sections.length - 1];
			count('blank line in a section');
		}
		if (!open) {
			const kind: Pick<Section, 'type' | 'number'> =
				pending ?? (labelled ? { type: 'other', number: null } : { type: 'verse', number: ++verses });
			open = { ...kind, lines: [] };
			sections.push(open);
			pending = null;
		}
		open.lines.push(text);
	}
	if (pending) count('repeat-marker');

	// Chord sheets split syllables under the chords ("appel - le", "Ve - nez"): rejoined.
	if (chordLines > 0) {
		strippedMarkup['chord-line'] = chordLines;
		for (const section of sections) {
			section.lines = section.lines.map((line) => {
				const joined = line.replace(SYLLABLE_SPLIT, '$1$2');
				if (joined !== line) count('syllable split');
				return joined;
			});
		}
	}

	// Postlude: credits and notes; anything else is a doubt, never lyrics.
	for (let i = end; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.kind === 'break') continue;
		const { text, linkOnly } = token.line;
		const note = noteKind(text);
		if (linkOnly) count('link');
		else if (note) count(note);
		else if (isCreditLine(text) || namesLine(text) !== null) creditsOf(text, credits);
		else warnings.push(`unclassified line kept out of the lyrics: "${text}"`);
	}

	if (!labelled && sections.length === 1 && sections[0].lines.length > LONG_SECTION) {
		warnings.push(`stanzas not split: ${sections[0].lines.length} lines in one section`);
	}
	return { sections, credits, strippedMarkup, warnings };
}

// ---------------------------------------------------------------------------------------------
// Parse

const MIN_LYRIC_LINES = 2;
const NOT_A_SONG_TRACKS = 3;

function hymnFrom(
	ref: EntryRef,
	title: string,
	extracted: Extracted,
	extraWarnings: string[] = []
): ParseResult {
	const lines = extracted.sections.reduce((n, s) => n + s.lines.length, 0);
	if (lines < MIN_LYRIC_LINES) return { ok: false, reason: 'no lyrics' };
	return {
		ok: true,
		hymn: {
			source: 'petc',
			hymnal: ref.hymnal,
			number: ref.number,
			url: ref.url,
			title,
			sections: extracted.sections,
			credits: extracted.credits,
			strippedMarkup: extracted.strippedMarkup,
			unknownCredits: [],
			warnings: [...extraWarnings, ...extracted.warnings]
		}
	};
}

/**
 * Some descriptions were pasted from a ChordPro page: each lyric line is followed by an empty
 * `.chordpro-chords` row, which would split every line into a stanza of its own. Removed; the
 * number removed is returned.
 */
function removeChordRows($: CheerioAPI, root: ReturnType<CheerioAPI>): number {
	const rows = root.find('.chordpro-chords');
	rows.remove();
	return rows.length;
}

/** An album track with no lyrics on the site (research R6): always a skipped entry. */
function parseAlbumTrack(html: string, track: number): ParseResult {
	const found = parseTracklist(html).tracks.find((t) => t.track === track);
	const what = found ? `album track ${track} "${found.title}"` : `album track ${track} (not in the tracklist)`;
	return { ok: false, reason: `no lyrics on the site: ${what}` };
}

/** One song of an album lyrics page: from its `<h1>n. title</h1>` to the next `<h1>`. */
function parseLyricsPageSong($: CheerioAPI, ref: EntryRef, track: number): ParseResult {
	const heading = $('.rte h1')
		.filter((_, h) => new RegExp(`^\\s*${track}\\s*\\.`, 'u').test($(h).text()))
		.first();
	if (heading.length === 0) return { ok: false, reason: `no lyrics: track ${track} not on the lyrics page` };
	const title = cleanLine(heading.text().replace(/^\s*\d+\s*\.\s*/u, ''));
	const block = load(
		`<div id="song">${heading
			.nextUntil('h1')
			.toArray()
			.map((n) => $.html(n))
			.join('')}</div>`
	);
	const tokens = tokenize(block, block('#song')[0] as Node);
	return hymnFrom(ref, title, extractLyrics(tokens, title));
}

export function parsePetcHymn(html: string, ref: EntryRef): ParseResult {
	const url = new URL(ref.url);
	const trackFragment = /^#track-(\d+)$/u.exec(url.hash);
	if (trackFragment) return parseAlbumTrack(html, Number(trackFragment[1]));

	const $ = load(html);
	const lyricsFragment = /^#(\d+)$/u.exec(url.hash);
	if (url.pathname.startsWith('/pages/') && lyricsFragment) {
		return parseLyricsPageSong($, ref, Number(lyricsFragment[1]));
	}

	const description = $('.product-single__description').first();
	if (description.length === 0) return { ok: false, reason: 'no lyrics' };
	const chordRows = removeChordRows($, description);
	const productTitle = cleanLine($('h1.product-single__title').first().text() || $('h1').first().text());
	if (!productTitle) return { ok: false, reason: 'no title' };
	if (parseTracklist(html).tracks.length >= NOT_A_SONG_TRACKS) {
		return { ok: false, reason: 'not a song: album page' };
	}
	const { title } = cleanTitle(productTitle);
	const extracted = extractLyrics(tokenize($, description[0]), title);
	if (chordRows > 0) extracted.strippedMarkup['chord row'] = chordRows;
	return hymnFrom(ref, title, extracted);
}

// ---------------------------------------------------------------------------------------------
// Entries

const isAlbum = (a: PetcAlbum): a is Extract<PetcAlbum, { first: number }> => 'first' in a;

/**
 * Entries of the hymnal (research R4): every pinned number, plus what the live lists add.
 * Pinned numbers always win; differences with the live tracklists are logged.
 */
export async function listPetcEntries(
	ctx: AdapterContext,
	numbers: PinnedNumber[],
	albums: PetcAlbum[]
): Promise<EntryRef[]> {
	const log = (message: string) => ctx.log(`${PETC_HYMNAL}: ${message}`);

	// Song pages.
	const songs: Card[] = [];
	let rows = 0;
	for (let page = 1; page <= MAX_LIST_PAGES; page++) {
		const cards = parseListPage(await ctx.fetch(`${PETC_LIST_URL}?page=${page}`));
		if (cards.length === 0) break;
		rows += cards.length;
		for (const card of cards) if (!songs.some((s) => s.handle === card.handle)) songs.push(card);
	}
	log(`${rows} rows, ${songs.length} song pages`);

	// Albums: known ones in release order, then new ones in list order.
	const listedAlbums = parseListPage(await ctx.fetch(PETC_ALBUMS_URL)).map((c) => c.handle);
	const known = albums.filter((a) => listedAlbums.includes(a.handle));
	const unknown = listedAlbums.filter((h) => !albums.some((a) => a.handle === h));
	let nextHundred = Math.max(0, ...albums.filter(isAlbum).map((a) => a.first)) + 100;

	const live: PinnedNumber[] = [];
	let trackCount = 0;
	let matched = 0;
	const toRead: (PetcAlbum | { handle: string })[] = [...known, ...unknown.map((handle) => ({ handle }))];
	for (const album of toRead) {
		if ('skip' in album) {
			log(`album ${album.handle} skipped: ${album.skip}`);
			continue;
		}
		let first: number;
		if (isAlbum(album as PetcAlbum)) {
			first = (album as Extract<PetcAlbum, { first: number }>).first;
		} else {
			if (nextHundred >= HORS_ALBUM_FIRST) throw new Error(`no free hundred left for album ${album.handle}`);
			first = nextHundred;
			nextHundred += 100;
			log(
				`album ${album.handle} is not pinned yet (first ${first}): add it to PETC_ALBUMS and to the parts in content/hymnals.json`
			);
		}
		const { tracks, lyricsPages } = parseTracklist(await ctx.fetch(`${PETC_BASE}/products/${album.handle}`));
		for (const { track, title } of tracks) {
			trackCount += 1;
			const found = resolveTrack(title, songs);
			if (found.kind === 'instrumental') {
				log(`album ${album.handle} track ${track} "${title}" skipped: instrumental`);
				continue;
			}
			let page: string;
			if (found.kind === 'song') {
				matched += 1;
				page = found.handle;
			} else if (found.kind === 'none' && lyricsPages.length > 0) {
				matched += 1;
				page = `${lyricsPages[0]}#${track}`;
			} else {
				if (found.kind === 'several') {
					log(`album ${album.handle} track ${track} "${title}" matches several song pages: ${found.handles.join(', ')}`);
				}
				page = `${album.handle}#track-${track}`;
			}
			live.push({ number: first + track, page });
		}
	}
	log(`${known.length + unknown.length} albums, ${trackCount} tracks, ${matched} matched`);

	// Pinned numbers first; then what the live lists add.
	const result = new Map(numbers.map((n) => [n.number, n.page]));
	for (const { number, page } of live) {
		const pinned = result.get(number);
		if (pinned === undefined) {
			result.set(number, page);
			log(`${number}: ${page} is not pinned yet: add it to PETC_NUMBERS`);
		} else if (pinned !== page) {
			log(`${number}: pinned ${pinned}, the site says ${page}: keep the pinned number, decide by hand`);
		}
	}
	const used = new Set(result.values());
	let next = Math.max(HORS_ALBUM_FIRST, ...[...result.keys()].filter((n) => n > HORS_ALBUM_FIRST));
	for (const song of songs) {
		if (used.has(song.handle)) continue;
		next += 1;
		result.set(next, song.handle);
		used.add(song.handle);
		log(`${next}: ${song.handle} is not pinned yet: add it to PETC_NUMBERS`);
	}

	return [...result.entries()]
		.sort(([a], [b]) => a - b)
		.map(([number, page]) => ({ hymnal: PETC_HYMNAL, number: String(number), url: pageUrl(page) }));
}

export function createPetcAdapter(
	numbers: PinnedNumber[] = PETC_NUMBERS,
	albums: PetcAlbum[] = PETC_ALBUMS
): SourceAdapter {
	return {
		id: 'petc',
		async listEntries(hymnal, ctx) {
			if (hymnal !== PETC_HYMNAL) {
				throw new Error(`pasteuretcompagnie.com does not cover hymnal "${hymnal}"`);
			}
			return listPetcEntries(ctx, numbers, albums);
		},
		parseHymn: parsePetcHymn
	};
}

export const petc = createPetcAdapter();
registerAdapter(petc);
