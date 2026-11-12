// A whole `run` for one hymnal, offline on saved pages (US1, task T035).
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildData } from '../../../scripts/build-data';
import { runImport } from '../../../scripts/import/pipeline/run';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import type { EntryRef, SourceAdapter } from '../../../scripts/import/sources/types';
import { HymnSchema } from '../../../src/lib/domain/schema';
import { makeWorkspace, seedCache, snapshot } from '../helpers/workspace';

const NOW = new Date('2026-11-12T08:30:00.000Z');
const url = (id: string) => `${CDL_BASE}/${id}`;

/** cdl's parser, with a fixed listing (listing pages are tested in adapters/cdl.test.ts). */
function adapterWith(refs: [number: string, page: string][]): SourceAdapter {
	return {
		id: 'cdl',
		listEntries: async (hymnal) =>
			refs.map(([number, page]): EntryRef => ({ hymnal, number, url: url(page) })),
		parseHymn: cdl.parseHymn
	};
}

// 5 parsable pages and 1 that is not a hymn: 1 failure in 6 (≤ 20 %).
const LISTING: [string, string][] = [
	['1', '130'],
	['3', '201'],
	['17', '7'],
	['901', '1411'],
	['903', '1413'],
	['2', 'termes-et-conditions']
];

let root: string;
beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'cdl');
});

const run = (over: Partial<Parameters<typeof runImport>[0]> = {}) =>
	runImport({
		root,
		source: 'cdl',
		hymnals: ['jem'],
		offline: true,
		yes: true,
		now: () => NOW,
		adapter: adapterWith(LISTING),
		...over
	});

const hymnFile = async (id: string) =>
	JSON.parse(await readFile(join(root, 'content', 'hymns', `${id}.json`), 'utf8'));

describe('run (US1)', () => {
	it('writes one valid hymn file per parsed page, unpublished, with its source', async () => {
		const report = await run();
		expect(report.perSource.cdl.status).toBe('ok');
		expect(report.perHymnal.jem.new.map((n) => n.number)).toEqual(['1', '3', '17', '901', '903']);

		const hymn = await hymnFile('j-aime-l-eternel');
		expect(HymnSchema.parse(hymn)).toEqual(hymn);
		expect(hymn).toEqual({
			id: 'j-aime-l-eternel',
			title: "J'aime l'Éternel",
			entries: [{ hymnal: 'jem', number: '1' }],
			sections: expect.any(Array),
			credits: [{ name: 'KATRINA EVERS', role: 'unspecified' }],
			source: {
				name: 'Conducteur de louange — conducteurdelouange.com',
				url: url('130'),
				retrievedAt: '2026-11-11'
			},
			rights: 'unconfirmed',
			corrections: []
		});
		expect(hymn.sections).toHaveLength(3);
	});

	it('writes a link for each new hymn', async () => {
		await run();
		const links = JSON.parse(await readFile(join(root, 'import/state/links.json'), 'utf8'));
		expect(links).toHaveLength(5);
		expect(links[0]).toMatchObject({
			source: 'cdl',
			hymnal: 'jem',
			number: '1',
			hymnId: 'j-aime-l-eternel',
			url: url('130'),
			status: 'active',
			lastSeenAt: '2026-11-12'
		});
		expect(links[0].acceptedFingerprint).toMatch(/^sha256:/);
	});

	it('lists the page that cannot be parsed under skipped, with its reason and URL', async () => {
		const report = await run();
		expect(report.perHymnal.jem.skipped).toEqual([
			{ number: '2', url: url('termes-et-conditions'), reason: 'no lyrics block' }
		]);
	});

	it('keeps the content buildable, and nothing new is published (rights not confirmed)', async () => {
		const before = await buildData(join(root, 'content'));
		await run();
		const after = await buildData(join(root, 'content'));
		expect(after.errors).toEqual([]);
		expect(after.report.hymns).toBe(before.report.hymns);
		expect(after.report.excluded).toBe(before.report.excluded + 5);
	});

	it('writes the report as JSON and Markdown, and nothing else with --dry-run', async () => {
		const before = await snapshot(join(root, 'content'));
		const stateBefore = await snapshot(join(root, 'import', 'state'));
		const report = await run({ dryRun: true });
		expect(await snapshot(join(root, 'content'))).toEqual(before);
		expect(await snapshot(join(root, 'import', 'state'))).toEqual(stateBefore);
		const reports = await readdir(join(root, 'import', 'reports'));
		expect(reports).toContain(`${report.runId}.json`);
		expect(reports).toContain(`${report.runId}.md`);
		expect(report.runId).toBe('20261112-083000');
		expect(report.perHymnal.jem.new).toHaveLength(5);
	});

	it('writes nothing for a source when more than 20 % of its pages fail', async () => {
		const before = await snapshot(join(root, 'content'));
		const report = await run({
			adapter: adapterWith([
				['1', '130'],
				['2', 'termes-et-conditions'],
				['3', 'absent-du-cache']
			])
		});
		expect(report.perSource.cdl.status).toBe('aborted');
		expect(report.perSource.cdl.reasons).toEqual({ 'no lyrics block': 1, 'not in cache': 1 });
		expect(await snapshot(join(root, 'content'))).toEqual(before);
		const reports = await readdir(join(root, 'import', 'reports'));
		expect(reports).toContain(`${report.runId}.json`);
	});

	it('makes no request when the source refused permission', async () => {
		await setPermission('refused');
		const report = await run({ offline: false, contact: 'x@example.org', fetchImpl: failFetch });
		expect(report.perSource.cdl.status).toBe('skipped-permission');
		expect(fetchCalls).toBe(0);
	});

	it('stops after a warning when permission is unknown and --yes is not given', async () => {
		await setPermission('unknown');
		const warnings: string[] = [];
		const report = await run({ yes: false, log: (m) => warnings.push(m) });
		expect(report.perSource.cdl.status).toBe('skipped-permission');
		expect(warnings.join('\n')).toMatch(/permission/i);
		expect(report.perHymnal.jem?.new ?? []).toEqual([]);
	});

	it('refuses a hymnal the source does not cover', async () => {
		await expect(run({ hymnals: ['psalmodie'] })).rejects.toThrow(/psalmodie/);
	});
});

let fetchCalls = 0;
const failFetch = (async () => {
	fetchCalls++;
	throw new Error('no network in tests');
}) as typeof fetch;
beforeEach(() => {
	fetchCalls = 0;
});

async function setPermission(permission: string) {
	const path = join(root, 'import', 'sources.json');
	const sources = JSON.parse(await readFile(path, 'utf8'));
	for (const s of sources) if (s.id === 'cdl') s.permission = permission;
	const { writeFile } = await import('node:fs/promises');
	await writeFile(path, JSON.stringify(sources, null, '\t') + '\n');
}
