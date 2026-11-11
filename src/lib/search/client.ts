/**
 * UI-side search API. Sends each query to the worker and ignores any response that is not for
 * the latest query (contracts/search.md, "Performance").
 */
import type { WorkerIn, WorkerOut } from './worker';
import type { SearchRequest, SearchResponse } from './types';

export type SearchClient = {
	/** Resolves with the response, or `null` if a newer search was started meanwhile. */
	search(request: SearchRequest): Promise<SearchResponse | null>;
	/** Resolves once the data and index are loaded. */
	ready: Promise<string>;
	dispose(): void;
};

/** `worker` can be injected for tests; by default a module Web Worker is started. */
export function createSearchClient(base: string, worker?: Worker): SearchClient {
	const w = worker ?? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
	let latestId = 0;
	const waiting = new Map<number, (response: SearchResponse | null) => void>();

	let resolveReady!: (version: string) => void;
	let rejectReady!: (error: Error) => void;
	const ready = new Promise<string>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});

	w.onmessage = (event: MessageEvent<WorkerOut>) => {
		const message = event.data;
		if (message.type === 'ready') resolveReady(message.version);
		else if (message.type === 'error') {
			rejectReady(new Error(message.message));
			// Do not leave callers waiting forever.
			for (const resolve of waiting.values()) resolve(null);
			waiting.clear();
		} else {
			const resolve = waiting.get(message.id);
			waiting.delete(message.id);
			resolve?.(message.id === latestId ? message.response : null);
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
		dispose: () => w.terminate()
	};
}
