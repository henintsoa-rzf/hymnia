// conducteurdelouange.com adapter on saved pages (contracts/source-adapter.md, task T034).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	cdl,
	createCdlAdapter,
	CDL_PINNED,
	CDL_VOLUMES,
	type PinnedId
} from '../../../scripts/import/sources/cdl';
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

	it('still skips rows without a number in a numbered hymnal', async () => {
		const ctx = fixtureContext(
			{ [`${BASE}/chants/recueil/1`]: 'listing-exo-page1.html' },
			{ emptyListing: true }
		);
		const entries = await createCdlAdapter({ jem: [1] }, {}).listEntries('jem', ctx);
		expect(entries).toEqual([]);
		expect(ctx.logs.join('\n')).toMatch(/no number/);
	});

	it('knows the volumes of each hymnal it covers, matching import/sources.json', () => {
		expect(CDL_VOLUMES).toEqual({ jem: [1, 3, 5, 44], adf: [19], cd: [11], exo: [6] });
		const sources = JSON.parse(readFileSync('import/sources.json', 'utf8'));
		const config = sources.find((s: { id: string }) => s.id === 'cdl');
		expect([...config.hymnals].sort()).toEqual(Object.keys(CDL_VOLUMES).sort());
	});

	it('refuses a hymnal it does not cover', async () => {
		await expect(cdl.listEntries('atg', fixtureContext({}))).rejects.toThrow(/atg/);
	});
});

// Feature 005: Exo, a hymnal the site does not number (specs/005-exo-hymnal).
const EXO_PAGES = {
	[`${BASE}/chants/recueil/6`]: 'listing-exo-page1.html',
	[`${BASE}/chants/recueil/6?page=2`]: 'listing-exo-page2.html',
	[`${BASE}/chants/recueil/6?page=3`]: 'listing-exo-page3.html'
};
/** The 50 distinct ids of the three saved Exo pages (2026-11-13), ascending. */
const EXO_IDS = [
	698, 704, 705, 706, 708, 752, 753, 754, 755, 756, 757, 758, 759, 760, 762, 764, 765, 766, 767,
	770, 771, 773, 774, 776, 777, 778, 779, 780, 781, 782, 783, 784, 789, 790, 791, 792, 794, 795,
	1312, 1313, 1314, 1315, 1316, 1320, 1321, 1322, 1323, 1324, 1325, 1326
];
const table = (ids: number[]): PinnedId[] => ids.map((id, i) => ({ number: i + 1, id }));
const listExo = (pinned: PinnedId[], pages: Record<string, string> = EXO_PAGES) => {
	const ctx = fixtureContext(pages);
	return createCdlAdapter({ exo: [6] }, { exo: pinned })
		.listEntries('exo', ctx)
		.then((entries) => ({ entries, logs: ctx.logs.join('\n'), fetched: ctx.fetched }));
};

describe('Exo listing (unnumbered hymnal)', () => {
	it('keeps one entry per distinct song over the three overlapping pages', async () => {
		const { entries, logs, fetched } = await listExo(table(EXO_IDS));
		expect(fetched).toHaveLength(3);
		expect(entries).toHaveLength(50);
		expect(entries[0]).toEqual({ hymnal: 'exo', number: '1', url: `${BASE}/698` });
		expect(entries.at(-1)).toEqual({ hymnal: 'exo', number: '50', url: `${BASE}/1326` });
		expect(entries.map((e) => Number(e.number))).toEqual(EXO_IDS.map((_, i) => i + 1));
		expect(logs).toContain('exo: 60 rows, 50 songs listed');
		expect(logs).not.toMatch(/not pinned yet|pinned but not/);
	});

	it('uses the pinned number, whatever the id order', async () => {
		const shuffled: PinnedId[] = [
			{ number: 1, id: 1326 },
			{ number: 2, id: 698 },
			...EXO_IDS.slice(1, -1).map((id, i) => ({ number: i + 3, id }))
		];
		const { entries } = await listExo(shuffled);
		expect(entries[0].url).toBe(`${BASE}/1326`);
		expect(entries[1].url).toBe(`${BASE}/698`);
	});

	it('numbers an unpinned id after the highest pinned number and says so', async () => {
		const { entries, logs } = await listExo(table(EXO_IDS.filter((id) => id !== 1320)));
		expect(entries.find((e) => e.url === `${BASE}/1320`)?.number).toBe('50');
		expect(logs).toContain('exo 50: /1320 is not pinned yet: add it to CDL_PINNED');
	});
});

