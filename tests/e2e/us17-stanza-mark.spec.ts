// Feature 013: a hymn opened from a search-by-meaning result marks the stanza that ranked it
// (specs/013-meaning-stanza-highlight/spec.md). /api/embed is answered by the fake embedder,
// a bag of words: a query made of a stanza's words ranks that stanza first.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { launchMeaning, mockEmbed, results, search } from './helpers';

/** « À toi la gloire » (CE 1): its last verse, section 3, far below the title. */
const LAST_VERSE = 'Craindrais-je encore, il vit à jamais, celui que j’adore, le Prince de paix';
/** Its first section (verse 1), visible as soon as the hymn opens. */
const FIRST_VERSE =
	'Brillant de lumière, l’ange est descendu, il roule la pierre du tombeau vaincu';
/** The chorus of « Minuit, chrétiens » (CE 23, section 1). */
const CHORUS = 'Peuple, à genoux, attends ta délivrance, Noël, voici le Rédempteur';

const marked = (page: Page) => page.locator('.hb-stanza--match');

async function searchByMeaning(page: Page, query: string) {
	await mockEmbed(page);
	await page.goto('/');
	await search(page, query);
	await launchMeaning(page);
	await expect(page.locator('main h2.hb-overline').first()).toContainText('Résultats par le sens');
}

/** Opens the first result, checking that it is `href` with a passage. */
async function openFirst(page: Page, href: string) {
	await expect(results(page).first()).toHaveAttribute('href', href);
	await results(page).first().click();
	await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === href);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** The marked stanza lies inside the window, above the phone reading bar. */
async function expectFullyVisible(page: Page) {
	const box = (await marked(page).first().boundingBox())!;
	const bar = await page.locator('.hy-readbar').boundingBox();
	const limit = bar ? bar.y : page.viewportSize()!.height;
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.y + box.height).toBeLessThanOrEqual(limit);
}

