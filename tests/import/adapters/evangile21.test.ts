// evangile21.thegospelcoalition.org adapter on saved pages
// (specs/004-evangile21-hymnal/contracts/evangile21-adapter.md, tasks T017–T018).
import { describe, expect, it } from 'vitest';
import {
	createEvangile21Adapter,
	evangile21,
	EVANGILE21_BASE,
	EVANGILE21_NUMBERS,
	EVANGILE21_SERIES_URL,
	EVANGILE21_SKIPPED,
	numberEntries,
	parseSeriesPage
} from '../../../scripts/import/sources/evangile21';
import type { EntryRef } from '../../../scripts/import/sources/types';
import { normalizeText } from '../../../src/lib/search/normalize';
import { fixtureContext, fixturePage } from '../helpers/fixtures';

const page = (file: string) => fixturePage('evangile21', file);
const ref = (number: string, path: string): EntryRef => ({
	hymnal: 'evangile21',
	number,
	url: `${EVANGILE21_BASE}${path}`
});
const parse = (file: string, number = '1', path = '/x/') => evangile21.parseHymn(page(file), ref(number, path));
const ok = (file: string) => {
	const result = parse(file);
	if (!result.ok) throw new Error(result.reason);
	return result.hymn;
};
const shape = (file: string) => ok(file).sections.map((s) => `${s.type}${s.number ?? ''}:${s.lines.length}`);
const credits = (file: string) => ok(file).credits.map((c) => `${c.name} [${c.role}]`);

describe('series page', () => {
	const series = parseSeriesPage(page('listing-series.html'));

	it('lists the 44 song cards and nothing else', () => {
		expect(series.paths).toHaveLength(44);
		expect(series.paths[0]).toBe('/pasteur-compagnie/en-memoire-de-ton-nom-chant/');
		expect(series.paths.at(-1)).toBe('/article/en-esprit-en-verite/');
		// Featured, recent and podcast cards of the same page are not songs.
		expect(series.paths).not.toContain('/article/guy-a-lepage-nous-dit-lisez-la-bible/');
		expect(series.paths).not.toContain('/accent-louange/40-pourquoi-cette-volonte-de-valoriser-des-vieux-hymnes/');
		expect(series.next).toBeNull();
	});

	it('every listed song is pinned or skipped, with no gap in the numbers', () => {
		const known = new Set([...EVANGILE21_NUMBERS, ...EVANGILE21_SKIPPED].map((e) => e.path));
		expect(series.paths.filter((p) => !known.has(p))).toEqual([]);
		expect(EVANGILE21_NUMBERS.map((n) => n.number)).toEqual(EVANGILE21_NUMBERS.map((_, i) => i + 1));
		expect(new Set(known).size).toBe(EVANGILE21_NUMBERS.length + EVANGILE21_SKIPPED.length);
	});

	it('listEntries reads the series page through ctx.fetch and numbers the songs', async () => {
		const ctx = fixtureContext({ [EVANGILE21_SERIES_URL]: 'listing-series.html' }, { source: 'evangile21' });
		const entries = await evangile21.listEntries('evangile21', ctx);
		expect(ctx.fetched).toEqual([EVANGILE21_SERIES_URL]);
		expect(entries).toHaveLength(38);
		expect(entries[0]).toEqual(ref('1', '/article/en-esprit-en-verite/'));
		expect(entries.find((e) => e.url.endsWith('/article/roc-des-ages/'))?.number).toBe('19');
		expect(entries.some((e) => e.url.endsWith('/video/psaume-150/'))).toBe(false);
		expect(ctx.logs.filter((l) => /skipped/.test(l))).toHaveLength(6);
		expect(ctx.logs.some((l) => /not pinned/.test(l))).toBe(false);
	});

	it('refuses another hymnal', async () => {
		await expect(evangile21.listEntries('jem', fixtureContext({}))).rejects.toThrow(/does not cover/);
	});
});

