// Feature 003, User Story 2: keep several collections.
import { expect, test } from '@playwright/test';
import { collectionTitles, seedCollections } from './helpers';

const rows = (page: import('@playwright/test').Page) => page.locator('main .hy-row');

test('1. every collection is listed with its hymn count, newest change first', async ({ page }) => {
	await seedCollections(page, [
		{
			name: 'Culte',
			entries: [
				['ce', '1'],
				['ce', '2']
			]
		},
		{ name: 'Mariage', entries: [['ce', '5']] },
		{ name: 'Noël' }
	]);
	await page.goto('/repertoire');
	await expect(rows(page)).toHaveCount(3);
	await expect(rows(page).nth(0)).toContainText('Noël');
	await expect(rows(page).nth(0)).toContainText('0 chant');
	await expect(rows(page).nth(2)).toContainText('Culte');
	await expect(rows(page).nth(2)).toContainText('2 chants');
});

test('2. renaming shows the new name everywhere; a taken name is refused', async ({ page }) => {
	await seedCollections(page, [{ name: 'Noël' }, { name: 'Mariage' }]);
	await page.goto('/repertoire/c1');
	await page.getByRole('button', { name: 'Plus d’options' }).click();
	await page.getByRole('button', { name: 'Renommer' }).click();
	const dialog = page.getByRole('dialog', { name: 'Renommer la collection' });
	const field = dialog.getByLabel('Nom de la collection');
	await expect(field).toHaveValue('Noël');
	await field.fill('mariage');
	await dialog.getByRole('button', { name: 'Renommer' }).click();
	await expect(dialog.getByRole('alert')).toHaveText('Une collection porte déjà ce nom.');
	await field.fill('Veillée de Noël');
	await dialog.getByRole('button', { name: 'Renommer' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Veillée de Noël');
	await page.getByRole('link', { name: 'Retour au répertoire' }).click();
	await expect(rows(page).first()).toContainText('Veillée de Noël');
});

test('3. deleting asks first, then can be undone', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '1']] }, { name: 'Mariage' }]);
	await page.goto('/repertoire/c1');
	await page.getByRole('button', { name: 'Plus d’options' }).click();
	await page.getByRole('button', { name: 'Supprimer' }).click();
	const dialog = page.getByRole('dialog', { name: 'Supprimer « Culte » ?' });
	await expect(dialog).toContainText('Les chants restent dans leurs recueils.');
	await dialog.getByRole('button', { name: 'Supprimer' }).click();

	await expect(page).toHaveURL(/\/repertoire$/);
	await expect(rows(page)).toHaveCount(1);
	await expect(page.getByText('Collection « Culte » supprimée')).toBeVisible();
	await page.getByRole('button', { name: 'Annuler' }).click();
	await expect(rows(page)).toHaveCount(2);
	await page.getByRole('link', { name: /Culte/ }).click();
	await expect(collectionTitles(page)).toHaveText(['À toi la gloire']);
});

test('4. with no collection, the Répertoire explains and offers to create one', async ({
	page
}) => {
	await page.goto('/repertoire');
	await expect(page.getByText('Aucune collection pour l’instant.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Nouvelle collection' })).toHaveCount(2);
});

test('5. removing a hymn only affects that collection', async ({ page }) => {
	await seedCollections(page, [
		{
			name: 'Culte',
			entries: [
				['ce', '1'],
				['ce', '2']
			]
		},
		{ name: 'Mariage', entries: [['ce', '1']] }
	]);
	await page.goto('/repertoire/c1');
	await page.getByRole('button', { name: 'Retirer « À toi la gloire »' }).click();
	await expect(collectionTitles(page)).toHaveText(['C’est un rempart que notre Dieu']);
	await page.goto('/repertoire/c2');
	await expect(collectionTitles(page)).toHaveText(['À toi la gloire']);
});

test('an entry no longer published shows as unavailable and can be removed', async ({ page }) => {
	await seedCollections(page, [
		{
			name: 'Culte',
			entries: [
				['ce', '999'],
				['ce', '1']
			]
		}
	]);
	await page.goto('/repertoire/c1');
	await expect(page.locator('ol.collection__list li').first()).toContainText('Chant indisponible');
	await page.getByRole('button', { name: 'Retirer « Chant indisponible »' }).click();
	await expect(collectionTitles(page)).toHaveText(['À toi la gloire']);
});

test('an unknown collection gets a "not found" page', async ({ page }) => {
	await page.goto('/repertoire/nope');
	await expect(page.getByRole('heading', { name: 'Collection introuvable' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Retour au répertoire' })).toBeVisible();
});
