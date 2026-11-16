// pasteuretcompagnie.com adapter (specs/010-pasteur-compagnie-hymnal/contracts/petc-adapter.md,
// tasks T011–T014, T025, T026, T035).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	cleanTitle,
	createPetcAdapter,
	HORS_ALBUM_FIRST,
	pageUrl,
	parseListPage,
	parsePetcHymn,
	parseTracklist,
	PETC_ALBUMS,
	PETC_ALBUMS_URL,
	PETC_BASE,
	PETC_HYMNAL,
	PETC_LIST_URL,
	PETC_NUMBERS,
	petc,
	resolveTrack,
	type Card,
	type PetcAlbum,
	type PinnedNumber
} from '../../../scripts/import/sources/petc';
import type { AdapterContext, EntryRef, RawHymn } from '../../../scripts/import/sources/types';
import { FIXTURES, fixturePage } from '../helpers/fixtures';

const page = (file: string) => fixturePage('petc', file);
const ref = (url: string, number = '1'): EntryRef => ({ hymnal: PETC_HYMNAL, number, url });
const song = (file: string, handle: string): RawHymn => {
	const result = parsePetcHymn(page(file), ref(`${PETC_BASE}/products/${handle}`));
	if (!result.ok) throw new Error(result.reason);
	return result.hymn;
};
const shape = (h: RawHymn) => h.sections.map((s) => `${s.type}${s.number ?? ''}:${s.lines.length}`);
const allLines = (h: RawHymn) => h.sections.flatMap((s) => s.lines);

describe('song pages (parseHymn)', () => {
	it('Jésus merci: labelled sections, the <h2> credit, English title removed', () => {
		const h = song('song-jesus-merci.html', 'jesus-merci-jesus-thank-you');
		expect(h.title).toBe('Jésus merci');
		expect(shape(h)).toEqual(['verse1:4', 'chorus:6', 'verse2:4', 'bridge:2']);
		expect(h.sections[0].lines[0]).toBe('Le mystère de la croix, comment le concevoir');
		expect(h.credits).toEqual([{ name: 'Pat Sczebel', role: 'unspecified' }]);
		expect(h.warnings).toEqual([]);
	});

	it("L'espoir: recording credits are not lyrics, pre-chorus kept as a section", () => {
		const h = song('song-lespoir.html', 'lespoir-1');
		expect(h.title).toBe("L'espoir");
		expect(h.credits).toEqual([
			{ name: 'Philippe Viguier', role: 'lyrics' },
			{ name: 'Philippe Viguier', role: 'music' }
		]);
		expect(allLines(h).some((l) => /violons|mastering/iu.test(l))).toBe(false);
		expect(h.strippedMarkup['recording credit']).toBe(2);
		expect(shape(h)).toEqual(['verse1:4', 'other:2', 'chorus:5', 'verse2:4', 'other:2', 'chorus:5', 'other:2']);
	});

	it('Rédempteur adorable: no labels, one verse per stanza, repeat marks kept', () => {
		const h = song('song-redempteur-adorable.html', 'redempteur-adorable');
		expect(shape(h)).toEqual(['verse1:4', 'verse2:4', 'verse3:5', 'verse4:5']);
		expect(h.sections[2].lines.at(-1)).toBe('Allélu, alléluia (x4)');
		expect(h.credits).toEqual([
			{ name: 'S. S. Wesley', role: 'music' },
			{ name: 'A. Humbert', role: 'lyrics' },
			{ name: 'Philippe Viguier', role: 'arrangement' }
		]);
	});

	it('Coule à flots: prose credits, "Pont par" and © not stored', () => {
		const h = song('song-coule-a-flots.html', 'coule-a-flots-come-thou-fount');
		expect(h.title).toBe('Coule à flots');
		expect(h.credits).toEqual([
			{ name: 'John Wyeth', role: 'music' },
			{ name: 'Robert Robinson', role: 'lyrics' },
			{ name: 'Philippe Viguier', role: 'translation' }
		]);
		expect(h.credits.some((c) => c.name.includes('Barnard'))).toBe(false);
		expect(h.sections[0].lines).toEqual([
			'Par-dessus tout, reçois ma louange',
			"Par-dessus-tout, oui mon coeur veut t'adorer"
		]);
		expect(allLines(h).some((l) => l.includes('©'))).toBe(false);
	});

	it('Noël, Jésus est né: shop note and hymnal reference out, a first line equal to the title kept', () => {
		const h = song('song-noel-jesus-est-ne.html', 'noel-jesus-est-ne');
		expect(h.sections[0].lines[0]).toBe('Noël ! Jésus est né.');
		expect(shape(h)).toEqual(['verse1:9', 'verse2:9']);
		const lines = allLines(h);
		expect(lines).not.toContain('Arrangement piano-violon et leadsheet.');
		expect(lines).not.toContain('A Toi Gloire 116.');
		expect(lines.some((l) => l.includes('Decovert'))).toBe(false);
		expect(h.credits).toEqual([{ name: 'Decovert-Blochet', role: 'unspecified' }]);
		expect(h.strippedMarkup).toMatchObject({ 'shop note': 1, 'hymnal reference': 1 });
	});

	it("Papa c'est quoi une âme ?: \"(partition)\" removed, the dialogue kept as lyrics", () => {
		const h = song('song-papa.html', 'papa-cest-quoi-une-ame-partition');
		expect(h.title).toBe("Papa c'est quoi une âme ?");
		expect(h.sections[0].lines[0]).toBe('Ma chérie, quand la musique sera terminée ce sera le temps d’aller au lit');
	});

	it('every extracted line is NFC, with no label, URL or shop note', () => {
		for (const [file, handle] of [
			['song-jesus-merci.html', 'jesus-merci-jesus-thank-you'],
			['song-lespoir.html', 'lespoir-1'],
			['song-redempteur-adorable.html', 'redempteur-adorable'],
			['song-coule-a-flots.html', 'coule-a-flots-come-thou-fount'],
			['song-noel-jesus-est-ne.html', 'noel-jesus-est-ne'],
			['song-papa.html', 'papa-cest-quoi-une-ame-partition']
		]) {
			for (const line of allLines(song(file, handle))) {
				expect(line).toBe(line.normalize('NFC'));
				expect(line).not.toMatch(/^(couplet|refrain|pont)\b|https?:|mp3|leadsheet/iu);
			}
		}
	});

	it('an album page given as a song is not a song', () => {
		const result = parsePetcHymn(page('album-dans-ses-mains.html'), ref(`${PETC_BASE}/products/dans-ses-mains`));
		expect(result).toEqual({ ok: false, reason: 'not a song: album page' });
	});
});

