/**
 * The catalog for the screens, loaded once per visit from `static/data/` (the search index stays
 * in the worker). Works offline once the files are cached (FR-018).
 */
import { base } from '$app/paths';
import { createCatalog, fetchCatalog, type CatalogApi } from './catalog';

let catalog: Promise<CatalogApi> | undefined;

export function loadCatalog(fetchFn: typeof fetch = fetch): Promise<CatalogApi> {
	catalog ??= fetchCatalog(base, fetchFn)
		.then(createCatalog)
		.catch((error) => {
			catalog = undefined; // try again on the next navigation
			throw error;
		});
	return catalog;
}
