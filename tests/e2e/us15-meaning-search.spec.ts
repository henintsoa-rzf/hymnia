// Feature 011: search by meaning (specs/011-semantic-search/spec.md, US1 and US2), with
// /api/embed answered by the fake embedder of the tests. Since feature 012 the button switches a
// mode of the field: one press runs the search on a text already typed, Enter runs it again.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { anyField, meaningButton, mockEmbed, results, search } from './helpers';

const chip = (page: Page, name: string) =>
	page.getByRole('group', { name: 'Filtrer par recueil' }).getByRole('button', { name });
const overline = (page: Page) => page.locator('main h2.hb-overline').first();

async function searchByMeaning(page: Page, query: string) {
	await search(page, query);
	if ((await meaningButton(page).getAttribute('aria-pressed')) === 'true') {
		await anyField(page).press('Enter');
	} else {
		await meaningButton(page).click();
	}
	await expect(overline(page)).toContainText('Résultats par le sens');
}

test.describe('US1: find a hymn by its meaning', () => {
	test('the button is shown whatever the query (feature 012)', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await expect(meaningButton(page)).toBeVisible();
		await search(page, 'CE 1');
		await expect(page.locator('.hy-exact')).toBeVisible();
		await expect(meaningButton(page)).toBeVisible();
		await search(page, '12');
		await expect(results(page).first()).toBeVisible();
		await expect(meaningButton(page)).toBeVisible();
		await search(page, 'un ami fidèle');
		await expect(meaningButton(page)).toBeVisible();
		await expect(meaningButton(page)).toHaveAttribute('aria-pressed', 'false');
	});

	test('pressing it shows one blended list with excerpts', async ({ page }) => {
		const posted = await mockEmbed(page);
		await page.goto('/');
		await searchByMeaning(page, 'la nuit de Noël et les anges');
		expect(posted).toEqual(['la nuit de Noël et les anges']);
		await expect(page).toHaveURL(/sens=1/);
		await expect(meaningButton(page)).toHaveAttribute('aria-pressed', 'true');
		await expect(results(page).first()).toBeVisible();
		await expect(page.locator('main .hy-result__excerpt').first()).toBeVisible();
	});

	test('an exact title stays first', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await searchByMeaning(page, 'Quel ami fidèle et tendre');
		await expect(results(page).first()).toContainText('Quel ami fidèle et tendre');
	});

	test('the hymnal filter applies', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await chip(page, 'Cantiques d’exemple').click();
		await searchByMeaning(page, 'la gloire de Dieu');
		await expect(results(page).first()).toBeVisible();
		for (const refs of await results(page).locator('.hy-result__refs').allTextContents()) {
			expect(refs).toMatch(/CE/);
			expect(refs).not.toMatch(/HE/);
		}
	});

	test('a result opens its hymn', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await searchByMeaning(page, 'la nuit de Noël et les anges');
		const href = await results(page).first().getAttribute('href');
		await results(page).first().click();
		await expect(page).toHaveURL(new RegExp(`${href}$`));
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('editing the query shows word results until Enter, in the same mode', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await searchByMeaning(page, 'la gloire de Dieu');
		await anyField(page).fill('la gloire de Dieu et');
		await expect(overline(page)).not.toContainText('Résultats par le sens');
		await expect(page).toHaveURL(/sens=1/);
		await expect(meaningButton(page)).toHaveAttribute('aria-pressed', 'true');
	});

	test('a link with sens=1 shows the meaning list again', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/?q=la%20gloire%20de%20Dieu&sens=1');
		await expect(overline(page)).toContainText('Résultats par le sens');
		await expect(page).toHaveURL(/sens=1/);
	});

	test('a long query is cut to 500 characters, with a note', async ({ page }) => {
		const posted = await mockEmbed(page);
		await page.goto('/');
		const long = 'la grâce de Dieu '.repeat(40).trim();
		await anyField(page).fill(long);
		await meaningButton(page).click();
		await expect(page.getByText('Recherche limitée aux 500 premiers caractères')).toBeVisible();
		await expect.poll(() => posted.length).toBe(1);
		expect([...posted[0]]).toHaveLength(500);
	});
});