describe('titles (research R9)', () => {
	// Every product title of the "Partitions" list on 2026-11-16.
	const catalogue = JSON.parse(readFileSync(join(FIXTURES, 'petc', 'catalogue.json'), 'utf8')) as {
		songs: Card[];
		albumOrder: string[];
		albums: Record<string, { track: number; title: string }[]>;
	};
	const kept = ['Là aussi (Psaume 139)', 'Voici Noël (jazzy)'];

	it('removes the English original title and "(partition)" from all 68 titles, and keeps other notes', () => {
		expect(catalogue.songs).toHaveLength(68);
		for (const { title } of catalogue.songs) {
			const clean = cleanTitle(title).title;
			if (kept.includes(title)) expect(clean).toBe(title);
			else expect(clean).not.toContain('(');
		}
	});

	it.each([
		['Grâce infinie (Amazing Grace)', 'Grâce infinie'],
		['Psaume 42 - Je le louerai encore (I will praise Him again)', 'Psaume 42 - Je le louerai encore'],
		['Est-il digne ? (Is He worthy)', 'Est-il digne ?'],
		["Papa c'est quoi une âme ? (partition)", "Papa c'est quoi une âme ?"],
		['Voici Noël (jazzy)', 'Voici Noël (jazzy)'],
		['Là aussi (Psaume 139)', 'Là aussi (Psaume 139)']
	])('%s → %s', (title, expected) => {
		expect(cleanTitle(title).title).toBe(expected);
	});
});

describe('the KIDS lyrics page', () => {
	const kids = (track: number) => parsePetcHymn(page('kids-lyrics.html'), ref(`${PETC_BASE}/pages/album-kids-paroles#${track}`, `40${track}`));

	it("gives the song of a track: L'évangile c'est de la bombe", () => {
		const result = kids(2);
		if (!result.ok) throw new Error(result.reason);
		expect(result.hymn.title).toBe("L'évangile c'est de la bombe");
		expect(shape(result.hymn)).toEqual(['chorus:8', 'verse1:5', 'verse2:5', 'verse3:5', 'verse4:5', 'bridge:8']);
		expect(result.hymn.sections[0].lines[0]).toBe('L’Évangile oh');
	});

	it('spells the title as in the heading: Coeur cassé', () => {
		const result = kids(5);
		expect(result.ok && result.hymn.title).toBe('Coeur cassé');
	});

	it('fails for a track that is not on the page', () => {
		expect(kids(12).ok).toBe(false);
	});
});

