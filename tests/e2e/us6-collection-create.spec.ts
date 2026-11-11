// Feature 003, User Story 1: create a named collection and fill it from a search.
import { expect, test } from '@playwright/test';
import { collectionTitles, searchField } from './helpers';

async function createCollection(page: import('@playwright/test').Page, name: string) {
	await page.goto('/repertoire');
	await page.getByRole('button', { name: 'Nouvelle collection' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'Nouvelle collection' });
	await dialog.getByLabel('Nom de la collection').fill(name);
	await dialog.getByRole('button', { name: 'Créer' }).click();
}

test('1. a new collection opens ready to add hymns', async ({ page }) => {
	await createCollection(page, 'Culte');
	await expect(page).toHaveURL(/\/repertoire\/[^/]+\/ajouter$/);
	await expect(page.getByRole('heading', { name: 'Ajouter des chants' })).toBeVisible();
	await expect(searchField(page)).toBeFocused();
});

test('2–3. hymns are added from the search, several in a row, in order', async ({ page }) => {
	await createCollection(page, 'Culte');
	await searchField(page).fill('CE 12');
	await page.getByRole('button', { name: /Ajouter « Debout, sainte cohorte »/ }).click();
	await expect(
		page.getByRole('button', { name: /Retirer « Debout, sainte cohorte »/ })
	).toHaveAttribute('aria-pressed', 'true');

	await searchField(page).fill('fleuve');
	const add = page.locator('main li.with-action').getByRole('button', { name: /^Ajouter/ });
	await expect(add.first()).toBeVisible();
	const firstTitle = (await page
		.locator('main li.with-action .hy-result__title')
		.first()
		.textContent())!;
	await add.first().click();
	await expect(searchField(page)).toHaveValue('fleuve');
	await searchField(page).fill('CE 7');
	await page.getByRole('button', { name: /Ajouter « Quel ami fidèle et tendre »/ }).click();

	await page.getByRole('link', { name: 'Terminé (3)' }).click();
	await expect(collectionTitles(page)).toHaveText([
		'Debout, sainte cohorte',
		firstTitle.trim(),
		'Quel ami fidèle et tendre'
	]);
});

test('4. a hymn already in the collection is shown as added, under any reference', async ({
	page
}) => {
	await createCollection(page, 'Culte');
	await searchField(page).fill('CE 1');
	await page.getByRole('button', { name: /Ajouter « À toi la gloire »/ }).click();
	await searchField(page).fill('HE 7');
	await expect(page.getByRole('button', { name: /Retirer « À toi la gloire »/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('5. an empty name is refused', async ({ page }) => {
	await page.goto('/repertoire');
	await page.getByRole('button', { name: 'Nouvelle collection' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'Nouvelle collection' });
	await dialog.getByRole('button', { name: 'Créer' }).click();
	await expect(dialog.getByRole('alert')).toHaveText('Donnez un nom à la collection.');
	await expect(dialog).toBeVisible();
	await expect(page).toHaveURL(/\/repertoire$/);
});

test('6. a hymn opens with the reference it was added with', async ({ page }) => {
	await createCollection(page, 'Culte');
	await searchField(page).fill('HE 7');
	await page.getByRole('button', { name: /Ajouter « À toi la gloire »/ }).click();
	await page.getByRole('link', { name: /Terminé/ }).click();
	await page.locator('ol.collection__list a').first().click();
	await expect(page).toHaveURL(/\/recueils\/he\/7\?collection=/);
	await expect(page.locator('.hb-header__number')).toHaveText('HE 7');
});