test.describe('US1: see the stanza that matched', () => {
	test.use({ viewport: { width: 360, height: 640 } });

	test('a stanza far down is marked alone and brought into view', async ({ page }) => {
		await searchByMeaning(page, LAST_VERSE);
		await expect(results(page).first()).toContainText('Craindrais-je encore');
		await openFirst(page, '/recueils/ce/1?passage=3');

		await expect(marked(page)).toHaveCount(1);
		await expect(marked(page)).toContainText('Craindrais-je encore');
		await expect(marked(page)).toContainText('Non, je ne crains rien');
		await expectFullyVisible(page);
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
		// The title stays reachable by scrolling up.
		await page.evaluate(() => window.scrollTo(0, 0));
		await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
	});

	test('a stanza already visible is marked and the page does not move', async ({ page }) => {
		await searchByMeaning(page, FIRST_VERSE);
		await openFirst(page, '/recueils/ce/1?passage=0');
		await expect(marked(page)).toHaveCount(1);
		await expect(marked(page)).toContainText('Brillant de lumière');
		await expectFullyVisible(page);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

	test.describe(() => {
		// The service worker would answer the data requests before page.route sees them.
		test.use({ serviceWorkers: 'block' });

		test('a chorus repeated after each verse is marked once, where it is printed', async ({
			page
		}) => {
			// « Minuit, chrétiens » gets a second verse and its chorus again (sections 2 and 3).
			await page.route('**/data/catalog.*.json', async (route) => {
				const response = await route.fetch();
				const catalog = await response.json();
				const hymn = catalog.hymns.find((h: { id: string }) => h.id === 'minuit-chretiens');
				hymn.sections.push(
					{
						type: 'verse',
						number: 2,
						lines: ['De notre foi que la lumière ardente', 'Nous guide tous au berceau de l’Enfant']
					},
					hymn.sections[1]
				);
				await route.fulfill({ response, json: catalog });
			});
			await searchByMeaning(page, CHORUS);
			await openFirst(page, '/recueils/ce/23?passage=1');
			await expect(page.locator('.hb-stanza')).toHaveCount(3);
			await expect(marked(page)).toHaveCount(1);
			await expect(marked(page)).toHaveClass(/hb-stanza--refrain/);
			await expect(marked(page)).toContainText('Peuple, à genoux');
		});
	});

	test('a wrong passage marks nothing and opens at the top', async ({ page }) => {
		for (const passage of ['999', 'abc', '1']) {
			// '1' is inside « À toi la gloire »'s data, but « Tel que je suis » has one section.
			await page.goto(`/recueils/ce/8?passage=${passage}`);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			await expect(page.locator('.hb-stanza').first()).toBeVisible();
			await expect(marked(page)).toHaveCount(0);
			expect(await page.evaluate(() => window.scrollY)).toBe(0);
		}
	});

	test('screen readers hear that the stanza matches the search', async ({ page }) => {
		await page.goto('/recueils/ce/1?passage=3');
		await expect(marked(page)).toContainText('Passage correspondant à votre recherche');
		await expect(page.locator('.hb-stanza').first()).not.toContainText('Passage correspondant');
	});

	for (const scheme of ['light', 'dark'] as const) {
		test(`a marked hymn has no axe violations (${scheme})`, async ({ page }, info) => {
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto('/recueils/ce/1?passage=3');
			await expect(marked(page)).toBeVisible();
			await page.screenshot({ path: info.outputPath(`marked-${scheme}.png`) });
			expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		});
	}
});

test.describe('US2: the mark belongs to the search, not to the hymn', () => {
	test.use({ viewport: { width: 360, height: 640 } });

	test('next then previous shows no mark', async ({ page }) => {
		await page.goto('/recueils/ce/1?passage=3');
		await expect(marked(page)).toHaveCount(1);
		await page.getByRole('link', { name: /^Chant suivant/ }).click();
		await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
		await expect(page.locator('.hb-stanza').first()).toBeVisible();
		await expect(marked(page)).toHaveCount(0);
		await page.getByRole('link', { name: /^Chant précédent/ }).click();
		await expect(page).toHaveURL(/\/recueils\/ce\/1$/);
		await expect(page.locator('.hb-stanza').first()).toBeVisible();
		await expect(marked(page)).toHaveCount(0);
	});

	test('back to the results, the same result marks the stanza again', async ({ page }) => {
		await searchByMeaning(page, LAST_VERSE);
		await openFirst(page, '/recueils/ce/1?passage=3');
		await expect(marked(page)).toHaveCount(1);
		await page.goBack();
		await expect(results(page).first()).toBeVisible();
		await openFirst(page, '/recueils/ce/1?passage=3');
		await expect(marked(page)).toHaveCount(1);
		await expectFullyVisible(page);
	});

	test('the hymnal list and the recent hymns open the hymn with no mark', async ({ page }) => {
		await page.goto('/recueils/ce/1?passage=3');
		await expect(marked(page)).toHaveCount(1);

		await page.goto('/recueils/ce');
		await page.locator('a.hb-item__link[href$="/recueils/ce/1"]').click();
		await expect(page).toHaveURL(/\/recueils\/ce\/1$/);
		await expect(page.locator('.hb-stanza').first()).toBeVisible();
		await expect(marked(page)).toHaveCount(0);

		await page.goto('/');
		const recent = page.getByRole('list', { name: 'Récemment consultés' });
		await recent.getByRole('link').first().click();
		await expect(page).toHaveURL(/\/recueils\/ce\/1$/);
		await expect(page.locator('.hb-stanza').first()).toBeVisible();
		await expect(marked(page)).toHaveCount(0);
	});

	test('a word search result links with no passage', async ({ page }) => {
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		for (const href of await results(page).evaluateAll((els) =>
			els.map((e) => e.getAttribute('href') ?? '')
		)) {
			expect(href).not.toContain('passage');
		}
	});

	test('back and forward keep the scroll the browser restores', async ({ page }) => {
		await page.goto('/recueils/ce/1?passage=3');
		await expect(marked(page)).toHaveCount(1);
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
		await page.getByRole('link', { name: /^Chant suivant/ }).click();
		await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
		await page.goBack();
		await expect(page).toHaveURL(/passage=3$/);
		await expect(marked(page)).toHaveCount(1);
		await page.waitForTimeout(300);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});
});
