// Stable, atomic JSON writing (specs/002-hymnal-import/research.md R6, tasks T008/T014).
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { readJson, removeFile, writeJsonStable } from '../../../scripts/import/store/files';

let dir: string;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'hymnia-files-'));
});

describe('writeJsonStable', () => {
	it('uses tabs, keeps key order and ends with a newline, like content/', async () => {
		const path = join(dir, 'a.json');
		await writeJsonStable(path, { id: 'x', title: 'T', entries: [{ hymnal: 'ce', number: '1' }] });
		expect(await readFile(path, 'utf8')).toBe(
			'{\n\t"id": "x",\n\t"title": "T",\n\t"entries": [\n\t\t{\n\t\t\t"hymnal": "ce",\n\t\t\t"number": "1"\n\t\t}\n\t]\n}\n'
		);
	});

	it('re-writes an existing content file byte for byte', async () => {
		const original = await readFile('tests/fixtures/sample-content/hymns/a-toi-la-gloire.json', 'utf8');
		const path = join(dir, 'copy.json');
		await writeJsonStable(path, JSON.parse(original));
		expect(await readFile(path, 'utf8')).toBe(original);
	});

	it('writes strings in Unicode NFC', async () => {
		const path = join(dir, 'nfc.json');
		await writeJsonStable(path, { t: 'Éternel' });
		expect((await readJson<{ t: string }>(path)).t).toBe('Éternel');
	});

	it('gives byte-identical files for the same value', async () => {
		const value = { b: 1, a: ['é', { z: null }] };
		await writeJsonStable(join(dir, '1.json'), value);
		await writeJsonStable(join(dir, '2.json'), value);
		expect(await readFile(join(dir, '1.json'))).toEqual(await readFile(join(dir, '2.json')));
	});

	it('leaves the previous file intact when a write is interrupted', async () => {
		const path = join(dir, 'safe.json');
		await writeFile(path, '{"old": true}\n');
		await expect(
			writeJsonStable(
				path,
				{ new: true },
				{
					beforeRename: () => {
						throw new Error('crash');
					}
				}
			)
		).rejects.toThrow('crash');
		expect(await readFile(path, 'utf8')).toBe('{"old": true}\n');
		expect(await readdir(dir)).toEqual(['safe.json']);
	});

	it('creates missing folders, and removeFile ignores missing files', async () => {
		const path = join(dir, 'a', 'b', 'c.json');
		await writeJsonStable(path, []);
		expect(await readJson(path)).toEqual([]);
		await removeFile(path);
		await removeFile(path);
		expect(await readdir(join(dir, 'a', 'b'))).toEqual([]);
	});
});
