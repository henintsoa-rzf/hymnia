// conducteurdelouange.com adapter on saved pages (contracts/source-adapter.md, task T034).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cdl, createCdlAdapter, CDL_VOLUMES } from '../../../scripts/import/sources/cdl';
import type { EntryRef } from '../../../scripts/import/sources/types';
import { decodeEntities, fixtureContext, fixturePage } from '../helpers/fixtures';

const BASE = 'https://www.conducteurdelouange.com';
const ref = (number: string, id: string, hymnal = 'jem'): EntryRef => ({
	hymnal,
	number,
	url: `${BASE}/${id}`
});
const parse = (file: string, r: EntryRef) => cdl.parseHymn(fixturePage('cdl', file), r);
const ok = (file: string, r: EntryRef) => {
	const result = parse(file, r);
	if (!result.ok) throw new Error(result.reason);
	return result.hymn;
};

describe('parseHymn', () => {
	it('extracts title, numbered verses, credits and the reference (AdF #1)', () => {
		const hymn = ok('hymn-1411.html', ref('1', '1411', 'adf'));
		expect(hymn).toMatchObject({
			source: 'cdl',
			hymnal: 'adf',
			number: '1',
			url: `${BASE}/1411`,
			title: "Qu'on batte des mains"
		});
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['verse', 1, 6],
			['verse', 2, 6],
			['verse', 3, 6]
		]);
		expect(hymn.sections[0].lines[0]).toBe("Qu'on batte des mains ! Que tous les humains,");
		expect(hymn.sections[2].lines[4]).toBe("D'un cœur plein de foi chantez notre Roi,");
		expect(hymn.credits).toEqual([
			{ name: 'Louis Bourgeois', role: 'unspecified' },
			{ name: 'Théodore de Bèze', role: 'unspecified' }
		]);
	});

	it('keeps the chorus where the source puts it, before and after the verse (JEM 1)', () => {
		const hymn = ok('hymn-130.html', ref('1', '130'));
		expect(hymn.title).toBe("J'aime l'Éternel");
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['chorus', null],
			['verse', 1],
			['chorus', null]
		]);
		expect(hymn.sections[0].lines).toEqual([
			"J'aime l'Éternel, car Il entend ma voix ;",
			'Il a penché son oreille vers moi ;',
			"Je l'invoquerai toute ma vie.",
			"J'aime l'Éternel, j'aime l'Éternel."
		]);
		expect(hymn.sections[2]).toEqual(hymn.sections[0]);
		expect(hymn.credits).toEqual([{ name: 'KATRINA EVERS', role: 'unspecified' }]);
	});

	it('uses the label numbers and removes the verse number written in the text (JEM 17)', () => {
		const hymn = ok('hymn-7.html', ref('17', '7'));
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['chorus', null],
			['verse', 2],
			['chorus', null]
		]);
		expect(hymn.sections[0].lines[0]).toBe("Ah ! qu'il est doux pour des frères");
		expect(hymn.sections[2].lines[0]).toBe('Hiné matov ouma nayim');
		expect(hymn.strippedMarkup).toEqual({ 'verse-number': 2 });
	});

	it('keeps a blank-line pause inside a verse as one section (JEM 3)', () => {
		const hymn = ok('hymn-201.html', ref('3', '201'));
		expect(hymn.sections).toEqual([
			{
				type: 'verse',
				number: 1,
				lines: [
					"L'Éternel est mon berger,",
					'Je ne manquerai de rien.',
					'Je ne crains aucun mal,',
					'car Il est avec moi.',
					'Alléluia !'
				]
			}
		]);
	});

	it('changes nothing in the text but whitespace (FR-004)', () => {
		// The page's text parts, decoded independently of the adapter, with whitespace collapsed.
		const html = fixturePage('cdl', 'hymn-1413.html');
		const texts = [...html.matchAll(/class="chordpro-text">([\s\S]*?)<\/span>/g)].map((m) =>
			decodeEntities(m[1]).replace(/\s+/g, ' ').trim()
		);
		const hymn = ok('hymn-1413.html', ref('3', '1413', 'adf'));
		expect(hymn.sections).toHaveLength(6);
		expect(hymn.sections.flatMap((s) => s.lines)).toEqual(texts);
	});

	it('removes chords when a page shows them, and counts them', () => {
		const html = fixturePage('cdl', 'hymn-1411.html').replace(
			'<span class="chordpro-chord"><sup></sup></span>',
			'<span class="chordpro-chord"><sup>G</sup></span>'
		);
		const result = cdl.parseHymn(html, ref('1', '1411', 'adf'));
		if (!result.ok) throw new Error(result.reason);
		expect(result.hymn.sections[0].lines[0]).toBe(
			"Qu'on batte des mains ! Que tous les humains,"
		);
		expect(result.hymn.strippedMarkup).toEqual({ chord: 1 });
	});

	it('accepts a page with no credits', () => {
		const html = fixturePage('cdl', 'hymn-201.html').replace(
			/<span class="author">[\s\S]*?<\/span>/,
			''
		);
		const result = cdl.parseHymn(html, ref('3', '201'));
		expect(result.ok && result.hymn.credits).toEqual([]);
	});

	it('fails with a short, stable reason on a page that is not a hymn', () => {
		expect(parse('not-a-hymn.html', ref('1', 'termes-et-conditions'))).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
		expect(parse('listing-jem1-page1.html', ref('1', 'x'))).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
	});

	it('produces lines in NFC with no chord or label left', () => {
		for (const [file, r] of [
			['hymn-130.html', ref('1', '130')],
			['hymn-7.html', ref('17', '7')],
			['hymn-1411.html', ref('1', '1411', 'adf')]
		] as const) {
			for (const line of ok(file, r).sections.flatMap((s) => s.lines)) {
				expect(line).toBe(line.normalize('NFC'));
				expect(line).not.toMatch(/^\s|\s$|\u00a0|Strophe|Refrain|Couplet/);
			}
		}
	});
});

