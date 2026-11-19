// Feature 014: choose the hymnals and parts used by the app (specs/014-hymnal-scope-settings).
// Sample data: CE « Cantiques d’exemple »; HE « Hymnes d’exemple » with parts « Louange » (from 1)
// and « Noël » (from 10: HE 12 « Les anges dans nos campagnes », HE 13 « Douce nuit »).
import { expect, test, type Page } from '@playwright/test';
import { launchMeaning, mockEmbed, results, search, seedCollections } from './helpers';

const CE = 'Cantiques d’exemple';
const HE = 'Hymnes d’exemple';

const box = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true });
const chip = (page: Page, name: string) =>
	page.getByRole('group', { name: 'Filtrer par recueil' }).getByRole('button', { name });
const listTitles = (page: Page) => page.locator('main .hy-row .hy-row__title');

async function leaveOut(page: Page, name: string) {
	await page.goto('/reglages');
	await box(page, name).uncheck();
	await expect(box(page, name)).not.toBeChecked();
}

async function showParts(page: Page) {
	await page.goto('/reglages');
	const more = page.getByRole('button', { name: `Afficher les parties de ${HE}` });
	await expect(more).toHaveAttribute('aria-expanded', 'false');
	await more.click();
	await expect(page.getByRole('button', { name: `Masquer les parties de ${HE}` })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
}

test.describe('US1: leave out a whole hymnal', () => {
	test('every hymnal is listed and selected at first', async ({ page }) => {
		await page.goto('/reglages');
		await expect(box(page, CE)).toBeChecked();
		await expect(box(page, HE)).toBeChecked();
		await expect(page.getByRole('button', { name: 'Tout sélectionner' })).toHaveCount(0);
	});

	test('a hymnal left out disappears from search, filters and lists, and stays out', async ({
		page
	}) => {
		await leaveOut(page, HE);
		await page.goto('/');
		await expect(chip(page, HE)).toHaveCount(0);

		// « endormi » is only in HE 13 « Douce nuit ».
		await search(page, 'endormi');
		await expect(
			page.getByText(/Certains recueils sont masqués dans les Réglages\./)
		).toBeVisible();
		await expect(results(page)).toHaveCount(0);
		await search(page, 'douce nuit');
		await expect(results(page).first()).toBeVisible();
		await expect(results(page).filter({ hasText: 'Douce nuit' })).toHaveCount(0);

		await search(page, 'HE 13');
		await expect(page.getByText(`${HE} est masqué dans les Réglages.`)).toBeVisible();
		await expect(
			page.locator('main .hy-message').getByRole('link', { name: 'Réglages' })
		).toHaveAttribute('href', /\/reglages$/);

		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		for (const refs of await results(page).locator('.hy-result__refs').allTextContents()) {
			expect(refs).not.toMatch(/HE/);
		}

		await page.goto('/recueils');
		await expect(listTitles(page)).toHaveText([CE]);

		await page.goto('/reglages');
		await page.reload();
		await expect(box(page, HE)).not.toBeChecked();
	});

	test('the last hymnal in use cannot be left out; « Tout sélectionner » brings all back', async ({
		page
	}) => {
		await leaveOut(page, HE);
		await expect(box(page, CE)).toBeDisabled();
		await expect(box(page, CE)).toHaveAccessibleDescription(/Gardez au moins un recueil\./);
		await page.getByRole('button', { name: 'Tout sélectionner' }).click();
		await expect(box(page, HE)).toBeChecked();
		await expect(box(page, CE)).toBeEnabled();
		await page.goto('/recueils');
		await expect(listTitles(page)).toHaveText([CE, HE]);
	});

	test('a search link filtering on a hymnal left out runs with no filter (FR-014)', async ({
		page
	}) => {
		await leaveOut(page, HE);
		await page.goto('/?q=gloire&recueils=he');
		await expect(results(page).first()).toBeVisible();
		await expect(page).not.toHaveURL(/recueils=/);
	});

	test('collections and direct links are not affected (FR-015, FR-016)', async ({ page }) => {
		await seedCollections(page, [{ name: 'Noël', entries: [['he', '13']] }]);
		await leaveOut(page, HE);
		await page.goto('/repertoire/c1');
		const item = page.locator('ol.collection__list .hb-item__title');
		await expect(item).toHaveText(['Douce nuit, sainte nuit']);
		await item.click();
		await expect(page).toHaveURL(/\/recueils\/he\/13/);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Douce nuit');

		await page.goto('/recueils/he/13');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Douce nuit');

		await page.goto('/recueils/he');
		await expect(page.getByText('Ce recueil est masqué dans les Réglages.')).toBeVisible();
	});

	test('search by meaning leaves the hymnal out too', async ({ page }) => {
		await mockEmbed(page);
		await leaveOut(page, HE);
		await page.goto('/');
		await search(page, 'la nuit de Noël et les anges');
		await launchMeaning(page);
		await expect(page.locator('main h2.hb-overline, main .hy-message').first()).toBeVisible();
		for (const refs of await results(page).locator('.hy-result__refs').allTextContents()) {
			expect(refs).not.toMatch(/HE/);
		}
	});
});

test.describe('US2: keep only some parts of a hymnal', () => {
	test('a part left out disappears from search and from its hymnal page', async ({ page }) => {
		await showParts(page);
		await expect(box(page, 'Louange')).toBeChecked();
		await box(page, 'Noël').uncheck();
		await expect(box(page, HE)).toHaveJSProperty('indeterminate', true);
		await expect(page.getByText('1 partie sur 2')).toBeVisible();

		await page.goto('/');
		// « campagnes » is only in HE 12 « Les anges dans nos campagnes ».
		await search(page, 'campagnes');
		await expect(results(page)).toHaveCount(0);
		await search(page, 'HE 12');
		await expect(page.getByText(`« Noël » (${HE}) est masqué dans les Réglages.`)).toBeVisible();
		await search(page, 'HE 7');
		await expect(page.locator('.hy-exact')).toContainText('HE 7');

		await page.goto('/recueils/he');
		await expect(page.getByRole('heading', { name: 'Louange' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Noël' })).toHaveCount(0);
		await expect(page.getByText(/1\s+partie masquée/)).toBeVisible();
		await page.getByRole('textbox', { name: 'Aller au numéro' }).fill('12');
		await page.getByRole('button', { name: 'Aller' }).click();
		await expect(page.getByRole('status')).toHaveText(
			/Le n°\s12 est dans «\s?Noël\s?», masqué dans les Réglages\./
		);
	});

	test('the hymnal checkbox selects all its parts; the last part in use is kept', async ({
		page
	}) => {
		await showParts(page);
		await box(page, 'Noël').uncheck();
		await box(page, CE).uncheck();
		await expect(box(page, 'Louange')).toBeDisabled();
		await expect(box(page, HE)).toBeDisabled();
		await box(page, CE).check();
		await box(page, HE).check();
		await expect(box(page, 'Noël')).toBeChecked();
		await expect(box(page, 'Louange')).toBeChecked();
		await expect(page.getByText('2 parties sur 2')).toBeVisible();
	});
});

test.describe('US3: a tidier settings screen', () => {
	test('two subsections, « Affichage » then « Recueils »', async ({ page }) => {
		await page.goto('/reglages');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réglages');
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Affichage', 'Recueils']);
		await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Thème', 'Taille du texte']);
	});

	test('the theme still works', async ({ page }) => {
		await page.goto('/reglages');
		await page.getByRole('button', { name: 'Sombre' }).click();
		expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
			'rgb(20, 19, 17)'
		);
	});
});
