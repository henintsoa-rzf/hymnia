/**
 * Embeddings with a local cache (data-model.md, EmbeddingCacheEntry; research R1, R7).
 *
 * Each text is embedded once per model: `.cache/embeddings/<model>.jsonl` holds one line per
 * text, `{ key: sha256(model + text), vector: base64 float32 of the full vector }`. Only missing
 * texts are sent, in batches of at most 100, at most 4 at a time; 429 and 5xx are retried.
 * The API key is never printed.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FULL_DIMS } from '../../src/lib/meaning/config';
import { fromBase64, toBase64 } from '../../src/lib/meaning/vector';

export const DEFAULT_BASE_URL = 'https://api.mammouth.ai/v1';
export const DEFAULT_MODEL = 'text-embedding-3-large';
export const DEFAULT_CACHE_DIR = '.cache/embeddings';
const BATCH = 100;
const PARALLEL = 4;
const RETRIES = 5;
/** Base64 length of a full float32 vector. */
const FULL_B64 = Math.ceil((FULL_DIMS * 4) / 3) * 4;

export class EmbedHttpError extends Error {
	constructor(
		readonly status: number,
		body: string
	) {
		super(`Embeddings API error ${status}: ${body.slice(0, 300)}`);
	}
}

export type EmbedBatch = (texts: string[]) => Promise<Float32Array[]>;

export type EmbedderOptions = {
	baseUrl?: string;
	model?: string;
	apiKey?: string;
	cacheDir?: string;
	/** Injected in tests; by default POSTs `<baseUrl>/embeddings`. */
	embedBatch?: EmbedBatch;
	sleep?: (ms: number) => Promise<void>;
};

export type Embedder = {
	model: string;
	hasCredentials(): boolean;
	/** Number of distinct texts not in the cache. */
	missing(texts: string[]): Promise<number>;
	/** Full vectors, in the order of `texts`. */
	embed(texts: string[]): Promise<{ vectors: Float32Array[]; embedded: number; cached: number }>;
};

/** Options from the environment (`.env` already loaded by the caller). */
export function envOptions(): EmbedderOptions {
	return {
		baseUrl: process.env.EMBEDDINGS_BASE_URL || DEFAULT_BASE_URL,
		model: process.env.EMBEDDINGS_MODEL || DEFAULT_MODEL,
		apiKey: process.env.MAMMOUTH_API_KEY || undefined
	};
}

export function httpEmbedBatch(baseUrl: string, model: string, apiKey: string): EmbedBatch {
	return async (texts) => {
		const response = await fetch(`${baseUrl}/embeddings`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({ model, input: texts }),
			signal: AbortSignal.timeout(120_000)
		});
		const body = await response.text();
		if (!response.ok) throw new EmbedHttpError(response.status, body.replaceAll(apiKey, '***'));
		const json = JSON.parse(body) as { data: { index: number; embedding: number[] }[] };
		const out = new Array<Float32Array>(texts.length);
		for (const d of json.data) out[d.index] = Float32Array.from(d.embedding);
		for (const v of out) {
			if (!v || v.length !== FULL_DIMS) {
				throw new EmbedHttpError(200, `expected ${FULL_DIMS} dims, got ${v?.length ?? 'none'}`);
			}
		}
		return out;
	};
}

export const cacheKey = (model: string, text: string) =>
	createHash('sha256')
		.update(model + text)
		.digest('hex');

export function createEmbedder(options: EmbedderOptions = {}): Embedder {
	const model = options.model ?? DEFAULT_MODEL;
	const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
	const cacheFile = join(
		options.cacheDir ?? DEFAULT_CACHE_DIR,
		`${model.replaceAll('/', '_')}.jsonl`
	);
	const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
	let cache: Promise<Map<string, string>> | undefined;

	const loadCache = () =>
		(cache ??= (async () => {
			const map = new Map<string, string>();
			if (!existsSync(cacheFile)) return map;
			for (const line of (await readFile(cacheFile, 'utf8')).split('\n')) {
				if (!line.trim()) continue;
				try {
					const { key, vector } = JSON.parse(line) as { key: string; vector: string };
					// A line damaged by an interrupted write: that text is embedded again.
					if (typeof key === 'string' && vector?.length === FULL_B64) map.set(key, vector);
				} catch {
					// A line cut by an interrupted run: that text is embedded again.
				}
			}
			return map;
		})());

	const batchFn = () => {
		if (options.embedBatch) return options.embedBatch;
		if (!options.apiKey) throw new Error('MAMMOUTH_API_KEY is not set');
		return httpEmbedBatch(baseUrl, model, options.apiKey);
	};

	async function withRetry(send: EmbedBatch, texts: string[]) {
		for (let attempt = 0; ; attempt++) {
			try {
				return await send(texts);
			} catch (error) {
				const status = error instanceof EmbedHttpError ? error.status : 0;
				const retryable = status === 429 || status >= 500 || status === 0;
				if (!retryable || attempt >= RETRIES) throw error;
				await sleep(1000 * 2 ** attempt);
			}
		}
	}

	return {
		model,
		hasCredentials: () => Boolean(options.apiKey),
		async missing(texts) {
			const map = await loadCache();
			return new Set(texts.filter((t) => !map.has(cacheKey(model, t)))).size;
		},
		async embed(texts) {
			const map = await loadCache();
			const keys = texts.map((t) => cacheKey(model, t));
			const todo = [...new Map(texts.map((t, i) => [keys[i], t])).entries()].filter(
				([key]) => !map.has(key)
			);
			const cached = new Set(keys).size - todo.length;

			if (todo.length > 0) {
				const send = batchFn();
				await mkdir(options.cacheDir ?? DEFAULT_CACHE_DIR, { recursive: true });
				const batches: [string, string][][] = [];
				for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
				let next = 0;
				// One write at a time: parallel appends of large lines can interleave.
				let writing: Promise<void> = Promise.resolve();
				const worker = async () => {
					while (next < batches.length) {
						const batch = batches[next++];
						const vectors = await withRetry(
							send,
							batch.map(([, t]) => t)
						);
						if (vectors.some((v) => v.length !== FULL_DIMS)) {
							throw new EmbedHttpError(200, `expected ${FULL_DIMS} dims`);
						}
						const lines = batch.map(([key], i) => {
							const vector = toBase64(vectors[i]);
							map.set(key, vector);
							return JSON.stringify({ key, vector });
						});
						// Written as each batch arrives, so an interrupted run keeps what it paid for.
						writing = writing.then(() => appendFile(cacheFile, lines.join('\n') + '\n'));
						await writing;
					}
				};
				await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));
			}

			return { vectors: keys.map((k) => fromBase64(map.get(k)!)), embedded: todo.length, cached };
		}
	};
}
