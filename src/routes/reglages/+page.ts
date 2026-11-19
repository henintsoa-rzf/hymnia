import { loadCatalog } from '$lib/data/store';
import type { PageLoad } from './$types';

/** The hymnals and their parts, for the « Recueils » subsection (feature 014). */
export const load: PageLoad = async ({ fetch }) => ({ catalog: await loadCatalog(fetch) });
