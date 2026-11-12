// Recognising the same hymn across hymnals and sources (US3, task T049). Offline.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildData } from '../../../scripts/build-data';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { markDistinct, mergeHymns } from '../../../scripts/import/pipeline/merge';
import { runImport } from '../../../scripts/import/pipeline/run';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import { jemaf } from '../../../scripts/import/sources/jemaf';
import type { SourceAdapter } from '../../../scripts/import/sources/types';
import { fixturePage } from '../helpers/fixtures';
import { cachePage, makeWorkspace, seedCache } from '../helpers/workspace';

const NOW = new Date('2026-11-12T08:30:00.000Z');
const JEMAF = 'https://jemaf.fr/chant';

/** An adapter with a fixed listing per hymnal, using cdl's page parser. */
function adapter(id: string, listing: Record<string, [string, string][]>): SourceAdapter {
	return {
		id,
		listEntries: async (hymnal) => (listing[hymnal] ?? []).map(([number, url]) => ({ hymnal, number, url })),
		parseHymn: cdl.parseHymn
	};
}

let root: string;
beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'cdl');
	// "Qu'on batte des mains" with other lyrics: same title, different hymn.
	const sameTitle = fixturePage('cdl', 'hymn-1413.html').replace(
		/<h2>[\s\S]*?<\/h2>/,
		"<h2>Qu'on batte des mains</h2>"
	);
	await cachePage(root, 'cdl', `${CDL_BASE}/9001`, sameTitle);
});

const run = (source: string, hymnals: string[], a: SourceAdapter) =>
	runImport({ root, source, hymnals, offline: true, yes: true, now: () => NOW, adapter: a, hooks: importHooks });

const hymn = async (id: string) =>
	JSON.parse(await readFile(join(root, 'content', 'hymns', `${id}.json`), 'utf8'));
const exists = async (id: string) =>
	(await readdir(join(root, 'content', 'hymns'))).includes(`${id}.json`);
const redirects = async () =>
	JSON.parse(await readFile(join(root, 'content', 'redirects.json'), 'utf8').catch(() => '{}'));

const CDL = adapter('cdl', {
	jem: [['900', `${CDL_BASE}/1411`]],
	adf: [['1', `${CDL_BASE}/1411`]],
	cd: [['50', `${CDL_BASE}/9001`]]
});

