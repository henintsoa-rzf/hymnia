// Feature 006, User Story 2: jump to a recent collection (spec.md, US2; contracts/ui.md).
import { expect, test, type Page } from '@playwright/test';
import { seedCollections } from './helpers';

const block = (page: Page) => page.getByRole('region', { name: 'Collections' });

// seedCollections makes later collections more recent: Mariage, then Répétition, then Culte.
const FOUR = [
	{ name: 'Noël', entries: [['ce', '20']] as [string, string][] },
	{
		name: 'Culte',
		entries: [
			['ce', '1'],
			['ce', '2']
		] as [string, string][]
	},
	{ name: 'Répétition' },
	{ name: 'Mariage', entries: [['ce', '5']] as [string, string][] }
];

test('1. the three most recently changed collections are listed, then the Répertoire', async ({
	page
}) => {
	await seedCollections(page, FOUR);
	await page.goto('/');
	const rows = block(page).getByRole('listitem');
	await expect(rows).toHaveCount(3);
	await expect(rows.nth(0)).toContainText('Mariage');
	await expect(rows.nth(0)).toContainText('1 chant');
	await expect(rows.nth(1)).toContainText('Répétition');
	await expect(rows.nth(1)).toContainText('0 chant');
	await expect(rows.nth(2)).toContainText('Culte');
	await expect(rows.nth(2)).toContainText('2 chants');
	await expect(block(page)).not.toContainText('Noël');
	await block(page).getByRole('link', { name: 'Tout le Répertoire' }).click();
	await expect(page).toHaveURL(/\/repertoire$/);
});

test('2. a collection opens on tap', async ({ page }) => {
	await seedCollections(page, FOUR);
	await page.goto('/');
	await block(page)
		.getByRole('link', { name: /Mariage/ })
		.click();
	await expect(page).toHaveURL(/\/repertoire\/c4$/);
});

test('3. without collections, there is no collections block', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('searchbox')).toBeVisible();
	await expect(block(page)).toHaveCount(0);
});

test('4. on desktop, collections sit below the recent hymns and above the keyboard tips', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await seedCollections(page, FOUR);
	await page.goto('/recueils/ce/1');
	await expect(page.locator('main h1')).toBeVisible();
	await page.goto('/');
	const aside = page.locator('aside.search__aside');
	const recent = await aside.getByRole('region', { name: 'Récemment consultés' }).boundingBox();
	const collections = await aside.getByRole('region', { name: 'Collections' }).boundingBox();
	const tips = await aside.locator('.search__keys').boundingBox();
	expect(recent!.y).toBeLessThan(collections!.y);
	expect(collections!.y).toBeLessThan(tips!.y);
});
