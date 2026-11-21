import { loadCatalog } from '$lib/data/store';
import type { PageLoad } from './$types';

/** The data manifest of the build, to know which files make each item (feature 016, R7). */
export const load: PageLoad = async ({ fetch }) => ({ catalog: await loadCatalog(fetch) });
