// Feature 017: the sequence that shows a search by meaning happening (clear, placeholder, reveal)
// and the marker of results by meaning (specs/017-meaning-results-transition/spec.md, US1–US3).
// /api/embed is answered by the fake embedder of the tests.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { anyField, launchMeaning, meaningButton, mockEmbed, results, search } from './helpers';

const placeholder = (page: Page) => page.locator('main .meaning-transition');

type Stamps = {
	launchedAt: number | null;
	repliedAt: number | null;
	shownAt: number | null;
	sawPlaceholder: boolean;
};

/**
 * Times, in the page's clock, of the last launch (click on the launch button), of the last
 * /api/embed reply, and of the first result row shown after the placeholder.
 */
async function watchSequence(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { stamps: Stamps };
		w.stamps = { launchedAt: null, repliedAt: null, shownAt: null, sawPlaceholder: false };
		document.addEventListener(
			'click',
			(event) => {
				const target = event.target as Element | null;
				if (target?.closest('[aria-label="Lancer la recherche par le sens"]')) {
					w.stamps = {
						launchedAt: performance.now(),
						repliedAt: null,
						shownAt: null,
						sawPlaceholder: false
					};
				}
			},
			true
		);
		const fetch0 = window.fetch.bind(window);
		window.fetch = async (...args: Parameters<typeof fetch>) => {
			const reply = await fetch0(...args);
			const url =
				typeof args[0] === 'string' ? args[0] : String((args[0] as Request).url ?? args[0]);
			if (url.includes('/api/embed')) w.stamps.repliedAt = performance.now();
			return reply;
		};
		new MutationObserver(() => {
			const s = w.stamps;
			if (s.launchedAt === null || s.shownAt !== null) return;
			if (document.querySelector('main .meaning-transition')) s.sawPlaceholder = true;
			else if (s.sawPlaceholder && document.querySelector('main .hy-result')) {
				s.shownAt = performance.now();
			}
		}).observe(document, { childList: true, subtree: true });
	});
}

const stamps = (page: Page) =>
	page.evaluate(() => (window as unknown as { stamps: Stamps }).stamps);

test.describe('US1: see the search by meaning happen', () => {
	test('the list empties, the placeholder shows, then the results come in', async ({ page }) => {
		await mockEmbed(page, { delayMs: 1500 });
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		await launchMeaning(page);
		await expect(results(page)).toHaveCount(0, { timeout: 500 });
		await expect(placeholder(page)).toBeVisible();
		await expect(page.getByText('Recherche par le sens…')).toBeVisible();
		await expect(results(page).first()).toBeVisible({ timeout: 5000 });
		await expect(placeholder(page)).toHaveCount(0);
	});

	test('the leaving list can no longer be used', async ({ page }) => {
		await mockEmbed(page, { delayMs: 1500 });
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		await launchMeaning(page);
		const leaving = page.locator('main .is-leaving');
		// Either caught while fading out (inert), or already replaced by the placeholder.
		if ((await leaving.count()) > 0) await expect(leaving).toHaveAttribute('inert', '');
		await expect(placeholder(page)).toBeVisible();
	});

	test('a cached answer still shows the sequence, for about 400 ms', async ({ page }) => {
		await watchSequence(page);
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(page.locator('main h2.hb-overline')).toContainText('Résultats par le sens');
		await expect.poll(async () => (await stamps(page)).shownAt).not.toBeNull();
		// Validated again on the same text: the vector is cached, the sequence plays again.
		await page.locator('[aria-label="Lancer la recherche par le sens"]').click();
		await expect.poll(async () => (await stamps(page)).shownAt).not.toBeNull();
		const s = await stamps(page);
		expect(s.sawPlaceholder).toBe(true);
		const delay = s.shownAt! - s.launchedAt!;
		expect(delay).toBeGreaterThanOrEqual(400);
		expect(delay).toBeLessThan(600);
	});

	test('a slow answer shows at once when it arrives', async ({ page }) => {
		await watchSequence(page);
		await mockEmbed(page, { delayMs: 1500 });
		await page.goto('/');
		await search(page, 'la nuit de Noël et les anges');
		await launchMeaning(page);
		await expect.poll(async () => (await stamps(page)).shownAt, { timeout: 5000 }).not.toBeNull();
		const s = await stamps(page);
		expect(s.repliedAt).not.toBeNull();
		expect(s.shownAt! - s.repliedAt!).toBeLessThan(150);
	});

	test('the search field does not move during the sequence', async ({ page }) => {
		await mockEmbed(page, { delayMs: 1000 });
		await page.goto('/');
		await search(page, 'gloire');
		await launchMeaning(page);
		await expect(page.locator('main h2.hb-overline')).toContainText('Résultats par le sens', {
			timeout: 5000
		});
		const before = await anyField(page).boundingBox();
		await anyField(page).press('Enter');
		await expect(placeholder(page)).toBeVisible();
		expect(await anyField(page).boundingBox()).toEqual(before);
		await expect(results(page).first()).toBeVisible({ timeout: 5000 });
		expect(await anyField(page).boundingBox()).toEqual(before);
	});

	test('a reloaded link waits, then shows the results, with nothing to clear', async ({ page }) => {
		await mockEmbed(page, { delayMs: 800 });
		await page.goto('/?q=la%20gloire%20de%20Dieu&sens=1');
		await expect(placeholder(page)).toBeVisible();
		await expect(page.locator('main .is-leaving')).toHaveCount(0);
		await expect(page.locator('main h2.hb-overline')).toContainText('Résultats par le sens', {
			timeout: 5000
		});
	});
});

const meaningList = (page: Page) => page.locator('main ul.hb-list--meaning');
const meaningHeading = (page: Page) => page.locator('main h2.hb-overline--meaning');

