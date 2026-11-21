// Feature 016, story 3: Réglages › Hors ligne shows what the device keeps and checks for updates
// (specs/016-settings-menu-sections, FR-016 to FR-020). Runs against the built app.
import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

/** First visit, then a reload so the service worker controls the page (second visit). */
async function installed(page: Page) {
	await page.goto('/');
	await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

const item = (page: Page, label: string) =>
	page.locator('main .offline__item').filter({ hasText: label });

test('after a visit, hymns and Bible are available offline, with space and date', async ({
	page
}) => {
	await installed(page);
	await page.goto('/reglages/hors-ligne');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hors ligne');
	await expect(item(page, 'Chants et recueils')).toContainText('Disponible hors ligne');
	await expect(item(page, 'Bible')).toContainText('Disponible hors ligne');
	await expect(item(page, 'Recherche par le sens')).toBeVisible();
	await expect(page.getByText(/^Espace utilisé : \d+,\d Mo$/)).toBeVisible();
	await expect(page.getByText('Chants mis à jour le 11 novembre 2026')).toBeVisible();
	const needs = page.locator('main .offline__needs');
	await expect(needs).toContainText('recherche par le sens');
	await expect(needs).toContainText('YouTube');
	await expect(needs).toContainText('mises à jour');

	// The meaning data downloads in the background; then the menu says everything is ready.
	await expect(item(page, 'Recherche par le sens')).toContainText('Disponible hors ligne', {
		timeout: 20_000
	});
	await page.goto('/reglages');
	await expect(
		page.locator('main .settings-menu a[data-section="hors-ligne"] .settings-menu__summary')
	).toHaveText('Prêt hors ligne');
});

test('the update check answers online and offline (FR-020)', async ({ page, context }) => {
	await installed(page);
	await page.goto('/reglages/hors-ligne');
	const button = page.getByRole('button', { name: 'Rechercher une mise à jour' });
	const status = page.locator('main [role="status"]');

	await button.click();
	await expect(status).toHaveText(/^Hymnia est à jour \(vérifié à \d{1,2} h \d{2}\)\.$/);

	await context.setOffline(true);
	await button.click();
	await expect(status).toHaveText(
		'Pas de connexion : la vérification est impossible pour le moment.'
	);
});
