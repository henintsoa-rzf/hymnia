// Feature 003, User Story 3: choose the collection when adding from a hymn.
import { expect, test } from '@playwright/test';
import { collectionTitles, seedCollections } from './helpers';

const bookmark = (page: import('@playwright/test').Page) =>
	page.getByRole('button', { name: 'Ajouter à une collection' }).first();
const sheet = (page: import('@playwright/test').Page) =>
	page.getByRole('dialog', { name: 'Ajouter à une collection' });

test('1–2. the sheet lists the collections; choosing one adds the hymn', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte' }, { name: 'Mariage' }]);
	await page.goto('/recueils/ce/1');
	await expect(bookmark(page)).toHaveAttribute('aria-pressed', 'false');
	await bookmark(page).click();
	const choices = sheet(page).locator('.sheet__row[aria-pressed="false"]');
	await expect(sheet(page).getByRole('button', { name: /Culte/ })).toBeVisible();
	await expect(sheet(page).getByRole('button', { name: /Mariage/ })).toBeVisible();
	await expect(choices).toHaveCount(2);

	await sheet(page)
		.getByRole('button', { name: /Mariage/ })
		.click();
	await expect(sheet(page).getByRole('button', { name: /Mariage/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(sheet(page).getByText('Ajouté à « Mariage »')).toBeAttached();
	await sheet(page).getByRole('button', { name: 'Fermer' }).click();
	await expect(bookmark(page)).toHaveAttribute('aria-pressed', 'true');

	await page.goto('/repertoire/c2');
	await expect(collectionTitles(page)).toHaveText(['À toi la gloire']);
});

test('3. choosing a collection that has the hymn removes it', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '1']] }]);
	await page.goto('/recueils/ce/1');
	await bookmark(page).click();
	await sheet(page).getByRole('button', { name: /Culte/ }).click();
	await expect(sheet(page).getByRole('button', { name: /Culte/ })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await page.keyboard.press('Escape');
	await expect(bookmark(page)).toHaveAttribute('aria-pressed', 'false');
	await expect(bookmark(page)).toBeFocused();
});

test('4 + 6. a new collection is created from the sheet, with the hymn in it', async ({ page }) => {
	await page.goto('/recueils/ce/5');
	await bookmark(page).click();
	await expect(sheet(page).getByText('Vous n’avez pas encore de collection.')).toBeVisible();
	await sheet(page).getByRole('button', { name: 'Nouvelle collection' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nouvelle collection' });
	await dialog.getByLabel('Nom de la collection').fill('Prière');
	await dialog.getByRole('button', { name: 'Créer' }).click();
	await expect(sheet(page).getByRole('button', { name: /Prière/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('5. the bookmark is filled for the same hymn under another reference', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '1']] }]);
	await page.goto('/recueils/he/7');
	await expect(bookmark(page)).toHaveAttribute('aria-pressed', 'true');
	await page.goto('/recueils/ce/2');
	await expect(bookmark(page)).toHaveAttribute('aria-pressed', 'false');
});
