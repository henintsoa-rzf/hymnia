// Collections model (specs/003-repertoire-collections/data-model.md).
import { describe, expect, it } from 'vitest';
import {
	addEntry,
	collectionsWith,
	createCollection,
	deleteCollection,
	moveEntry,
	removeEntry,
	renameCollection,
	restoreCollection,
	toggleEntry,
	validateName,
	type HymnIdOf
} from '$lib/repertoire/model';
import { EMPTY_DOC, type RepertoireDoc } from '$lib/repertoire/schema';

const T0 = '2026-11-11T09:00:00.000Z';
const T1 = '2026-11-11T10:00:00.000Z';

// CE 1 and HE 7 are the same hymn; XX 9 is unknown to the catalog.
const HYMNS: Record<string, string> = {
	'ce 1': 'a-toi-la-gloire',
	'he 7': 'a-toi-la-gloire',
	'ce 2': 'rempart',
	'ce 3': 'torrents'
};
const hymnIdOf: HymnIdOf = (ref) => HYMNS[`${ref.hymnal} ${ref.number}`];

function withCollections(...names: string[]): { doc: RepertoireDoc; ids: string[] } {
	let doc = EMPTY_DOC;
	const ids: string[] = [];
	for (const name of names) {
		const result = createCollection(doc, name, T0);
		if (!result.ok) throw new Error(result.error);
		doc = result.doc;
		ids.push(result.id);
	}
	return { doc, ids };
}

function filled(...refs: [string, string][]) {
	const { doc: start, ids } = withCollections('Culte');
	let doc = start;
	for (const [hymnal, number] of refs)
		doc = addEntry(doc, ids[0], { hymnal, number }, hymnIdOf, T0).doc;
	return { doc, id: ids[0] };
}

const numbers = (doc: RepertoireDoc, id: string) =>
	doc.collections.find((c) => c.id === id)!.entries.map((e) => `${e.hymnal} ${e.number}`);

describe('createCollection', () => {
	it('creates an empty collection with a trimmed name and dates', () => {
		const result = createCollection(EMPTY_DOC, '  Culte du 16 novembre ', T0);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.doc.collections).toHaveLength(1);
		expect(result.doc.collections[0]).toEqual({
			id: result.id,
			name: 'Culte du 16 novembre',
			createdAt: T0,
			updatedAt: T0,
			entries: []
		});
	});

	it('gives each collection its own id', () => {
		const { ids } = withCollections('A', 'B', 'C');
		expect(new Set(ids).size).toBe(3);
	});

	it.each([
		['', 'empty'],
		['   ', 'empty'],
		['x'.repeat(61), 'too-long']
	])('refuses %j (%s)', (name, error) => {
		expect(createCollection(EMPTY_DOC, name, T0)).toEqual({ ok: false, error });
	});

	it('accepts 60 characters', () => {
		expect(createCollection(EMPTY_DOC, 'x'.repeat(60), T0).ok).toBe(true);
	});

	it('refuses a name already used, ignoring case, accents and punctuation', () => {
		const { doc } = withCollections('Noël');
		for (const name of ['noel', 'NOËL', 'Noël !']) {
			expect(createCollection(doc, name, T0)).toEqual({ ok: false, error: 'taken' });
		}
	});
});

describe('renameCollection', () => {
	it('renames and updates the date', () => {
		const { doc, ids } = withCollections('Noël');
		const result = renameCollection(doc, ids[0], 'Veillée de Noël', T1);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.doc.collections[0]).toMatchObject({ name: 'Veillée de Noël', updatedAt: T1 });
	});

	it('allows the same name in another case, refuses another collection’s name', () => {
		const { doc, ids } = withCollections('Noël', 'Mariage');
		expect(renameCollection(doc, ids[0], 'NOËL', T1).ok).toBe(true);
		expect(renameCollection(doc, ids[0], 'mariage', T1)).toEqual({ ok: false, error: 'taken' });
		expect(renameCollection(doc, ids[0], '', T1)).toEqual({ ok: false, error: 'empty' });
	});

	it('validateName ignores the collection being renamed', () => {
		const { doc, ids } = withCollections('Noël');
		expect(validateName(doc, 'noel', ids[0])).toEqual({ ok: true, name: 'noel' });
		expect(validateName(doc, 'noel')).toEqual({ ok: false, error: 'taken' });
	});
});

