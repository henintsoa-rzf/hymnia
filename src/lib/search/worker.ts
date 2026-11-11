/**
 * Search Web Worker: keeps typing smooth by searching off the main thread (research.md §3).
 * Only the latest pending request is run; older ones are dropped.
 */
import { fetchData } from '../data/catalog';
import { createEngine, type SearchEngine } from './engine';
import type { SearchRequest, SearchResponse } from './types';

export type WorkerIn =
	{ type: 'init'; base: string } | { type: 'search'; id: number; request: SearchRequest };

export type WorkerOut =
	| { type: 'ready'; version: string }
	| { type: 'error'; message: string }
	| { type: 'result'; id: number; response: SearchResponse };

const post = (message: WorkerOut) => self.postMessage(message);

let engine: Promise<SearchEngine> | undefined;
let pending: { id: number; request: SearchRequest } | undefined;
let scheduled = false;

async function runLatest() {
	scheduled = false;
	const job = pending;
	pending = undefined;
	if (!job || !engine) return;
	try {
		const response = (await engine).search(job.request);
		post({ type: 'result', id: job.id, response });
	} catch (error) {
		post({ type: 'error', message: String(error) });
	}
}

self.onmessage = (event: MessageEvent<WorkerIn>) => {
	const message = event.data;
	if (message.type === 'init') {
		engine = fetchData(message.base).then(({ catalog, indexJson }) =>
			createEngine(catalog, indexJson)
		);
		engine
			.then((e) => post({ type: 'ready', version: e.catalog.version }))
			.catch((error) => post({ type: 'error', message: String(error) }));
		return;
	}
	pending = { id: message.id, request: message.request };
	if (!scheduled) {
		scheduled = true;
		setTimeout(runLatest, 0);
	}
};
