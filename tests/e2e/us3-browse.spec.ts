// User Story 3: browse a hymnal (spec.md, acceptance scenarios 1–3).
import { expect, test } from '@playwright/test';

test('1. the hymnal list shows each hymnal with its hymn count', async ({ page }) => {
	await page.goto('/recueils');
	const rows = page.locator('main .hy-row');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText('Cantiques d’exemple');
	await expect(rows.nth(0)).toContainText('10 chants');
	await expect(rows.nth(1)).toContainText('7 chants');
});

test('2. a hymnal lists its hymns in number order', async ({ page }) => {
	await page.goto('/recueils');
	await page.getByRole('link', { name: /Cantiques d’exemple/ }).click();
	const numbers = await page.locator('.hb-item__num').allTextContents();
	expect(numbers).toEqual(['1', '2', '3', '5', '7', '8', '12', '12a', '20', '23']);
});

test('3. "go to number" brings that hymn into view and highlights it', async ({ page }) => {
	await page.goto('/recueils/he');
	await page.getByLabel('Aller au numéro').fill('3bis');
	await page.getByRole('button', { name: 'Aller' }).click();
	const target = page.locator('.hb-item.is-target');
	await expect(target).toContainText('3 bis');
	await expect(target).toBeInViewport();
	await expect(target.getByRole('link')).toBeFocused();
});

test('"go to number" reports a missing number', async ({ page }) => {
	await page.goto('/recueils/ce');
	await page.getByLabel('Aller au numéro').fill('99');
	await page.getByRole('button', { name: 'Aller' }).click();
	await expect(page.getByText('Pas de n° 99 dans ce recueil.')).toBeVisible();
});

test('with an empty query, the search screen lists the hymnals', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Recueils' })).toBeVisible();
	await expect(page.locator('main .hy-row:visible')).toHaveCount(2);
});
