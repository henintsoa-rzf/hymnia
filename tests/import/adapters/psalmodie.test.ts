// psalmodie.ch adapter on saved pages (contracts/source-adapter.md, task T065).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	createPsalmodieAdapter,
	psalmodie,
	PSALMODIE_PROGRAMMES,
	type Programme
} from '../../../scripts/import/sources/psalmodie';
import type { EntryRef } from '../../../scripts/import/sources/types';
import { decodeEntities, fixtureContext, fixturePage } from '../helpers/fixtures';

const BASE = 'https://psalmodie.ch';
const page = (slug: string) => `${BASE}/paroles-du-programme-${slug}/`;
const ref = (number: string, slug: string, position: number): EntryRef => ({
	hymnal: 'psalmodie',
	number,
	url: `${page(slug)}#chant-${position}`
});
const parse = (file: string, r: EntryRef) => psalmodie.parseHymn(fixturePage('psalmodie', file), r);
const ok = (file: string, r: EntryRef) => {
	const result = parse(file, r);
	if (!result.ok) throw new Error(result.reason);
	return result.hymn;
};

const SOUFFLE = 'programme-souffle-de-vie.html';
const VIT = 'programme-parce-quil-vit.html';

/** Lines of every song of a page, decoded without the adapter's parser, markup left out. */
function independentLines(html: string): string[][] {
	const content = html.slice(html.indexOf('<div class="entry-content">'), html.indexOf('</article>'));
	return content
		.split(/<h3>/)
		.slice(1)
		.map((song) =>
			song
				.slice(song.indexOf('</h3>') + 5)
				.split(/<br \/>|<\/p>/)
				.map((part) =>
					decodeEntities(part.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/&raquo;/g, '»'))
						.replace(/\s+/g, ' ')
						.trim()
				)
				.filter((line) => line !== '')
				.filter((line) => !/^(Refrain|Pré-refrain|Pont|Derniers refrains)\s*:?$/.test(line))
				.filter((line) => !/^(Texte|Musique|Paroles|Adaptation|©)/.test(line))
				.map((line) => line.replace(/^\d+\.\s+/, ''))
		);
}

