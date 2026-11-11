/**
 * Links collection entries to the hymn data (data-model.md, "Derived at runtime"). An entry
 * whose reference no longer resolves is "unavailable": kept, shown, removable, never resolved
 * to another hymn.
 */
import type { CatalogApi } from '../data/catalog';
import type { PublishedHymn, PublishedHymnal } from '../domain/schema';
import type { HymnIdOf } from './model';
import type { Collection, CollectionEntry } from './schema';

export function hymnIdOf(catalog: CatalogApi): HymnIdOf {
	return (ref) => catalog.getEntry(ref.hymnal, ref.number)?.hymn.id;
}

export type ResolvedEntry = {
	entry: CollectionEntry;
	index: number;
	hymn?: PublishedHymn;
	hymnal?: PublishedHymnal;
	available: boolean;
};

export function resolveEntries(catalog: CatalogApi, collection: Collection): ResolvedEntry[] {
	return collection.entries.map((entry, index) => {
		const found = catalog.getEntry(entry.hymnal, entry.number);
		return {
			entry,
			index,
			hymn: found?.hymn,
			hymnal: catalog.getHymnal(entry.hymnal),
			available: found !== undefined
		};
	});
}