describe('duplicates (US3)', () => {
	it('stores a hymn shared by two hymnals once, with both entries', async () => {
		const report = await run('cdl', ['jem', 'adf', 'cd'], CDL);
		expect(report.perHymnal.jem.new.map((n) => n.hymnId)).toEqual(['qu-on-batte-des-mains']);
		expect(report.perHymnal.adf.autoMerged.map((n) => n.number)).toEqual(['1']);
		expect((await hymn('qu-on-batte-des-mains')).entries).toEqual([
			{ hymnal: 'jem', number: '900' },
			{ hymnal: 'adf', number: '1' }
		]);
	});

	it('never gives a hymn two numbers of the same hymnal in one run (unless lettered variants)', async () => {
		// AdF 1 and AdF 2 print the same text: AdF 1 joins JEM 900, AdF 2 stays its own hymn.
		const report = await run(
			'cdl',
			['jem', 'adf'],
			adapter('cdl', {
				jem: [['900', `${CDL_BASE}/1411`]],
				adf: [
					['1', `${CDL_BASE}/1411`],
					['2', `${CDL_BASE}/1411#again`]
				]
			})
		);
		expect((await hymn('qu-on-batte-des-mains')).entries).toEqual([
			{ hymnal: 'jem', number: '900' },
			{ hymnal: 'adf', number: '1' }
		]);
		expect(report.perHymnal.adf.new.map((n) => n.number)).toEqual(['2']);
	});

	it('keeps the title each hymnal prints on its entry (HymnalEntry.title)', async () => {
		const retitled = fixturePage('cdl', 'hymn-1411.html').replace(
			/<h2>[\s\S]*?<\/h2>/,
			'<h2>Battez des mains, peuples</h2>'
		);
		await cachePage(root, 'cdl', `${CDL_BASE}/9002`, retitled);
		await run(
			'cdl',
			['jem', 'adf'],
			adapter('cdl', {
				jem: [['900', `${CDL_BASE}/1411`]],
				adf: [['1', `${CDL_BASE}/9002`]]
			})
		);
		const merged = await hymn('qu-on-batte-des-mains');
		expect(merged.title).toBe("Qu'on batte des mains");
		expect(merged.entries).toEqual([
			{ hymnal: 'jem', number: '900' },
			{ hymnal: 'adf', number: '1', title: 'Battez des mains, peuples' }
		]);
		// A manual merge keeps them too.
		await writeFile(
			join(root, 'content/hymns/autre-chant.json'),
			JSON.stringify({ ...merged, id: 'autre-chant', title: 'Autre chant', entries: [{ hymnal: 'cd', number: '1' }] })
		);
		await mergeHymns(root, 'qu-on-batte-des-mains', 'autre-chant', '2026-11-12');
		expect((await hymn('qu-on-batte-des-mains')).entries).toContainEqual({
			hymnal: 'cd',
			number: '1',
			title: 'Autre chant'
		});
		expect((await buildData(join(root, 'content'))).errors).toEqual([]);
	});

	it('lists a same-title hymn with other lyrics as a possible duplicate, and keeps both', async () => {
		const report = await run('cdl', ['jem', 'adf', 'cd'], CDL);
		expect(report.perHymnal.cd.possibleDuplicates).toEqual([
			{
				a: 'qu-on-batte-des-mains',
				b: 'qu-on-batte-des-mains-cd-50',
				similarity: 0,
				reason: 'same title'
			}
		]);
		expect(await exists('qu-on-batte-des-mains-cd-50')).toBe(true);
	});

	it('takes the reference text from the source ranked first, and records the other source', async () => {
		await run('cdl', ['adf'], CDL);
		// jemaf has the same hymn with one small difference, and ranks first for adf.
		const page = fixturePage('cdl', 'hymn-1411.html').replace('Trembler&nbsp;à&nbsp;Sa&nbsp;voix', 'Trembler&nbsp;à&nbsp;sa&nbsp;voix');
		await cachePage(root, 'jemaf', `${JEMAF}/1`, page);
		const path = join(root, 'import/decisions/source-priority.json');
		await writeFile(path, JSON.stringify({ adf: ['jemaf', 'cdl'] }) + '\n');

		const report = await run('jemaf', ['adf'], adapter('jemaf', { adf: [['1', `${JEMAF}/1`]] }));
		expect(report.perHymnal.adf.autoMerged.map((n) => n.hymnId)).toEqual(['qu-on-batte-des-mains']);
		const merged = await hymn('qu-on-batte-des-mains');
		expect(merged.source.name).toBe('JEM — jemaf.fr');
		expect(merged.sections[0].lines[5]).toBe('Trembler à sa voix les plus puissants rois.');
		expect(merged.alternateSources).toEqual([
			expect.objectContaining({ name: 'Conducteur de louange — conducteurdelouange.com' })
		]);
		expect(merged.entries).toEqual([{ hymnal: 'adf', number: '1' }]);
	});

	it('keeps the reference text when the new source ranks lower', async () => {
		await run('cdl', ['adf'], CDL);
		const page = fixturePage('cdl', 'hymn-1411.html').replace('Trembler&nbsp;à&nbsp;Sa&nbsp;voix', 'Trembler&nbsp;à&nbsp;sa&nbsp;voix');
		await cachePage(root, 'jemaf', `${JEMAF}/1`, page);
		await writeFile(join(root, 'import/decisions/source-priority.json'), '{"adf": ["cdl", "jemaf"]}\n');
		await run('jemaf', ['adf'], adapter('jemaf', { adf: [['1', `${JEMAF}/1`]] }));
		const kept = await hymn('qu-on-batte-des-mains');
		expect(kept.source.name).toBe('Conducteur de louange — conducteurdelouange.com');
		expect(kept.alternateSources).toEqual([expect.objectContaining({ name: 'JEM — jemaf.fr' })]);
	});

	it('keeps the reference text when a hymnal with no priority is added from another source', async () => {
		// jemaf.fr gives AdF 1 first, as the reference text (it ranks first for adf).
		const page = fixturePage('cdl', 'hymn-1411.html').replace('Trembler&nbsp;à&nbsp;Sa&nbsp;voix', 'Trembler&nbsp;à&nbsp;sa&nbsp;voix');
		await cachePage(root, 'jemaf', `${JEMAF}/1`, page);
		await writeFile(join(root, 'import/decisions/source-priority.json'), '{"adf": ["jemaf", "cdl"]}\n');
		await run('jemaf', ['adf'], adapter('jemaf', { adf: [['1', `${JEMAF}/1`]] }));
		// conducteurdelouange.com then adds the same hymn as JEM 900: no priority for jem.
		await run('cdl', ['jem'], adapter('cdl', { jem: [['900', `${CDL_BASE}/1411`]] }));
		const kept = await hymn('qu-on-batte-des-mains');
		expect(kept.entries).toEqual([
			{ hymnal: 'adf', number: '1' },
			{ hymnal: 'jem', number: '900' }
		]);
		expect(kept.source.name).toBe('JEM — jemaf.fr');
		expect(kept.sections[0].lines[5]).toBe('Trembler à sa voix les plus puissants rois.');
	});

	it('recognises the same hymnal number from another site even when the titles differ', async () => {
		// JEM 17 as given by conducteurdelouange.com and by jemaf.fr (saved pages).
		await cachePage(root, 'jemaf', `${JEMAF}/jem017`, fixturePage('jemaf', 'hymn-jem017.html'));
		await writeFile(join(root, 'import/decisions/source-priority.json'), '{"jem": ["jemaf", "cdl"]}\n');
		await run('cdl', ['jem'], adapter('cdl', { jem: [['17', `${CDL_BASE}/7`]] }));
		const report = await run('jemaf', ['jem'], {
			...jemaf,
			listEntries: async (hymnal) => [{ hymnal, number: '17', url: `${JEMAF}/jem017` }]
		});
		expect(report.perHymnal.jem.conflicts).toEqual([]);
		expect(report.perHymnal.jem.autoMerged.map((m) => m.hymnId)).toEqual(['ah-qu-il-est-doux']);
		// jemaf ranks first: its title, text and credits become the reference.
		const merged = await hymn('ah-qu-il-est-doux');
		expect(merged.title).toBe("Ah ! Qu'il est doux pour des frères");
		expect(merged.credits).toEqual([
			{ name: 'Mélodie hébraïque', role: 'music' },
			{ name: 'Christian Glardon', role: 'lyrics' }
		]);
		expect(merged.alternateSources).toEqual([
			expect.objectContaining({ name: 'Conducteur de louange — conducteurdelouange.com' })
		]);
	});

	it('does not propose a pair again after "distinct"', async () => {
		await run('cdl', ['jem', 'adf', 'cd'], CDL);
		await markDistinct(root, 'qu-on-batte-des-mains', 'qu-on-batte-des-mains-cd-50', '2026-11-12');
		const merges = JSON.parse(await readFile(join(root, 'import/decisions/merges.json'), 'utf8'));
		expect(merges).toEqual([
			{ a: 'qu-on-batte-des-mains', b: 'qu-on-batte-des-mains-cd-50', decision: 'distinct', date: '2026-11-12' }
		]);
		const again = await run('cdl', ['jem', 'adf', 'cd'], CDL);
		expect(again.perHymnal.cd.possibleDuplicates).toEqual([]);
	});

	it('"merge a b" moves b’s entries and links to a, removes b and redirects it', async () => {
		await run('cdl', ['jem', 'adf', 'cd'], CDL);
		await mergeHymns(root, 'qu-on-batte-des-mains', 'qu-on-batte-des-mains-cd-50', '2026-11-12');
		expect(await exists('qu-on-batte-des-mains-cd-50')).toBe(false);
		expect((await hymn('qu-on-batte-des-mains')).entries).toEqual([
			{ hymnal: 'jem', number: '900' },
			{ hymnal: 'adf', number: '1' },
			{ hymnal: 'cd', number: '50' }
		]);
		expect(await redirects()).toEqual({ 'qu-on-batte-des-mains-cd-50': 'qu-on-batte-des-mains' });
		const links = JSON.parse(await readFile(join(root, 'import/state/links.json'), 'utf8'));
		expect(links.find((l: { number: string }) => l.number === '50').hymnId).toBe('qu-on-batte-des-mains');
		expect((await buildData(join(root, 'content'))).errors).toEqual([]);

		// A later run keeps the merge and changes nothing.
		const again = await run('cdl', ['jem', 'adf', 'cd'], CDL);
		expect(again.perHymnal.cd.new).toEqual([]);
		expect(again.perHymnal.cd.unchanged).toHaveLength(1);
	});

	it('rewrites redirects that pointed to a hymn merged later (no chains)', async () => {
		await run('cdl', ['jem', 'adf', 'cd'], CDL);
		await mergeHymns(root, 'qu-on-batte-des-mains-cd-50', 'qu-on-batte-des-mains', '2026-11-12');
		await writeFile(
			join(root, 'content/hymns/autre-chant.json'),
			JSON.stringify({ ...(await hymn('qu-on-batte-des-mains-cd-50')), id: 'autre-chant', entries: [{ hymnal: 'cd', number: '1' }] })
		);
		await mergeHymns(root, 'autre-chant', 'qu-on-batte-des-mains-cd-50', '2026-11-12');
		expect(await redirects()).toEqual({
			'qu-on-batte-des-mains': 'autre-chant',
			'qu-on-batte-des-mains-cd-50': 'autre-chant'
		});
		expect((await buildData(join(root, 'content'))).errors).toEqual([]);
	});
});
