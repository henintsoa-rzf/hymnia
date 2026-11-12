// Import records (data-model.md, contracts/import-files.md, tasks T010/T017).
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	emptyState,
	LinkSchema,
	loadState,
	MergeDecisionSchema,
	saveState,
	SourceConfigSchema,
	validateState,
	type ImportState,
	type Link,
	type RightsDecision,
	type SourceConfig
} from '../../../scripts/import/store/state';

const source: SourceConfig = {
	id: 'cdl',
	name: 'Conducteur de louange — conducteurdelouange.com',
	baseUrl: 'https://www.conducteurdelouange.com',
	hymnals: ['jem'],
	minDelayMs: 1000,
	terms: { url: null, summary: 'À vérifier', checkedAt: '2026-11-11' },
	permission: 'unknown'
};

const link = (over: Partial<Link> = {}): Link => ({
	source: 'cdl',
	hymnal: 'jem',
	number: '1',
	hymnId: 'a',
	url: 'https://www.conducteurdelouange.com/1',
	acceptedFingerprint: 'sha256:' + '0'.repeat(64),
	status: 'active',
	lastSeenAt: '2026-11-11',
	...over
});

const rights = (over: Partial<RightsDecision> = {}): RightsDecision => ({
	scope: 'hymnal',
	target: 'jem',
	basis: 'permission',
	date: '2026-11-11',
	note: '',
	...over
});

const ctx = { hymnalIds: new Set(['jem', 'atg']), hymnIds: new Set(['a', 'b']) };
const state = (over: Partial<ImportState> = {}): ImportState => ({
	...emptyState(),
	sources: [source],
	...over
});

describe('schemas', () => {
	it('accepts a valid source and rejects bad delays or permissions', () => {
		expect(SourceConfigSchema.safeParse(source).success).toBe(true);
		expect(SourceConfigSchema.safeParse({ ...source, minDelayMs: 999 }).success).toBe(false);
		expect(SourceConfigSchema.safeParse({ ...source, permission: 'maybe' }).success).toBe(false);
		expect(SourceConfigSchema.safeParse({ ...source, extra: 1 }).success).toBe(false);
	});

	it('rejects a link status outside active, missing', () => {
		expect(LinkSchema.safeParse(link()).success).toBe(true);
		expect(LinkSchema.safeParse({ ...link(), status: 'gone' }).success).toBe(false);
	});

	it('stores merge pairs with a < b', () => {
		const merge = { a: 'a', b: 'b', decision: 'merge', date: '2026-11-11' };
		expect(MergeDecisionSchema.safeParse(merge).success).toBe(true);
		expect(MergeDecisionSchema.safeParse({ ...merge, a: 'b', b: 'a' }).success).toBe(false);
		expect(MergeDecisionSchema.safeParse({ ...merge, b: 'a' }).success).toBe(false);
	});
});

describe('validateState', () => {
	it('accepts a consistent state', () => {
		expect(validateState(state({ links: [link()], rights: [rights()] }), ctx)).toEqual([]);
	});

	it('rejects a source hymnal missing from content/hymnals.json', () => {
		const errors = validateState(state({ sources: [{ ...source, hymnals: ['zzz'] }] }), ctx);
		expect(errors.join()).toMatch(/zzz/);
	});

	it('rejects a rights decision whose target does not exist', () => {
		for (const decision of [
			rights({ scope: 'hymnal', target: 'zzz' }),
			rights({ scope: 'source', target: 'nope' }),
			rights({ scope: 'hymn', target: 'missing-hymn' })
		]) {
			expect(validateState(state({ rights: [decision] }), ctx)).not.toEqual([]);
		}
	});

	it('rejects two rights decisions for the same scope and target', () => {
		const errors = validateState(state({ rights: [rights(), rights({ note: 'again' })] }), ctx);
		expect(errors.join()).toMatch(/only one decision/i);
	});

	it('reports two links to the same hymnal and number with different hymns as a conflict', () => {
		const errors = validateState(
			state({ links: [link(), link({ source: 'jemaf', hymnId: 'b' })] }),
			{ ...ctx }
		);
		expect(errors.join()).toMatch(/conflict/i);
	});

	it('rejects two links with the same source, hymnal and number', () => {
		const errors = validateState(state({ links: [link(), link()] }), ctx);
		expect(errors.join()).toMatch(/unique/i);
	});

	it('rejects a link to a hymn that does not exist', () => {
		expect(validateState(state({ links: [link({ hymnId: 'ghost' })] }), ctx)).not.toEqual([]);
	});
});

describe('loadState and saveState', () => {
	it('reads missing files as empty and writes them back in the stable format', async () => {
		const root = await mkdtemp(join(tmpdir(), 'hymnia-state-'));
		await mkdir(join(root, 'import'), { recursive: true });
		await writeFile(join(root, 'import', 'sources.json'), JSON.stringify([source]));
		const loaded = await loadState(root);
		expect(loaded).toEqual(state());
		await saveState(root, { ...loaded, links: [link()] });
		const text = await readFile(join(root, 'import', 'state', 'links.json'), 'utf8');
		expect(text.startsWith('[\n\t{\n\t\t"source": "cdl"')).toBe(true);
		expect((await loadState(root)).links).toEqual([link()]);
	});

	it('names the file and field of an invalid record', async () => {
		const root = await mkdtemp(join(tmpdir(), 'hymnia-state-'));
		await mkdir(join(root, 'import'), { recursive: true });
		await writeFile(join(root, 'import', 'sources.json'), JSON.stringify([{ ...source, minDelayMs: 1 }]));
		await expect(loadState(root)).rejects.toThrow(/sources\.json.*minDelayMs/);
	});
});