test.describe('US2: weak or no connection', () => {
	test('a repeated query works offline, with no request', async ({ page, context }) => {
		const posted = await mockEmbed(page);
		await page.goto('/');
		await searchByMeaning(page, 'la gloire de Dieu');
		await search(page, 'autre chose');
		await context.setOffline(true);
		await searchByMeaning(page, 'la gloire de Dieu');
		await expect(results(page).first()).toBeVisible();
		expect(posted).toHaveLength(1);
	});

	test('a new query offline says so at once, and word results stay', async ({ page, context }) => {
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		await context.setOffline(true);
		await meaningButton(page).click();
		await expect(page.getByText('La recherche par le sens nécessite une connexion.')).toBeVisible({
			timeout: 1000
		});
		await expect(results(page).first()).toBeVisible();
		// The mode stays on: Enter tries again once back online.
		await expect(page).toHaveURL(/sens=1/);
	});

	test('a slow reply shows a waiting line that can be cancelled', async ({ page }) => {
		await mockEmbed(page, { delayMs: 15_000 });
		await page.goto('/');
		await search(page, 'gloire');
		await meaningButton(page).click();
		await expect(page.getByText('Recherche par le sens…')).toBeVisible();
		await expect(results(page).first()).toBeVisible();
		await page.getByRole('button', { name: 'Annuler' }).click();
		await expect(page.getByText('Recherche par le sens…')).toHaveCount(0);
		// Cancelling stops the search, not the mode (feature 012).
		await expect(meaningButton(page)).toHaveAttribute('aria-pressed', 'true');
	});

	test('the service is unavailable: a message, and word results stay', async ({ page }) => {
		await mockEmbed(page, { status: 503 });
		await page.goto('/');
		await search(page, 'gloire');
		await meaningButton(page).click();
		await expect(
			page.getByText('La recherche par le sens est indisponible pour le moment.')
		).toBeVisible();
		await expect(results(page).first()).toBeVisible();
	});

	test.describe(() => {
		test.use({ serviceWorkers: 'allow' });

		test('the meaning data downloads once idle, into its own cache, never precached', async ({
			page
		}) => {
			await page.goto('/');
			await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
			await page.reload();
			await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

			await expect
				.poll(
					() =>
						page.evaluate(async () => {
							const cache = await caches.open('hymnia-meaning');
							return (await cache.keys()).map((r) => new URL(r.url).pathname.split('/').pop());
						}),
					{ timeout: 20_000 }
				)
				.toEqual(
					expect.arrayContaining([
						expect.stringMatching(/^meaning\./),
						expect.stringMatching(/^meaning-rows\./)
					])
				);

			const precached = await page.evaluate(async () => {
				const names = (await caches.keys()).filter((n) => n.includes('precache'));
				const urls: string[] = [];
				for (const name of names) {
					for (const r of await (await caches.open(name)).keys()) urls.push(r.url);
				}
				return urls;
			});
			expect(precached.length).toBeGreaterThan(0);
			expect(precached.filter((u) => u.includes('meaning'))).toEqual([]);
		});

		test('on a first visit, before the service worker controls the page, nothing downloads', async ({
			page
		}) => {
			const meaningRequests: string[] = [];
			page.on('request', (r) => {
				if (/\/data\/meaning[^/]*\.bin$/.test(r.url())) meaningRequests.push(r.url());
			});
			await page.goto('/');
			await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
			expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
			await page.waitForTimeout(6000);
			expect(meaningRequests).toEqual([]);
		});
	});
});

test.describe('accessibility and themes', () => {
	for (const scheme of ['light', 'dark'] as const) {
		test(`meaning states have no axe violations (${scheme})`, async ({ page }, info) => {
			await page.emulateMedia({ colorScheme: scheme });
			await mockEmbed(page);
			await page.goto('/');
			await search(page, 'la gloire de Dieu');
			await expect(meaningButton(page)).toBeVisible();
			await page.screenshot({ path: info.outputPath(`button-${scheme}.png`) });
			expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

			await meaningButton(page).click();
			await expect(overline(page)).toContainText('Résultats par le sens');
			await page.screenshot({ path: info.outputPath(`results-${scheme}.png`) });
			expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		});
	}

	test('waiting and offline lines have no axe violations', async ({ page, context }) => {
		await mockEmbed(page, { delayMs: 15_000 });
		await page.goto('/');
		await search(page, 'gloire');
		await meaningButton(page).click();
		await expect(page.getByText('Recherche par le sens…')).toBeVisible();
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		await page.getByRole('button', { name: 'Annuler' }).click();
		await context.setOffline(true);
		await search(page, 'grâce');
		await anyField(page).press('Enter');
		await expect(page.getByText('La recherche par le sens nécessite une connexion.')).toBeVisible();
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	});
});
