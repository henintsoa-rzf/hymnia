import { loadCatalog } from '$lib/data/store';
import { loadBible } from '$lib/bible/store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const [catalog, bible] = await Promise.all([loadCatalog(fetch), loadBible(fetch)]);
	return { catalog, bible };
};
