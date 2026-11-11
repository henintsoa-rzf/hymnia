import { loadCatalog } from '$lib/data/store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => ({ catalog: await loadCatalog(fetch) });
