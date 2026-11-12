// Polite cached fetcher (research R3/R4, tasks T011/T019). No real network: fetch is mocked.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createFetcher, type FetcherOptions } from '../../../scripts/import/fetcher';

const BASE = 'https://example.org';
const T0 = Date.parse('2026-11-11T10:00:00.000Z');

type Route = (init: RequestInit) => Response;

let cacheDir: string;
let calls: { url: string; headers: Headers }[];
let sleeps: number[];
let t: number;

beforeEach(async () => {
	cacheDir = await mkdtemp(join(tmpdir(), 'hymnia-fetch-'));
	calls = [];
	sleeps = [];
	t = T0;
});

function setup(routes: Record<string, Route | Route[]>, over: Partial<FetcherOptions> = {}) {
	const queues = new Map(
		Object.entries(routes).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])
	);
	const fetchImpl = async (input: string | URL | Request, init: RequestInit = {}) => {
		const url = String(input);
		calls.push({ url, headers: new Headers(init.headers) });
		const route = queues.get(url);
		if (!route) return new Response('not found', { status: 404 });
		const handler = Array.isArray(route) ? (route.length > 1 ? route.shift()! : route[0]) : route;
		return handler(init);
	};
	return createFetcher({
		source: { id: 'test', minDelayMs: 1000 },
		cacheDir,
		contact: 'contact@example.org',
		fetchImpl,
		now: () => t,
		sleep: async (ms) => {
			sleeps.push(ms);
			t += ms;
		},
		...over
	});
}

const ok = (body: string, headers: Record<string, string> = {}) => () =>
	new Response(body, { status: 200, headers });
const robots = (text: string) => ({ [`${BASE}/robots.txt`]: ok(text) });

describe('politeness', () => {
	it('reads robots.txt once per host and refuses disallowed URLs', async () => {
		const f = setup({
			...robots('User-agent: *\nDisallow: /search'),
			[`${BASE}/a`]: ok('A'),
			[`${BASE}/b`]: ok('B')
		});
		await f.fetchPage(`${BASE}/a`);
		await f.fetchPage(`${BASE}/b`);
		await expect(f.fetchPage(`${BASE}/search?q=x`)).rejects.toThrow(/robots/i);
		expect(calls.filter((c) => c.url.endsWith('/robots.txt'))).toHaveLength(1);
	});

	it('treats a missing robots.txt as allowing everything', async () => {
		const f = setup({ [`${BASE}/a`]: ok('A') });
		expect((await f.fetchPage(`${BASE}/a`)).body).toBe('A');
	});

	it('waits minDelayMs between requests to one host', async () => {
		const f = setup({ ...robots(''), [`${BASE}/a`]: ok('A'), [`${BASE}/b`]: ok('B') });
		await f.fetchPage(`${BASE}/a`);
		await f.fetchPage(`${BASE}/b`);
		expect(sleeps).toEqual([1000, 1000]);
	});

	it('waits the Crawl-delay when it is longer', async () => {
		const f = setup({
			...robots('User-agent: *\nCrawl-delay: 10'),
			[`${BASE}/a`]: ok('A'),
			[`${BASE}/b`]: ok('B')
		});
		await f.fetchPage(`${BASE}/a`);
		await f.fetchPage(`${BASE}/b`);
		expect(sleeps).toEqual([10000, 10000]);
	});

	it('sends the identifying User-Agent', async () => {
		const f = setup({ ...robots(''), [`${BASE}/a`]: ok('A') });
		await f.fetchPage(`${BASE}/a`);
		for (const call of calls) {
			expect(call.headers.get('user-agent')).toMatch(
				/^HymniaImporter\/\d+\.\d+\.\d+ \(\+contact: contact@example\.org\)$/
			);
		}
	});

	it('refuses to make any request without a contact address', async () => {
		const f = setup({ [`${BASE}/a`]: ok('A') }, { contact: undefined });
		await expect(f.fetchPage(`${BASE}/a`)).rejects.toThrow(/HYMNIA_CONTACT/);
		expect(calls).toEqual([]);
	});
});

