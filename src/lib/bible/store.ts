/**
 * The Bible for the screens, loaded once per visit on the first visit to the Bible section
 * (specs/015-bible-verse-search, research R3). Precached by the service worker with the app, so
 * it loads offline. `null` when the build has no Bible.
 */
import { base } from '$app/paths';
import { fetchBibleText } from '../data/catalog';
import { loadCatalog } from '../data/store';
import { createBible, type Bible } from './bible';
import type { BibleData } from './schema';

let bible: Promise<Bible | null> | undefined;

export function loadBible(fetchFn: typeof fetch = fetch): Promise<Bible | null> {
	bible ??= loadCatalog(fetchFn)
		.then(async ({ bibleFile }) => {
			if (!bibleFile) return null;
			const data: BibleData = JSON.parse(await fetchBibleText(base, bibleFile, fetchFn));
			return createBible(data);
		})
		.catch((error) => {
			bible = undefined; // try again on the next navigation
			throw error;
		});
	return bible;
}