describe('numbering', () => {
	const pinned = [
		{ number: 1, path: '/a/' },
		{ number: 2, path: '/b/' },
		{ number: 4, path: '/d/' }
	];
	const skipped = [{ path: '/s/', reason: 'no lyrics' }];
	const run = (listed: string[]) => {
		const logs: string[] = [];
		const entries = numberEntries(listed, 'evangile21', pinned, skipped, (m) => logs.push(m));
		return { numbers: Object.fromEntries(entries.map((e) => [new URL(e.url).pathname, e.number])), logs };
	};

	it('uses pinned numbers and leaves skipped pages out with their reason', () => {
		const { numbers, logs } = run(['/d/', '/s/', '/b/', '/a/']);
		expect(numbers).toEqual({ '/a/': '1', '/b/': '2', '/d/': '4' });
		expect(logs).toEqual(['evangile21: /s/ skipped: no lyrics']);
	});

	it('gives unpinned songs the next numbers, oldest first, and says so', () => {
		// Listed newest first: /new2/ is newer than /new1/.
		const { numbers, logs } = run(['/new2/', '/new1/', '/d/', '/b/', '/a/']);
		expect(numbers['/new1/']).toBe('5');
		expect(numbers['/new2/']).toBe('6');
		expect(logs.filter((l) => /not pinned yet/.test(l))).toHaveLength(2);
	});

	it('a song removed from the list leaves every other number unchanged', () => {
		const { numbers } = run(['/d/', '/a/']);
		expect(numbers).toEqual({ '/a/': '1', '/d/': '4' });
	});

	it('the adapter can be built with other tables', async () => {
		const adapter = createEvangile21Adapter([{ number: 7, path: '/article/roc-des-ages/' }], []);
		const ctx = fixtureContext({ [EVANGILE21_SERIES_URL]: 'listing-series.html' }, { source: 'evangile21' });
		const entries = await adapter.listEntries('evangile21', ctx);
		expect(entries.find((e) => e.number === '7')?.url).toBe(`${EVANGILE21_BASE}/article/roc-des-ages/`);
		expect(entries).toHaveLength(44);
	});
});

