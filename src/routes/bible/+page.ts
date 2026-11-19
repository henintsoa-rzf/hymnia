import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { resolve } from '$app/paths';
import { bookByCode } from '$lib/bible/books';
import { loadBible } from '$lib/bible/store';
import { prefs } from '$lib/prefs/prefs';
import type { PageLoad } from './$types';

// Feature 015 (contracts/bible-ui.md §2.1): the Bible section reopens at the last chapter read;
// `?livres` always shows the list of books.
export const load: PageLoad = async ({ fetch, url }) => {
	const bible = await loadBible(fetch);
	const at = get(prefs).bibleAt;
	const book = at ? bookByCode(at.book) : undefined;
	if (bible && at && book && !url.searchParams.has('livres')) {
		redirect(
			307,
			resolve('/bible/[livre]/[chapitre]', { livre: book.slug, chapitre: `${at.chapter}` })
		);
	}
	return { bible };
};
