/**
 * A temporary workspace for integration tests, with a page cache seeded from saved fixtures, so
 * a whole `run` works offline. It starts from what was there before any real import: the
 * repository's hymnals plus the sample hymnals and hymns (ce/he, tests/fixtures/sample-content)
 * and the source settings, with no imported hymn, link, redirect or decision. Real imports in
 * the repository never change it.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, fixtureIndex } from './fixtures';

/** The sample hymnals and hymns of feature 001 (task T062). */
const SAMPLE = join('tests', 'fixtures', 'sample-content');

export async function makeWorkspace(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'hymnia-run-'));
	const at = (...parts: string[]) => join(root, ...parts);
	const json = (data: unknown) => JSON.stringify(data, null, '\t') + '\n';

	await mkdir(at('content', 'hymns'), { recursive: true });
	const read = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown[];
	const hymnals = [
		...(await read(join(SAMPLE, 'hymnals.json'))),
		...(await read(join('content', 'hymnals.json')))
	];
	await writeFile(at('content', 'hymnals.json'), json(hymnals));
	await cp(join(SAMPLE, 'hymns'), at('content', 'hymns'), { recursive: true });

	for (const dir of ['decisions', 'state', 'pending', 'reports']) {
		await mkdir(at('import', dir), { recursive: true });
	}
	await cp(join('import', 'sources.json'), at('import', 'sources.json'));
	await writeFile(at('import', 'decisions', 'rights.json'), json([]));
	await writeFile(at('import', 'decisions', 'merges.json'), json([]));
	await writeFile(at('import', 'decisions', 'source-priority.json'), json({}));
	await writeFile(at('import', 'state', 'links.json'), json([]));
	return root;
}

/** Writes a page into the workspace cache as the fetcher would. */
export async function cachePage(
	root: string,
	source: string,
	url: string,
	body: string,
	retrievedAt = '2026-11-11T17:00:00.000Z'
) {
	const dir = join(root, 'import', 'cache', source);
	await mkdir(dir, { recursive: true });
	const key = createHash('sha1').update(url).digest('hex');
	await writeFile(join(dir, `${key}.html`), body);
	const meta = {
		url,
		retrievedAt,
		status: 200,
		etag: null,
		lastModified: null,
		sha256: createHash('sha256').update(body).digest('hex')
	};
	await writeFile(join(dir, `${key}.meta.json`), JSON.stringify(meta, null, '\t') + '\n');
}

/** Seeds the cache with every saved page of a source (tests/import/fixtures/<source>/). */
export async function seedCache(root: string, source: string, only?: string[]) {
	for (const [file, { url, retrievedAt }] of Object.entries(fixtureIndex(source))) {
		if (only && !only.includes(file)) continue;
		const body = await readFile(join(FIXTURES, source, file), 'utf8');
		await cachePage(root, source, url, body, retrievedAt);
	}
}

/** Every file under a folder, with its content: to compare a workspace before and after. */
export async function snapshot(dir: string): Promise<Record<string, string>> {
	const out: Record<string, string> = {};
	async function walk(rel: string) {
		for (const entry of await readdir(join(dir, rel), { withFileTypes: true })) {
			const path = join(rel, entry.name);
			if (entry.isDirectory()) await walk(path);
			else out[path] = await readFile(join(dir, path), 'utf8');
		}
	}
	await walk('');
	return out;
}
