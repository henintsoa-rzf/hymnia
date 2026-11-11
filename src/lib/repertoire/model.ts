/**
 * Collections: pure operations (specs/003-repertoire-collections/data-model.md, "Operations").
 * Every operation returns a new document and never changes the one it is given. Hymn identity
 * comes from `hymnIdOf`, so this module needs no hymn data and is easy to test.
 */
import { normalizeNumber } from '../domain/numbering';
import { normalizeText } from '../search/normalize';
import {
	RepertoireDocSchema,
	type Collection,
	type CollectionEntry,
	type EntryRef,
	type RepertoireDoc
} from './schema';

export const NAME_MAX_LENGTH = 60;

/** Resolves a reference to its hymn id, or undefined when the catalog does not know it. */
export type HymnIdOf = (ref: EntryRef) => string | undefined;

export type NameError = 'empty' | 'too-long' | 'taken';
export type NameResult = { ok: true; name: string } | { ok: false; error: NameError };
export type DocResult = { ok: true; doc: RepertoireDoc } | { ok: false; error: NameError };
export type Removed = { collection: Collection; index: number };

export function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const nameKey = (name: string) => normalizeText(name).replace(/ /g, '');

/** Name rules: trimmed, 1–60 characters, unique ignoring case, accents and punctuation. */
export function validateName(doc: RepertoireDoc, name: string, exceptId?: string): NameResult {
	const trimmed = name.trim();
	if (trimmed === '') return { ok: false, error: 'empty' };
	if ([...trimmed].length > NAME_MAX_LENGTH) return { ok: false, error: 'too-long' };
	const key = nameKey(trimmed);
	if (doc.collections.some((c) => c.id !== exceptId && nameKey(c.name) === key)) {
		return { ok: false, error: 'taken' };
	}
	return { ok: true, name: trimmed };
}

function update(
	doc: RepertoireDoc,
	id: string,
	change: (collection: Collection) => Collection
): RepertoireDoc {
	const index = doc.collections.findIndex((c) => c.id === id);
	if (index < 0) return doc;
	const collections = [...doc.collections];
	collections[index] = change(collections[index]);
	return { ...doc, collections };
}

export function createCollection(
	doc: RepertoireDoc,
	name: string,
	now: string,
	id: string = newId()
): { ok: true; doc: RepertoireDoc; id: string } | { ok: false; error: NameError } {
	const checked = validateName(doc, name);
	if (!checked.ok) return checked;
	const collection: Collection = {
		id,
		name: checked.name,
		createdAt: now,
		updatedAt: now,
		entries: []
	};
	return { ok: true, id, doc: { ...doc, collections: [...doc.collections, collection] } };
}

export function renameCollection(
	doc: RepertoireDoc,
	id: string,
	name: string,
	now: string
): DocResult {
	const checked = validateName(doc, name, id);
	if (!checked.ok) return checked;
	return { ok: true, doc: update(doc, id, (c) => ({ ...c, name: checked.name, updatedAt: now })) };
}

export function deleteCollection(
	doc: RepertoireDoc,
	id: string
): { doc: RepertoireDoc; removed?: Removed } {
	const index = doc.collections.findIndex((c) => c.id === id);
	if (index < 0) return { doc };
	return {
		doc: { ...doc, collections: doc.collections.filter((c) => c.id !== id) },
		removed: { collection: doc.collections[index], index }
	};
}

/** Puts a deleted collection back at its place, with the same id. No-op if it is there. */
export function restoreCollection(doc: RepertoireDoc, removed: Removed): RepertoireDoc {
	if (doc.collections.some((c) => c.id === removed.collection.id)) return doc;
	const collections = [...doc.collections];
	collections.splice(Math.min(removed.index, collections.length), 0, removed.collection);
	return { ...doc, collections };
}

const sameRef = (a: EntryRef, b: EntryRef) =>
	a.hymnal === b.hymnal && normalizeNumber(a.number) === normalizeNumber(b.number);

