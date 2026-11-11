// User Story 1: open a hymn by hymnal and number (spec.md, acceptance scenarios 1–4).
import { expect, test } from '@playwright/test';
import { results, search, searchField } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
});

test('the search field is ready without any navigation (FR-001)', async ({ page }) => {
	await expect(searchField(page)).toBeFocused();
});

test('1. "CE 12" shows that hymn first and opens it', async ({ page }) => {
	await search(page, 'CE 12');
	const exact = page.locator('.hy-exact');
	await expect(exact).toContainText('CE 12');
	await expect(exact).toContainText('Debout, sainte cohorte');
	await exact.click();
	await expect(page).toHaveURL(/\/recueils\/ce\/12$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Debout, sainte cohorte');
});

for (const query of ['ce12', 'CE n°12']) {
	test(`2. "${query}" finds the same hymn`, async ({ page }) => {
		await search(page, query);
		await expect(page.locator('.hy-exact')).toContainText('Debout, sainte cohorte');
	});
}

test('2. Enter opens the first result', async ({ page }) => {
	await search(page, 'ce12');
	await expect(page.locator('.hy-exact')).toBeVisible();
	await searchField(page).press('Enter');
	await expect(page).toHaveURL(/\/recueils\/ce\/12$/);
});

test('3. a number alone lists every hymn with that number, labelled by hymnal', async ({
	page
}) => {
	await search(page, '12');
	await expect(page.getByRole('heading', { name: /Chants n°/ })).toBeVisible();
	await expect(results(page)).toHaveCount(2);
	await expect(results(page).nth(0)).toContainText('CE 12');
	await expect(results(page).nth(1)).toContainText('HE 12');
});

test('4. a missing number shows a calm message, not an error', async ({ page }) => {
	await search(page, 'CE 9999');
	await expect(page.getByText('Aucun chant n° 9999 dans Cantiques d’exemple')).toBeVisible();
	await page.getByRole('link', { name: /Voir les 10 chants du recueil/ }).click();
	await expect(page).toHaveURL(/\/recueils\/ce$/);
});

test('the back button returns to the search with its query', async ({ page }) => {
	await search(page, 'ce7');
	await page.locator('.hy-exact').click();
	await expect(page).toHaveURL(/\/recueils\/ce\/7$/);
	await page.goBack();
	await expect(searchField(page)).toHaveValue('ce7');
	await expect(page.locator('.hy-exact')).toContainText('Quel ami fidèle et tendre');
});

test('an unknown hymnal or number gets a "not found" page', async ({ page }) => {
	await page.goto('/recueils/ce/99');
	await expect(page.getByRole('heading', { name: 'Chant introuvable' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Retour à la recherche' })).toBeVisible();
	await page.goto('/recueils/xyz');
	await expect(page.getByRole('heading', { name: 'Recueil introuvable' })).toBeVisible();
	await page.goto('/nulle-part');
	await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
});
