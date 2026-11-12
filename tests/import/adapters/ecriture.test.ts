// ecrituremusique.com adapter on saved pages (contracts/source-adapter.md, task T066).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	createEcritureAdapter,
	ecriture,
	ECRITURE_ALBUMS
} from '../../../scripts/import/sources/ecriture';
import type { AdapterContext, EntryRef } from '../../../scripts/import/sources/types';
import { decodeEntities, fixtureContext, fixturePage } from '../helpers/fixtures';

const BASE = 'https://www.ecrituremusique.com';
const ref = (number: string, slug: string): EntryRef => ({
	hymnal: 'ecriture',
	number,
	url: `${BASE}/${slug}`
});
const page = (file: string) => fixturePage('ecriture', file);
const parse = (file: string, r: EntryRef) => ecriture.parseHymn(page(file), r);
const ok = (file: string, r: EntryRef) => {
	const result = parse(file, r);
	if (!result.ok) throw new Error(result.reason);
	return result.hymn;
};
const both = (...names: string[]) =>
	names.flatMap((name) => [
		{ name, role: 'lyrics' },
		{ name, role: 'music' }
	]);

/** The title and lyrics lines, decoded independently of the adapter (blank lines dropped). */
function sourceLines(html: string): string[] {
	const block = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)<\/div>/.exec(html)!;
	return decodeEntities(
		`${block[1]}\n${block[2]}`.replace(/<br\s*\/?>|<\/p>/g, '\n').replace(/<[^>]+>/g, '')
	)
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
}

describe('parseHymn', () => {
	it('extracts title, numbered verses, chorus and credits (Ta Parole)', () => {
		const hymn = ok('hymn-taparole.html', ref('1', 'taparole'));
		expect(hymn).toMatchObject({
			source: 'ecriture',
			hymnal: 'ecriture',
			number: '1',
			url: `${BASE}/taparole`,
			title: 'Ta Parole'
		});
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['verse', 1, 4],
			['chorus', null, 4],
			['verse', 2, 4],
			['verse', 3, 4]
		]);
		expect(hymn.sections[0].lines[0]).toBe("Ta Parole, portée par l'Esprit,");
		expect(hymn.sections[1].lines).toEqual([
			"Quel sublime trésor, plus précieux que l'or,",
			'Tes paroles de vie éternelle !',
			'Œuvre par ton Esprit pour révéler le Christ.',
			'Parle-nous, nourris-nous par ta voix !'
		]);
		expect(hymn.sections[2].lines[3]).toBe('Combats en nous l’incrédulité.');
		// "Paroles et musique : …": each name gets both roles.
		expect(hymn.credits).toEqual(
			both('Adrian Price', 'Fiona Price', 'Naomi Pilgrem', 'Johnny Pilgrem')
		);
		expect(hymn.unknownCredits).toEqual([]);
		expect(hymn.strippedMarkup).toEqual({ 'verse-number': 3, 'section-label': 1 });
	});

	it('keeps a chorus written once, and a different last chorus (Glorieux, l’Éternel règne)', () => {
		const hymn = ok('hymn-glorieuxleternelregne.html', ref('26', 'glorieuxleternelregne'));
		expect(hymn.title).toBe('Glorieux, l’Éternel règne');
		expect(hymn.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['chorus', null],
			['verse', 2],
			['verse', 3],
			['chorus', null]
		]);
		expect(hymn.sections[4].lines[0]).toBe('D’une voix devant le trône,');
		expect(hymn.sections[4].lines[4]).toBe('À jamais soit exalté !');
	});

	it('maps PRE-REFRAIN to other and PONT to bridge', () => {
		expect(
			ok('hymn-christseul.html', ref('3', 'christseul')).sections.map((s) => [s.type, s.number])
		).toEqual([
			['verse', 1],
			['verse', 2],
			['other', null],
			['chorus', null],
			['verse', 3],
			['verse', 4]
		]);
		const richesse = ok('hymn-larichesse.html', ref('12', 'larichesse'));
		expect(richesse.sections.map((s) => [s.type, s.number])).toEqual([
			['verse', 1],
			['verse', 2],
			['chorus', null],
			['verse', 3],
			['bridge', null],
			['verse', 4]
		]);
		expect(richesse.sections[4].lines).toEqual([
			'A lui la gloire pour toujours !',
			'A lui la gloire pour toujours !'
		]);
	});

	it('keeps the chorus first when the source puts it first (À ta suite)', () => {
		const hymn = ok('hymn-atasuite.html', ref('22', 'atasuite'));
		expect(hymn.sections.map((s) => [s.type, s.number, s.lines.length])).toEqual([
			['chorus', null, 4],
			['verse', 1, 4],
			['verse', 2, 5],
			['verse', 3, 5]
		]);
		expect(hymn.sections[3].lines[4]).toBe('(Oui) je veux servir le Ressuscité.');
		expect(hymn.credits).toHaveLength(12);
	});

	it('changes nothing in the text but whitespace, verse numbers and labels (FR-004)', () => {
		for (const [file, slug] of [
			['hymn-taparole.html', 'taparole'],
			['hymn-glorieuxleternelregne.html', 'glorieuxleternelregne'],
			['hymn-christseul.html', 'christseul'],
			['hymn-larichesse.html', 'larichesse'],
			['hymn-atasuite.html', 'atasuite'],
			['hymn-celestepere.html', 'celestepere']
		] as const) {
			const [title, ...lines] = sourceLines(page(file));
			const hymn = ok(file, ref('1', slug));
			expect(hymn.title).toBe(title);
			// Each section starts at a source line: "N. text" or a label line before the text.
			let removed = 0;
			const expected = lines.flatMap((line) => {
				if (/^[A-ZÉ][A-ZÉ -]+$/.test(line)) {
					removed++;
					return [];
				}
				const verse = /^\d+\.\s+/.exec(line);
				if (verse) removed++;
				return [verse ? line.slice(verse[0].length) : line];
			});
			expect(hymn.sections.flatMap((s) => s.lines)).toEqual(expected);
			const counted = Object.values(hymn.strippedMarkup).reduce((a, b) => a + b, 0);
			expect(counted).toBe(removed);
		}
	});

	it('accepts a page with no credits', () => {
		const html = page('hymn-celestepere.html').replace(
			/© 2019 Écriture Musique\. <br>Paroles et musique : [^<]*/,
			''
		);
		expect(html).not.toBe(page('hymn-celestepere.html'));
		const result = ecriture.parseHymn(html, ref('9', 'celestepere'));
		expect(result.ok && result.hymn.credits).toEqual([]);
	});

	it('reports a credit label it cannot map', () => {
		const html = page('hymn-celestepere.html').replace(
			'Paroles et musique : ',
			'Réalisation : X. <br>Paroles : '
		);
		const result = ecriture.parseHymn(html, ref('9', 'celestepere'));
		if (!result.ok) throw new Error(result.reason);
		expect(result.hymn.unknownCredits).toEqual(['Réalisation: X.']);
		expect(result.hymn.credits.map((c) => c.role)).toEqual(['lyrics', 'lyrics', 'lyrics']);
	});

	it('fails with a short, stable reason on a page that is not a hymn', () => {
		expect(parse('not-a-hymn.html', ref('1', 'apropos'))).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
		expect(parse('listing-chants.html', ref('1', 'chants'))).toEqual({
			ok: false,
			reason: 'no lyrics block'
		});
	});

	it('produces lines in NFC with no verse number or label left', () => {
		for (const [file, slug] of [
			['hymn-taparole.html', 'taparole'],
			['hymn-christseul.html', 'christseul'],
			['hymn-celestepere.html', 'celestepere']
		] as const) {
			for (const line of ok(file, ref('1', slug)).sections.flatMap((s) => s.lines)) {
				expect(line).toBe(line.normalize('NFC'));
				expect(line).not.toMatch(/^\s|\s$|\u00a0|^\d+\.\s|REFRAIN|^PONT$/);
			}
		}
	});
});

