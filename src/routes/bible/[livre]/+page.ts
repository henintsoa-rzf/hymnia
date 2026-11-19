import { bookBySlug } from '$lib/bible/books';
import { loadBible } from '$lib/bible/store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => ({
	bible: await loadBible(fetch),
	book: bookBySlug(params.livre),
	slug: params.livre
});
