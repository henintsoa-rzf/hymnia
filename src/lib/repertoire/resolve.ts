/**
 * Links collection entries to the hymn data (specs/003-repertoire-collections/data-model.md,
 * "Resolving an entry"; feature 002 FR-027).
 *
 * An entry remembers the hymn it was saved for (`hymnId`). When a data update renumbers or
 * merges that hymn, the entry follows it; when the hymn is no longer published, the entry is
 * unavailable. An entry is never resolved to a different hymn. Resolution reports the changes
 * to store (`repair`) but does not store them: see `collectRepairs` and the store's
 * `applyRepairs`.
 */
import type { CatalogApi } from '../data/catalog';
import type { PublishedHymn, PublishedHymnal } from '../domain/schema';
import type { CollectionRepair, HymnIdOf, Repair } from './model';
import type { Collection, CollectionEntry, HymnRef } from './schema';

export function hymnIdOf(catalog: CatalogApi): HymnIdOf {
	return (ref) =>
		ref.hymnId !== undefined
			? catalog.resolveHymnId(ref.hymnId)
			: catalog.getEntry(ref.hymnal, ref.number)?.hymn.id;
}

export type ResolvedEntry<E extends HymnRef = CollectionEntry> = {
	/** The entry as it should be shown and linked (with any repair applied). */
	entry: E;
	index: number;
	hymn?: PublishedHymn;
	hymnal?: PublishedHymnal;
	available: boolean;
	/** What must change in the stored entry, when something must. */
	repair?: Repair;
};

/**
 * Resolves one stored reference (a collection entry, or a history entry in feature 006). The
 * entry keeps its other fields; only `hymnal`, `number` and `hymnId` may change.
 */
export function resolveEntry<E extends HymnRef>(
	catalog: CatalogApi,
	entry: E,
	index = 0
): ResolvedEntry<E> {
	const byRef = catalog.getEntry(entry.hymnal, entry.number);
	const result = (e: E, hymn?: PublishedHymn, repair?: Repair): ResolvedEntry<E> => ({
		entry: e,
		index,
		hymn,
		hymnal: catalog.getHymnal(e.hymnal),
		available: hymn !== undefined,
		...(repair ? { repair } : {})
	});

	// Older entry, saved before entries remembered their hymn: the reference decides.
	if (entry.hymnId === undefined) {
		if (!byRef) return result(entry);
		const repair = { hymnal: entry.hymnal, number: entry.number, hymnId: byRef.hymn.id };
		return result({ ...entry, ...repair }, byRef.hymn, repair);
	}

	const currentId = catalog.resolveHymnId(entry.hymnId);
	const hymn = catalog.getHymn(currentId);
	// Not published (rights withdrawn, unknown): unavailable, whatever the number points to now.
	if (!hymn) return result(entry);

	if (byRef?.hymn.id === hymn.id) {
		if (currentId === entry.hymnId) return result(entry, hymn);
		const repair = { hymnal: entry.hymnal, number: entry.number, hymnId: currentId };
		return result({ ...entry, ...repair }, hymn, repair);
	}

	// Renumbered, or merged into a hymn with other numbers: open it under its entry in the same
	// hymnal if it has one, otherwise its first entry.
	const target = hymn.entries.find((e) => e.hymnal === entry.hymnal) ?? hymn.entries[0];
	const repair = { hymnal: target.hymnal, number: target.number, hymnId: currentId };
	return result({ ...entry, ...repair }, hymn, repair);
}

export function resolveEntries(catalog: CatalogApi, collection: Collection): ResolvedEntry[] {
	return collection.entries.map((entry, index) => resolveEntry(catalog, entry, index));
}

/** Every repair needed across the Répertoire, for one save (`applyRepairs`). */
export function collectRepairs(catalog: CatalogApi, collections: Collection[]): CollectionRepair[] {
	return collections.flatMap((c) =>
		resolveEntries(catalog, c).flatMap((row) =>
			row.repair ? [{ collectionId: c.id, index: row.index, repair: row.repair }] : []
		)
	);
}
