/**
 * Polite, cached fetcher shared by every source (specs/002-hymnal-import/research.md R3, R4).
 *
 * - follows robots.txt (read once per host) for our own user-agent;
 * - waits max(minDelayMs, Crawl-delay) between two requests to the same host;
 * - identifies itself: "HymniaImporter/<version> (+contact: <HYMNIA_CONTACT>)";
 * - retries 429 and 5xx at most 3 times, with exponential backoff and Retry-After;
 * - keeps every page under the cache folder (<sha1(url)>.html + .meta.json) and asks again
 *   with If-None-Match / If-Modified-Since;
 * - offline, reads only the cache.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import robotsParser from 'robots-parser';
import { version } from '../../package.json' with { type: 'json' };
import { writeJsonStable, writeTextAtomic } from './store/files';

export const USER_AGENT_NAME = 'HymniaImporter';
const MAX_RETRIES = 3;
const BACKOFF_MS = 2000;

export type CachedMeta = {
	url: string;
	retrievedAt: string;
	status: number;
	etag: string | null;
	lastModified: string | null;
	sha256: string;
};

export type FetchedPage = { url: string; body: string; meta: CachedMeta; fromCache: boolean };

export type FetcherOptions = {
	source: { id: string; minDelayMs: number };
	/** Folder for this source's pages, e.g. import/cache/<source>. */
	cacheDir: string;
	offline?: boolean;
	/** HYMNIA_CONTACT. Required for any network request. */
	contact?: string;
	fetchImpl?: typeof fetch;
	/** Milliseconds since the epoch (injected for tests). */
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	log?: (message: string) => void;
};

export class FetchError extends Error {
	constructor(
		message: string,
		readonly url: string,
		readonly status?: number
	) {
		super(message);
	}
}

const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

/** Where the fetcher keeps a page and its metadata in a source's cache folder. */
export const cachePaths = (cacheDir: string, url: string) => ({
	page: join(cacheDir, `${sha1(url)}.html`),
	meta: join(cacheDir, `${sha1(url)}.meta.json`)
});
export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** The URL as sent to the server: the fragment ("#…") is never part of the request. */
export function pageUrl(url: string): string {
	const u = new URL(url);
	u.hash = '';
	return u.toString();
}

export function userAgent(contact: string) {
	return `${USER_AGENT_NAME}/${version} (+contact: ${contact})`;
}

function retryAfterMs(header: string | null, now: number): number {
	if (!header) return 0;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(header);
	return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export function createFetcher(options: FetcherOptions) {
	const {
		source,
		cacheDir,
		offline = false,
		contact,
		fetchImpl = fetch,
		now = Date.now,
		sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		log = () => {}
	} = options;

	type Robots = ReturnType<typeof robotsParser>;
	const robots = new Map<string, Promise<Robots>>();
	const lastRequestAt = new Map<string, number>();
	const delayFor = new Map<string, number>();

	const pagePath = (url: string) => cachePaths(cacheDir, url).page;
	const metaPath = (url: string) => cachePaths(cacheDir, url).meta;

	async function readCache(url: string): Promise<{ body: string; meta: CachedMeta } | undefined> {
		try {
			const [body, meta] = await Promise.all([
				readFile(pagePath(url), 'utf8'),
				readFile(metaPath(url), 'utf8')
			]);
			return { body, meta: JSON.parse(meta) as CachedMeta };
		} catch {
			return undefined;
		}
	}

	/** One HTTP request, after the polite delay for its host. */
	async function request(url: string, headers: Record<string, string>, extraWait = 0) {
		const host = new URL(url).host;
		const delay = delayFor.get(host) ?? source.minDelayMs;
		const last = lastRequestAt.get(host);
		const politeWait = last === undefined ? 0 : last + delay - now();
		const wait = Math.max(politeWait, extraWait);
		if (wait > 0) await sleep(wait);
		lastRequestAt.set(host, now());
		return fetchImpl(url, { headers: { 'user-agent': userAgent(contact!), ...headers } });
	}

	function robotsFor(url: string): Promise<Robots> {
		const origin = new URL(url).origin;
		let entry = robots.get(origin);
		if (!entry) {
			entry = (async () => {
				const robotsUrl = `${origin}/robots.txt`;
				let text = '';
				try {
					const response = await request(robotsUrl, {});
					if (response.ok) text = await response.text();
				} catch (error) {
					log(`robots.txt not readable for ${origin}: ${(error as Error).message}`);
				}
				const parsed = robotsParser(robotsUrl, text);
				const crawlDelay = parsed.getCrawlDelay(USER_AGENT_NAME);
				const host = new URL(url).host;
				delayFor.set(host, Math.max(source.minDelayMs, (crawlDelay ?? 0) * 1000));
				return parsed;
			})();
			robots.set(origin, entry);
		}
		return entry;
	}

	/**
	 * Pages fetched during this run, by URL without its fragment: several entries can live on
	 * one page ("…/programme#chant-3"); the page is requested once.
	 */
	const seenThisRun = new Map<string, Promise<FetchedPage>>();

	async function fetchPage(url: string): Promise<FetchedPage> {
		const page = pageUrl(url);
		let pending = seenThisRun.get(page);
		if (!pending) {
			pending = fetchOne(page);
			seenThisRun.set(page, pending);
			pending.catch(() => seenThisRun.delete(page));
		}
		return { ...(await pending), url };
	}

	async function fetchOne(url: string): Promise<FetchedPage> {
		const cached = await readCache(url);
		if (offline) {
			if (!cached) throw new FetchError(`Page not in the cache (offline): ${url}`, url);
			return { url, body: cached.body, meta: cached.meta, fromCache: true };
		}
		if (!contact) throw new FetchError('HYMNIA_CONTACT is not set (see .env.example)', url);

		const rules = await robotsFor(url);
		if (rules.isAllowed(url, `${USER_AGENT_NAME}/${version}`) === false) {
			throw new FetchError(`Disallowed by robots.txt: ${url}`, url);
		}

		const headers: Record<string, string> = {};
		if (cached?.meta.etag) headers['if-none-match'] = cached.meta.etag;
		if (cached?.meta.lastModified) headers['if-modified-since'] = cached.meta.lastModified;

		let extraWait = 0;
		for (let attempt = 0; ; attempt++) {
			const response = await request(url, headers, extraWait);
			if (response.status === 304 && cached) {
				return { url, body: cached.body, meta: cached.meta, fromCache: true };
			}
			if (response.ok) {
				const body = await response.text();
				const meta: CachedMeta = {
					url,
					retrievedAt: new Date(now()).toISOString(),
					status: response.status,
					etag: response.headers.get('etag'),
					lastModified: response.headers.get('last-modified'),
					sha256: sha256(body)
				};
				await writeTextAtomic(pagePath(url), body);
				await writeJsonStable(metaPath(url), meta);
				return { url, body, meta, fromCache: false };
			}
			const retryable = response.status === 429 || response.status >= 500;
			if (!retryable || attempt >= MAX_RETRIES) {
				throw new FetchError(`HTTP ${response.status} for ${url}`, url, response.status);
			}
			extraWait = Math.max(
				BACKOFF_MS * 2 ** attempt,
				retryAfterMs(response.headers.get('retry-after'), now())
			);
			log(`HTTP ${response.status} for ${url}, retrying in ${Math.round(extraWait / 1000)} s`);
		}
	}

	return {
		fetchPage,
		/** Body only, for adapters (AdapterContext.fetch). */
		fetch: async (url: string) => (await fetchPage(url)).body
	};
}

export type Fetcher = ReturnType<typeof createFetcher>;
