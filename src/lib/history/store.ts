/**
 * The history on this device (specs/006-search-start-panel/contracts/storage.md): read once,
 * saved whole after each change. When storage is missing or refuses, the history lives in
 * memory for the visit, silently: nothing the user made by hand is at risk (research R8).
 */
import { get, writable } from 'svelte/store';
import type { EntryRef } from '../repertoire/schema';
import { clearHistory, parseHistory, recordOpened } from './model';
import type { HistoryDoc } from './schema';

export const STORAGE_KEY = 'hymnia.history.v1';

type Options = { storage?: Storage; now?: () => string };

export function createHistoryStore(options: Options = {}) {
	const { storage, now = () => new Date().toISOString() } = options;

	let raw: string | null = null;
	try {
		raw = storage?.getItem(STORAGE_KEY) ?? null;
	} catch {
		// Storage blocked: start empty.
	}
	const doc = writable<HistoryDoc>(parseHistory(raw));

	function save(next: HistoryDoc) {
		doc.set(next);
		try {
			storage?.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			// Full or blocked: kept for this visit only.
		}
	}

	return {
		subscribe: doc.subscribe,
		record(ref: EntryRef, hymnId: string) {
			save(recordOpened(get(doc), ref, hymnId, now()));
		},
		clear() {
			save(clearHistory());
		}
	};
}

export type HistoryStore = ReturnType<typeof createHistoryStore>;

function browserStorage(): Storage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		return undefined;
	}
}

/** The app's history. */
export const hymnHistory = createHistoryStore({ storage: browserStorage() });
