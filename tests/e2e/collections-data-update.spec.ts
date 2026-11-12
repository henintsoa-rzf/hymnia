// Feature 002, FR-027 (task T031): a saved entry follows the hymn it was saved for when a data
// update renumbers or removes it. The data update is simulated by seeding entries whose stored
// reference no longer matches their hymnId.
import { expect, test } from '@playwright/test';
import { collectionTitles, seedCollections } from './helpers';

const stored = (page: import('@playwright/test').Page) =>
	page.evaluate(() => JSON.parse(localStorage.getItem('hymnia.repertoire.v2') ?? 'null'));

test('an entry whose number now points to another hymn opens the hymn it was saved for', async ({
	page
}) => {
	// Saved as CE 3 for "À toi la gloire" — CE 3 is now "Torrents d'amour".
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '3', 'a-toi-la-gloire']] }]);
	await page.goto('/repertoire/c1');
	await expect(collectionTitles(page)).toHaveText(['À toi la gloire']);
	// Opened under its current reference, CE 1.
	await expect(page.locator('ol.collection__list li a').first()).toHaveAttribute(
		'href',
		/\/recueils\/ce\/1\b/
	);

	// The stored entry was repaired, without changing the collection's date.
	await expect
		.poll(async () => (await stored(page)).collections[0].entries[0])
		.toMatchObject({
			hymnal: 'ce',
			number: '1',
			hymnId: 'a-toi-la-gloire'
		});
	expect((await stored(page)).collections[0].updatedAt).toBe('2026-11-11T09:00:00.000Z');

	await collectionTitles(page).first().click();
	await expect(page).toHaveURL(/\/recueils\/ce\/1/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('À toi la gloire');
});

test('an entry whose hymn is no longer published is unavailable, even if its number exists', async ({
	page
}) => {
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '3', 'chant-retire']] }]);
	await page.goto('/repertoire/c1');
	const row = page.locator('ol.collection__list li').first();
	await expect(row).toContainText('Chant indisponible');
	// Never opens "Torrents d'amour", which CE 3 now points to.
	await expect(row).not.toContainText('Torrents');
	await expect(row.locator('a[href*="/recueils/"]')).toHaveCount(0);
});

test('an older entry with no hymnId gets one, and keeps its reference', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '3']] }]);
	await page.goto('/repertoire/c1');
	await expect(collectionTitles(page)).toHaveText(['Torrents d’amour et de grâce']);
	await expect
		.poll(async () => (await stored(page)).collections[0].entries[0])
		.toMatchObject({
			hymnal: 'ce',
			number: '3',
			hymnId: 'torrents-d-amour-et-de-grace'
		});
});