describe('entries', () => {
	it('adds hymns at the end, with the date', () => {
		const { doc, id } = filled(['ce', '2'], ['ce', '1']);
		expect(numbers(doc, id)).toEqual(['ce 2', 'ce 1']);
		const result = addEntry(doc, id, { hymnal: 'ce', number: '3' }, hymnIdOf, T1);
		expect(result.status).toBe('added');
		expect(result.doc.collections[0].entries.at(-1)).toEqual({
			hymnal: 'ce',
			number: '3',
			addedAt: T1
		});
		expect(result.doc.collections[0].updatedAt).toBe(T1);
	});

	it('keeps one entry per hymn, whatever the reference', () => {
		const { doc, id } = filled(['ce', '1']);
		const again = addEntry(doc, id, { hymnal: 'he', number: '7' }, hymnIdOf, T1);
		expect(again.status).toBe('already-there');
		expect(again.doc).toBe(doc);
	});

	it('compares references when the catalog does not know the hymn', () => {
		const { doc, id } = filled(['xx', '9']);
		expect(addEntry(doc, id, { hymnal: 'xx', number: '9' }, hymnIdOf, T1).status).toBe(
			'already-there'
		);
		expect(addEntry(doc, id, { hymnal: 'xx', number: '10' }, hymnIdOf, T1).status).toBe('added');
	});

	it('removes a hymn, under its reference or another one', () => {
		const { doc, id } = filled(['ce', '1'], ['ce', '2']);
		expect(numbers(removeEntry(doc, id, { hymnal: 'ce', number: '2' }, hymnIdOf, T1), id)).toEqual([
			'ce 1'
		]);
		expect(numbers(removeEntry(doc, id, { hymnal: 'he', number: '7' }, hymnIdOf, T1), id)).toEqual([
			'ce 2'
		]);
	});

	it('toggles a hymn in and out', () => {
		const { doc, id } = filled();
		const added = toggleEntry(doc, id, { hymnal: 'ce', number: '1' }, hymnIdOf, T0);
		expect(added.status).toBe('added');
		const removed = toggleEntry(added.doc, id, { hymnal: 'he', number: '7' }, hymnIdOf, T1);
		expect(removed.status).toBe('removed');
		expect(numbers(removed.doc, id)).toEqual([]);
	});

	it('moves a hymn and ignores moves out of range', () => {
		const { doc, id } = filled(['ce', '1'], ['ce', '2'], ['ce', '3']);
		expect(numbers(moveEntry(doc, id, 2, 0, T1), id)).toEqual(['ce 3', 'ce 1', 'ce 2']);
		expect(numbers(moveEntry(doc, id, 0, 2, T1), id)).toEqual(['ce 2', 'ce 3', 'ce 1']);
		expect(moveEntry(doc, id, 0, 3, T1)).toBe(doc);
		expect(moveEntry(doc, id, -1, 0, T1)).toBe(doc);
	});
});

describe('deleting', () => {
	it('deletes a collection and restores it in place', () => {
		const { doc: start, ids } = withCollections('A', 'B', 'C');
		const doc = addEntry(start, ids[1], { hymnal: 'ce', number: '1' }, hymnIdOf, T0).doc;
		const { doc: after, removed } = deleteCollection(doc, ids[1]);
		expect(after.collections.map((c) => c.name)).toEqual(['A', 'C']);
		const restored = restoreCollection(after, removed!);
		expect(restored).toEqual(doc);
	});

	it('does not restore twice', () => {
		const { doc, ids } = withCollections('A');
		const { doc: after, removed } = deleteCollection(doc, ids[0]);
		const once = restoreCollection(after, removed!);
		expect(restoreCollection(once, removed!)).toBe(once);
	});

	it('never changes the other collections', () => {
		const { doc: start, ids } = withCollections('A', 'B');
		const doc = addEntry(start, ids[0], { hymnal: 'ce', number: '1' }, hymnIdOf, T0).doc;
		const after = deleteCollection(doc, ids[1]).doc;
		expect(after.collections[0]).toBe(doc.collections[0]);
	});
});

describe('collectionsWith', () => {
	it('finds every collection holding the hymn under any reference', () => {
		const { doc: start, ids } = withCollections('A', 'B', 'C');
		let doc = addEntry(start, ids[0], { hymnal: 'ce', number: '1' }, hymnIdOf, T0).doc;
		doc = addEntry(doc, ids[2], { hymnal: 'he', number: '7' }, hymnIdOf, T0).doc;
		expect(collectionsWith(doc, { hymnal: 'he', number: '7' }, hymnIdOf)).toEqual([ids[0], ids[2]]);
		expect(collectionsWith(doc, { hymnal: 'ce', number: '2' }, hymnIdOf)).toEqual([]);
	});
});

describe('immutability', () => {
	it('never changes the document it is given', () => {
		const { doc, id } = filled(['ce', '1'], ['ce', '2']);
		const snapshot = structuredClone(doc);
		addEntry(doc, id, { hymnal: 'ce', number: '3' }, hymnIdOf, T1);
		removeEntry(doc, id, { hymnal: 'ce', number: '1' }, hymnIdOf, T1);
		moveEntry(doc, id, 1, 0, T1);
		renameCollection(doc, id, 'Autre', T1);
		deleteCollection(doc, id);
		expect(doc).toEqual(snapshot);
	});
});
