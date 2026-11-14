// Feature 006, User Story 3: learn how to search on a first visit (spec.md, US3; contracts/ui.md).
// Examples come from the sample hymnals: « CE 1 », « Torrents d’amour et de grâce »,
// « Une invincible armure ».
import { expect, test, type Page } from '@playwright/test';
import { searchField, seedCollections } from './helpers';

const block = (page: Page) => page.getByRole('region', { name: 'Essayez' });

test('1. a first visit shows three example searches', async ({ page }) => {
	await page.goto('/');
	await expect(block(page).getByRole('button')).toHaveText([
		'CE 1',
		'Torrents d’amour et de grâce',
		'Une invincible armure'
	]);
});

test('2. an example fills the field and runs the search', async ({ page }) => {
	await page.goto('/');
	for (const query of ['CE 1', 'Torrents d’amour et de grâce', 'Une invincible armure']) {
		await block(page)
			.getByRole('button', { name: `Rechercher ${query}` })
			.click();
		await expect(searchField(page)).toHaveValue(query);
		await expect(searchField(page)).toBeFocused();
		await expect(page).toHaveURL(/\?q=/);
		await expect(page.locator('main .hy-result, main .hy-exact').first()).toBeVisible();
		await searchField(page).fill('');
		await expect(block(page)).toBeVisible();
	}
});

test('3. browser back returns to the empty screen', async ({ page }) => {
	await page.goto('/');
	await block(page).getByRole('button', { name: 'Rechercher CE 1' }).click();
	await expect(page).toHaveURL(/\?q=CE/);
	await page.goto('/recueils/ce/1');
	await page.goBack();
	await expect(searchField(page)).toHaveValue('CE 1');
});

test('4. after opening a hymn, the examples are gone', async ({ page }) => {
	await page.goto('/recueils/ce/1');
	await expect(page.locator('main h1')).toBeVisible();
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Récemment consultés' })).toBeVisible();
	await expect(block(page)).toHaveCount(0);
});

test('5. with a collection and no history, the examples are gone', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte' }]);
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Collections' })).toBeVisible();
	await expect(block(page)).toHaveCount(0);
});

test('6. the help sentence takes its number from the loaded hymnals', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.search__help')).toContainText('CE 1');
	await expect(page.locator('.search__help')).not.toContainText('CE 12');
});
