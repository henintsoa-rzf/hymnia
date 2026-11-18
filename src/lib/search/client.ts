/**
 * UI-side search API. Sends each query to the worker and ignores any response that is not for
 * the latest query (contracts/search.md, "Performance"). Feature 011 adds search by meaning and
 * the state of its data (contracts/meaning-search.md).
 */
import { writable, type Readable } from 'svelte/store';
import type { MeaningManifest } from '../domain/schema';
import type { MeaningError, MeaningState, WorkerIn, WorkerOut } from './worker';
import type { SearchRequest, SearchResponse } from './types';

export type MeaningStatus = { state: MeaningState; loaded?: number; total?: number };

export type MeaningAnswer = { response: SearchResponse } | { error: MeaningError };

export type SearchClient = {
	/** Resolves with the response, or `null` if a newer search was started meanwhile. */
	search(request: SearchRequest): Promise<SearchResponse | null>;
	/** Resolves once the data and index are loaded. */
	ready: Promise<string>;
	/** Search by meaning with a query vector; `null` if a newer one was started meanwhile. */
	searchMeaning(
		request: SearchRequest,
		vector: Float32Array,
		configId: string
	): Promise<MeaningAnswer | null>;
	/** Starts the background download of the meaning data (idle, R8). */
	prefetchMeaning(): void;
	meaningStatus: Readable<MeaningStatus>;
	/** The meaning data of the loaded build, once ready; `undefined` when the build has none. */
	meaningConfig(): MeaningManifest | undefined;
	dispose(): void;
};

/** `worker` can be injected for tests; by default a module Web Worker is started. */
export function createSearchClient(base: string, worker?: Worker): SearchClient {
	const w = worker ?? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
	let latestId = 0;
	const waiting = new Map<number, (response: SearchResponse | null) => void>();
	let latestMeaningId = 0;
	const waitingMeaning = new Map<number, (answer: MeaningAnswer | null) => void>();
	const meaningStatus = writable<MeaningStatus>({ state: 'absent' });
	let meaning: MeaningManifest | undefined;

	let resolveReady!: (version: string) => void;
	let rejectReady!: (error: Error) => void;
	const ready = new Promise<string>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});

	w.onmessage = (event: MessageEvent<WorkerOut>) => {
		const message = event.data;
		switch (message.type) {
			case 'ready':
				meaning = message.meaning;
				if (!meaning) meaningStatus.set({ state: 'unavailable' });
				resolveReady(message.version);
				return;
			case 'error':
				rejectReady(new Error(message.message));
				// Do not leave callers waiting forever.
				for (const resolve of waiting.values()) resolve(null);
				waiting.clear();
				for (const resolve of waitingMeaning.values()) resolve({ error: 'failed' });
				waitingMeaning.clear();
				return;
			case 'result': {
				const resolve = waiting.get(message.id);
				waiting.delete(message.id);
				resolve?.(message.id === latestId ? message.response : null);
				return;
			}
			case 'meaning-status':
				meaningStatus.set({ state: message.state, loaded: message.loaded, total: message.total });
				return;
			case 'meaning-result': {
				const resolve = waitingMeaning.get(message.id);
				waitingMeaning.delete(message.id);
				if (message.id !== latestMeaningId || (!message.response && !message.error)) {
					resolve?.(null);
				} else {
					resolve?.(message.response ? { response: message.response } : { error: message.error! });
				}
			}
		}
	};

	// The UI awaits `ready` and shows the error; avoid an unhandled rejection if it does not.
	ready.catch(() => {});
	w.postMessage({ type: 'init', base } satisfies WorkerIn);

	return {
		ready,
		search(request) {
			const id = ++latestId;
			// Older searches will never be answered (the worker drops them): settle them now.
			for (const [oldId, resolve] of waiting) {
				resolve(null);
				waiting.delete(oldId);
			}
			return new Promise((resolve) => {
				waiting.set(id, resolve);
				w.postMessage({ type: 'search', id, request } satisfies WorkerIn);
			});
		},
		searchMeaning(request, vector, configId) {
			const id = ++latestMeaningId;
			for (const [oldId, resolve] of waitingMeaning) {
				resolve(null);
				waitingMeaning.delete(oldId);
			}
			const copy = vector.slice().buffer;
			return new Promise((resolve) => {
				waitingMeaning.set(id, resolve);
				w.postMessage(
					{ type: 'meaning-search', id, request, vector: copy, configId } satisfies WorkerIn,
					[copy]
				);
			});
		},
		prefetchMeaning() {
			w.postMessage({ type: 'meaning-prefetch' } satisfies WorkerIn);
		},
		meaningStatus: { subscribe: meaningStatus.subscribe },
		meaningConfig: () => meaning,
		dispose: () => w.terminate()
	};
}
