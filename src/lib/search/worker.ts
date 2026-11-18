/**
 * Search Web Worker: keeps typing smooth by searching off the main thread (research.md §3).
 * Only the latest pending request is run; older ones are dropped.
 *
 * Feature 011 adds search by meaning (contracts/meaning-search.md): the meaning data is fetched
 * on `meaning-prefetch` (idle, background) or at the first `meaning-search`, checked against the
 * catalog, then kept in memory.
 */
import { fetchData } from '../data/catalog';
import type { Catalog, DataManifest, MeaningManifest } from '../domain/schema';
import { loadMeaningData, type MeaningData } from '../meaning/load';
import { searchByMeaning } from '../meaning/search';
import { createEngine, type SearchEngine } from './engine';
import type { SearchRequest, SearchResponse } from './types';

export type MeaningState = 'absent' | 'downloading' | 'ready' | 'failed' | 'unavailable';

/** Why a search by meaning gave no response. */
export type MeaningError = 'config' | 'failed' | 'unavailable';

export type WorkerIn =
	| { type: 'init'; base: string }
	| { type: 'search'; id: number; request: SearchRequest }
	| { type: 'meaning-prefetch' }
	| {
			type: 'meaning-search';
			id: number;
			request: SearchRequest;
			vector: ArrayBuffer;
			configId: string;
	  };

export type WorkerOut =
	| { type: 'ready'; version: string; meaning?: MeaningManifest }
	| { type: 'error'; message: string }
	| { type: 'result'; id: number; response: SearchResponse }
	| { type: 'meaning-status'; state: MeaningState; loaded?: number; total?: number }
	| { type: 'meaning-result'; id: number; response: SearchResponse | null; error?: MeaningError };

const post = (message: WorkerOut) => self.postMessage(message);

type Loaded = { engine: SearchEngine; manifest: DataManifest; catalog: Catalog };

let base = '';
let loaded: Promise<Loaded> | undefined;
let pending: { id: number; request: SearchRequest } | undefined;
let scheduled = false;

async function runLatest() {
	scheduled = false;
	const job = pending;
	pending = undefined;
	if (!job || !loaded) return;
	try {
		const response = (await loaded).engine.search(job.request);
		post({ type: 'result', id: job.id, response });
	} catch (error) {
		post({ type: 'error', message: String(error) });
	}
}

/* ---------- meaning data ---------- */

let meaning: Promise<MeaningData> | undefined;

/** Reads a file, posting the download progress of both files together. */
async function download(
	path: string,
	progress: { loaded: number; total: number }
): Promise<ArrayBuffer> {
	const response = await fetch(`${base}/data/${path}`);
	if (!response.ok || !response.body)
		throw new Error(`Cannot load ${path}: HTTP ${response.status}`);
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		size += value.byteLength;
		progress.loaded += value.byteLength;
		post({ type: 'meaning-status', state: 'downloading', ...progress });
	}
	const out = new Uint8Array(size);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.byteLength;
	}
	return out.buffer;
}

/** Downloads and checks the meaning data once; a failure can be retried later. */
function ensureMeaning(): Promise<MeaningData> {
	meaning ??= (async () => {
		if (!loaded) throw new Error('not initialised');
		const { manifest, catalog } = await loaded;
		const meta = manifest.meaning;
		if (!meta) {
			post({ type: 'meaning-status', state: 'unavailable' });
			throw new Error('unavailable');
		}
		const progress = { loaded: 0, total: meta.bytes };
		post({ type: 'meaning-status', state: 'downloading', ...progress });
		try {
			const [vectors, rowMap] = await Promise.all([
				download(meta.vectors, progress),
				download(meta.rowMap, progress)
			]);
			const data = loadMeaningData(meta, vectors, rowMap, catalog);
			post({ type: 'meaning-status', state: 'ready' });
			return data;
		} catch (error) {
			post({ type: 'meaning-status', state: 'failed' });
			throw error;
		}
	})();
	meaning.catch(() => {
		// Retry on the next request, except when the build has no meaning data.
		void loaded?.then(({ manifest }) => {
			if (manifest.meaning) meaning = undefined;
		});
	});
	return meaning;
}

let latestMeaning = 0;

async function runMeaning(message: Extract<WorkerIn, { type: 'meaning-search' }>) {
	latestMeaning = message.id;
	const answer = (response: SearchResponse | null, error?: MeaningError) =>
		post({ type: 'meaning-result', id: message.id, response, ...(error ? { error } : {}) });
	try {
		const { engine, manifest, catalog } = await loaded!;
		if (!manifest.meaning) return answer(null, 'unavailable');
		if (message.configId !== manifest.meaning.configId) return answer(null, 'config');
		const data = await ensureMeaning();
		if (message.id !== latestMeaning) return answer(null);
		const vector = new Float32Array(message.vector);
		if (vector.length !== data.dims) return answer(null, 'config');
		answer(searchByMeaning(engine, data, vector, message.request, catalog.hymns));
	} catch {
		answer(null, 'failed');
	}
}

self.onmessage = (event: MessageEvent<WorkerIn>) => {
	const message = event.data;
	switch (message.type) {
		case 'init':
			base = message.base;
			loaded = fetchData(message.base).then(({ manifest, catalog, indexJson }) => ({
				engine: createEngine(catalog, indexJson),
				manifest,
				catalog
			}));
			loaded
				.then(({ engine, manifest }) =>
					post({ type: 'ready', version: engine.catalog.version, meaning: manifest.meaning })
				)
				.catch((error) => post({ type: 'error', message: String(error) }));
			return;
		case 'meaning-prefetch':
			ensureMeaning().catch(() => {});
			return;
		case 'meaning-search':
			void runMeaning(message);
			return;
		case 'search':
			pending = { id: message.id, request: message.request };
			if (!scheduled) {
				scheduled = true;
				setTimeout(runLatest, 0);
			}
	}
};