describe('Exo numbers stay stable (US3)', () => {
	it('gives the same numbers when the pages come in another order', async () => {
		const normal = await listExo(table(EXO_IDS));
		const reordered = await listExo(table(EXO_IDS), {
			[`${BASE}/chants/recueil/6`]: 'listing-exo-page3.html',
			[`${BASE}/chants/recueil/6?page=2`]: 'listing-exo-page2.html',
			[`${BASE}/chants/recueil/6?page=3`]: 'listing-exo-page1.html'
		});
		expect(reordered.entries).toEqual(normal.entries);
	});

	it('still lists a pinned song the listing missed this run', async () => {
		const { entries, logs } = await listExo([...table(EXO_IDS), { number: 99, id: 9999 }]);
		expect(entries.at(-1)).toEqual({ hymnal: 'exo', number: '99', url: `${BASE}/9999` });
		expect(logs).toContain('exo 99: /9999 pinned but not in the list this run');
	});

	it('gives a new song the next free number without moving the others', async () => {
		const without = EXO_IDS.filter((id) => id !== 1312);
		const { entries } = await listExo(table(without));
		const byUrl = new Map(entries.map((e) => [e.url, e.number]));
		without.forEach((id, i) => expect(byUrl.get(`${BASE}/${id}`)).toBe(String(i + 1)));
		expect(byUrl.get(`${BASE}/1312`)).toBe('50');
	});
});

describe('CDL_PINNED (shipped table)', () => {
	it('has unique numbers and ids, numbered 1..N in ascending id order', () => {
		for (const [hymnal, rows] of Object.entries(CDL_PINNED)) {
			expect(CDL_VOLUMES[hymnal]).toBeDefined();
			expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
			expect(new Set(rows.map((r) => r.number)).size).toBe(rows.length);
			const byId = [...rows].sort((a, b) => a.id - b.id).map((r) => r.number);
			expect(byId).toEqual(rows.map((_, i) => i + 1));
		}
		expect(CDL_PINNED.exo).toHaveLength(60);
	});
});

describe('Exo song pages', () => {
	it('reads a "(Refrain)" line as the label of its section, not as lyrics (/698)', () => {
		const hymn = ok('hymn-698.html', ref('1', '698', 'exo'));
		expect(hymn.title).toBe('Si tu veux le louer');
		const lines = hymn.sections.flatMap((s) => s.lines);
		expect(lines).not.toContain('(Refrain)');
		expect(hymn.strippedMarkup['section-marker']).toBe(1);
		const chorus = hymn.sections.filter((s) => s.type === 'chorus');
		expect(chorus).toHaveLength(1);
		expect(chorus[0]).toMatchObject({ number: null });
		expect(chorus[0].lines[0]).toBe('Si tu veux le louer - sache');
		const verses = hymn.sections.filter((s) => s.type === 'verse').map((s) => s.number);
		expect(verses).toEqual(verses.map((_, i) => i + 1));
		expect(hymn.credits.map((c) => c.name).sort()).toEqual(['CHRIS CHRISTENSEN', 'THIERRY OSTRINI']);
		expect(hymn.credits.every((c) => c.role === 'unspecified')).toBe(true);
	});

	it('reads a chorus before the verses, with one author (/1320)', () => {
		const hymn = ok('hymn-1320.html', ref('2', '1320', 'exo'));
		expect(hymn.title).toBe("Dieu de l'impossible");
		expect(hymn.sections[0]).toMatchObject({ type: 'chorus', number: null });
		expect(hymn.sections[0].lines[0]).toBe("Dieu de l'impossible,");
		expect(hymn.sections[1]).toMatchObject({ type: 'verse', number: 1 });
		expect(hymn.credits).toEqual([{ name: 'CHRIS CHRISTENSEN', role: 'unspecified' }]);
	});
});