describe('listEntries', () => {
	const pages = {
		[`${BASE}/chants/recueil/1`]: 'listing-jem1-page1.html',
		[`${BASE}/chants/recueil/1?page=19`]: 'listing-jem1-page19.html',
		[`${BASE}/chants/recueil/6`]: 'listing-exo.html'
	};

	it('lists numbers and URLs over every page of a volume', async () => {
		// Pages 2–18 are not saved: give them empty listings so only pages 1 and 19 count.
		const ctx = fixtureContext(pages, { emptyListing: true });
		const entries = await createCdlAdapter({ jem: [1] }).listEntries('jem', ctx);
		expect(entries.slice(0, 3)).toEqual([
			{ hymnal: 'jem', number: '1', url: `${BASE}/130` },
			{ hymnal: 'jem', number: '2', url: `${BASE}/251` },
			{ hymnal: 'jem', number: '3', url: `${BASE}/201` }
		]);
		expect(entries).toHaveLength(31);
		expect(entries.at(-1)?.number).toBe('371');
		expect(ctx.fetched).toContain(`${BASE}/chants/recueil/1?page=2`);
		expect(ctx.fetched).toContain(`${BASE}/chants/recueil/1?page=19`);
		expect(ctx.fetched).not.toContain(`${BASE}/chants/recueil/1?page=20`);
	});

	it('skips listing items with no number, and says so', async () => {
		const ctx = fixtureContext(pages, { emptyListing: true });
		const entries = await createCdlAdapter({ exo: [6] }).listEntries('exo', ctx);
		expect(entries).toEqual([]);
		expect(ctx.logs.join('\n')).toMatch(/no number/);
	});

	it('knows the volumes of each hymnal it covers, matching import/sources.json', () => {
		expect(CDL_VOLUMES).toEqual({ jem: [1, 3, 5, 44], adf: [19], cd: [11] });
		const sources = JSON.parse(readFileSync('import/sources.json', 'utf8'));
		const config = sources.find((s: { id: string }) => s.id === 'cdl');
		expect([...config.hymnals].sort()).toEqual(Object.keys(CDL_VOLUMES).sort());
	});

	it('refuses a hymnal it does not cover', async () => {
		await expect(cdl.listEntries('atg', fixtureContext({}))).rejects.toThrow(/atg/);
	});
});