describe('listEntries', () => {
	const pages = { [`${BASE}/chants`]: 'listing-chants.html' };
	const context = (html: string): AdapterContext & { logs: string[] } => {
		const logs: string[] = [];
		return { logs, fetch: async () => html, log: (m) => logs.push(m) };
	};

	it('numbers album tracks in fixed blocks, oldest album first', async () => {
		const ctx = fixtureContext(pages, { source: 'ecriture' });
		const entries = await ecriture.listEntries('ecriture', ctx);
		expect(ctx.fetched).toEqual([`${BASE}/chants`]);
		expect(entries).toHaveLength(32);
		expect(entries.map((e) => e.number)).toEqual(
			Array.from({ length: 32 }, (_, i) => String(i + 1))
		);
		expect(entries[0]).toEqual({ hymnal: 'ecriture', number: '1', url: `${BASE}/taparole` });
		expect(entries[11]).toEqual({ hymnal: 'ecriture', number: '12', url: `${BASE}/larichesse` });
		expect(entries[12].url).toBe(`${BASE}/connaitrechrist`);
		expect(entries[21].url).toBe(`${BASE}/atasuite`);
		expect(entries[25].url).toBe(`${BASE}/glorieuxleternelregne`);
		expect(entries[31].url).toBe(`${BASE}/enchrist`);
		expect(ctx.logs).toEqual([]);
	});

	it('skips a track with no number, and says so', async () => {
		const html = page('listing-chants.html').replace('3. Jésus élevé', 'Jésus élevé');
		const ctx = context(html);
		const entries = await ecriture.listEntries('ecriture', ctx);
		expect(entries).toHaveLength(31);
		expect(entries.find((e) => e.url === `${BASE}/jesuseleve`)).toBeUndefined();
		expect(entries.find((e) => e.number === '15')).toBeUndefined();
		expect(ctx.logs.join('\n')).toMatch(/Jésus élevé.*no track number/);
	});

	it('skips the songs of an album with no numbers yet, and says so', async () => {
		const albums = { ecriture: ECRITURE_ALBUMS.ecriture.slice(0, 2) };
		const ctx = context(page('listing-chants.html'));
		const entries = await createEcritureAdapter(albums).listEntries('ecriture', ctx);
		expect(entries).toHaveLength(25);
		expect(ctx.logs.join('\n')).toMatch(/En toutes choses, Pt\. 1.*7 songs skipped/);
		expect(ctx.logs.join('\n')).toMatch(/Glorieux.*on no album/);
	});

	it('knows the hymnals it covers, matching import/sources.json', () => {
		const sources = JSON.parse(readFileSync('import/sources.json', 'utf8'));
		const config = sources.find((s: { id: string }) => s.id === 'ecriture');
		expect([...config.hymnals].sort()).toEqual(Object.keys(ECRITURE_ALBUMS).sort());
	});

	it('refuses a hymnal it does not cover', async () => {
		await expect(ecriture.listEntries('jem', fixtureContext({}))).rejects.toThrow(/jem/);
	});
});
