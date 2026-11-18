// POST /api/embed (specs/011-semantic-search/contracts/embed-api.md), with a fake upstream.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle, type Env } from '../../worker/index';
import { MEANING_CONFIG, configId } from '../../src/lib/meaning/config';
import { fromBase64 } from '../../src/lib/meaning/vector';
import { fakeEmbedOne } from '../helpers/fake-embedder';

const ID = configId(MEANING_CONFIG);
const SECRET_QUERY = 'ma requête très privée';

class FakeCache {
	store = new Map<string, Response>();
	async match(key: Request) {
		return this.store.get(key.url)?.clone();
	}
	async put(key: Request, response: Response) {
		this.store.set(key.url, response.clone());
	}
}

function setup(options: { upstream?: typeof fetch; allow?: boolean } = {}) {
	const upstream = vi.fn(
		options.upstream ??
			(async (_url: RequestInfo | URL, init?: RequestInit) => {
				const { input } = JSON.parse(String(init!.body)) as { input: string[] };
				return Response.json({
					data: input.map((t, index) => ({ index, embedding: Array.from(fakeEmbedOne(t)) }))
				});
			})
	);
	const limit = vi.fn(async () => ({ success: options.allow ?? true }));
	const env: Env = {
		MAMMOUTH_API_KEY: 'secret-key',
		EMBED_LIMIT: { limit },
		ASSETS: { fetch: async () => new Response('asset') }
	};
	const cache = new FakeCache();
	const waits: Promise<unknown>[] = [];
	const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p) };
	const call = async (body: unknown, init: RequestInit = {}, path = '/api/embed') => {
		const response = await handle(
			new Request(`https://hymnia.test${path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
				body: typeof body === 'string' ? body : JSON.stringify(body),
				...init
			}),
			env,
			ctx,
			{ fetch: upstream as unknown as typeof fetch, cache }
		);
		await Promise.all(waits);
		return response;
	};
	return { call, upstream, limit, cache };
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/embed', () => {
	it('returns the query vector cut to the shipped dims, normalised', async () => {
		const { call, upstream } = setup();
		const response = await call({ text: 'la fidélité de Dieu', configId: ID });
		expect(response.status).toBe(200);
		const body = (await response.json()) as { configId: string; dims: number; vector: string };
		expect(body).toMatchObject({ configId: ID, dims: MEANING_CONFIG.dims });
		const v = fromBase64(body.vector);
		expect(v).toHaveLength(MEANING_CONFIG.dims);
		expect(Math.hypot(...v)).toBeCloseTo(1, 4);
		const [url, init] = upstream.mock.calls[0];
		expect(String(url)).toBe('https://api.mammouth.ai/v1/embeddings');
		expect(JSON.parse(String(init!.body))).toEqual({
			model: 'text-embedding-3-large',
			input: ['la fidélité de Dieu']
		});
		expect(new Headers(init!.headers).get('authorization')).toBe('Bearer secret-key');
	});

	it('answers 400 for bad JSON or empty text', async () => {
		const { call } = setup();
		expect((await call('{nope')).status).toBe(400);
		expect((await call({ text: '   ', configId: ID })).status).toBe(400);
		expect((await call({ configId: ID })).status).toBe(400);
	});

	it('answers 409 for another configId', async () => {
		const { call } = setup();
		const response = await call({ text: 'grâce', configId: 'old/stanza/256/i8/v1' });
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: 'config', expected: ID });
	});

	it('answers 413 over 500 code points', async () => {
		const { call } = setup();
		expect((await call({ text: '😀'.repeat(501), configId: ID })).status).toBe(413);
		expect((await call({ text: '😀'.repeat(500), configId: ID })).status).toBe(200);
	});

	it('answers 429 with Retry-After when the limit refuses', async () => {
		const { call, upstream } = setup({ allow: false });
		const response = await call({ text: 'grâce', configId: ID });
		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBeTruthy();
		expect(upstream).not.toHaveBeenCalled();
	});

	it('answers 502 on an upstream error and 503 on a timeout', async () => {
		const failing = setup({ upstream: async () => new Response('no credits', { status: 402 }) });
		expect((await failing.call({ text: 'grâce', configId: ID })).status).toBe(502);

		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const slow = setup({
				upstream: (_u, init) =>
					new Promise((_resolve, reject) =>
						init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason))
					)
			});
			const pending = slow.call({ text: 'grâce', configId: ID });
			while (slow.upstream.mock.calls.length === 0) await new Promise((r) => setImmediate(r));
			await vi.advanceTimersByTimeAsync(8_001);
			expect((await pending).status).toBe(503);
		} finally {
			vi.useRealTimers();
		}
	});

	it('answers 404 JSON for other methods and paths', async () => {
		const { call } = setup();
		const get = await call(undefined, { method: 'GET', body: undefined });
		expect(get.status).toBe(404);
		expect(await get.json()).toEqual({ error: 'not-found' });
		expect((await call({}, {}, '/api/other')).status).toBe(404);
	});

	it('serves a repeated query from the cache, with no upstream call', async () => {
		const { call, upstream } = setup();
		const first = await (await call({ text: 'Grâce  divine', configId: ID })).json();
		const second = await (await call({ text: 'grâce divine', configId: ID })).json();
		expect(second).toEqual(first);
		expect(upstream).toHaveBeenCalledTimes(1);
	});

	it('never logs the query text', async () => {
		const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
			vi.spyOn(console, m).mockImplementation(() => {})
		);
		const ok = setup();
		await ok.call({ text: SECRET_QUERY, configId: ID });
		const failing = setup({ upstream: async () => new Response('boom', { status: 500 }) });
		await failing.call({ text: SECRET_QUERY, configId: ID });
		const logged = spies
			.flatMap((s) => s.mock.calls.flat())
			.map(String)
			.join('\n');
		expect(logged).not.toContain(SECRET_QUERY);
		expect(logged).not.toContain('secret-key');
	});
});
