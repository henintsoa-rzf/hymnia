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
