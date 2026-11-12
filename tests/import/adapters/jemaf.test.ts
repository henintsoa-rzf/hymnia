// jemaf.fr adapter on saved pages (contracts/source-adapter.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	createJemafAdapter,
	jemaf,
	JEMAF_HYMNALS
} from '../../../scripts/import/sources/jemaf';
import type { AdapterContext, EntryRef } from '../../../scripts/import/sources/types';
import { decodeEntities, fixtureContext, fixturePage } from '../helpers/fixtures';

const BASE = 'https://jemaf.fr';
const ref = (hymnal: string, number: string, code: string): EntryRef => ({
	hymnal,
	number,
	url: `${BASE}/chant/${code}`
});
const page = (file: string) => fixturePage('jemaf', file);
const ok = (html: string, r: EntryRef) => {
	const result = jemaf.parseHymn(html, r);
	if (!result.ok) throw new Error(result.reason);
	return result.hymn;
};

describe('parseHymn', () => {
	it('extracts title, numbered verses, credits with roles and the reference (AdF 1)', () => {
		const hymn = ok(page('hymn-af001.html'), ref('adf', '1', 'af001'));
		expect(hymn).toMatchObject({
			source: 'jemaf',
			hymnal: 'adf',
			number: '1',
			url: `${BASE}/chant/af001`,
			title: "Qu'on batte des mains."
		});
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['verse', 1, 7],
			['verse', 2, 6],
			['verse', 3, 6]
		]);
		expect(hymn.sections[0].lines.slice(0, 2)).toEqual([
			"Qu'on batte des mains !",
			'Que tous les humains,'
		]);
		expect(hymn.sections[2].lines[4]).toBe("D'un cœur plein de foi chantez notre Roi,");
		expect(hymn.credits).toEqual([
			{ name: 'Louis Bourgeois', role: 'music' },
			{ name: 'Théodore De Bèze', role: 'lyrics' }
		]);
		expect(hymn.unknownCredits).toEqual([]);
		expect(hymn.strippedMarkup).toEqual({ 'verse-number': 3 });
	});

	it('keeps the chorus each time the source writes it, and a blank line inside a verse (ATG 1)', () => {
		const hymn = ok(page('hymn-atg001.html'), ref('atg', '1', 'atg001'));
		expect(hymn.title).toBe('À Toi la Gloire !');
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['chorus', null],
			['verse', 2],
			['chorus', null],
			['verse', 3],
			['chorus', null]
		]);
		expect(hymn.sections[0].lines).toEqual([
			'À toi la gloire,',
			'Ô Ressuscité !',
			'À toi la victoire',
			"Pour l'éternité !",
			'Brillant de lumière,',
			"L'ange est descendu,",
			'Il roule la pierre',
			'Du tombeau vaincu.'
		]);
		expect(hymn.sections[3]).toEqual(hymn.sections[1]);
		expect(hymn.credits).toEqual([
			{ name: 'George Frideric Haendel', role: 'music' },
			{ name: 'Edmond Louis Budry', role: 'lyrics' }
		]);
	});

	it('types sections by their label: "Refrain 1", "Strophe 2" (JEM 17)', () => {
		const hymn = ok(page('hymn-jem017.html'), ref('jem', '17', 'jem017'));
		expect(hymn.title).toBe("Ah ! Qu'il est doux pour des frères");
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['chorus', null],
			['verse', 2],
			['chorus', null]
		]);
		expect(hymn.sections[2].lines[0]).toBe('Hiné matov ouma nayim');
		expect(hymn.strippedMarkup).toEqual({ 'verse-number': 2 });
	});

	it('maps "Refrain a/b", "Pont 1/2a" and "Fin", whatever block draws them (JEM 1000)', () => {
		const hymn = ok(page('hymn-jem1000.html'), ref('jem', '1000', 'jem1000'));
		expect(hymn.title).toBe('Cet amour');
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['chorus', null],
			['chorus', null],
			['verse', 2],
			['chorus', null],
			['chorus', null],
			['bridge', null],
			['bridge', null],
			['bridge', null],
			['chorus', null],
			['chorus', null],
			['other', null]
		]);
		// One string on the site, for both roles: kept as it is.
		expect(hymn.credits).toEqual([
			{ name: 'Paul Baloche et Michael Rossback', role: 'music' },
			{ name: 'Paul Baloche et Michael Rossback', role: 'lyrics' }
		]);
	});

	it('parses a lettered variant page, which prints the plain number (AdF 309A)', () => {
		const hymn = ok(page('hymn-af309a.html'), ref('adf', '309A', 'af309a'));
		expect(hymn.number).toBe('309A');
		expect(hymn.title).toBe('Abandonne ta vie.');
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['verse', 1, 8],
			['verse', 2, 8],
			['verse', 3, 8],
			['verse', 4, 8]
		]);
	});

	it('changes nothing in the text but whitespace and verse numbers (FR-004)', () => {
		for (const [file, r] of [
			['hymn-atg001.html', ref('atg', '1', 'atg001')],
			['hymn-jem1000.html', ref('jem', '1000', 'jem1000')],
			['hymn-af309a.html', ref('adf', '309A', 'af309a')]
		] as const) {
			// The page's lyrics blocks, decoded independently of the adapter.
			const html = page(file);
			const blocks = [...html.matchAll(/<div class="(?:strophe|refrain)">([\s\S]*?)<\/div>/g)];
			const expected = blocks.flatMap((m) =>
				decodeEntities(m[1])
					.split(/\r?\n/)
					.map((line) => line.replace(/\s+/g, ' ').trim())
					.filter(Boolean)
					.map((line, i) => (i === 0 ? line.replace(/^\d+\. /, '') : line))
			);
			const hymn = ok(html, r);
			expect(hymn.sections).toHaveLength(blocks.length);
			expect(hymn.sections.flatMap((s) => s.lines)).toEqual(expected);
		}
	});

	it('removes chords when a page shows them, and counts them', () => {
		const html = page('hymn-af001.html')
			.replace('Que tous les humains,', '[G]Que tous les [D]humains,')
			.replace("D'un chant solennel", "G  D/F#  Em\nD'un chant solennel");
		const hymn = ok(html, ref('adf', '1', 'af001'));
		expect(hymn.sections[0].lines.slice(1, 4)).toEqual([
			'Que tous les humains,',
			'En cet heureux jour, viennent tour à tour',
			"D'un chant solennel louer l'Éternel."
		]);
		expect(hymn.strippedMarkup).toEqual({
			'verse-number': 3,
			'inline-chord': 2,
			'chord-line': 1
		});
	});

	it('accepts a page with no credits, and reports credit fields it cannot map', () => {
		const html = page('hymn-af001.html').replace(
			'"composer":"Louis Bourgeois","author":"Th\\u00e9odore De B\\u00e8ze"',
			'"composer":"","author":"","interprete":"Chorale X"'
		);
		const hymn = ok(html, ref('adf', '1', 'af001'));
		expect(hymn.credits).toEqual([]);
		expect(hymn.unknownCredits).toEqual(['interprete: Chorale X']);
	});

	it('fails with a short, stable reason on a page that is not a hymn', () => {
		const r = ref('adf', '999', 'af999');
		expect(jemaf.parseHymn(page('not-found.html'), r)).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
		expect(jemaf.parseHymn(page('not-a-hymn.html'), r)).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
		expect(jemaf.parseHymn(page('listing-atg.html'), r)).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
	});

	it('produces lines in NFC with no verse number, label or stray space left', () => {
		for (const [file, r] of [
			['hymn-af001.html', ref('adf', '1', 'af001')],
			['hymn-atg001.html', ref('atg', '1', 'atg001')],
			['hymn-jem017.html', ref('jem', '17', 'jem017')],
			['hymn-jem1000.html', ref('jem', '1000', 'jem1000')]
		] as const) {
			const hymn = ok(page(file), r);
			expect(hymn.title).toBe(hymn.title.normalize('NFC'));
			for (const line of hymn.sections.flatMap((s) => s.lines)) {
				expect(line).toBe(line.normalize('NFC'));
				expect(line).not.toMatch(/^\s|\s$|\u00a0|\r|^\d+\.\s|Strophe|Refrain|Pont/);
			}
		}
	});
});

