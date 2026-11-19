import { bookBySlug } from '$lib/bible/books';
import { loadBible } from '$lib/bible/store';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const bible = await loadBible(fetch);
	const book = bookBySlug(params.livre);
	const chapter = /^\d+$/.test(params.chapitre) ? Number(params.chapitre) : NaN;
	const verses = book && bible ? bible.chapter(book.code, chapter) : undefined;
	return { bible, book, chapter, verses, requested: `${params.livre} ${params.chapitre}` };
};
