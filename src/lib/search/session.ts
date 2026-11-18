/** One search worker for the whole visit, started on first use. */
import { base } from '$app/paths';
import { createSearchClient, type SearchClient } from './client';

let client: SearchClient | undefined;

export function getSearchClient(): SearchClient {
	client ??= createSearchClient(base);
	return client;
}

/**
 * Background download of the meaning data (feature 011, FR-016, research R8): once the search
 * is ready and the browser is idle. With Save-Data on, it waits for the first search by meaning.
 * A failed download is tried again at the next app start, or at the first use.
 * On a first visit the service worker does not control the page yet, so the files would not be
 * kept in its cache and would download again: it then waits for the next visit (or first use).
 */
export function scheduleMeaningPrefetch(): () => void {
	const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
	if (connection?.saveData) return () => {};
	if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) return () => {};
	const search = getSearchClient();
	let cancelled = false;
	let cancelIdle = () => {};
	search.ready
		.then(() => {
			if (cancelled || !search.meaningConfig()) return;
			const start = () => search.prefetchMeaning();
			if ('requestIdleCallback' in window) {
				const id = window.requestIdleCallback(start, { timeout: 10_000 });
				cancelIdle = () => window.cancelIdleCallback(id);
			} else {
				const id = setTimeout(start, 5000);
				cancelIdle = () => clearTimeout(id);
			}
		})
		.catch(() => {});
	return () => {
		cancelled = true;
		cancelIdle();
	};
}