describe('listEntries', () => {
	const LISTING = `${BASE}/index/atg&lt=0-9`;
	const serving = (html: string): AdapterContext & { logs: string[] } => {
		const logs: string[] = [];
		return { logs, fetch: async () => html, log: (m) => logs.push(m) };
	};

	it('lists numbers and URLs from the hymnal index, in number order', async () => {
		const ctx = fixtureContext({ [LISTING]: 'listing-atg.html' }, { source: 'jemaf' });
		const entries = await jemaf.listEntries('atg', ctx);
		expect(ctx.fetched).toEqual([LISTING]);
		expect(entries).toHaveLength(400);
		expect(entries.slice(0, 2)).toEqual([
			{ hymnal: 'atg', number: '1', url: `${BASE}/chant/atg001` },
			{ hymnal: 'atg', number: '2', url: `${BASE}/chant/atg002` }
		]);
		expect(entries.at(-1)).toEqual({ hymnal: 'atg', number: '400', url: `${BASE}/chant/atg400` });
	});

	it('keeps a letter suffix and skips items with no number, saying so', async () => {
		const html = page('listing-atg.html')
			.replace('<span>ATG002</span>', '')
			.replace('href="chant/atg003" class="resRech" ><span>ATG003</span>', 'href="chant/atg003a" class="resRech" ><span>ATG003A</span>');
		const ctx = serving(html);
		const entries = await jemaf.listEntries('atg', ctx);
		expect(entries).toHaveLength(399);
		expect(entries.slice(0, 2)).toEqual([
			{ hymnal: 'atg', number: '1', url: `${BASE}/chant/atg001` },
			{ hymnal: 'atg', number: '3A', url: `${BASE}/chant/atg003a` }
		]);
		expect(ctx.logs.join('\n')).toMatch(/atg002.*no number/);
	});

	it('keeps the first of two items with the same number', async () => {
		const html = page('listing-atg.html').replace('<span>ATG002</span>', '<span>ATG001</span>');
		const ctx = serving(html);
		const entries = await jemaf.listEntries('atg', ctx);
		expect(entries).toHaveLength(399);
		expect(entries[0].url).toBe(`${BASE}/chant/atg001`);
		expect(ctx.logs.join('\n')).toMatch(/listed twice/);
	});

	it('uses the configured index and code of a hymnal', async () => {
		const ctx = fixtureContext(
			{ [`${BASE}/index/test&lt=0-9`]: 'listing-atg.html' },
			{ source: 'jemaf' }
		);
		const adapter = createJemafAdapter({ adf: { index: 'test', code: 'ATG' } });
		expect(await adapter.listEntries('adf', ctx)).toHaveLength(400);
	});

	it('knows the hymnals it covers, matching import/sources.json', () => {
		expect(JEMAF_HYMNALS).toEqual({
			jem: { index: 'jem1-4', code: 'JEM' },
			adf: { index: 'af', code: 'AF' },
			atg: { index: 'atg', code: 'ATG' }
		});
		const sources = JSON.parse(readFileSync('import/sources.json', 'utf8'));
		const config = sources.find((s: { id: string }) => s.id === 'jemaf');
		expect([...config.hymnals].sort()).toEqual(Object.keys(JEMAF_HYMNALS).sort());
	});

	it('refuses a hymnal it does not cover', async () => {
		await expect(jemaf.listEntries('cd', fixtureContext({}))).rejects.toThrow(/"cd"/);
	});
});