describe('lists and albums', () => {
	it('reads the product cards of the grid only', () => {
		const first = parseListPage(page('list-page1.html'));
		expect(first).toHaveLength(8);
		expect(first[0]).toEqual({ handle: 'jesus-merci-jesus-thank-you', title: 'Jésus merci (Jesus Thank You)' });
		expect(parseListPage(page('list-page9.html')).map((c) => c.handle)).toEqual([
			'o-peuple-fidele',
			'et-se-peut-il-and-can-it-be',
			'chantons-lhistoire-demmanuel',
			'lamour-de-dieu'
		]);
		expect(parseListPage('<html><body><ul></ul></body></html>')).toEqual([]);
	});

	it('reads the album list', () => {
		expect(parseListPage(page('albums.html')).map((c) => c.handle)).toEqual([
			'hymnes21-2018',
			'impros-louange',
			'dans-ses-mains',
			'kids',
			'kids-album-pistes-instrumentales',
			'plus-haut-encore-album'
		]);
	});

	it('reads a tracklist and the lyrics pages an album links to', () => {
		const dsm = parseTracklist(page('album-dans-ses-mains.html'));
		expect(dsm.tracks).toHaveLength(10);
		expect(dsm.tracks[6]).toEqual({ track: 7, title: 'Il me gardera (Alicia Roehrig & Philippe Viguier)' });
		expect(dsm.lyricsPages).toEqual([]);
		const kids = parseTracklist(page('album-kids.html'));
		expect(kids.tracks).toHaveLength(11);
		expect(kids.lyricsPages).toEqual(['album-kids-paroles']);
	});

	const cards: Card[] = [
		{ handle: 'il-me-gardera-he-will-hold-me-fast', title: 'Il me gardera (He Will Hold me Fast)' },
		{ handle: 'a-l-agneau-sur-son-trone', title: "A l'Agneau sur son trône (Crown Him with Many Crowns)" },
		{ handle: 'viens-et-vois-were-you-there', title: 'Viens et vois (Were you There)' },
		{ handle: 'viens-decouvrir-cette-fontaine', title: 'Viens découvrir cette fontaine' },
		{ handle: 'lespoir-1', title: "L'espoir" },
		{ handle: 'psaume-32', title: 'Psaume 32' },
		{ handle: 'psaume-32-bis', title: 'Psaume 32 (bis)' }
	];

	it.each([
		['Il me gardera (Alicia Roehrig & Philippe Viguier)', { kind: 'song', handle: 'il-me-gardera-he-will-hold-me-fast' }],
		["A l'Agneau", { kind: 'song', handle: 'a-l-agneau-sur-son-trone' }],
		['Viens et vois (Philippe Viguier & Darlène Rizzitelli)', { kind: 'song', handle: 'viens-et-vois-were-you-there' }],
		['Les cieux proclament (Tendry)', { kind: 'none' }],
		["L'espoir (instrumental)", { kind: 'instrumental' }],
		['Psaume 32', { kind: 'several', handles: ['psaume-32', 'psaume-32-bis'] }]
	])('track "%s"', (title, expected) => {
		expect(resolveTrack(title, cards)).toEqual(expected);
	});

	it('reports an album track with no lyrics on the site', () => {
		const result = parsePetcHymn(page('album-dans-ses-mains.html'), ref(`${PETC_BASE}/products/dans-ses-mains#track-5`, '305'));
		expect(result).toEqual({ ok: false, reason: 'no lyrics on the site: album track 5 "Les cieux proclament (Tendry)"' });
	});

	it('builds the URL of each kind of pinned page', () => {
		expect(pageUrl('grace-infinie')).toBe(`${PETC_BASE}/products/grace-infinie`);
		expect(pageUrl('album-kids-paroles#2')).toBe(`${PETC_BASE}/pages/album-kids-paroles#2`);
		expect(pageUrl('dans-ses-mains#track-5')).toBe(`${PETC_BASE}/products/dans-ses-mains#track-5`);
	});
});

