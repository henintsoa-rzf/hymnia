// SC-006 / FR-018: after one visit, every user story works offline.
import { expect, test } from '@playwright/test';
import { collectionTitles, results, search } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('after one visit, the app works without a network', async ({ page, context }) => {
	await page.goto('/');
	// Wait until the service worker is installed (everything precached), then reload so it
	// controls the page, as on a second visit.
	await page.evaluate(async () => {
		const registration = await navigator.serviceWorker.ready;
		return registration.active?.state;
	});
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	await context.setOffline(true);
	await page.reload();

	// US1 + US2: number and text search.
	await search(page, 'ce7');
	await expect(page.locator('.hy-exact')).toContainText('Quel ami fidèle et tendre');
	await search(page, 'fleuve');
	await expect(results(page).first()).toBeVisible();

	// US3: browse, US4: read (deep link, never visited before).
	await page.goto('/recueils/he');
	await expect(page.locator('.hb-item')).toHaveCount(7);
	await page.goto('/recueils/he/13');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Douce nuit, sainte nuit');

	// US5: filter.
	await page.goto('/?q=12&recueils=he');
	await expect(results(page)).toHaveCount(1);
});

test('collections can be made and changed offline, and are kept (SC-004)', async ({
	page,
	context
}) => {
	await page.goto('/');
	await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	await context.setOffline(true);

	await page.goto('/repertoire');
	await page.getByRole('button', { name: 'Nouvelle collection' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'Nouvelle collection' });
	await dialog.getByLabel('Nom de la collection').fill('Hors ligne');
	await dialog.getByRole('button', { name: 'Créer' }).click();
	for (const query of ['CE 1', 'CE 12']) {
		await page.getByRole('searchbox').fill(query);
		await page
			.getByRole('button', { name: /^Ajouter « / })
			.first()
			.click();
	}
	await page.getByRole('link', { name: /Terminé/ }).click();
	await page.getByRole('button', { name: 'Plus d’options' }).click();
	await page.getByRole('button', { name: 'Modifier l’ordre' }).click();
	await page.getByRole('button', { name: /^Monter « Debout/ }).click();

	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hors ligne');
	await expect(collectionTitles(page)).toHaveText(['Debout, sainte cohorte', 'À toi la gloire']);
});
