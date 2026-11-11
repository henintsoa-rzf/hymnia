/**
 * The Répertoire on this device (contracts/storage.md, "Loading" and "Writing"): a Svelte store
 * of the document, saved whole after each change, following changes from other tabs.
 * If storage is missing or refuses writes, collections live in memory for the visit and
 * `notice` says so once.
 */
import { get, writable, type Readable } from 'svelte/store';
import {
	addEntry,
	createCollection,
	deleteCollection,
	moveEntry,
	parseDocument,
	removeEntry,
	renameCollection,
	restoreCollection,
	toggleEntry,
	type HymnIdOf
} from './model';
import type { EntryRef, RepertoireDoc } from './schema';

export const STORAGE_KEY = 'hymnia.repertoire.v2';
export const UNDO_DELAY_MS = 8000;
/** An unreadable document is kept under this prefix + date, for recovery. */
export const CORRUPT_PREFIX = 'hymnia.repertoire.corrupt-';

export type Notice = 'corrupt' | 'unavailable' | null;
export type LastDeleted = { name: string; undo: () => void } | null;

type Options = {
	storage?: Storage;
	now?: () => string;
	/** Follow changes made in other tabs (`storage` event). */
	listen?: boolean;
	/** Ask the browser to keep the data (installed app). */
	persist?: boolean;
};

export function createRepertoireStore(options: Options = {}) {
	const { storage, now = () => new Date().toISOString(), listen = true, persist = true } = options;
	const notice = writable<Notice>(null);
	const lastDeleted = writable<LastDeleted>(null);
	let undoTimer: ReturnType<typeof setTimeout> | undefined;
	let persistAsked = false;

	function load(): RepertoireDoc {
		let raw: string | null = null;
		try {
			raw = storage?.getItem(STORAGE_KEY) ?? null;
		} catch {
			notice.set('unavailable');
		}
		const parsed = parseDocument(raw);
		if (parsed.ok) return parsed.doc;
		try {
			storage?.setItem(`${CORRUPT_PREFIX}${now()}`, raw ?? '');
		} catch {
			// Could not keep a copy; the notice still tells the user.
		}
		notice.set('corrupt');
		return { version: 2, collections: [] };
	}

	const doc = writable<RepertoireDoc>(load());

	function save(next: RepertoireDoc) {
		doc.set(next);
		try {
			if (!storage) throw new Error('no storage');
			storage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			if (get(notice) === null) notice.set('unavailable');
		}
		if (persist && !persistAsked && next.collections.length > 0) {
			persistAsked = true;
			navigator.storage?.persist?.().catch(() => {});
		}
	}

	if (listen && typeof window !== 'undefined') {
		window.addEventListener('storage', (event) => {
			if (event.key !== STORAGE_KEY) return;
			const parsed = parseDocument(event.newValue);
			if (parsed.ok) doc.set(parsed.doc);
		});
	}

	const current = () => get(doc);

	return {
		subscribe: doc.subscribe,
		notice: { subscribe: notice.subscribe } as Readable<Notice>,
		/** The last deleted collection, with its undo, for UNDO_DELAY_MS. */
		lastDeleted: { subscribe: lastDeleted.subscribe } as Readable<LastDeleted>,
		dismissNotice: () => notice.set(null),
		/** The document now, outside a reactive context. */
		current,

		create(name: string) {
			const result = createCollection(current(), name, now());
			if (result.ok) save(result.doc);
			return result;
		},
		rename(id: string, name: string) {
			const result = renameCollection(current(), id, name, now());
			if (result.ok) save(result.doc);
			return result;
		},
		remove(id: string) {
			const { doc: next, removed } = deleteCollection(current(), id);
			if (!removed) return;
			save(next);
			clearTimeout(undoTimer);
			const clear = () => {
				clearTimeout(undoTimer);
				lastDeleted.set(null);
			};
			lastDeleted.set({
				name: removed.collection.name,
				undo: () => {
					save(restoreCollection(current(), removed));
					clear();
				}
			});
			undoTimer = setTimeout(clear, UNDO_DELAY_MS);
		},
		add(id: string, ref: EntryRef, hymnIdOf: HymnIdOf) {
			const result = addEntry(current(), id, ref, hymnIdOf, now());
			if (result.status === 'added') save(result.doc);
			return result.status;
		},
		removeEntry(id: string, ref: EntryRef, hymnIdOf: HymnIdOf) {
			const next = removeEntry(current(), id, ref, hymnIdOf, now());
			if (next !== current()) save(next);
		},
		toggle(id: string, ref: EntryRef, hymnIdOf: HymnIdOf) {
			const result = toggleEntry(current(), id, ref, hymnIdOf, now());
			if (result.status !== 'no-collection') save(result.doc);
			return result.status;
		},
		move(id: string, from: number, to: number) {
			const next = moveEntry(current(), id, from, to, now());
			if (next !== current()) save(next);
		}
	};
}

export type RepertoireStore = ReturnType<typeof createRepertoireStore>;

function browserStorage(): Storage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		return undefined;
	}
}

/** The app's Répertoire. */
export const repertoire = createRepertoireStore({
	storage: browserStorage(),
	listen: typeof window !== 'undefined',
	persist: typeof navigator !== 'undefined'
});