describe('pinned tables (data-model)', () => {
	const hymnals = JSON.parse(readFileSync(join('content', 'hymnals.json'), 'utf8')) as {
		id: string;
		parts?: { name: string; first: number }[];
	}[];
	const parts = hymnals.find((h) => h.id === PETC_HYMNAL)!.parts!;
	const albums = PETC_ALBUMS.filter((a): a is Extract<PetcAlbum, { first: number }> => 'first' in a);

	it('has one part per album, with the same name and first number, then "Hors album"', () => {
		expect(parts).toEqual([
			...albums.map((a) => ({ name: a.name, first: a.first })),
			{ name: 'Hors album', first: HORS_ALBUM_FIRST }
		]);
	});

	it('gives each album a distinct hundred below 1000', () => {
		const firsts = albums.map((a) => a.first);
		expect(new Set(firsts).size).toBe(firsts.length);
		for (const f of firsts) {
			expect(f % 100).toBe(0);
			expect(f).toBeLessThan(HORS_ALBUM_FIRST);
		}
	});

	it('pins each number once, album numbers as first + track, "Hors album" numbers on song pages', () => {
		const numbers = PETC_NUMBERS.map((n) => n.number);
		expect(new Set(numbers).size).toBe(numbers.length);
		expect(PETC_NUMBERS).toHaveLength(81);
		for (const { number, page: p } of PETC_NUMBERS) {
			if (number < HORS_ALBUM_FIRST) {
				const album = albums.find((a) => number > a.first && number < a.first + 100);
				expect(album, `${number}`).toBeDefined();
			} else {
				expect(number).toBeGreaterThan(HORS_ALBUM_FIRST);
				expect(p).not.toContain('#');
			}
		}
	});

	it('lists only the 4 songs on two albums twice', () => {
		const count = new Map<string, number>();
		for (const { page: p } of PETC_NUMBERS) count.set(p, (count.get(p) ?? 0) + 1);
		expect([...count].filter(([, n]) => n > 1).map(([p]) => p).sort()).toEqual([
			'coule-a-flots-come-thou-fount',
			'mon-ame-eveille-toi-1',
			'sois-seul-ma-vision-1',
			'viens-suis-moi-1'
		]);
	});
});

// ---------------------------------------------------------------------------------------------
// listEntries on a site rebuilt from the catalogue of 2026-11-16 (titles and tracklists only)

const catalogue = JSON.parse(readFileSync(join(FIXTURES, 'petc', 'catalogue.json'), 'utf8')) as {
	songs: Card[];
	albumOrder: string[];
	albums: Record<string, { track: number; title: string }[]>;
};
const grid = (cards: Card[]) =>
	`<html><body>${cards
		.map(
			(c) =>
				`<div class="grid-view-item product-card"><a class="grid-view-item__link" href="/collections/x/products/${c.handle}"></a><div class="product-card__title">${c.title}</div></div>`
		)
		.join('')}</body></html>`;
const albumPage = (handle: string, tracks: { track: number; title: string }[]) =>
	`<html><body><h1 class="product-single__title">${handle}</h1><div class="product-single__description rte">${tracks
		.map((t) => `<p>${t.track}. ${t.title}</p>`)
		.join('')}${handle === 'kids' ? '<p><a href="https://pasteuretcompagnie.com/pages/album-kids-paroles">PAROLES</a></p>' : ''}</div></body></html>`;

type Site = { songs?: Card[]; perPage?: number; albumOrder?: string[]; albums?: typeof catalogue.albums };

function siteContext(site: Site = {}): AdapterContext & { logs: string[]; fetched: string[] } {
	const songs = site.songs ?? catalogue.songs;
	const perPage = site.perPage ?? 8;
	const albums = site.albums ?? catalogue.albums;
	const order = site.albumOrder ?? catalogue.albumOrder;
	const logs: string[] = [];
	const fetched: string[] = [];
	return {
		logs,
		fetched,
		async fetch(url) {
			fetched.push(url);
			const listPage = new RegExp(`^${PETC_LIST_URL}\\?page=(\\d+)$`).exec(url);
			if (listPage) {
				const n = Number(listPage[1]);
				return grid(songs.slice((n - 1) * perPage, n * perPage));
			}
			if (url === PETC_ALBUMS_URL) return grid(order.map((handle) => ({ handle, title: handle })));
			const album = new RegExp(`^${PETC_BASE}/products/([^/#]+)$`).exec(url)?.[1];
			if (album && albums[album]) return albumPage(album, albums[album]);
			throw new Error(`no page for ${url}`);
		},
		log: (message) => logs.push(message)
	};
}

const list = (ctx: AdapterContext, numbers?: PinnedNumber[], albums?: PetcAlbum[]) =>
	createPetcAdapter(numbers, albums).listEntries(PETC_HYMNAL, ctx);
const asTable = (refs: EntryRef[]) => refs.map((r) => [Number(r.number), r.url]);
const pinnedTable = PETC_NUMBERS.map((n) => [n.number, pageUrl(n.page)]);

