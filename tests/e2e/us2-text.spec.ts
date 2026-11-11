// User Story 2: find a hymn by title or a lyric fragment (spec.md, acceptance scenarios 1–5).
import { expect, test } from '@playwright/test';
import { results, search } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
});

test('1. a title typed without accents finds the hymn first', async ({ page }) => {
	await search(page, 'a toi la gloire');
	await expect(results(page).first()).toContainText('À toi la gloire');
});

test('2. a lyric fragment without accents finds the hymn in the top 3', async ({ page }) => {
	await search(page, 'eternite');
	const top3 = await results(page).locator('.hy-result__title').allTextContents();
	expect(top3.slice(0, 3)).toContain('À toi la gloire');
});

test('3. one typo is tolerated', async ({ page }) => {
	await search(page, 'ressucite');
	await expect(results(page).first()).toContainText('À toi la gloire');
});

test('4. a lyric match shows an excerpt with the matched words highlighted', async ({ page }) => {
	await search(page, 'fleuve');
	const excerpt = results(page).first().locator('.hy-result__excerpt');
	await expect(excerpt).toBeVisible();
	await expect(excerpt.locator('mark')).toHaveText('fleuve');
});

test('5. a title match ranks above a lyrics-only match', async ({ page }) => {
	await search(page, 'gloire');
	await expect(results(page).first()).toContainText('À toi la gloire');
	await expect(results(page).first().locator('.hy-result__excerpt')).toHaveCount(0);
});

test('a hymn in two hymnals is listed once, with both references', async ({ page }) => {
	await search(page, 'plus pres de toi');
	const first = results(page).first();
	await expect(first).toContainText('Plus près de toi, mon Dieu');
	await expect(first.locator('.hy-ref')).toHaveText(['CE 5', 'HE 2']);
});

test('no result gives a calm message', async ({ page }) => {
	await search(page, 'pélican');
	await expect(page.getByText(/Aucun chant ne contient.*pélican/)).toBeVisible();
});
