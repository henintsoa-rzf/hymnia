import { loadCatalog } from '$lib/data/store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const catalog = await loadCatalog(fetch);
	const hymnal = catalog.getHymnal(params.recueil);
	return {
		catalog,
		requested: params.recueil,
		hymnal,
		entries: hymnal ? catalog.listEntries(hymnal.id) : []
	};
};
