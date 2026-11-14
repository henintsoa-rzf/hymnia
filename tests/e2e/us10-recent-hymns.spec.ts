// Feature 006, User Story 1: reopen a recently viewed hymn (spec.md, US1; contracts/ui.md).
import { expect, test, type Page } from '@playwright/test';
import { searchField, seedCollections } from './helpers';

const recent = (page: Page) => page.getByRole('region', { name: 'Récemment consultés' });
const rows = (page: Page) => recent(page).getByRole('listitem');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(page.locator('main h1')).toBeVisible();
}

test('1. opened hymns are listed newest first, and open on tap', async ({ page }) => {
	await open(page, '/recueils/ce/1');
	await page.goto('/recueils/ce');
	await page.locator('main a[href$="/recueils/ce/2"]').click();
	await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
	await page.goto('/');
	await expect(rows(page)).toHaveCount(2);
	await expect(rows(page).nth(0)).toContainText('CE 2');
	await expect(rows(page).nth(0)).toContainText('C’est un rempart que notre Dieu');
	await expect(rows(page).nth(1)).toContainText('CE 1');
	await expect(rows(page).nth(1)).toContainText('À toi la gloire');
	await rows(page).nth(1).getByRole('link').click();
	await expect(page).toHaveURL(/\/recueils\/ce\/1$/);
});

test('2. a hymn opened again moves to the top and is listed once', async ({ page }) => {
	await open(page, '/recueils/ce/1');
	await open(page, '/recueils/ce/2');
	await open(page, '/recueils/he/7'); // the same hymn as CE 1
	await page.goto('/');
	await expect(rows(page)).toHaveCount(2);
	await expect(rows(page).nth(0)).toContainText('HE 7');
	await expect(rows(page).nth(1)).toContainText('CE 2');
});

test('3. at most 8 hymns are shown', async ({ page }) => {
	for (const n of ['1', '2', '3', '5', '7', '8', '12', '12a', '20', '23']) {
		await open(page, `/recueils/ce/${n}`);
	}
	await page.goto('/');
	await expect(rows(page)).toHaveCount(8);
	await expect(rows(page).nth(0)).toContainText('CE 23');
});

test('4. the next hymn, opened from the reading bar, is recorded', async ({ page }) => {
	await open(page, '/recueils/ce/1');
	await page
		.getByRole('toolbar', { name: 'Lecture' })
		.getByRole('link', { name: /Chant suivant/ })
		.click();
	await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
	await page.goto('/');
	await expect(rows(page).nth(0)).toContainText('CE 2');
});

test('5. typing hides the list, clearing the field brings it back', async ({ page }) => {
	await open(page, '/recueils/ce/1');
	await page.goto('/');
	await expect(recent(page)).toBeVisible();
	await searchField(page).fill('gloire');
	await expect(recent(page)).toHaveCount(0);
	await searchField(page).fill('');
	await expect(recent(page)).toBeVisible();
});

test('6. « Effacer » empties the history and keeps the collections', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '1']] }]);
	await open(page, '/recueils/ce/1');
	await page.goto('/');
	await page.getByRole('button', { name: 'Effacer les chants récents' }).click();
	await expect(recent(page)).toHaveCount(0);
	await expect(searchField(page)).toBeFocused();
	await expect(page.getByText('Historique effacé')).toBeAttached();
	await page.reload();
	await expect(recent(page)).toHaveCount(0);
	await page.goto('/repertoire');
	await expect(page.getByRole('link', { name: /Culte/ })).toBeVisible();
});

test('7. a hymn that is not found is not recorded', async ({ page }) => {
	await page.goto('/recueils/ce/999');
	await expect(page.getByText(/introuvable|Pas de/).first()).toBeVisible();
	await page.goto('/');
	await expect(recent(page)).toHaveCount(0);
});

test('8. on desktop, the list is in the side column above the keyboard tips', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await open(page, '/recueils/ce/1');
	await page.goto('/');
	const aside = page.locator('aside.search__aside');
	await expect(aside.getByRole('region', { name: 'Récemment consultés' })).toBeVisible();
	const listBox = await aside.getByRole('region', { name: 'Récemment consultés' }).boundingBox();
	const tipsBox = await aside.locator('.search__keys').boundingBox();
	expect(listBox!.y).toBeLessThan(tipsBox!.y);
});

test('9. with storage blocked, hymns open and the search screen works', async ({ page }) => {
	await page.addInitScript(() => {
		Storage.prototype.setItem = () => {
			throw new Error('blocked');
		};
	});
	await open(page, '/recueils/ce/1');
	await page.goto('/');
	await expect(searchField(page)).toBeVisible();
	// Kept in memory for the visit only: a full reload starts again from nothing.
	await expect(recent(page)).toHaveCount(0);
});