/** Same hymn: by hymn id when both are known, otherwise by reference. */
export function sameHymn(a: EntryRef, b: EntryRef, hymnIdOf: HymnIdOf): boolean {
	const idA = hymnIdOf(a);
	const idB = hymnIdOf(b);
	return idA !== undefined && idB !== undefined ? idA === idB : sameRef(a, b);
}

function find(doc: RepertoireDoc, id: string) {
	return doc.collections.find((c) => c.id === id);
}

export function hasHymn(collection: Collection, ref: EntryRef, hymnIdOf: HymnIdOf): boolean {
	return collection.entries.some((e) => sameHymn(e, ref, hymnIdOf));
}

export function addEntry(
	doc: RepertoireDoc,
	id: string,
	ref: EntryRef,
	hymnIdOf: HymnIdOf,
	now: string
): { doc: RepertoireDoc; status: 'added' | 'already-there' | 'no-collection' } {
	const collection = find(doc, id);
	if (!collection) return { doc, status: 'no-collection' };
	if (hasHymn(collection, ref, hymnIdOf)) return { doc, status: 'already-there' };
	const entry: CollectionEntry = { hymnal: ref.hymnal, number: ref.number, addedAt: now };
	return {
		status: 'added',
		doc: update(doc, id, (c) => ({ ...c, entries: [...c.entries, entry], updatedAt: now }))
	};
}

/** Removes the hymn, whatever the reference it was added with. */
export function removeEntry(
	doc: RepertoireDoc,
	id: string,
	ref: EntryRef,
	hymnIdOf: HymnIdOf,
	now: string
): RepertoireDoc {
	const collection = find(doc, id);
	if (!collection || !hasHymn(collection, ref, hymnIdOf)) return doc;
	return update(doc, id, (c) => ({
		...c,
		entries: c.entries.filter((e) => !sameHymn(e, ref, hymnIdOf)),
		updatedAt: now
	}));
}

export function toggleEntry(
	doc: RepertoireDoc,
	id: string,
	ref: EntryRef,
	hymnIdOf: HymnIdOf,
	now: string
): { doc: RepertoireDoc; status: 'added' | 'removed' | 'no-collection' } {
	const collection = find(doc, id);
	if (!collection) return { doc, status: 'no-collection' };
	if (hasHymn(collection, ref, hymnIdOf)) {
		return { doc: removeEntry(doc, id, ref, hymnIdOf, now), status: 'removed' };
	}
	return { doc: addEntry(doc, id, ref, hymnIdOf, now).doc, status: 'added' };
}

export function moveEntry(
	doc: RepertoireDoc,
	id: string,
	from: number,
	to: number,
	now: string
): RepertoireDoc {
	const collection = find(doc, id);
	const size = collection?.entries.length ?? 0;
	if (!collection || from === to || from < 0 || to < 0 || from >= size || to >= size) return doc;
	return update(doc, id, (c) => {
		const entries = [...c.entries];
		const [moved] = entries.splice(from, 1);
		entries.splice(to, 0, moved);
		return { ...c, entries, updatedAt: now };
	});
}

/** Ids of the collections that hold this hymn, under any reference. */
export function collectionsWith(doc: RepertoireDoc, ref: EntryRef, hymnIdOf: HymnIdOf): string[] {
	return doc.collections.filter((c) => hasHymn(c, ref, hymnIdOf)).map((c) => c.id);
}

/** Most recently changed first (FR-001). */
export function byUpdatedDesc(collections: Collection[]): Collection[] {
	return [...collections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Reads the stored text: `null` gives an empty Répertoire; anything invalid is `corrupt`. */
export function parseDocument(
	raw: string | null
): { ok: true; doc: RepertoireDoc } | { ok: false } {
	if (raw === null) return { ok: true, doc: { version: 2, collections: [] } };
	try {
		const parsed = RepertoireDocSchema.safeParse(JSON.parse(raw));
		if (!parsed.success) return { ok: false };
		const ids = new Set(parsed.data.collections.map((c) => c.id));
		return ids.size === parsed.data.collections.length
			? { ok: true, doc: parsed.data }
			: { ok: false };
	} catch {
		return { ok: false };
	}
}
