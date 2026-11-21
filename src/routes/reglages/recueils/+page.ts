import { loadCatalog } from '$lib/data/store';
import type { PageLoad } from './$types';

/** The hymnals and their parts (feature 014), now in their own section (feature 016). */
export const load: PageLoad = async ({ fetch }) => ({ catalog: await loadCatalog(fetch) });
