/**
 * Cloudflare Worker of the deployment: `POST /api/embed` turns a search query into a vector with
 * the same model and the same cutting code as the stanzas (specs/011-semantic-search,
 * contracts/embed-api.md). Every other request is a static asset (`run_worker_first` only sends
 * `/api/*` here).
 *
 * Privacy (FR-010): no query text, IP or user agent is ever logged; the edge cache key is a hash.
 */
import { MAX_EMBED_CHARS, MEANING_CONFIG, configId, tidyQuery } from '../src/lib/meaning/config';
import { cutAndNormalize, toBase64 } from '../src/lib/meaning/vector';

export type Env = {
	/** Secret: `npx wrangler secret put MAMMOUTH_API_KEY`. */
	MAMMOUTH_API_KEY: string;
	EMBEDDINGS_BASE_URL?: string;
	EMBED_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
	ASSETS: { fetch(request: Request): Promise<Response> };
};

type Ctx = { waitUntil(promise: Promise<unknown>): void };

type CacheLike = {
	match(key: Request): Promise<Response | undefined>;
	put(key: Request, response: Response): Promise<void>;
};

/** Injected in tests; by default the global `fetch` and the edge cache. */
export type Deps = { fetch?: typeof fetch; cache?: CacheLike };

const CONFIG_ID = configId(MEANING_CONFIG);
const UPSTREAM_TIMEOUT_MS = 8_000;
const CACHE_SECONDS = 30 * 24 * 3600;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }
	});

/** Cache key text: also lower case, so « Grâce  divine » and « grâce divine » share a vector. */
const normalise = (text: string) => tidyQuery(text).toLowerCase();

async function cacheKey(text: string): Promise<Request> {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`${CONFIG_ID}\n${normalise(text)}`)
	);
	const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
	return new Request(`https://embed-cache.hymnia/${encodeURIComponent(CONFIG_ID)}/${hex}`);
}

function defaultCache(): CacheLike | undefined {
	return (globalThis as { caches?: { default?: CacheLike } }).caches?.default;
}

async function embed(request: Request, env: Env, ctx: Ctx, deps: Deps): Promise<Response> {
	let body: { text?: unknown; configId?: unknown };
	try {
		body = await request.json();
	} catch {
		return json(400, { error: 'invalid' });
	}
	const text = typeof body?.text === 'string' ? tidyQuery(body.text) : '';
	if (!text || typeof body.configId !== 'string') return json(400, { error: 'invalid' });
	if ([...text].length > MAX_EMBED_CHARS) return json(413, { error: 'too-long' });
	if (body.configId !== CONFIG_ID) return json(409, { error: 'config', expected: CONFIG_ID });

	const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	const { success } = await env.EMBED_LIMIT.limit({ key: ip });
	if (!success) return json(429, { error: 'rate' }, { 'Retry-After': '60' });

	const cache = deps.cache ?? defaultCache();
	const key = await cacheKey(text);
	const cached = await cache?.match(key);
	if (cached) return cached;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
	let full: number[];
	try {
		const base = env.EMBEDDINGS_BASE_URL || 'https://api.mammouth.ai/v1';
		const upstream = await (deps.fetch ?? fetch)(`${base}/embeddings`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${env.MAMMOUTH_API_KEY}`
			},
			body: JSON.stringify({ model: MEANING_CONFIG.model, input: [text] }),
			signal: controller.signal
		});
		if (!upstream.ok) {
			console.warn(`embed upstream status ${upstream.status}`);
			return json(502, { error: 'upstream' });
		}
		const data = (await upstream.json()) as { data?: { embedding?: number[] }[] };
		full = data.data?.[0]?.embedding ?? [];
		if (full.length < MEANING_CONFIG.dims) {
			console.warn(`embed upstream returned ${full.length} dims`);
			return json(502, { error: 'upstream' });
		}
	} catch {
		const timedOut = controller.signal.aborted;
		console.warn(timedOut ? 'embed upstream timeout' : 'embed upstream network error');
		return json(timedOut ? 503 : 502, { error: 'upstream' });
	} finally {
		clearTimeout(timer);
	}

	const vector = cutAndNormalize(full, MEANING_CONFIG.dims);
	const response = new Response(
		JSON.stringify({ configId: CONFIG_ID, dims: MEANING_CONFIG.dims, vector: toBase64(vector) }),
		{
			headers: {
				'content-type': 'application/json',
				'cache-control': `max-age=${CACHE_SECONDS}`
			}
		}
	);
	if (cache) ctx.waitUntil(cache.put(key, response.clone()));
	return response;
}

export async function handle(
	request: Request,
	env: Env,
	ctx: Ctx,
	deps: Deps = {}
): Promise<Response> {
	const { pathname } = new URL(request.url);
	if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
	if (pathname === '/api/embed' && request.method === 'POST') {
		return embed(request, env, ctx, deps);
	}
	return json(404, { error: 'not-found' });
}

export default { fetch: (request: Request, env: Env, ctx: Ctx) => handle(request, env, ctx) };
