// User Story 5: narrow search to one or more hymnals (spec.md, acceptance scenarios 1–3).
import { expect, test } from '@playwright/test';
import { results, search, seedCollections } from './helpers';

const chip = (page: import('@playwright/test').Page, name: string) =>
	page.getByRole('group', { name: 'Filtrer par recueil' }).getByRole('button', { name });

test('1. with only HE selected, a word found in both hymnals shows only HE hymns', async ({
	page
}) => {
	await page.goto('/');
	await chip(page, 'Hymnes d’exemple').click();
	await search(page, 'gloire');
	await expect(results(page).first()).toBeVisible();
	for (const refs of await results(page).locator('.hy-result__refs').allTextContents()) {
		expect(refs).toMatch(/HE/);
		expect(refs).not.toMatch(/CE/);
	}
	await expect(page).toHaveURL(/recueils=he/);
});

test('2. the active filter is visible and cleared in one tap', async ({ page }) => {
	await page.goto('/?q=gloire&recueils=he');
	await expect(chip(page, 'Hymnes d’exemple')).toHaveAttribute('aria-pressed', 'true');
	await chip(page, 'Tous les recueils').click();
	await expect(chip(page, 'Hymnes d’exemple')).toHaveAttribute('aria-pressed', 'false');
	await expect(page).not.toHaveURL(/recueils=/);
	await expect(results(page).locator('.hy-ref', { hasText: 'CE' }).first()).toBeVisible();
});

test('3. with a filter, a number alone only lists the selected hymnals', async ({ page }) => {
	await page.goto('/?recueils=ce');
	await search(page, '12');
	await expect(results(page)).toHaveCount(1);
	await expect(results(page).first()).toContainText('CE 12');
});

test('the filter is remembered on the device', async ({ page }) => {
	await page.goto('/');
	await chip(page, 'Cantiques d’exemple').click();
	await page.goto('/');
	await expect(chip(page, 'Cantiques d’exemple')).toHaveAttribute('aria-pressed', 'true');
});

// Feature 009, User Story 2. The fixture's name order equals its sortOrder, so these tests check
// that the screens agree; the unit test in tests/unit/catalog.test.ts proves the sort.
const chipNames = async (page: import('@playwright/test').Page) =>
	(
		await page
			.getByRole('group', { name: 'Filtrer par recueil' })
			.getByRole('button')
			.allTextContents()
	).map((t) => t.trim());

const rowTitles = async (page: import('@playwright/test').Page) => {
	await page.goto('/recueils');
	const rows = page.locator('main .hy-row .hy-row__title');
	await expect(rows.first()).toBeVisible();
	return rows.allTextContents();
};

test('the hymnal chips follow the Recueils screen order', async ({ page }) => {
	const titles = await rowTitles(page);
	expect(titles.length).toBeGreaterThan(1);
	await page.goto('/');
	await expect(chip(page, titles[0])).toBeVisible();
	expect(await chipNames(page)).toEqual(titles);

	await seedCollections(page, [{ name: 'Dimanche' }]);
	await page.goto('/repertoire/c1/ajouter');
	await expect(chip(page, titles[0])).toBeVisible();
	expect(await chipNames(page)).toEqual(titles);
});

test('a selected chip keeps its place and the clear chip is last', async ({ page }) => {
	const titles = await rowTitles(page);
	await page.goto('/');
	await chip(page, 'Hymnes d’exemple').click();
	await expect(chip(page, 'Tous les recueils')).toBeVisible();
	expect(await chipNames(page)).toEqual([...titles, 'Tous les recueils']);
});
