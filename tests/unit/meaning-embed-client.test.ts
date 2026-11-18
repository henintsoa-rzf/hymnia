import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedQuery } from '../../src/lib/meaning/embed-client';
import { createQueryCache } from '../../src/lib/meaning/query-cache';
import { toBase64 } from '../../src/lib/meaning/vector';
import { MemoryStorage } from '../helpers/memory-storage';

const META = { configId: 'te3-large/title+stanza/4/i8/v1', dims: 4 };
const VECTOR = Float32Array.of(0.5, 0.5, 0.5, 0.5);

const ok = (body: object = { configId: META.configId, dims: 4, vector: toBase64(VECTOR) }) =>
	vi.fn(async () => Response.json(body));
const status = (code: number) => vi.fn(async () => Response.json({ error: 'x' }, { status: code }));
const cache = () => createQueryCache({ storage: new MemoryStorage(), configId: META.configId });

afterEach(() => vi.useRealTimers());

describe('embedQuery, online', () => {
	it('returns the vector', async () => {
		const fetchFn = ok();
		const result = await embedQuery('grâce', META, { fetchFn, online: () => true });
		expect(result).toMatchObject({ ok: true, truncated: false });
		expect(result.ok && Array.from(result.vector)).toEqual([0.5, 0.5, 0.5, 0.5]);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/embed');
		expect(JSON.parse(String(init.body))).toEqual({ text: 'grâce', configId: META.configId });
	});

	it('rejects a reply of another config or length', async () => {
		const other = ok({ configId: 'other', dims: 4, vector: toBase64(VECTOR) });
		expect(await embedQuery('a', META, { fetchFn: other, online: () => true })).toMatchObject({
			ok: false,
			reason: 'config'
		});
		const short = ok({ configId: META.configId, dims: 2, vector: toBase64(Float32Array.of(1, 0)) });
		expect(await embedQuery('a', META, { fetchFn: short, online: () => true })).toMatchObject({
			reason: 'config'
		});
	});

	it.each([
		[409, 'config'],
		[413, 'failed'],
		[400, 'failed'],
		[429, 'rate'],
		[502, 'unavailable'],
		[503, 'unavailable']
	])('maps %i to %s', async (code, reason) => {
		expect(
			await embedQuery('a', META, { fetchFn: status(code), online: () => true })
		).toMatchObject({ ok: false, reason });
	});

	it('cuts the text to 500 code points', async () => {
		const fetchFn = ok();
		const result = await embedQuery('é'.repeat(600), META, { fetchFn, online: () => true });
		expect(result.truncated).toBe(true);
		const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect([...JSON.parse(String(init.body)).text]).toHaveLength(500);
	});
});

describe('embedQuery, weak or no connection', () => {
	it('answers offline at once without calling', async () => {
		const fetchFn = ok();
		expect(await embedQuery('a', META, { fetchFn, online: () => false })).toMatchObject({
			ok: false,
			reason: 'offline'
		});
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('maps a network error to offline', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		expect(await embedQuery('a', META, { fetchFn, online: () => true })).toMatchObject({
			reason: 'offline'
		});
	});

	it('times out after 10 s', async () => {
		vi.useFakeTimers();
		const fetchFn = vi.fn(
			(_url: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_r, reject) =>
					init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))
				)
		);
		const pending = embedQuery('a', META, { fetchFn, online: () => true });
		await vi.advanceTimersByTimeAsync(10_001);
		expect(await pending).toMatchObject({ ok: false, reason: 'timeout' });
	});

	it('is cancelled by the user', async () => {
		const controller = new AbortController();
		const fetchFn = vi.fn(
			(_url: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_r, reject) =>
					init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))
				)
		);
		const pending = embedQuery('a', META, {
			fetchFn,
			online: () => true,
			signal: controller.signal
		});
		controller.abort();
		expect(await pending).toMatchObject({ ok: false, reason: 'cancelled' });
	});

	it('uses the query cache first, offline too, and caches only successes', async () => {
		const c = cache();
		const failing = status(502);
		await embedQuery('grâce', META, { fetchFn: failing, online: () => true, cache: c });
		expect(c.get('grâce')).toBeUndefined();

		await embedQuery('grâce', META, { fetchFn: ok(), online: () => true, cache: c });
		const offline = vi.fn();
		const again = await embedQuery('Grâce ', META, {
			fetchFn: offline,
			online: () => false,
			cache: c
		});
		expect(again).toMatchObject({ ok: true, cached: true });
		expect(offline).not.toHaveBeenCalled();
	});
});
