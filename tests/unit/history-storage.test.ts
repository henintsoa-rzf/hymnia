// Loading and saving the history (specs/006-search-start-panel/contracts/storage.md, task T006).
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { createHistoryStore, STORAGE_KEY } from '$lib/history/store';

class MemoryStorage implements Storage {
	data = new Map<string, string>();
	failReads = false;
	failWrites = false;
	get length() {
		return this.data.size;
	}
	clear() {
		this.data.clear();
	}
	getItem(key: string) {
		if (this.failReads) throw new Error('SecurityError');
		return this.data.get(key) ?? null;
	}
	key(i: number) {
		return [...this.data.keys()][i] ?? null;
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
	setItem(key: string, value: string) {
		if (this.failWrites) throw new Error('QuotaExceededError');
		this.data.set(key, value);
	}
}

const NOW = '2026-11-14T09:00:00.000Z';
const make = (storage: Storage | undefined) => createHistoryStore({ storage, now: () => NOW });
const VALID = {
	version: 1,
	entries: [{ hymnal: 'ce', number: '1', hymnId: 'a-toi-la-gloire', openedAt: NOW }]
};

describe('loading', () => {
	it('uses a stored document', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, JSON.stringify(VALID));
		expect(get(make(storage))).toEqual(VALID);
	});

	it('loads an unreadable value as an empty history and writes nothing else', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, '{broken');
		expect(get(make(storage))).toEqual({ version: 1, entries: [] });
		expect([...storage.data.keys()]).toEqual([STORAGE_KEY]);
	});
});

describe('writing', () => {
	it('saves the whole document after each record', () => {
		const storage = new MemoryStorage();
		const store = make(storage);
		store.record({ hymnal: 'ce', number: '1' }, 'a-toi-la-gloire');
		expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(VALID);
		expect(get(store)).toEqual(VALID);
	});

	it('clears the history without touching collections or preferences', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, JSON.stringify(VALID));
		storage.setItem('hymnia.repertoire.v2', 'collections');
		storage.setItem('hymnia.prefs', 'prefs');
		const store = make(storage);
		store.clear();
		expect(get(store).entries).toEqual([]);
		expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual({ version: 1, entries: [] });
		expect(storage.getItem('hymnia.repertoire.v2')).toBe('collections');
		expect(storage.getItem('hymnia.prefs')).toBe('prefs');
	});
});

describe('storage unavailable (FR-012)', () => {
	it('keeps the history in memory and never throws', () => {
		const storage = new MemoryStorage();
		storage.failReads = true;
		storage.failWrites = true;
		const store = make(storage);
		expect(get(store).entries).toEqual([]);
		expect(() => store.record({ hymnal: 'ce', number: '1' }, 'a-toi-la-gloire')).not.toThrow();
		expect(get(store)).toEqual(VALID);
		expect(() => store.clear()).not.toThrow();
		expect(get(store).entries).toEqual([]);
	});

	it('works without any storage', () => {
		const store = make(undefined);
		store.record({ hymnal: 'ce', number: '1' }, 'a-toi-la-gloire');
		expect(get(store)).toEqual(VALID);
	});
});
