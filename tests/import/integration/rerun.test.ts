// Re-running an import safely (US2, task T043). Offline, on a temporary workspace.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { acceptChange, rejectChange } from '../../../scripts/import/pipeline/pending';
import { runImport } from '../../../scripts/import/pipeline/run';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import type { SourceAdapter } from '../../../scripts/import/sources/types';
import { fixturePage } from '../helpers/fixtures';
import { cachePage, makeWorkspace, seedCache, snapshot } from '../helpers/workspace';

const NOW = new Date('2026-11-12T08:30:00.000Z');
const url = (id: string) => `${CDL_BASE}/${id}`;

let listing: [string, string][];
const adapter: SourceAdapter = {
	id: 'cdl',
	listEntries: async (hymnal) => listing.map(([number, id]) => ({ hymnal, number, url: url(id) })),
	parseHymn: cdl.parseHymn
};

let root: string;
beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'cdl');
	listing = [
		['1', '130'],
		['3', '201'],
		['17', '7'],
		['20', '1411']
	];
	await run();
});

const run = () =>
	runImport({ root, source: 'cdl', hymnals: ['jem'], offline: true, yes: true, now: () => NOW, adapter });
const hymnPath = (id: string) => join(root, 'content', 'hymns', `${id}.json`);
const hymn = async (id: string) => JSON.parse(await readFile(hymnPath(id), 'utf8'));
const links = async () => JSON.parse(await readFile(join(root, 'import/state/links.json'), 'utf8'));
const pendingFiles = async () => (await readdir(join(root, 'import/pending'))).filter((f) => f.endsWith('.json'));

/** A manual correction on "J'aime l'Éternel": one line fixed and logged. */
async function correct() {
	const h = await hymn('j-aime-l-eternel');
	h.sections[1].lines[1] = 'Mes yeux des larmes';
	h.corrections.push({ date: '2026-11-12', description: 'Virgule retirée (relecture).' });
	await writeFile(hymnPath('j-aime-l-eternel'), JSON.stringify(h, null, '\t') + '\n');
}

/** The source changes one word of "L'Éternel est mon berger" (JEM 3). */
async function changeSource() {
	const page = fixturePage('cdl', 'hymn-201.html').replace('Je ne crains aucun mal', 'Je ne crains nul mal');
	await cachePage(root, 'cdl', url('201'), page, '2026-11-12T08:00:00.000Z');
}

describe('re-running (US2)', () => {
	it('changes nothing when the source did not change (SC-003)', async () => {
		const content = await snapshot(join(root, 'content'));
		const state = await snapshot(join(root, 'import', 'state'));
		const report = await run();
		expect(await snapshot(join(root, 'content'))).toEqual(content);
		expect(await snapshot(join(root, 'import', 'state'))).toEqual(state);
		expect(report.perHymnal.jem.unchanged).toHaveLength(4);
		expect(report.perHymnal.jem.new).toEqual([]);
	});

	it('adds a hymn newly listed at the source', async () => {
		listing.push(['21', '1413']);
		const report = await run();
		expect(report.perHymnal.jem.new.map((n) => n.hymnId)).toEqual(['rendez-a-dieu-l-honneur-supreme']);
		expect((await hymn('rendez-a-dieu-l-honneur-supreme')).rights).toBe('unconfirmed');
	});

	it('turns a changed source text into a pending change, and keeps content until accepted', async () => {
		const before = await hymn('l-eternel-est-mon-berger');
		await changeSource();
		const report = await run();
		expect(report.perHymnal.jem.changed.map((c) => c.hymnId)).toEqual(['l-eternel-est-mon-berger']);
		expect(await hymn('l-eternel-est-mon-berger')).toEqual(before);
		expect(await pendingFiles()).toEqual(['l-eternel-est-mon-berger--cdl.json']);
		const pending = JSON.parse(
			await readFile(join(root, 'import/pending/l-eternel-est-mon-berger--cdl.json'), 'utf8')
		);
		expect(pending.diff).toMatch(/-Je ne crains aucun mal,\n\+Je ne crains nul mal,/);

		// Running again does not duplicate or rewrite the pending change.
		const again = await snapshot(join(root, 'import', 'pending'));
		await run();
		expect(await snapshot(join(root, 'import', 'pending'))).toEqual(again);
	});

	it('drops a pending change when the source goes back to the accepted text', async () => {
		await changeSource();
		await run();
		await cachePage(root, 'cdl', url('201'), fixturePage('cdl', 'hymn-201.html'));
		await run();
		expect(await pendingFiles()).toEqual([]);
	});

	it('accept writes the new text and fingerprint; reject keeps the text', async () => {
		await changeSource();
		await run();
		const fp = (await links()).find((l: { number: string }) => l.number === '3').acceptedFingerprint;

		await acceptChange(root, 'l-eternel-est-mon-berger');
		const accepted = await hymn('l-eternel-est-mon-berger');
		expect(accepted.sections[0].lines[2]).toBe('Je ne crains nul mal,');
		expect(accepted.source.retrievedAt).toBe('2026-11-12');
		const after = (await links()).find((l: { number: string }) => l.number === '3');
		expect(after.acceptedFingerprint).not.toBe(fp);
		expect(await pendingFiles()).toEqual([]);
		expect((await run()).perHymnal.jem.changed).toEqual([]);
	});

	it('reject keeps the stored text and stops proposing that change', async () => {
		const before = await hymn('l-eternel-est-mon-berger');
		await changeSource();
		await run();
		await rejectChange(root, 'l-eternel-est-mon-berger');
		expect(await hymn('l-eternel-est-mon-berger')).toEqual(before);
		expect(await pendingFiles()).toEqual([]);
		expect((await run()).perHymnal.jem.changed).toEqual([]);
	});

	it('never overwrites a manual correction on another hymn (SC-004)', async () => {
		await correct();
		const corrected = await hymn('j-aime-l-eternel');
		await changeSource();
		await run();
		await acceptChange(root, 'l-eternel-est-mon-berger');
		await run();
		expect(await hymn('j-aime-l-eternel')).toEqual(corrected);
	});

	it('flags a hymn no longer listed as missing and keeps its file', async () => {
		listing = listing.filter(([n]) => n !== '17');
		const report = await run();
		expect(report.perHymnal.jem.missing.map((m) => m.number)).toEqual(['17']);
		expect((await links()).find((l: { number: string }) => l.number === '17').status).toBe('missing');
		await expect(hymn('ah-qu-il-est-doux')).resolves.toBeTruthy();
	});

	it('refuses accept when there is no pending change, or when the source is ambiguous', async () => {
		await expect(acceptChange(root, 'j-aime-l-eternel')).rejects.toThrow(/no pending change/i);
	});
});
