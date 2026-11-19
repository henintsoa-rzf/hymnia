// Feature 015, User Story 1: read the Bible offline (spec.md US1, contracts/bible-ui.md §2).
import { expect, test } from '@playwright/test';

const toolbar = (page: import('@playwright/test').Page) =>
	page.getByRole('toolbar', { name: 'Lecture' });
const verses = (page: import('@playwright/test').Page) => page.locator('main .verse');

test('the Bible tab lists the 66 books under two headings', async ({ page }) => {
	await page.goto('/');
	const tab = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', {
		name: 'Bible'
	});
	await tab.first().click();
	await expect(page).toHaveURL(/\/bible$/);
	await expect(page.getByRole('heading', { level: 2 })).toHaveText([
		'Ancien Testament',
		'Nouveau Testament'
	]);
	await expect(page.locator('.bible__book')).toHaveCount(66);
	await expect(page.getByText('Louis Segond 1910 · domaine public')).toBeVisible();
});

test('a book, then a chapter, shows its numbered verses', async ({ page }) => {
	await page.goto('/bible?livres');
	await page.getByRole('link', { name: 'Psaumes', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Psaumes');
	await page.getByRole('link', { name: 'Chapitre 23', exact: true }).click();
	await expect(page).toHaveURL(/\/bible\/psaumes\/23$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Psaumes 23');
	await expect(verses(page)).toHaveCount(6);
	await expect(verses(page).first()).toContainText('L’Éternel est mon berger');
	await expect(page).toHaveTitle('Psaumes 23 · Hymnia');
});

test('previous and next cross books and stop at both ends', async ({ page }) => {
	await page.goto('/bible/malachie/4');
	await toolbar(page).getByRole('link', { name: 'Chapitre suivant : Matthieu 1' }).click();
	await expect(page).toHaveURL(/\/bible\/matthieu\/1$/);
	await toolbar(page)
		.getByRole('link', { name: /Chapitre précédent : Malachie 4/ })
		.click();
	await expect(page).toHaveURL(/\/bible\/malachie\/4$/);

	await page.goto('/bible/genese/1');
	await expect(
		toolbar(page).getByRole('button', { name: 'Pas de chapitre précédent' })
	).toBeDisabled();
	await page.goto('/bible/apocalypse/22');
	await expect(
		toolbar(page).getByRole('button', { name: 'Pas de chapitre suivant' })
	).toBeDisabled();
});

test('a typed reference opens the verse; an unknown one says so', async ({ page }) => {
	await page.goto('/bible?livres');
	const field = page.getByRole('searchbox', { name: /Aller à une référence/ });
	await field.fill('jo 3');
	await field.press('Enter');
	await expect(page.getByRole('alert')).toHaveText('Référence introuvable');
	await expect(field).toHaveValue('jo 3');

	await field.fill('jn 3:16');
	await field.press('Enter');
	await expect(page).toHaveURL(/\/bible\/jean\/3\?v=16$/);
	await expect(page.locator('#v16')).toBeInViewport();
	await expect(page.locator('#v16')).toContainText('Car Dieu a tant aimé le monde');
});

test('the Bible reopens at the last chapter read', async ({ page }) => {
	await page.goto('/bible/romains/8');
	await expect(verses(page)).toHaveCount(39);
	await page.goto('/bible');
	await expect(page).toHaveURL(/\/bible\/romains\/8$/);
	await page.reload();
	await page.goto('/bible');
	await expect(page).toHaveURL(/\/bible\/romains\/8$/);
});

test('an unknown book or chapter shows "not found"', async ({ page }) => {
	await page.goto('/bible/jean/22');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chapitre introuvable');
	await expect(page.getByText('Jean compte 21 chapitres.')).toBeVisible();
	await page.goto('/bible/nope');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Livre introuvable');
});

test.describe('offline', () => {
	test.use({ serviceWorkers: 'allow' });

	test('after one visit, a chapter never opened before reads offline (SC-001)', async ({
		page,
		context
	}) => {
		await page.goto('/');
		await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
		await page.reload();
		await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

		await context.setOffline(true);
		await page.goto('/bible/psaumes/121');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Psaumes 121');
		await expect(verses(page)).toHaveCount(8);
	});
});
