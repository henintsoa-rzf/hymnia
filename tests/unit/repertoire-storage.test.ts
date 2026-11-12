// Loading and saving the Répertoire (specs/003-repertoire-collections/contracts/storage.md).
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { CORRUPT_PREFIX, createRepertoireStore, STORAGE_KEY } from '$lib/repertoire/store';
import type { HymnIdOf } from '$lib/repertoire/model';

class MemoryStorage implements Storage {
	data = new Map<string, string>();
	failWrites = false;
	get length() {
		return this.data.size;
	}
	clear() {
		this.data.clear();
	}
	getItem(key: string) {
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

const NOW = '2026-11-11T09:00:00.000Z';
const hymnIdOf: HymnIdOf = (ref) => `${ref.hymnal}-${ref.number}`;
const make = (storage: Storage | undefined) =>
	createRepertoireStore({ storage, now: () => NOW, listen: false, persist: false });

const VALID = {
	version: 2,
	collections: [
		{
			id: 'c1',
			name: 'Culte',
			createdAt: NOW,
			updatedAt: NOW,
			entries: [{ hymnal: 'ce', number: '1', addedAt: NOW }]
		}
	]
};

describe('loading', () => {
	it('uses a valid document as it is', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, JSON.stringify(VALID));
		const store = make(storage);
		expect(get(store)).toEqual(VALID);
		expect(get(store.notice)).toBeNull();
	});

	it('loads a version 2 document whose entries have no hymnId, unchanged', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, JSON.stringify(VALID));
		expect(get(make(storage))).toEqual(VALID);
		expect(get(make(storage)).collections[0].entries[0]).not.toHaveProperty('hymnId');
	});

	it('loads and saves entries with a hymnId (feature 002, FR-027)', () => {
		const storage = new MemoryStorage();
		const withId = structuredClone(VALID);
		Object.assign(withId.collections[0].entries[0], { hymnId: 'a-toi-la-gloire' });
		storage.setItem(STORAGE_KEY, JSON.stringify(withId));
		const store = make(storage);
		expect(get(store)).toEqual(withId);
		store.rename('c1', 'Culte du soir');
		expect(JSON.parse(storage.getItem(STORAGE_KEY)!).collections[0].entries[0].hymnId).toBe(
			'a-toi-la-gloire'
		);
	});

	it('applies repairs in one save, without changing updatedAt', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, JSON.stringify(VALID));
		const store = make(storage);
		store.applyRepairs([
			{ collectionId: 'c1', index: 0, repair: { hymnal: 'ce', number: '2', hymnId: 'rempart' } }
		]);
		const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
		expect(saved.collections[0].entries[0]).toEqual({
			hymnal: 'ce',
			number: '2',
			addedAt: NOW,
			hymnId: 'rempart'
		});
		expect(saved.collections[0].updatedAt).toBe(NOW);
	});

	it('sets an unreadable document aside and starts empty', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, '{"version": 2, "collections": [{"id": 3}]}');
		const store = make(storage);
		expect(get(store).collections).toEqual([]);
		expect(get(store.notice)).toBe('corrupt');
		const aside = [...storage.data.keys()].filter((k) => k.startsWith(CORRUPT_PREFIX));
		expect(aside).toEqual([`hymnia.repertoire.corrupt-${NOW}`]);
		expect(storage.getItem(aside[0])).toBe('{"version": 2, "collections": [{"id": 3}]}');
	});

	it('sets an unreadable document aside only once', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, 'not json');
		expect(get(make(storage).notice)).toBe('corrupt');
		// The next launch finds no document: no second copy, no notice.
		expect(get(make(storage).notice)).toBeNull();
		const aside = [...storage.data.keys()].filter((k) => k.startsWith(CORRUPT_PREFIX));
		expect(aside).toHaveLength(1);
	});

	it('sets aside text that is not JSON', () => {
		const storage = new MemoryStorage();
		storage.setItem(STORAGE_KEY, 'not json');
		expect(get(make(storage).notice)).toBe('corrupt');
	});

	it('starts empty and ignores the single list of feature 001', () => {
		const storage = new MemoryStorage();
		storage.setItem('hymnia.repertoire', JSON.stringify([{ hymnal: 'ce', number: '1' }]));
		const store = make(storage);
		expect(get(store).collections).toEqual([]);
		expect(storage.getItem('hymnia.repertoire')).not.toBeNull();
	});
});

describe('saving', () => {
	it('writes the whole document after each change', () => {
		const storage = new MemoryStorage();
		const store = make(storage);
		const created = store.create('Culte');
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		store.add(created.id, { hymnal: 'ce', number: '1' }, hymnIdOf);
		const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
		expect(saved.version).toBe(2);
		expect(saved.collections[0].entries).toEqual([
			{ hymnal: 'ce', number: '1', addedAt: NOW, hymnId: 'ce-1' }
		]);
		// A new store reads the same document.
		expect(get(make(storage))).toEqual(saved);
	});

	it('keeps changes in memory when storage refuses them', () => {
		const storage = new MemoryStorage();
		storage.failWrites = true;
		const store = make(storage);
		expect(store.create('Culte').ok).toBe(true);
		expect(get(store).collections).toHaveLength(1);
		expect(get(store.notice)).toBe('unavailable');
	});

	it('shows the "unavailable" notice once per visit', () => {
		const storage = new MemoryStorage();
		storage.failWrites = true;
		const store = make(storage);
		expect(store.create('Culte').ok).toBe(true);
		expect(get(store.notice)).toBe('unavailable');
		store.dismissNotice();
		expect(store.create('Chorale').ok).toBe(true);
		expect(get(store.notice)).toBeNull();
	});

	it('works without any storage', () => {
		const store = make(undefined);
		expect(store.create('Culte').ok).toBe(true);
		expect(get(store.notice)).toBe('unavailable');
	});

	it('offers to undo a deletion', () => {
		const storage = new MemoryStorage();
		const store = make(storage);
		const created = store.create('Culte');
		if (!created.ok) throw new Error();
		store.remove(created.id);
		expect(get(store).collections).toEqual([]);
		expect(get(store.lastDeleted)?.name).toBe('Culte');
		get(store.lastDeleted)!.undo();
		expect(get(store).collections.map((c) => c.id)).toEqual([created.id]);
		expect(get(store.lastDeleted)).toBeNull();
	});
});
