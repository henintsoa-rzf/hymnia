// `check` with no network (contracts/cli.md, FR-003, FR-004, task T073).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { checkImport } from '../../../scripts/import/check';
import { main, type Io } from '../../../scripts/import/cli';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { runImport } from '../../../scripts/import/pipeline/run';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import type { SourceAdapter } from '../../../scripts/import/sources/types';
import { makeWorkspace, seedCache } from '../helpers/workspace';

const adapter: SourceAdapter = {
	id: 'cdl',
	listEntries: async (hymnal) => [
		{ hymnal, number: '1', url: `${CDL_BASE}/130` },
		{ hymnal, number: '3', url: `${CDL_BASE}/201` }
	],
	parseHymn: cdl.parseHymn
};

let root: string;
beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'cdl');
	await runImport({
		root,
		source: 'cdl',
		hymnals: ['jem'],
		offline: true,
		yes: true,
		now: () => new Date('2026-11-12T08:30:00Z'),
		adapter,
		hooks: importHooks
	});
});

const path = (id: string) => join(root, 'content', 'hymns', `${id}.json`);
async function edit(id: string, change: (h: Record<string, unknown> & { sections: { lines: string[] }[]; corrections: unknown[] }) => void) {
	const hymn = JSON.parse(await readFile(path(id), 'utf8'));
	change(hymn);
	await writeFile(path(id), JSON.stringify(hymn, null, '\t') + '\n');
}

describe('check', () => {
	it('passes on a fresh import and compares every imported text with its page', async () => {
		const result = await checkImport(root);
		expect(result.errors).toEqual([]);
		expect(result.checkedTexts).toBe(2);
	});

	it('reports a text changed by hand without a correction (FR-004)', async () => {
		await edit('j-aime-l-eternel', (h) => (h.sections[0].lines[0] = 'J’aime l’Éternel'));
		expect((await checkImport(root)).errors.join('\n')).toMatch(/j-aime-l-eternel.*FR-004/);
	});

	it('accepts the same change when a correction explains it', async () => {
		await edit('j-aime-l-eternel', (h) => {
			h.sections[0].lines[0] = 'J’aime l’Éternel';
			h.corrections.push({ date: '2026-11-12', description: 'Apostrophes typographiques.' });
		});
		expect((await checkImport(root)).errors).toEqual([]);
	});

	it('reports invalid content and a merge decision without its redirect', async () => {
		await edit('j-aime-l-eternel', (h) => (h.rights = 'maybe'));
		await writeFile(
			join(root, 'import/decisions/merges.json'),
			JSON.stringify([{ a: 'j-aime-l-eternel', b: 'l-eternel-est-mon-berger', decision: 'merge', date: '2026-11-12' }])
		);
		const errors = (await checkImport(root)).errors.join('\n');
		expect(errors).toMatch(/rights/);
		expect(errors).toMatch(/no redirect/);
	});

	it('exits with 0 when everything is valid, 1 otherwise', async () => {
		const lines: string[] = [];
		const io: Io = { out: (t) => lines.push(t), err: (t) => lines.push(t) };
		expect(await main(['check'], io, root)).toBe(0);
		await edit('j-aime-l-eternel', (h) => (h.sections[0].lines[0] = 'autre'));
		expect(await main(['check'], io, root)).toBe(1);
	});
});
