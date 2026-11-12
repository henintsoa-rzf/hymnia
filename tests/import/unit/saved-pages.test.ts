// Pages saved from a browser (specs/004-evangile21-hymnal/contracts/cli-add-pages.md, tasks T003–T004).
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cachePaths, createFetcher } from '../../../scripts/import/fetcher';
import { addSavedPages, pageUrlOf } from '../../../scripts/import/saved-pages';
import { SourceConfigSchema } from '../../../scripts/import/store/state';

const BASE = 'https://example.org';
const source = {
	id: 'demo',
	name: 'Demo — example.org',
	baseUrl: BASE,
	hymnals: ['demo'],
	minDelayMs: 1000,
	terms: { url: null, summary: 'test', checkedAt: '2026-11-12' },
	permission: 'unknown' as const,
	access: 'saved-pages' as const
};

const page = (head: string, body = '<p>Paroles</p>') =>
	`<!DOCTYPE html>\n${head}<html><head><title>Chant</title></head><body>${body}</body></html>`;
const savedFrom = (url: string) => `<!-- saved from url=(${String(url.length).padStart(4, '0')})${url} -->\n`;

async function setup(files: Record<string, string>) {
	const root = await mkdtemp(join(tmpdir(), 'hymnia-saved-'));
	const folder = join(root, 'inbox');
	await mkdir(folder, { recursive: true });
	for (const [name, body] of Object.entries(files)) {
		await mkdir(join(folder, name, '..'), { recursive: true });
		await writeFile(join(folder, name), body);
	}
	return { root, folder, cacheDir: join(root, 'import', 'cache', 'demo') };
}

describe('pageUrlOf', () => {
	it('reads the "saved from url" comment first, then canonical, then og:url, without fragment', () => {
		expect(pageUrlOf(page(savedFrom(`${BASE}/a/#x`)))).toBe(`${BASE}/a/`);
		expect(pageUrlOf(`<html><head><link rel="canonical" href="${BASE}/b/"></head></html>`)).toBe(`${BASE}/b/`);
		expect(pageUrlOf(`<html><head><meta property="og:url" content="${BASE}/c/"></head></html>`)).toBe(
			`${BASE}/c/`
		);
		expect(
			pageUrlOf(
				`${savedFrom(`${BASE}/first/`)}<html><head><link rel="canonical" href="${BASE}/second/"></head></html>`
			)
		).toBe(`${BASE}/first/`);
		expect(pageUrlOf('<html><head></head><body>x</body></html>')).toBeNull();
	});
});

describe('addSavedPages', () => {
	it('adds pages to the cache in the fetcher format, readable offline', async () => {
		const body = page(savedFrom(`${BASE}/song/`));
		const { root, folder, cacheDir } = await setup({ 'song.html': body });
		const mtime = new Date('2026-11-10T08:30:00.000Z');
		await utimes(join(folder, 'song.html'), mtime, mtime);

		const result = await addSavedPages({ root, source, folder });
		expect(result.counts).toEqual({ added: 1, replaced: 0, unchanged: 0, refused: 0 });

		const meta = JSON.parse(await readFile(cachePaths(cacheDir, `${BASE}/song/`).meta, 'utf8'));
		expect(meta).toEqual({
			url: `${BASE}/song/`,
			retrievedAt: '2026-11-10T08:30:00.000Z',
			status: 200,
			etag: null,
			lastModified: null,
			sha256: createHash('sha256').update(body).digest('hex')
		});
		const fetcher = createFetcher({ source, cacheDir, offline: true });
		expect(await fetcher.fetch(`${BASE}/song/`)).toBe(body);
	});

	it('refuses files with no url, another host, a challenge page or an empty body', async () => {
		const { root, folder } = await setup({
			'none.html': '<html><body>rien</body></html>',
			'other.html': page(savedFrom('https://elsewhere.org/x/')),
			'challenge.html': `${savedFrom(`${BASE}/x/`)}<html><head><title>Just a moment...</title></head></html>`,
			'empty.html': '   \n'
		});
		const result = await addSavedPages({ root, source, folder });
		expect(result.counts).toEqual({ added: 0, replaced: 0, unchanged: 0, refused: 4 });
		const reasons = Object.fromEntries(result.files.map((f) => [f.file, f.reason]));
		expect(reasons).toEqual({
			'challenge.html': 'challenge page',
			'empty.html': 'empty',
			'none.html': 'no url',
			'other.html': 'other host'
		});
	});

	it('leaves an identical page unchanged and replaces a different one', async () => {
		const { root, folder, cacheDir } = await setup({ 'song.html': page(savedFrom(`${BASE}/song/`)) });
		await addSavedPages({ root, source, folder });
		const metaPath = cachePaths(cacheDir, `${BASE}/song/`).meta;
		const before = (await stat(metaPath)).mtimeMs;

		const again = await addSavedPages({ root, source, folder });
		expect(again.counts).toEqual({ added: 0, replaced: 0, unchanged: 1, refused: 0 });
		expect((await stat(metaPath)).mtimeMs).toBe(before);

		await writeFile(join(folder, 'song.html'), page(savedFrom(`${BASE}/song/`), '<p>Autre</p>'));
		const changed = await addSavedPages({ root, source, folder });
		expect(changed.counts).toEqual({ added: 0, replaced: 1, unchanged: 0, refused: 0 });
	});

	it('ignores sub-folders and other files, and writes nothing with dryRun', async () => {
		const { root, folder, cacheDir } = await setup({
			'song.htm': page(savedFrom(`${BASE}/song/`)),
			'song_files/inner.html': page(savedFrom(`${BASE}/inner/`)),
			'notes.txt': 'x'
		});
		const result = await addSavedPages({ root, source, folder, dryRun: true });
		expect(result.files.map((f) => f.file)).toEqual(['song.htm']);
		expect(result.counts.added).toBe(1);
		await expect(stat(cacheDir)).rejects.toThrow();
	});
});

describe('SourceConfigSchema.access', () => {
	it('accepts "saved-pages", "fetch" or nothing, and nothing else', () => {
		expect(SourceConfigSchema.safeParse(source).success).toBe(true);
		expect(SourceConfigSchema.safeParse({ ...source, access: 'fetch' }).success).toBe(true);
		const without: Record<string, unknown> = { ...source };
		delete without.access;
		expect(SourceConfigSchema.safeParse(without).success).toBe(true);
		expect(SourceConfigSchema.safeParse({ ...source, access: 'browser' }).success).toBe(false);
	});
});