describe('parseHymn', () => {
	it('extracts title, verses, credits and the reference (Souffle de vie #13, public domain text)', () => {
		const hymn = ok(SOUFFLE, ref('113', 'souffle-de-vie', 13));
		expect(hymn).toMatchObject({
			source: 'psalmodie',
			hymnal: 'psalmodie',
			number: '113',
			url: `${page('souffle-de-vie')}#chant-13`,
			title: 'Tel que je suis'
		});
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['verse', 1, 4],
			['verse', 2, 4],
			['verse', 3, 4],
			['verse', 4, 4]
		]);
		expect(hymn.sections[0].lines[0]).toBe('Tel que je suis, sans rien à moi,');
		expect(hymn.sections[3].lines[3]).toBe('Agneau de Dieu, je viens, je viens.');
		expect(hymn.credits).toEqual([
			{ name: 'Charlotte Elliot', role: 'lyrics' },
			{ name: 'Margaret Petty', role: 'music' }
		]);
		expect(hymn.strippedMarkup).toEqual({});
	});

	it('keeps a chorus written once where the source puts it (Souffle de vie #2)', () => {
		const hymn = ok(SOUFFLE, ref('102', 'souffle-de-vie', 2));
		expect(hymn.title).toBe('Amour offert');
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['chorus', null],
			['verse', 2],
			['verse', 3]
		]);
		expect(hymn.sections[1].lines[0]).toBe('Notre Dieu, nous voulons te remercier');
		expect(hymn.strippedMarkup).toEqual({ 'section-label': 1 });
	});

	it('maps labelled credits, translators after "trad." included (Souffle de vie #3)', () => {
		const hymn = ok(SOUFFLE, ref('103', 'souffle-de-vie', 3));
		expect(hymn.credits).toEqual([
			{ name: 'Peter Strauch', role: 'lyrics' },
			{ name: 'Etienne Demaurex', role: 'translation' },
			{ name: 'Marc Varidel', role: 'translation' },
			{ name: 'Peter Strauch', role: 'music' }
		]);
		// "Samuel et Frédérique Jaccard" is not split into "Samuel" and "Frédérique Jaccard".
		expect(ok(SOUFFLE, ref('102', 'souffle-de-vie', 2)).credits).toEqual([
			{ name: 'Samuel et Frédérique Jaccard', role: 'lyrics' },
			{ name: 'Sylvain Jaccard', role: 'music' }
		]);
	});

	it('uses the verse numbers, labels and repeat markers of the page (Parce qu’il vit #2)', () => {
		const hymn = ok(VIT, ref('702', 'parce-quil-vit', 2));
		expect(hymn.title).toBe('Tout-Puissant');
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['verse', 1, 4],
			['chorus', null, 8],
			['verse', 2, 4],
			['bridge', null, 8]
		]);
		expect(hymn.sections[0].lines[0]).toBe('Majestueux, infiniment grand,');
		expect(hymn.sections[3].lines[0]).toBe('Un jour tout genou fléchira,');
		expect(hymn.strippedMarkup).toEqual({
			'verse-number': 2,
			'section-label': 2,
			'repeat-marker': 2
		});
		expect(hymn.credits).toEqual([
			{ name: 'Philippe Decouroux', role: 'lyrics' },
			{ name: 'Philippe Decouroux', role: 'music' }
		]);
	});

	it('reads "Paroles et musique" and "Adaptation française" (Parce qu’il vit #1)', () => {
		const hymn = ok(VIT, ref('701', 'parce-quil-vit', 1));
		expect(hymn.title).toBe('Je crois (I Believe)');
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['verse', 2],
			['chorus', null],
			['verse', 3],
			['verse', 4],
			['bridge', null]
		]);
		expect(hymn.credits.filter((c) => c.role === 'music').map((c) => c.name)).toEqual([
			'Chris Davenport',
			'Jonathan Smith',
			'Phil Wickham'
		]);
		expect(hymn.credits.filter((c) => c.role === 'translation')[0]).toEqual({
			name: 'Marc Varidel',
			role: 'translation'
		});
		expect(hymn.unknownCredits).toEqual([]);
	});

	it('reads a "Pré-refrain" as "other" and a label with its text on the same line', () => {
		const vit = ok(VIT, ref('704', 'parce-quil-vit', 4));
		expect(vit.sections.map((s) => s.type)).toEqual(['verse', 'verse', 'other', 'chorus', 'verse']);
		const certitudes = ok('programme-certitudes.html', ref('303', 'certitudes', 3));
		expect(certitudes.sections[1]).toEqual({
			type: 'chorus',
			number: null,
			lines: ['Jésus, Roi des rois !']
		});
	});

	it('reads a song whose heading wraps a stray paragraph (Moments d’éternité, 2nd song)', () => {
		const hymn = ok('programme-moments-deternite.html', ref('402', 'moments-deternite', 2));
		expect(hymn.title).toBe('Symbole des apôtres');
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['verse', 1, 16],
			['verse', 2, 16]
		]);
		expect(hymn.credits).toEqual([
			{ name: 'Marc Varidel', role: 'lyrics' },
			{ name: 'Marc Dirlewanger', role: 'music' }
		]);
	});

	it('changes nothing in the text but whitespace and markup (FR-004)', () => {
		for (const [file, slug, first] of [
			[SOUFFLE, 'souffle-de-vie', 100],
			[VIT, 'parce-quil-vit', 700]
		] as const) {
			const expected = independentLines(fixturePage('psalmodie', file));
			expect(expected.length).toBeGreaterThan(15);
			expected.forEach((lines, i) => {
				const hymn = ok(file, ref(String(first + i + 1), slug, i + 1));
				expect(hymn.sections.flatMap((s) => s.lines)).toEqual(lines);
			});
		}
	});

	it('accepts a song with no credits', () => {
		const html = fixturePage('psalmodie', SOUFFLE).replace(
			/<p><em>Texte : Charlotte Elliot<\/em>[\s\S]*?<\/p>/,
			''
		);
		const result = psalmodie.parseHymn(html, ref('113', 'souffle-de-vie', 13));
		expect(result.ok && result.hymn.credits).toEqual([]);
	});

	it('fails with a short, stable reason on a page that is not a hymn', () => {
		expect(parse('not-a-hymn.html', { hymnal: 'psalmodie', number: '1', url: `${BASE}/obtenir-des-partitions/#chant-1` })).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
		expect(parse(SOUFFLE, ref('199', 'souffle-de-vie', 99))).toEqual({
			ok: false,
			reason: 'no song at this position'
		});
		expect(parse(SOUFFLE, { hymnal: 'psalmodie', number: '101', url: page('souffle-de-vie') })).toEqual({
			ok: false,
			reason: 'no song position in the URL'
		});
	});

	it('produces lines in NFC with no label, verse number or credit left', () => {
		for (const [file, slug] of [
			[SOUFFLE, 'souffle-de-vie'],
			[VIT, 'parce-quil-vit'],
			['programme-certitudes.html', 'certitudes']
		] as const) {
			for (let position = 1; position <= 16; position++) {
				const hymn = ok(file, ref('1', slug, position));
				expect(hymn.title).toBe(hymn.title.normalize('NFC'));
				expect(hymn.title).not.toMatch(/^\d/);
				for (const line of hymn.sections.flatMap((s) => s.lines)) {
					expect(line).toBe(line.normalize('NFC'));
					expect(line).not.toMatch(/^\s|\s$|\u00a0|^\d+\.\s|^(Refrain|Pont|Pré-refrain)\b|^(Paroles|Texte|Musique|©)/);
				}
			}
		}
	});
});

