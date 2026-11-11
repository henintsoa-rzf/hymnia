import { loadCatalog } from '$lib/data/store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const catalog = await loadCatalog(fetch);
	const hymnal = catalog.getHymnal(params.recueil);
	const found = hymnal ? catalog.getEntry(hymnal.id, params.numero) : undefined;
	const { previous, next } = found ? catalog.neighbours(hymnal!.id, found.entry.number) : {};
	return {
		hymnals: new Map(catalog.getHymnals().map((h) => [h.id, h])),
		requested: { hymnal: params.recueil, number: params.numero },
		hymnal,
		found,
		previous,
		next,
		siblings: hymnal ? catalog.listEntries(hymnal.id) : []
	};
};