test.describe('US2: tell results by meaning at a glance', () => {
	test('word results carry no marker', async ({ page }) => {
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		await expect(meaningList(page)).toHaveCount(0);
		await expect(meaningHeading(page)).toHaveCount(0);
	});

	test('results by meaning carry the heading glyph and a bar per row', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(meaningHeading(page)).toContainText('Résultats par le sens');
		await expect(meaningHeading(page).locator('svg')).toHaveCount(1);
		const colors = await meaningList(page).evaluate((ul) => {
			const li = ul.querySelector('li')!;
			const probe = document.createElement('span');
			probe.style.color = 'var(--meaning)';
			document.body.append(probe);
			const meaning = getComputedStyle(probe).color;
			probe.remove();
			const bar = getComputedStyle(li, '::before');
			return { bar: bar.backgroundColor, width: bar.width, meaning };
		});
		expect(colors.bar).toBe(colors.meaning);
		expect(colors.width).toBe('3px');
	});

	test('the marker does not move the text of the rows', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		const title = page.locator('main .hy-result__title').first();
		await expect(title).toBeVisible();
		const wordX = (await title.boundingBox())!.x;
		await launchMeaning(page);
		await expect(meaningList(page)).toBeVisible();
		await page.waitForTimeout(600); // the reveal is over
		expect((await title.boundingBox())!.x).toBe(wordX);
	});

	test('the marker goes with the meaning list', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(meaningList(page)).toBeVisible();
		await search(page, '12');
		await expect(results(page).first()).toBeVisible();
		await expect(meaningList(page)).toHaveCount(0);
		await expect(meaningHeading(page)).toHaveCount(0);
	});

	test('no horizontal scroll at 320 px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 700 });
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(meaningList(page)).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			320
		);
	});

	for (const colorScheme of ['light', 'dark'] as const) {
		test(`marked results have no axe violations (${colorScheme})`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await mockEmbed(page);
			await page.goto('/');
			await search(page, 'la gloire de Dieu');
			await launchMeaning(page);
			await expect(meaningList(page)).toBeVisible();
			await page.waitForTimeout(600);
			expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
		});
	}
});

test.describe('US3: return to word results', () => {
	async function launchSlow(page: Page) {
		await mockEmbed(page, { delayMs: 15_000 });
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		await launchMeaning(page);
		await expect(placeholder(page)).toBeVisible();
	}

	test('cancelling brings the word results back', async ({ page }) => {
		await launchSlow(page);
		await page.getByRole('button', { name: 'Annuler' }).click();
		await expect(placeholder(page)).toHaveCount(0, { timeout: 500 });
		await expect(results(page).first()).toBeVisible({ timeout: 500 });
		await expect(meaningList(page)).toHaveCount(0);
	});

	test('leaving the mode brings the word results back', async ({ page }) => {
		await launchSlow(page);
		await meaningButton(page).click();
		await expect(placeholder(page)).toHaveCount(0, { timeout: 500 });
		await expect(results(page).first()).toBeVisible({ timeout: 500 });
		await expect(meaningList(page)).toHaveCount(0);
	});

	test('emptying the field ends the sequence', async ({ page }) => {
		await launchSlow(page);
		await anyField(page).fill('');
		await expect(placeholder(page)).toHaveCount(0, { timeout: 500 });
		await expect(page.locator('main .search__help')).toBeVisible();
	});

	test('a failed search shows its message above the word results', async ({ page }) => {
		await mockEmbed(page, { status: 503 });
		await page.goto('/');
		await search(page, 'gloire');
		await launchMeaning(page);
		await expect(
			page.getByText('La recherche par le sens est indisponible pour le moment.')
		).toBeVisible();
		await expect(results(page).first()).toBeVisible({ timeout: 500 });
		await expect(placeholder(page)).toHaveCount(0);
	});

	test('offline: the message and the word results', async ({ page, context }) => {
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		await context.setOffline(true);
		await launchMeaning(page);
		await expect(page.getByText('La recherche par le sens nécessite une connexion.')).toBeVisible();
		await expect(results(page).first()).toBeVisible({ timeout: 500 });
		await expect(placeholder(page)).toHaveCount(0);
	});

	test('changing the hymnal filter does not play the sequence again', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(meaningList(page)).toBeVisible();
		await page.waitForTimeout(600);
		await page
			.getByRole('group', { name: 'Filtrer par recueil' })
			.getByRole('button', { name: 'Cantiques d’exemple' })
			.click();
		for (let i = 0; i < 10; i++) {
			expect(await placeholder(page).count()).toBe(0);
			await page.waitForTimeout(100);
		}
		await expect(meaningList(page)).toBeVisible();
	});
});

test.describe('motion and accessibility', () => {
	test('reduced motion: the same steps, nothing moves', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await mockEmbed(page, { delayMs: 1000 });
		await page.goto('/');
		await search(page, 'gloire');
		await expect(results(page).first()).toBeVisible();
		const running = () =>
			page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
		await launchMeaning(page);
		expect(await running()).toBe(0);
		await expect(placeholder(page)).toBeVisible();
		await expect(results(page)).toHaveCount(0);
		expect(await running()).toBe(0);
		await expect(meaningList(page)).toBeVisible({ timeout: 5000 });
		expect(await running()).toBe(0);
	});

	test('the placeholder is hidden from assistive technology, with no axe violations', async ({
		page
	}) => {
		await mockEmbed(page, { delayMs: 15_000 });
		await page.goto('/');
		await search(page, 'gloire');
		await launchMeaning(page);
		await expect(placeholder(page)).toBeVisible();
		await expect(placeholder(page)).toHaveAttribute('aria-hidden', 'true');
		expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
	});
});
