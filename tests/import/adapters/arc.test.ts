// Arc-en-ciel adapter on an excerpt of the Google Doc export (tests/import/fixtures/arc/README.md).
import { describe, expect, it } from 'vitest';
import { arc, ARC_EXPORT, parseArcDocument } from '../../../scripts/import/sources/arc';
import type { EntryRef } from '../../../scripts/import/sources/types';
import { fixtureContext, fixturePage } from '../helpers/fixtures';

const doc = fixturePage('arc', 'document.html');
const ref = (number: string): EntryRef => ({
	hymnal: 'arc',
	number,
	url: `${ARC_EXPORT}#${number.replace(/\s+/g, '')}`
});
const ok = (number: string) => {
	const result = arc.parseHymn(doc, ref(number));
	if (!result.ok) throw new Error(result.reason);
	return result.hymn;
};
const shape = (number: string) => ok(number).sections.map((s) => [s.type, s.number, s.lines.length]);

describe('listEntries', () => {
	it('lists every song of the document, one page, numbered as printed', async () => {
		const ctx = fixtureContext({ [ARC_EXPORT]: 'document.html' }, { source: 'arc' });
		const refs = await arc.listEntries('arc', ctx);
		expect(ctx.fetched).toEqual([ARC_EXPORT]);
		expect(refs.map((r) => r.number)).toEqual([
			'1',
			'5 A',
			'24',
			'136',
			'258',
			'320',
			'352',
			'467',
			'591',
			'592'
		]);
		expect(refs[1]).toEqual({ hymnal: 'arc', number: '5 A', url: `${ARC_EXPORT}#5A` });
	});

	it('refuses another hymnal', async () => {
		const ctx = fixtureContext({}, { source: 'arc' });
		await expect(arc.listEntries('jem', ctx)).rejects.toThrow(/does not cover/);
	});
});

describe('parseArcDocument', () => {
	it('keeps the h1 section of each song and ignores h2 subsections', () => {
		const parts = Object.fromEntries(parseArcDocument(doc).map((s) => [s.number, s.part]));
		expect(parts).toMatchObject({ '1': 'Psaumes', '258': 'Louange', '352': 'Noël', '592': 'Baptême' });
	});
});

describe('parseHymn', () => {
	it('reads a psalm: title without "Ps n.", numbered verses, labels removed', () => {
		const hymn = ok('1');
		expect(hymn).toMatchObject({ source: 'arc', hymnal: 'arc', number: '1', title: 'Heureux', credits: [] });
		expect(shape('1')).toEqual([
			['verse', 1, 6],
			['verse', 2, 6],
			['verse', 3, 6]
		]);
		expect(hymn.sections[0].lines[0]).toBe('Heureux celui dont la plus grande joie');
		expect(hymn.strippedMarkup).toEqual({ 'verse-number': 3 });
	});

	it('finds a lettered number', () => {
		expect(ok('5 A').title).toBe('Entends, Seigneur, ma plainte');
	});

	it('drops a note opening a paragraph, keeps the verse after it (Ps 24)', () => {
		const hymn = ok('24');
		const six = hymn.sections.find((s) => s.number === 6)!;
		expect(six.lines[0]).toBe('Réjouis-toi, cité de Dieu :');
		expect(hymn.sections.flatMap((s) => s.lines)).not.toContain('(Pour le jour des Rameaux)');
		expect(hymn.strippedMarkup.note).toBe(1);
	});

	it('reads "Rif." as a chorus (Ps 136)', () => {
		const [first, second] = ok('136').sections;
		expect(first).toMatchObject({ type: 'verse', number: 1 });
		expect(second).toMatchObject({ type: 'chorus', number: null });
		expect(second.lines[0]).toBe('Sa bonté dure à toujours.');
	});

	it('keeps an unnumbered song as plain stanzas and drops "Peut se chanter…" (258)', () => {
		const hymn = ok('258');
		expect(hymn.sections.every((s) => s.type === 'other')).toBe(true);
		expect(hymn.sections.flatMap((s) => s.lines).join(' ')).not.toMatch(/Peut se chanter/);
		expect(hymn.strippedMarkup.note).toBe(1);
	});

	it('reads "R." refrains and drops the footnote paragraph (320)', () => {
		const hymn = ok('320');
		expect(hymn.sections[1]).toMatchObject({ type: 'chorus', number: null });
		expect(hymn.sections[1].lines[0]).toBe('Quand viendra-t-il* marcher sur nos chemins,');
		expect(hymn.sections.at(-1)).toMatchObject({ type: 'verse', number: 6 });
		expect(hymn.strippedMarkup.note).toBe(1);
	});

	it('reads "1-4." as a chorus (352)', () => {
		const hymn = ok('352');
		expect(hymn.sections[0]).toMatchObject({ type: 'chorus', number: null });
		expect(hymn.sections[0].lines[0]).toBe('O nuit bienveillante,');
		expect(hymn.sections.at(-1)!.lines[0]).toBe('Chantons, chantons à l’Eternel.');
		expect(hymn.strippedMarkup['verse-range']).toBe(2);
	});

	it('reads "R1." and "R2." as choruses (467)', () => {
		const choruses = ok('467').sections.filter((s) => s.type === 'chorus');
		expect(choruses.map((s) => s.lines[0])).toEqual([
			'O Seigneur, pardonne à ton peuple.',
			'O Seigneur, nous sommes ton peuple.'
		]);
	});

	it('splits a song whose heading is a plain paragraph (591, 592)', () => {
		expect(shape('591')).toEqual([
			['other', null, 1],
			['other', null, 1]
		]);
		const hymn = ok('592');
		expect(hymn.title).toBe('Seigneur, tu es notre joie');
		expect(shape('592')).toEqual([
			['chorus', null, 4],
			['verse', 1, 4],
			['verse', 2, 4]
		]);
	});

	it('fails on a number missing from the document', () => {
		expect(arc.parseHymn(doc, ref('999'))).toEqual({ ok: false, reason: 'song 999 not in the document' });
	});
});
