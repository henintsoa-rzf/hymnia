// One broken source never affects another (FR-025, US5, task T063). Offline.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { main, type Io } from '../../../scripts/import/cli';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { runImport } from '../../../scripts/import/pipeline/run';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import type { SourceAdapter } from '../../../scripts/import/sources/types';
import { fixturePage } from '../helpers/fixtures';
import { cachePage, makeWorkspace, seedCache } from '../helpers/workspace';

const NOW = new Date('2026-11-12T08:30:00.000Z');
let root: string;
beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'cdl');
	await cachePage(root, 'jemaf', `${CDL_BASE}/1413`, fixturePage('cdl', 'hymn-1413.html'));
});

const healthy: SourceAdapter = {
	id: 'cdl',
	listEntries: async (hymnal) => [{ hymnal, number: '1', url: `${CDL_BASE}/1411` }],
	parseHymn: cdl.parseHymn
};
const broken: SourceAdapter = {
	id: 'jemaf',
	listEntries: async (hymnal) => [{ hymnal, number: '1', url: `${CDL_BASE}/1413` }],
	parseHymn: () => {
		throw new Error('layout changed');
	}
};
const run = (source: string, adapter: SourceAdapter) =>
	runImport({ root, source, hymnals: ['adf'], offline: true, yes: true, now: () => NOW, adapter, hooks: importHooks });

describe('isolation (US5)', () => {
	it('a broken source is aborted and the healthy one is imported', async () => {
		const bad = await run('jemaf', broken);
		expect(bad.perSource.jemaf.status).toBe('aborted');
		expect(bad.perSource.jemaf.reasons).toEqual({ 'layout changed': 1 });
		const good = await run('cdl', healthy);
		expect(good.perSource.cdl.status).toBe('ok');
		expect(await readdir(join(root, 'content/hymns'))).toContain('qu-on-batte-des-mains.json');
	});

	it('exits with 2 for an unknown --source', async () => {
		const lines: string[] = [];
		const io: Io = { out: (t) => lines.push(t), err: (t) => lines.push(t) };
		expect(await main(['run', '--source', 'nope', '--offline'], io, root)).toBe(2);
		expect(lines.join('\n')).toMatch(/Unknown source "nope"/);
	});
});