describe('retries', () => {
	it('retries 429 and 5xx with backoff, following Retry-After', async () => {
		const f = setup({
			...robots(''),
			[`${BASE}/a`]: [
				() => new Response('', { status: 429, headers: { 'retry-after': '30' } }),
				() => new Response('', { status: 503 }),
				ok('A')
			]
		});
		expect((await f.fetchPage(`${BASE}/a`)).body).toBe('A');
		// 1 s polite delay, then 30 s (Retry-After), then a backoff of at least 4 s.
		expect(sleeps[1]).toBe(30000);
		expect(sleeps[2]).toBeGreaterThanOrEqual(4000);
	});

	it('gives up after 3 retries', async () => {
		const f = setup({ ...robots(''), [`${BASE}/a`]: () => new Response('', { status: 500 }) });
		await expect(f.fetchPage(`${BASE}/a`)).rejects.toThrow(/500/);
		expect(calls.filter((c) => c.url === `${BASE}/a`)).toHaveLength(4);
	});

	it('does not retry other errors', async () => {
		const f = setup({ ...robots('') });
		await expect(f.fetchPage(`${BASE}/missing`)).rejects.toThrow(/404/);
		expect(calls.filter((c) => c.url === `${BASE}/missing`)).toHaveLength(1);
	});
});

describe('cache', () => {
	it('writes the page and its metadata', async () => {
		const f = setup({ ...robots(''), [`${BASE}/a`]: ok('Page A', { etag: '"v1"' }) });
		const page = await f.fetchPage(`${BASE}/a`);
		const key = createHash('sha1').update(`${BASE}/a`).digest('hex');
		expect(await readFile(join(cacheDir, `${key}.html`), 'utf8')).toBe('Page A');
		const meta = JSON.parse(await readFile(join(cacheDir, `${key}.meta.json`), 'utf8'));
		expect(meta).toEqual({
			url: `${BASE}/a`,
			retrievedAt: '2026-11-11T10:00:01.000Z',
			status: 200,
			etag: '"v1"',
			lastModified: null,
			sha256: createHash('sha256').update('Page A').digest('hex')
		});
		expect(page.meta).toEqual(meta);
		expect(page.fromCache).toBe(false);
	});

	it('asks again with the ETag and uses the cache on 304', async () => {
		const first = setup({ ...robots(''), [`${BASE}/a`]: ok('Page A', { etag: '"v1"' }) });
		await first.fetchPage(`${BASE}/a`);
		calls = [];
		const second = setup({
			...robots(''),
			[`${BASE}/a`]: () => new Response(null, { status: 304 })
		});
		const page = await second.fetchPage(`${BASE}/a`);
		expect(page.body).toBe('Page A');
		expect(page.fromCache).toBe(true);
		const pageCall = calls.find((c) => c.url === `${BASE}/a`)!;
		expect(pageCall.headers.get('if-none-match')).toBe('"v1"');
	});

	it('reads only the cache offline and fails clearly on a miss', async () => {
		const online = setup({ ...robots(''), [`${BASE}/a`]: ok('Page A') });
		await online.fetchPage(`${BASE}/a`);
		calls = [];
		const offline = setup({}, { offline: true, contact: undefined });
		expect((await offline.fetchPage(`${BASE}/a`)).body).toBe('Page A');
		await expect(offline.fetchPage(`${BASE}/b`)).rejects.toThrow(/not in the cache/);
		expect(calls).toEqual([]);
	});

	it('requests a page once per run, and ignores the #fragment', async () => {
		const f = setup({ ...robots(''), [`${BASE}/programme`]: ok('P') });
		const a = await f.fetchPage(`${BASE}/programme#chant-1`);
		const b = await f.fetchPage(`${BASE}/programme#chant-2`);
		const c = await f.fetchPage(`${BASE}/programme`);
		expect([a.body, b.body, c.body]).toEqual(['P', 'P', 'P']);
		expect(a.url).toBe(`${BASE}/programme#chant-1`);
		expect(calls.filter((x) => x.url.startsWith(`${BASE}/programme`))).toHaveLength(1);
		expect(calls.every((x) => !x.url.includes('#'))).toBe(true);
		expect((await readdir(cacheDir)).filter((n) => n.endsWith('.html'))).toHaveLength(1);
	});

	it('only keeps .html and .meta.json files in the cache folder', async () => {
		const f = setup({ ...robots(''), [`${BASE}/a`]: ok('A') });
		await f.fetchPage(`${BASE}/a`);
		const files = await readdir(cacheDir);
		expect(files.every((n) => n.endsWith('.html') || n.endsWith('.meta.json'))).toBe(true);
	});
});
