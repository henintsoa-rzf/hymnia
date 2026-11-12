// Recording rights and publishing (US4, task T057). Offline.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildData } from '../../../scripts/build-data';
import { main, type Io } from '../../../scripts/import/cli';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { runImport } from '../../../scripts/import/pipeline/run';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import type { SourceAdapter } from '../../../scripts/import/sources/types';
import { makeWorkspace, seedCache, snapshot } from '../helpers/workspace';

const NOW = new Date('2026-11-12T08:30:00.000Z');
let listing: Record<string, [string, string][]>;
const adapter: SourceAdapter = {
	id: 'cdl',
	listEntries: async (hymnal) =>
		(listing[hymnal] ?? []).map(([number, id]) => ({ hymnal, number, url: `${CDL_BASE}/${id}` })),
	parseHymn: cdl.parseHymn
};
const run = () =>
	runImport({
		root,
		source: 'cdl',
		hymnals: ['jem', 'adf'],
		offline: true,
		yes: true,
		now: () => NOW,
		adapter,
		hooks: importHooks
	});

const io = (): Io & { out: (t: string) => void; lines: string[] } => {
	const lines: string[] = [];
	return { lines, out: (t) => lines.push(t), err: (t) => lines.push(t) };
};
const hymn = async (id: string) =>
	JSON.parse(await readFile(join(root, 'content', 'hymns', `${id}.json`), 'utf8'));

let root: string;
beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'cdl');
	listing = {
		jem: [
			['1', '130'],
			['3', '201']
		],
		adf: [['3', '1413']]
	};
	await run();
});

describe('rights (US4)', () => {
	it('"rights set" on a hymnal changes only the rights field of that hymnal’s hymns', async () => {
		const before = await snapshot(join(root, 'content'));
		const out = io();
		const code = await main(
			['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'permission', '--date', '2026-11-12', '--note', 'Accord écrit'],
			out,
			root
		);
		expect(code).toBe(0);
		const after = await snapshot(join(root, 'content'));
		const changed = Object.keys(after).filter((f) => after[f] !== before[f]);
		expect(changed.sort()).toEqual(['hymns/j-aime-l-eternel.json', 'hymns/l-eternel-est-mon-berger.json']);
		for (const file of changed) {
			const old = JSON.parse(before[file]);
			expect(JSON.parse(after[file])).toEqual({ ...old, rights: 'confirmed' });
		}
		const decisions = JSON.parse(await readFile(join(root, 'import/decisions/rights.json'), 'utf8'));
		expect(decisions).toEqual([
			{ scope: 'hymnal', target: 'jem', basis: 'permission', date: '2026-11-12', note: 'Accord écrit' }
		]);
	});

	it('publishes exactly the covered hymns (SC-006)', async () => {
		await main(['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'permission', '--note', ''], io(), root);
		const { catalog, errors } = await buildData(join(root, 'content'));
		expect(errors).toEqual([]);
		const ids = catalog!.hymns.map((h) => h.id);
		expect(ids).toContain('j-aime-l-eternel');
		expect(ids).toContain('l-eternel-est-mon-berger');
		expect(ids).not.toContain('rendez-a-dieu-l-honneur-supreme');
	});

	it('a hymn added later to a covered hymnal inherits the decision, and the report says so', async () => {
		await main(['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'permission', '--note', ''], io(), root);
		listing.jem.push(['17', '7']);
		const report = await run();
		expect((await hymn('ah-qu-il-est-doux')).rights).toBe('confirmed');
		expect(report.perHymnal.jem.rightsInherited.map((r) => r.hymnId)).toEqual(['ah-qu-il-est-doux']);
		expect(report.rights?.jem).toEqual({ published: 3, unpublished: 0 });
	});

	it('publishes a single public-domain hymn of an uncovered hymnal', async () => {
		await main(['rights', 'set', '--scope', 'hymn', '--target', 'rendez-a-dieu-l-honneur-supreme', '--basis', 'public-domain', '--note', 'Marot, XVIe s.'], io(), root);
		expect((await hymn('rendez-a-dieu-l-honneur-supreme')).rights).toBe('public-domain');
		expect((await hymn('j-aime-l-eternel')).rights).toBe('unconfirmed');
	});

	it('"refused" unpublishes again', async () => {
		await main(['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'permission', '--note', ''], io(), root);
		await main(['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'refused', '--note', 'Retiré'], io(), root);
		expect((await hymn('j-aime-l-eternel')).rights).toBe('unconfirmed');
		const decisions = JSON.parse(await readFile(join(root, 'import/decisions/rights.json'), 'utf8'));
		expect(decisions).toHaveLength(1);
	});

	it('exits with 1 for a target that does not exist, and 2 for a bad scope', async () => {
		expect(await main(['rights', 'set', '--scope', 'hymnal', '--target', 'zzz', '--basis', 'permission', '--note', ''], io(), root)).toBe(1);
		expect(await main(['rights', 'set', '--scope', 'recueil', '--target', 'jem', '--basis', 'permission', '--note', ''], io(), root)).toBe(2);
		expect(await main(['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'permission'], io(), root)).toBe(2);
	});

	it('"rights list" shows each decision and how many hymns it covers', async () => {
		await main(['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'permission', '--note', ''], io(), root);
		const out = io();
		expect(await main(['rights', 'list'], out, root)).toBe(0);
		expect(out.lines.join('\n')).toMatch(/hymnal jem.*permission.*2 hymns/);
	});

	it('a manual merge recomputes the rights from the decisions', async () => {
		await main(['rights', 'set', '--scope', 'hymnal', '--target', 'adf', '--basis', 'refused', '--note', ''], io(), root);
		await main(['rights', 'set', '--scope', 'hymnal', '--target', 'jem', '--basis', 'licence', '--note', ''], io(), root);
		expect((await hymn('rendez-a-dieu-l-honneur-supreme')).rights).toBe('unconfirmed');
		const out = io();
		expect(await main(['merge', 'j-aime-l-eternel', 'rendez-a-dieu-l-honneur-supreme'], out, root)).toBe(0);
		// In JEM (licence) and AdF (refused): covered by either hymnal.
		expect((await hymn('j-aime-l-eternel')).rights).toBe('confirmed');
	});

	it('leaves the sample hymns as they are', async () => {
		const samples = (await readdir(join(root, 'content/hymns'))).filter((f) => f.startsWith('a-toi'));
		const before = await snapshot(join(root, 'content/hymns'));
		await main(['rights', 'set', '--scope', 'source', '--target', 'cdl', '--basis', 'refused', '--note', ''], io(), root);
		const after = await snapshot(join(root, 'content/hymns'));
		for (const f of samples) expect(after[f]).toBe(before[f]);
	});
});