describe('listEntries (site of 2026-11-16)', () => {
	it('gives exactly the pinned numbers, with nothing to pin and no difference with the site', async () => {
		const ctx = siteContext();
		const refs = await list(ctx);
		expect(asTable(refs)).toEqual(pinnedTable);
		expect(ctx.logs.filter((l) => /not pinned|site says|several/u.test(l))).toEqual([]);
		expect(ctx.logs).toContain('pasteur-compagnie: 68 rows, 68 song pages');
		expect(ctx.logs).toContain('pasteur-compagnie: 6 albums, 55 tracks, 48 matched');
		expect(ctx.logs).toContain(
			'pasteur-compagnie: album kids-album-pistes-instrumentales skipped: same tracklist as KIDS (instrumental)'
		);
		expect(ctx.fetched).not.toContain(`${PETC_BASE}/products/kids-album-pistes-instrumentales`);
	});

	it('maps the contract cases', async () => {
		const refs = await list(siteContext());
		const at = (n: number) => refs.find((r) => r.number === String(n))?.url;
		expect(at(307)).toBe(`${PETC_BASE}/products/il-me-gardera-he-will-hold-me-fast`);
		expect(at(209)).toBe(`${PETC_BASE}/products/a-l-agneau-sur-son-trone`);
		expect(at(105)).toBe(at(505));
		expect(at(402)).toBe(`${PETC_BASE}/pages/album-kids-paroles#2`);
		expect(at(305)).toBe(`${PETC_BASE}/products/dans-ses-mains#track-5`);
		expect(at(511)).toBeUndefined();
		expect(at(1005)).toBe(`${PETC_BASE}/products/grace-infinie`);
	});

	it('throws for another hymnal', async () => {
		await expect(petc.listEntries('jem', siteContext())).rejects.toThrow(/does not cover/u);
	});
});

describe('listEntries: numbers stay stable (US4)', () => {
	it('gives the same refs when the list is reordered or split differently', async () => {
		const reordered = [...catalogue.songs].reverse();
		expect(asTable(await list(siteContext({ songs: reordered, perPage: 5 })))).toEqual(pinnedTable);
	});

	it('gives a new song on no album the next "Hors album" number', async () => {
		const ctx = siteContext({ songs: [...catalogue.songs, { handle: 'nouveau-chant', title: 'Nouveau chant' }] });
		const refs = await list(ctx);
		expect(asTable(refs)).toEqual([...pinnedTable, [1028, `${PETC_BASE}/products/nouveau-chant`]]);
		expect(ctx.logs).toContain('pasteur-compagnie: 1028: nouveau-chant is not pinned yet: add it to PETC_NUMBERS');
	});

	it('gives a new album the next free hundred; a "Hors album" song on it keeps its number too', async () => {
		const ctx = siteContext({
			songs: [...catalogue.songs, { handle: 'chant-neuf', title: 'Chant neuf' }],
			albumOrder: [...catalogue.albumOrder, 'nouvel-album'],
			albums: {
				...catalogue.albums,
				'nouvel-album': [
					{ track: 1, title: 'Grâce infinie' },
					{ track: 2, title: 'Chant neuf' }
				]
			}
		});
		const refs = await list(ctx);
		const at = (n: number) => refs.find((r) => r.number === String(n))?.url;
		expect(at(601)).toBe(`${PETC_BASE}/products/grace-infinie`);
		expect(at(1005)).toBe(`${PETC_BASE}/products/grace-infinie`);
		expect(at(602)).toBe(`${PETC_BASE}/products/chant-neuf`);
		expect(at(1028)).toBeUndefined();
		expect(ctx.logs).toContain(
			'pasteur-compagnie: album nouvel-album is not pinned yet (first 600): add it to PETC_ALBUMS and to the parts in content/hymnals.json'
		);
		expect(ctx.logs).toContain('pasteur-compagnie: 601: grace-infinie is not pinned yet: add it to PETC_NUMBERS');
	});

	it('still returns a pinned song that no list shows', async () => {
		const songs = catalogue.songs.filter((s) => s.handle !== 'grace-infinie');
		expect(asTable(await list(siteContext({ songs })))).toEqual(pinnedTable);
	});

	it('keeps the pinned number when a tracklist changes, and says so', async () => {
		const albums = {
			...catalogue.albums,
			'dans-ses-mains': catalogue.albums['dans-ses-mains'].map((t) =>
				t.track === 7 ? { track: 7, title: 'Saint-Esprit' } : t.track === 8 ? { track: 8, title: 'Il me gardera' } : t
			)
		};
		const ctx = siteContext({ albums });
		expect(asTable(await list(ctx))).toEqual(pinnedTable);
		expect(ctx.logs).toContain(
			'pasteur-compagnie: 307: pinned il-me-gardera-he-will-hold-me-fast, the site says saint-esprit-holy-spirit: keep the pinned number, decide by hand'
		);
	});
});
