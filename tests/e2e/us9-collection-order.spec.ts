// Feature 003, User Story 4: put the hymns of a collection in order, and read them in order.
import { expect, test } from '@playwright/test';
import { collectionTitles, seedCollections } from './helpers';

test.beforeEach(async ({ page }) => {
	await seedCollections(page, [
		{
			name: 'Culte',
			entries: [
				['ce', '1'],
				['ce', '12'],
				['he', '13']
			]
		}
	]);
});

test('1. moving a hymn to the top is kept after a reload', async ({ page }) => {
	await page.goto('/repertoire/c1');
	await page.getByRole('button', { name: 'Plus d’options' }).click();
	await page.getByRole('button', { name: 'Modifier l’ordre' }).click();
	await expect(page.getByRole('button', { name: /^Monter « À toi la gloire »/ })).toBeDisabled();
	await expect(page.getByRole('button', { name: /^Descendre « Douce nuit/ })).toBeDisabled();

	await page.getByRole('button', { name: /^Monter « Douce nuit/ }).click();
	await expect(page.getByRole('button', { name: /^Monter « Douce nuit/ })).toBeFocused();
	await page.getByRole('button', { name: /^Monter « Douce nuit/ }).click();
	await page.getByRole('button', { name: 'Terminé' }).click();
	const expected = ['Douce nuit, sainte nuit', 'À toi la gloire', 'Debout, sainte cohorte'];
	await expect(collectionTitles(page)).toHaveText(expected);
	await page.reload();
	await expect(collectionTitles(page)).toHaveText(expected);
});

test('2. reading in order follows the collection, not the hymnal', async ({ page }) => {
	await page.goto('/repertoire/c1');
	await page.getByRole('link', { name: 'Lire dans l’ordre' }).click();
	await expect(page).toHaveURL(/\/recueils\/ce\/1\?collection=c1$/);
	await expect(page.locator('.hymn-top .page__back-label')).toHaveText(/Culte · 1\s\/\s3/);

	const toolbar = page.getByRole('toolbar', { name: 'Lecture' });
	await expect(toolbar.getByRole('button', { name: /premier de la collection/ })).toBeDisabled();
	await toolbar.getByRole('link', { name: /Chant suivant : CE 12/ }).click();
	await expect(page).toHaveURL(/\/recueils\/ce\/12\?collection=c1$/);

	// Swipe left: the next hymn of the collection (HE 13), not CE 12a.
	await page.locator('.hymn__swipe').evaluate((el) => {
		const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
		el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(300)], bubbles: true }));
		el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(100)], bubbles: true }));
	});
	await expect(page).toHaveURL(/\/recueils\/he\/13\?collection=c1$/);
	await expect(toolbar.getByRole('button', { name: /dernier de la collection/ })).toBeDisabled();

	await page.getByRole('link', { name: 'Retour à Culte' }).click();
	await expect(page).toHaveURL(/\/repertoire\/c1$/);
});

test('3. outside a collection, next is the next number of the hymnal', async ({ page }) => {
	await page.goto('/recueils/ce/12');
	await page
		.getByRole('toolbar', { name: 'Lecture' })
		.getByRole('link', { name: /Chant suivant/ })
		.click();
	await expect(page).toHaveURL(/\/recueils\/ce\/12a$/);
	await page.goto('/recueils/ce/12?collection=inconnue');
	await expect(
		page
			.getByRole('toolbar', { name: 'Lecture' })
			.getByRole('link', { name: /Chant suivant : CE 12a/ })
	).toBeVisible();
});