describe('listEntries', () => {
	const pages = {
		[page('souffle-de-vie')]: SOUFFLE,
		[page('moments-deternite')]: 'programme-moments-deternite.html',
		[page('paul')]: 'programme-paul.html'
	};
	const ctx = () => fixtureContext(pages, { source: 'psalmodie' });

	it('numbers printed songs in the programme’s block of 100', async () => {
		const programmes: Record<string, Programme[]> = {
			psalmodie: [{ slug: 'paroles-du-programme-souffle-de-vie', first: 100, numbering: 'printed' }]
		};
		const entries = await createPsalmodieAdapter(programmes).listEntries('psalmodie', ctx());
		expect(entries).toHaveLength(19);
		expect(entries.slice(0, 2)).toEqual([
			{ hymnal: 'psalmodie', number: '101', url: `${page('souffle-de-vie')}#chant-1` },
			{ hymnal: 'psalmodie', number: '102', url: `${page('souffle-de-vie')}#chant-2` }
		]);
		expect(entries.at(-1)?.number).toBe('119');
	});

	it('numbers an unnumbered programme by position on the page', async () => {
		const programmes: Record<string, Programme[]> = {
			psalmodie: [{ slug: 'paroles-du-programme-moments-deternite', first: 400, numbering: 'position' }]
		};
		const entries = await createPsalmodieAdapter(programmes).listEntries('psalmodie', ctx());
		expect(entries.map((e) => e.number)).toEqual(
			Array.from({ length: 15 }, (_, i) => String(401 + i))
		);
	});

	it('skips headings with no number, and says so', async () => {
		const programmes: Record<string, Programme[]> = {
			psalmodie: [{ slug: 'paroles-du-programme-paul', first: 200, numbering: 'printed' }]
		};
		const c = ctx();
		const entries = await createPsalmodieAdapter(programmes).listEntries('psalmodie', c);
		// 28 headings: 4 acts ("A. Lapidation d'Étienne"…) and 24 numbered songs, one "15’".
		expect(entries).toHaveLength(24);
		expect(entries[0]).toEqual({ hymnal: 'psalmodie', number: '201', url: `${page('paul')}#chant-2` });
		expect(entries.map((e) => e.number)).toContain('215’');
		expect(c.logs.filter((l) => /no number/.test(l))).toHaveLength(4);
	});

	it('lists every configured programme, matching import/sources.json', async () => {
		expect(Object.keys(PSALMODIE_PROGRAMMES)).toEqual(['psalmodie']);
		const firsts = PSALMODIE_PROGRAMMES.psalmodie.map((p) => p.first);
		expect(new Set(firsts).size).toBe(firsts.length);
		const sources = JSON.parse(readFileSync('import/sources.json', 'utf8'));
		const config = sources.find((s: { id: string }) => s.id === 'psalmodie');
		expect([...config.hymnals].sort()).toEqual(Object.keys(PSALMODIE_PROGRAMMES).sort());
	});

	it('refuses a hymnal it does not cover', async () => {
		await expect(psalmodie.listEntries('jem', ctx())).rejects.toThrow(/jem/);
	});
});
