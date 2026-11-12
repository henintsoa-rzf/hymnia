// A source fed only by pages saved from a browser (specs/004-evangile21-hymnal, research R3,
// task T011). No request may be sent, with or without --offline.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { runImport } from '../../../scripts/import/pipeline/run';
import { addSavedPages } from '../../../scripts/import/saved-pages';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import type { SourceAdapter } from '../../../scripts/import/sources/types';
import { fixturePage } from '../helpers/fixtures';
import { makeWorkspace, snapshot } from '../helpers/workspace';

const NOW = new Date('2026-11-12T08:30:00.000Z');
const SAVED = ['130', '7', '201', '1411', '1413'];
const noNetwork = (() => {
	throw new Error('network used');
}) as unknown as typeof fetch;

let root: string;
beforeEach(async () => {
	root = await makeWorkspace();
	// cdl becomes a saved-pages source for this test.
	const path = join(root, 'import', 'sources.json');
	const sources = JSON.parse(await readFile(path, 'utf8')) as { id: string; access?: string }[];
	for (const s of sources) if (s.id === 'cdl') s.access = 'saved-pages';
	await writeFile(path, JSON.stringify(sources, null, '\t') + '\n');

	const inbox = join(root, 'inbox');
	await mkdir(inbox);
	for (const n of SAVED) {
		const url = `${CDL_BASE}/${n}`;
		const marker = `<!-- saved from url=(${String(url.length).padStart(4, '0')})${url} -->\n`;
		await writeFile(join(inbox, `${n}.html`), marker + fixturePage('cdl', `hymn-${n}.html`));
	}
	await addSavedPages({ root, source: { id: 'cdl', baseUrl: CDL_BASE }, folder: inbox });
});

const adapterFor = (numbers: string[]): SourceAdapter => ({
	id: 'cdl',
	listEntries: async (hymnal) =>
		numbers.map((n, i) => ({ hymnal, number: String(i + 1), url: `${CDL_BASE}/${n}` })),
	parseHymn: cdl.parseHymn
});

const run = (numbers: string[], logs: string[] = []) =>
	runImport({
		root,
		source: 'cdl',
		hymnals: ['adf'],
		yes: true,
		now: () => NOW,
		fetchImpl: noNetwork,
		adapter: adapterFor(numbers),
		hooks: importHooks,
		log: (m) => logs.push(m)
	});

describe('saved-pages source', () => {
	it('imports from saved pages without --offline and sends no request', async () => {
		const logs: string[] = [];
		const report = await run(SAVED, logs);
		expect(report.perSource.cdl.status).toBe('ok');
		expect(report.perSource.cdl.failures).toBe(0);
		expect(report.perHymnal.adf.new.length).toBeGreaterThan(0);
		expect(logs.join('\n')).toMatch(/source cdl: saved pages only, no request is sent/);
	});

	it('reports a page that was not saved', async () => {
		const report = await run([...SAVED, '9999']);
		expect(report.perSource.cdl.status).toBe('ok');
		expect(report.perSource.cdl.reasons).toEqual({ 'page not saved': 1 });
		expect(JSON.stringify(report.perHymnal.adf.skipped)).toContain(`${CDL_BASE}/9999`);
	});

	it('writes nothing when more than 20% of the pages are missing', async () => {
		const before = await snapshot(join(root, 'content'));
		const report = await run([...SAVED, '9997', '9998']);
		expect(report.perSource.cdl.status).toBe('aborted');
		expect(await snapshot(join(root, 'content'))).toEqual(before);
	});

	it('a second run changes no file', async () => {
		await run(SAVED);
		const content = await snapshot(join(root, 'content'));
		const state = await snapshot(join(root, 'import', 'state'));
		await run(SAVED);
		expect(await snapshot(join(root, 'content'))).toEqual(content);
		expect(await snapshot(join(root, 'import', 'state'))).toEqual(state);
	});
});
