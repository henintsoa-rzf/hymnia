// A hymn printed twice in the same hymnal (variants such as AdF 299 and 299A, feature 002).
// Its references used to be keyed by hymnal alone: the duplicate key crashed the results list,
// and the search stopped answering until the page was reloaded.
import { expect, test } from '@playwright/test';
import { results, searchField } from './helpers';

// The service worker would answer the data requests before page.route sees them.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
	// Give "À toi la gloire" (CE 1, HE 7) a variant CE 1A.
	await page.route('**/data/catalog.*.json', async (route) => {
		const response = await route.fetch();
		const catalog = await response.json();
		const hymn = catalog.hymns.find((h: { id: string }) => h.id === 'a-toi-la-gloire');
		hymn.entries.splice(1, 0, { hymnal: 'ce', number: '1A', sortKey: [1, 'a'] });
		await route.fulfill({ response, json: catalog });
	});
});

test('typing a title letter by letter still finds the hymn', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');

	// The first letter alone lists the hymn with both of its CE references.
	await searchField(page).pressSequentially('a');
	await expect(results(page).first()).toContainText('À toi la gloire');
	await searchField(page).pressSequentially(' toi la gloire', { delay: 30 });

	await expect(page).toHaveURL(/q=a(%20|\+)toi(%20|\+)la(%20|\+)gloire/);
	const first = results(page).first();
	await expect(first).toContainText('À toi la gloire');
	await expect(first.locator('.hy-ref')).toHaveText(['CE 1', 'CE 1A', 'HE 7']);
	expect(errors).toEqual([]);
});

test('the hymn page lists the other variant of the same hymnal', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/recueils/he/7');

	const others = page.getByRole('region', { name: 'Aussi dans' }).locator('.hy-ref');
	await expect(others).toHaveText(['CE 1', 'CE 1A']);
	expect(errors).toEqual([]);
});
