// Feature 016, story 1: Réglages is a menu of sections, each on its own address
// (specs/016-settings-menu-sections). Sample data: two hymnals, CE and HE.
import { expect, test, type Page } from '@playwright/test';

const HE = 'Hymnes d’exemple';
const SECTIONS = [
	['affichage', 'Affichage'],
	['lecture', 'Lecture'],
	['recueils', 'Recueils'],
	['hors-ligne', 'Hors ligne']
] as const;

const menuLinks = (page: Page) => page.locator('main .settings-menu a');
// A link's name is its title then its summary (visible text, WCAG 2.5.3).
const entry = (page: Page, title: string) =>
	page.locator('main .settings-menu').getByRole('link', { name: new RegExp(`^${title} `) });
const summary = (page: Page, title: string) =>
	entry(page, title).locator('.settings-menu__summary');

for (const scheme of ['light', 'dark'] as const) {
	test.describe(`settings menu (${scheme})`, () => {
		test.use({ colorScheme: scheme });

		test('lists the four sections with a summary and no control', async ({ page }) => {
			await page.goto('/reglages');
			await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réglages');
			await expect(menuLinks(page)).toHaveCount(4);
			for (const [i, [, title]] of SECTIONS.entries()) {
				await expect(menuLinks(page).nth(i).locator('.settings-menu__title')).toHaveText(title);
			}
			await expect(summary(page, 'Affichage')).toHaveText('Thème système');
			await expect(summary(page, 'Lecture')).toHaveText('Texte 100 % · Avec empattement');
			await expect(summary(page, 'Recueils')).toHaveText('Tous les recueils');
			const main = page.locator('main');
			await expect(main.getByRole('checkbox')).toHaveCount(0);
			await expect(main.getByRole('switch')).toHaveCount(0);
			await expect(main.locator('button')).toHaveCount(0);
		});

		test('the menu fits on a small phone without scrolling (SC-001)', async ({ page }) => {
			await page.setViewportSize({ width: 360, height: 640 });
			await page.goto('/reglages');
			await expect(menuLinks(page)).toHaveCount(4);
			const last = await menuLinks(page).last().boundingBox();
			const tabbar = await page.locator('.hy-tabbar').boundingBox();
			expect(last!.y + last!.height).toBeLessThanOrEqual(tabbar ? tabbar.y : 640);
		});
	});
}

test('each entry opens its section on its own address', async ({ page }) => {
	for (const [slug, title] of SECTIONS) {
		await page.goto('/reglages');
		await entry(page, title).click();
		await expect(page).toHaveURL(new RegExp(`/reglages/${slug}$`));
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
	}
});

test('back returns to the menu, with the summary updated and focus on the entry', async ({
	page
}) => {
	await page.goto('/reglages');
	await entry(page, 'Recueils').click();
	await page.getByRole('checkbox', { name: HE, exact: true }).uncheck();
	await page.getByRole('link', { name: 'Retour aux Réglages' }).click();
	await expect(page).toHaveURL(/\/reglages$/);
	await expect(summary(page, 'Recueils')).toHaveText('1 recueil sur 2');
	await expect(entry(page, 'Recueils')).toBeFocused();

	// The back link went back in history: one more step back leaves Réglages.
	await entry(page, 'Affichage').click();
	await expect(page).toHaveURL(/\/reglages\/affichage$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/reglages$/);
	await expect(entry(page, 'Affichage')).toBeFocused();
});

test('a section opened directly loads, and its back link leads to the menu', async ({ page }) => {
	await page.goto('/reglages/lecture');
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lecture');
	await page.getByRole('link', { name: 'Retour aux Réglages' }).click();
	await expect(page).toHaveURL(/\/reglages$/);
});

test('an unknown section opens the menu', async ({ page }) => {
	await page.goto('/reglages/xyz');
	await expect(page).toHaveURL(/\/reglages$/);
	await expect(menuLinks(page)).toHaveCount(4);
});

test('links about left-out hymnals open the Recueils section (FR-005)', async ({ page }) => {
	await page.goto('/reglages/recueils');
	await page.getByRole('checkbox', { name: HE, exact: true }).uncheck();
	await page.goto('/recueils/he');
	const link = page
		.locator('main')
		.getByRole('link', { name: /Réglages/ })
		.first();
	await expect(link).toHaveAttribute('href', /\/reglages\/recueils$/);
	await link.click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recueils');
});

test('the settings icon stays current inside a section (desktop)', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/reglages/affichage');
	await expect(page.locator('.hy-topnav').getByRole('link', { name: 'Réglages' })).toHaveAttribute(
		'aria-current',
		'page'
	);
});
