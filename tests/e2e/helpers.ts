import { expect, type Page } from '@playwright/test';

/** The search field of the first screen. */
export const searchField = (page: Page) =>
	page.getByRole('searchbox', { name: 'Rechercher par numéro, titre ou paroles' });

/** Type a query and wait until results or a message are shown. */
export async function search(page: Page, query: string) {
	await searchField(page).fill(query);
	await expect(page).toHaveURL(
		new RegExp(`q=${encodeURIComponent(query).replace(/%20/g, '(%20|\\+)')}`)
	);
}

/** The list of text or number results. */
export const results = (page: Page) => page.locator('main .hy-result');

/** Collections to start with (feature 003). Only seeded when the browser has none yet. */
export async function seedCollections(
	page: Page,
	collections: { name: string; entries?: [hymnal: string, number: string][] }[]
) {
	const at = '2026-11-11T09:00:00.000Z';
	const doc = {
		version: 2,
		collections: collections.map((c, i) => ({
			id: `c${i + 1}`,
			name: c.name,
			createdAt: at,
			// Later collections are "more recent": they come first in the Répertoire.
			updatedAt: `2026-11-11T09:0${i}:00.000Z`,
			entries: (c.entries ?? []).map(([hymnal, number]) => ({ hymnal, number, addedAt: at }))
		}))
	};
	await page.addInitScript((json) => {
		if (!localStorage.getItem('hymnia.repertoire.v2')) {
			localStorage.setItem('hymnia.repertoire.v2', json);
		}
	}, JSON.stringify(doc));
}

/** Titles of the hymns of the open collection, in order (use with `toHaveText([...])`). */
export const collectionTitles = (page: Page) => page.locator('ol.collection__list .hb-item__title');
