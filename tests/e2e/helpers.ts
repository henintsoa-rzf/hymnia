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
	collections: {
		name: string;
		/** An optional third item is the hymn id the entry was saved for (feature 002). */
		entries?: [hymnal: string, number: string, hymnId?: string][];
	}[]
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
			entries: (c.entries ?? []).map(([hymnal, number, hymnId]) => ({
				hymnal,
				number,
				addedAt: at,
				...(hymnId ? { hymnId } : {})
			}))
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

/**
 * Feature 011: answers `POST /api/embed` in the browser with the fake embedder of the tests
 * (the e2e data is built with HYMNIA_FAKE_EMBEDDER=1). Returns the texts posted, in order.
 */
export async function mockEmbed(
	page: Page,
	options: { delayMs?: number; status?: number } = {}
): Promise<string[]> {
	const { fakeEmbedOne } = await import('../helpers/fake-embedder');
	const { cutAndNormalize, toBase64 } = await import('../../src/lib/meaning/vector');
	const { MEANING_CONFIG } = await import('../../src/lib/meaning/config');
	const dims = MEANING_CONFIG.dims;
	const posted: string[] = [];
	await page.route('**/api/embed', async (route) => {
		const body = route.request().postDataJSON() as { text: string; configId: string };
		posted.push(body.text);
		if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
		const reply = options.status
			? { status: options.status, json: { error: 'x' } }
			: {
					json: {
						configId: body.configId,
						dims,
						vector: toBase64(cutAndNormalize(fakeEmbedOne(body.text), dims))
					}
				};
		await route.fulfill(reply).catch(() => {
			// The page was closed while the reply was delayed.
		});
	});
	return posted;
}

/** The « Par le sens » button beside the search field. */
export const meaningButton = (page: Page) => page.getByRole('button', { name: 'Par le sens' });
