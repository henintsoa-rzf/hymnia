import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbedHttpError, createEmbedder } from '../../scripts/semantic/embed';
import { fromBase64 } from '../../src/lib/meaning/vector';
import { fakeEmbed } from '../helpers/fake-embedder';

let dir: string;
beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), 'hymnia-embed-'))));
afterEach(() => rm(dir, { recursive: true, force: true }));

const options = (embedBatch: (texts: string[]) => Promise<Float32Array[]>) => ({
	baseUrl: 'https://example.invalid/v1',
	model: 'text-embedding-3-large',
	apiKey: 'k',
	cacheDir: dir,
	embedBatch,
	sleep: async () => {}
});

describe('createEmbedder', () => {
	it('sends only texts missing from the cache, and writes one line per text', async () => {
		const spy = vi.fn(fakeEmbed);
		const first = await createEmbedder(options(spy)).embed(['a b', 'c d']);
		expect(first).toMatchObject({ embedded: 2, cached: 0 });
		expect(spy).toHaveBeenCalledTimes(1);

		const again = createEmbedder(options(spy));
		const second = await again.embed(['c d', 'e f', 'a b']);
		expect(second).toMatchObject({ embedded: 1, cached: 2 });
		expect(spy).toHaveBeenLastCalledWith(['e f']);
		expect(Array.from(second.vectors[0])).toEqual(Array.from(first.vectors[1]));

		const lines = (await readFile(join(dir, 'text-embedding-3-large.jsonl'), 'utf8'))
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l));
		expect(lines).toHaveLength(3);
		const key = createHash('sha256')
			.update('text-embedding-3-large' + 'a b')
			.digest('hex');
		const line = lines.find((l) => l.key === key);
		expect(fromBase64(line.vector)).toHaveLength(3072);
	});

	it('sends batches of at most 100, at most 4 at a time', async () => {
		let running = 0;
		let maxRunning = 0;
		const sizes: number[] = [];
		const spy = vi.fn(async (texts: string[]) => {
			sizes.push(texts.length);
			maxRunning = Math.max(maxRunning, ++running);
			await new Promise((r) => setTimeout(r, 5));
			running--;
			return fakeEmbed(texts);
		});
		const texts = Array.from({ length: 950 }, (_, i) => `text ${i}`);
		const result = await createEmbedder(options(spy)).embed(texts);
		expect(result.embedded).toBe(950);
		expect(Math.max(...sizes)).toBeLessThanOrEqual(100);
		expect(sizes.reduce((a, b) => a + b, 0)).toBe(950);
		expect(maxRunning).toBeLessThanOrEqual(4);
	});

	it('retries 429 and 5xx, but not other 4xx', async () => {
		let calls = 0;
		const flaky = vi.fn(async (texts: string[]) => {
			calls++;
			if (calls === 1) throw new EmbedHttpError(429, 'rate');
			if (calls === 2) throw new EmbedHttpError(503, 'down');
			return fakeEmbed(texts);
		});
		expect((await createEmbedder(options(flaky)).embed(['x'])).embedded).toBe(1);
		expect(flaky).toHaveBeenCalledTimes(3);

		const bad = vi.fn(async () => {
			throw new EmbedHttpError(401, 'no');
		});
		await expect(createEmbedder(options(bad)).embed(['y'])).rejects.toThrow(/401/);
		expect(bad).toHaveBeenCalledTimes(1);
	});

	it('reports credentials and missing texts', async () => {
		const e = createEmbedder({ ...options(fakeEmbed), apiKey: undefined });
		expect(e.hasCredentials()).toBe(false);
		expect(await e.missing(['z'])).toBe(1);
	});
});
