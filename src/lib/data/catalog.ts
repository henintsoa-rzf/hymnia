/**
 * Catalog lookups (plan.md, T018). `createCatalog` is pure so it can be used in the browser,
 * in the search worker and in Node tests. `fetchData` loads the build output.
 */
import { compareSortKeys, normalizeNumber } from '../domain/numbering';
import type {
	Catalog,
	DataManifest,
	PublishedEntry,
	PublishedHymn,
	PublishedHymnal
} from '../domain/schema';

export type EntryRef = { hymn: PublishedHymn; entry: PublishedEntry };

export type CatalogApi = {
	version: string;
	getHymnals(): PublishedHymnal[];
	getHymnal(id: string): PublishedHymnal | undefined;
	getHymn(id: string): PublishedHymn | undefined;
	/** Number as typed or printed: "12 bis" and "12bis" find the same entry. */
	getEntry(hymnalId: string, number: string): EntryRef | undefined;
	/** All entries of a hymnal, in number order. */
	listEntries(hymnalId: string): EntryRef[];
	neighbours(hymnalId: string, number: string): { previous?: EntryRef; next?: EntryRef };
};

export function createCatalog(catalog: Catalog): CatalogApi {
	const hymnals = new Map(catalog.hymnals.map((h) => [h.id, h]));
	const hymns = new Map(catalog.hymns.map((h) => [h.id, h]));
	const byHymnal = new Map<string, EntryRef[]>();
	const byNumber = new Map<string, EntryRef>();

	for (const hymn of catalog.hymns) {
		for (const entry of hymn.entries) {
			const ref = { hymn, entry };
			const list = byHymnal.get(entry.hymnal) ?? [];
			list.push(ref);
			byHymnal.set(entry.hymnal, list);
			byNumber.set(`${entry.hymnal} ${normalizeNumber(entry.number)}`, ref);
		}
	}
	for (const list of byHymnal.values()) {
		list.sort((a, b) => compareSortKeys(a.entry.sortKey, b.entry.sortKey));
	}

	const listEntries = (hymnalId: string) => byHymnal.get(hymnalId) ?? [];

	return {
		version: catalog.version,
		getHymnals: () => catalog.hymnals,
		getHymnal: (id) => hymnals.get(id),
		getHymn: (id) => hymns.get(id),
		getEntry: (hymnalId, number) => byNumber.get(`${hymnalId} ${normalizeNumber(number)}`),
		listEntries,
		neighbours(hymnalId, number) {
			const list = listEntries(hymnalId);
			const key = normalizeNumber(number);
			const i = list.findIndex((r) => normalizeNumber(r.entry.number) === key);
			if (i < 0) return {};
			return { previous: list[i - 1], next: list[i + 1] };
		}
	};
}

export type LoadedData = { manifest: DataManifest; catalog: Catalog; indexJson: string };

function getter(base: string, fetchFn: typeof fetch) {
	return async (path: string) => {
		const response = await fetchFn(`${base}/data/${path}`);
		if (!response.ok) throw new Error(`Cannot load ${path}: HTTP ${response.status}`);
		return response.text();
	};
}

/** Load the build output from `<base>/data/`: catalog and search index (search worker). */
export async function fetchData(base: string, fetchFn: typeof fetch = fetch): Promise<LoadedData> {
	const get = getter(base, fetchFn);
	const manifest: DataManifest = JSON.parse(await get('manifest.json'));
	const [catalogText, indexJson] = await Promise.all([get(manifest.catalog), get(manifest.index)]);
	return { manifest, catalog: JSON.parse(catalogText), indexJson };
}

/** Load the catalog only (screens). */
export async function fetchCatalog(base: string, fetchFn: typeof fetch = fetch): Promise<Catalog> {
	const get = getter(base, fetchFn);
	const manifest: DataManifest = JSON.parse(await get('manifest.json'));
	return JSON.parse(await get(manifest.catalog));
}
