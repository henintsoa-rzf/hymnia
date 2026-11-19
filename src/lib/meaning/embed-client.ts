/**
 * Turns a query into a vector through `POST /api/embed` (contracts/embed-api.md, client rules):
 * query cache first, offline answer at once, 10 s timeout, user cancel, errors mapped to the
 * messages of the search screen. A failed reply is never cached.
 */
import { MAX_QUERY_CHARS } from './config';
import type { QueryCache } from './query-cache';
import { fromBase64 } from './vector';

export const EMBED_TIMEOUT_MS = 10_000;

export type EmbedFailure =
	'config' | 'failed' | 'unavailable' | 'rate' | 'offline' | 'timeout' | 'cancelled';

export type EmbedResult =
	| { ok: true; vector: Float32Array; truncated: boolean; cached: boolean }
	| { ok: false; reason: EmbedFailure; truncated: boolean };

export type EmbedOptions = {
	fetchFn?: typeof fetch;
	signal?: AbortSignal;
	cache?: QueryCache;
	online?: () => boolean;
	endpoint?: string;
	/** Longest text sent; the search field's 500 by default (feature 015: 2,000 for verses). */
	maxChars?: number;
};

/** The query as sent: at most `max` code points (500 for the search field). */
export function cutQuery(
	text: string,
	max: number = MAX_QUERY_CHARS
): { text: string; truncated: boolean } {
	const chars = [...text.trim()];
	return chars.length > max
		? { text: chars.slice(0, max).join(''), truncated: true }
		: { text: text.trim(), truncated: false };
}

function statusReason(status: number): EmbedFailure {
	if (status === 409) return 'config';
	if (status === 429) return 'rate';
	if (status >= 500) return 'unavailable';
	return 'failed';
}

export async function embedQuery(
	query: string,
	meta: { configId: string; dims: number },
	options: EmbedOptions = {}
): Promise<EmbedResult> {
	const { text, truncated } = cutQuery(query, options.maxChars);
	const fail = (reason: EmbedFailure): EmbedResult => ({ ok: false, reason, truncated });

	const hit = options.cache?.get(text);
	if (hit && hit.length === meta.dims) return { ok: true, vector: hit, truncated, cached: true };

	const online = options.online ?? (() => typeof navigator === 'undefined' || navigator.onLine);
	if (!online()) return fail('offline');
	if (options.signal?.aborted) return fail('cancelled');

	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, EMBED_TIMEOUT_MS);
	const onAbort = () => controller.abort();
	options.signal?.addEventListener('abort', onAbort);

	try {
		const fetchFn = options.fetchFn ?? fetch;
		const response = await fetchFn(options.endpoint ?? '/api/embed', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text, configId: meta.configId }),
			signal: controller.signal
		});
		if (!response.ok) return fail(statusReason(response.status));
		const body = (await response.json()) as { configId?: string; dims?: number; vector?: string };
		if (body.configId !== meta.configId || body.dims !== meta.dims || !body.vector) {
			return fail('config');
		}
		const vector = fromBase64(body.vector);
		if (vector.length !== meta.dims) return fail('config');
		options.cache?.put(text, vector);
		return { ok: true, vector, truncated, cached: false };
	} catch {
		if (timedOut) return fail('timeout');
		if (options.signal?.aborted) return fail('cancelled');
		return fail('offline');
	} finally {
		clearTimeout(timer);
		options.signal?.removeEventListener('abort', onAbort);
	}
}