describe('song pages', () => {
	it('Roc des âges: labelled verses, prose credits, no download links', () => {
		const hymn = ok('hymn-roc-des-ages.html');
		expect(hymn.title).toBe('Roc des âges');
		expect(shape('hymn-roc-des-ages.html')).toEqual(['verse1:6', 'verse2:6', 'verse3:6', 'verse4:6']);
		expect(hymn.sections[0].lines[0]).toBe('Roc des âges, fendu pour moi');
		expect(hymn.sections[3].lines.at(-1)).toBe('Me voici caché en toi');
		expect(credits('hymn-roc-des-ages.html')).toEqual([
			'Augustus Toplady [lyrics]',
			'Thomas Hastings [music]',
			'Philippe Viguier [translation]'
		]);
		expect(hymn.strippedMarkup).toEqual({ 'download-links': 3, 'section-label': 4 });
	});

	it('Ô Dieu ta grâce: "Paroles:" marker and a chorus', () => {
		expect(shape('hymn-o-dieu-grace.html')).toEqual(['verse1:4', 'chorus:4', 'verse2:4', 'verse3:4', 'verse4:4']);
		expect(ok('hymn-o-dieu-grace.html').sections[1].lines[0]).toBe('Ô Dieu ta grâce');
		expect(credits('hymn-o-dieu-grace.html')).toEqual([
			'Daniel B. Towner [music]',
			'Julia H. Johnston [lyrics]',
			'Philippe Viguier [translation]'
		]);
	});

	it('Mon Dieu plus près de toi: unlabelled stanzas are numbered verses; arrangement credit', () => {
		expect(shape('hymn-dieu-plus-pres-de-toi.html')).toEqual(['verse1:4', 'verse2:4', 'verse3:4', 'verse4:4']);
		expect(credits('hymn-dieu-plus-pres-de-toi.html')).toEqual([
			'A. Humbert [lyrics]',
			'R.K. Carter [music]',
			'Philippe Viguier [arrangement]'
		]);
	});

	it('Folle nuit de la croix: one block per line, names line above the lyrics', () => {
		expect(shape('hymn-folle-nuit-de-la-croix.html')).toEqual([
			'verse1:4',
			'verse2:4',
			'chorus:7',
			'verse3:4',
			'verse4:4',
			'bridge:4'
		]);
		expect(credits('hymn-folle-nuit-de-la-croix.html')).toEqual([
			'José Luis Naime [unspecified]',
			'Philippe Viguier [unspecified]'
		]);
	});

	it('Dieu l’Éternel Incréé: chordpro lines, numbered refrains, a tag', () => {
		expect(shape('hymn-dieu-leternel-incree.html')).toEqual([
			'verse1:4',
			'chorus:7',
			'verse2:4',
			'chorus:7',
			'verse3:4',
			'chorus:7',
			'verse4:4',
			'chorus:7',
			'other:3'
		]);
		expect(credits('hymn-dieu-leternel-incree.html')).toContain('Kevin Stauffer [translation]');
		expect(credits('hymn-dieu-leternel-incree.html')).toContain('Pete James [unspecified]');
	});

	it('Psaume 32: Bible verses and commentary around the stanzas are left out', () => {
		const hymn = ok('hymn-psaume-32.html');
		expect(shape('hymn-psaume-32.html')).toEqual(['verse1:4', 'verse2:4', 'chorus:5', 'verse3:4']);
		expect(hymn.sections[0].lines[0]).toBe('Heureux l’homme à qui Dieu pardonne');
		expect(hymn.sections[3].lines.at(-1)).toBe('Sont recouverts de grâce');
		expect(hymn.strippedMarkup['bible-verse']).toBe(6);
	});

	it('Viens suis-moi: a copyright line only gives no credits', () => {
		expect(ok('hymn-viens-suis-moi.html').credits).toEqual([]);
		expect(shape('hymn-viens-suis-moi.html')).toEqual(['verse1:7', 'verse2:7', 'verse3:7', 'verse4:7']);
	});

	it('Sois seul ma vision: a page that labels only its refrain numbers its verses', () => {
		expect(shape('hymn-sois-seul-vision.html')).toEqual([
			'verse1:4',
			'verse2:4',
			'verse3:4',
			'chorus:2',
			'verse4:4',
			'chorus:2'
		]);
		expect(credits('hymn-sois-seul-vision.html')).toEqual([
			'Eleanor Hull [lyrics]',
			'Philippe Viguier [translation]'
		]);
	});

	it('titles: "(chant)" and a credited name in parentheses are removed', () => {
		const alleluia = ok('hymn-alleluia-grand-sauveur.html');
		expect(alleluia.title).toBe('Alléluia, quel grand Sauveur');
		expect(alleluia.strippedMarkup['title-qualifier']).toBe(1);
		const memoire = ok('hymn-en-memoire-de-ton-nom.html');
		expect(memoire.title).toBe('En mémoire de ton nom');
		expect(memoire.sections[0].lines[0]).toBe('Le souvenir de nos souffrances');
		expect(memoire.credits).toEqual([]);
	});

	it('Psaume 150: the article and the video page hold the same words', () => {
		// The article writes the chorus after every verse (once with two lines joined), the video
		// twice: the same words (research R6).
		const words = (file: string) =>
			new Set(
				ok(file)
					.sections.flatMap((s) => s.lines)
					.flatMap((l) => normalizeText(l.replace(/œ/g, 'oe')).split(' '))
			);
		expect(words('hymn-psaume-150-video.html')).toEqual(words('hymn-psaume-150-article.html'));
		expect(credits('hymn-psaume-150-article.html')).toContain('Matt Boswell [unspecified]');
	});

	it('no extracted line is a download link, a marker or a share button', () => {
		const files = Object.keys(JSON.parse(fixturePage('evangile21', 'index.json'))).filter((f) =>
			f.startsWith('hymn-')
		);
		for (const file of files) {
			for (const line of ok(file).sections.flatMap((s) => s.lines)) {
				expect(line, file).not.toMatch(/T[ée]l[ée]chargement|^Partitions|^Accords|Paroles\s*:|Partager|LEADSHEET/i);
			}
		}
	});

	it('an article with no lyrics and a challenge page fail with a reason', () => {
		expect(parse('not-a-hymn.html')).toEqual({ ok: false, reason: 'no lyrics' });
		const challenge = '<html><head><title>Just a moment...</title></head><body></body></html>';
		expect(evangile21.parseHymn(challenge, ref('1', '/x/'))).toEqual({ ok: false, reason: 'challenge page' });
	});

	it('stripping scripts and styles from a page does not change the result', () => {
		expect(parse('hymn-roc-des-ages-full.html')).toEqual(parse('hymn-roc-des-ages.html'));
	});
});
