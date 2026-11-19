// Feature 012: the search-by-meaning mode of the search field
// (specs/012-meaning-search-mode/spec.md, US1–US3; contracts/search-mode.md).
import { expect, test, type Page } from '@playwright/test';
import {
	anyField,
	launchButton,
	launchMeaning,
	meaningButton,
	meaningField,
	mockEmbed,
	results,
	search,
	searchField
} from './helpers';

const overline = (page: Page) => page.locator('main h2.hb-overline').first();
/** The visible frame of the field (the label around the textarea). */
const frame = (page: Page) => page.getByRole('search').locator('label');

async function height(page: Page) {
	return (await frame(page).boundingBox())!.height;
}

const borderColor = (page: Page) =>
	frame(page).evaluate((el) => getComputedStyle(el).borderTopColor);

test.describe('US1: notice and enter the search-by-meaning mode', () => {
	test('the switch is there from the start, whatever the query', async ({ page }) => {
		await page.goto('/');
		await expect(meaningButton(page)).toBeVisible();
		await expect(meaningButton(page)).toHaveAttribute('aria-checked', 'false');
		await expect(meaningButton(page)).toHaveAttribute('title', 'Recherche par le sens');
		await expect(launchButton(page)).toHaveCount(0);
		for (const query of ['245', 'CE 1', 'grâce']) {
			await search(page, query);
			await expect(meaningButton(page)).toBeVisible();
		}
	});

	test('turning it on doubles the field, changes its frame and keeps the focus', async ({
		page
	}) => {
		await page.goto('/');
		await expect(searchField(page)).toBeFocused();
		const wordHeight = await height(page);
		const wordBorder = await borderColor(page);

		await meaningButton(page).click();
		await expect(meaningButton(page)).toHaveAttribute('aria-checked', 'true');
		await expect(meaningField(page)).toBeFocused();
		await expect(meaningField(page)).toHaveAttribute(
			'placeholder',
			'Décrivez un thème, une idée, un passage…'
		);
		await expect.poll(() => height(page)).toBeGreaterThanOrEqual(wordHeight * 1.8);
		expect(await borderColor(page)).not.toBe(wordBorder);
		await expect(page).toHaveURL(/sens=1/);
		await expect(launchButton(page)).toBeVisible();
		await expect(launchButton(page)).toBeDisabled();
	});

	test('turning it on runs nothing, even on a text already typed', async ({ page }) => {
		const posted = await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await meaningButton(page).click();
		await expect(launchButton(page)).toBeEnabled();
		await page.waitForTimeout(500);
		expect(posted).toEqual([]);
		await expect(overline(page)).not.toContainText('Résultats par le sens');
		await expect(results(page).first()).toBeVisible();
	});

	test('in the mode, nothing is sent while typing; the launch button sends it', async ({
		page
	}) => {
		const posted = await mockEmbed(page);
		await page.goto('/');
		await meaningButton(page).click();
		const text = "un chant d'espérance pour des funérailles";
		await meaningField(page).pressSequentially(text);
		await expect(results(page).first()).toBeVisible();
		expect(posted).toEqual([]);
		await launchButton(page).click();
		await expect(overline(page)).toContainText('Résultats par le sens');
		expect(posted).toEqual([text]);
	});

	test('Enter launches it too, and never adds a line break', async ({ page }) => {
		const posted = await mockEmbed(page);
		await page.goto('/?sens=1');
		const text = 'la grâce de Dieu';
		await meaningField(page).fill(text);
		await meaningField(page).press('Enter');
		await expect(overline(page)).toContainText('Résultats par le sens');
		expect(posted).toEqual([text]);
		await expect(meaningField(page)).toHaveValue(text);
	});

	test('a hymn number with Enter opens the hymn, with no search by meaning', async ({ page }) => {
		const posted = await mockEmbed(page);
		await page.goto('/?sens=1');
		await expect(meaningButton(page)).toHaveAttribute('aria-checked', 'true');
		await search(page, 'CE 1');
		await expect(page.locator('.hy-exact')).toBeVisible();
		await anyField(page).press('Enter');
		await expect(page).toHaveURL(/\/recueils\/ce\/1$/);
		expect(posted).toEqual([]);
	});

	test('editing the text keeps the results by meaning until the button is pressed again', async ({
		page
	}) => {
		const posted = await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(overline(page)).toContainText('Résultats par le sens');
		await search(page, 'la gloire de Dieu seul');
		await page.waitForTimeout(500);
		await expect(overline(page)).toContainText('Résultats par le sens');
		expect(posted).toEqual(['la gloire de Dieu']);
		await launchButton(page).click();
		await expect.poll(() => posted).toEqual(['la gloire de Dieu', 'la gloire de Dieu seul']);
		await expect(overline(page)).toContainText('Résultats par le sens');
	});

	test('a hymn number typed over results by meaning shows its hymn', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(overline(page)).toContainText('Résultats par le sens');
		await search(page, 'CE 1');
		await expect(page.locator('.hy-exact')).toBeVisible();
	});

	test('pasted line breaks become spaces', async ({ page }) => {
		await page.goto('/?sens=1');
		await meaningField(page).fill('la grâce\nde Dieu\r\n  pour tous');
		await expect(meaningField(page)).toHaveValue('la grâce de Dieu pour tous');
		await expect(page).toHaveURL(/q=la(\+|%20)gr/);
		expect(new URL(page.url()).searchParams.get('q')).toBe('la grâce de Dieu pour tous');
	});

	test('a link with sens=1 opens in the mode, with the results by meaning', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/?q=la%20gloire%20de%20Dieu&sens=1');
		await expect(meaningButton(page)).toHaveAttribute('aria-checked', 'true');
		await expect(meaningField(page)).toHaveValue('la gloire de Dieu');
		await expect(overline(page)).toContainText('Résultats par le sens');
	});
});

test.describe('US2: return to word search', () => {
	test('pressing again gives back the word field, text and results', async ({ page }) => {
		await mockEmbed(page);
		await page.goto('/');
		const wordHeight = await height(page);
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(overline(page)).toContainText('Résultats par le sens');

		await meaningButton(page).click();
		await expect(meaningButton(page)).toHaveAttribute('aria-checked', 'false');
		await expect(searchField(page)).toHaveValue('la gloire de Dieu');
		await expect(searchField(page)).toHaveAttribute('placeholder', 'Numéro, titre ou paroles');
		await expect.poll(() => height(page)).toBeLessThanOrEqual(wordHeight + 2);
		await expect(overline(page)).not.toContainText('Résultats par le sens');
		await expect(results(page).first()).toBeVisible();
		await expect(page).not.toHaveURL(/sens=1/);
		await expect(launchButton(page)).toHaveCount(0);
	});

	test('leaving the mode cancels a search in progress', async ({ page }) => {
		await mockEmbed(page, { delayMs: 2000 });
		await page.goto('/');
		await search(page, 'la gloire de Dieu');
		await launchMeaning(page);
		await expect(page.getByText('Recherche par le sens…')).toBeVisible();
		await meaningButton(page).click();
		await expect(page.getByText('Recherche par le sens…')).toHaveCount(0);
		await page.waitForTimeout(2500);
		await expect(overline(page)).not.toContainText('Résultats par le sens');
		await expect(results(page).first()).toBeVisible();
	});

	test('the clear button keeps the mode', async ({ page }) => {
		await page.goto('/?sens=1');
		const meaningHeight = await height(page);
		await meaningField(page).fill('la grâce');
		await page.getByRole('button', { name: 'Effacer la recherche' }).click();
		await expect(meaningField(page)).toHaveValue('');
		await expect(meaningButton(page)).toHaveAttribute('aria-checked', 'true');
		expect(await height(page)).toBe(meaningHeight);
	});
});

/**
 * Records every size change of the form, the field's frame and the mode switch, and every
 * control added or removed in the form, except the clear button inside the field (research R9).
 */
async function watchLayout(page: Page) {
	await page.getByRole('search').waitFor();
	await page.evaluate(() => {
		const form = document.querySelector('form[role="search"]')!;
		const changes: string[] = [];
		(window as unknown as { layoutChanges: string[] }).layoutChanges = changes;
		const targets = [form, form.querySelector('label'), form.querySelector('.mode-btn')].filter(
			(el): el is Element => el !== null
		);
		const seen = new Set<Element>();
		new ResizeObserver((entries) => {
			for (const e of entries) {
				if (!seen.has(e.target)) seen.add(e.target);
				else
					changes.push(`resize ${e.target.tagName} ${e.contentRect.width}×${e.contentRect.height}`);
			}
		}).observe(form);
		for (const t of targets.slice(1)) {
			new ResizeObserver((entries) => {
				for (const e of entries) {
					if (!seen.has(e.target)) seen.add(e.target);
					else changes.push(`resize ${e.target.tagName}`);
				}
			}).observe(t);
		}
		new MutationObserver((records) => {
			for (const r of records) {
				for (const n of [...r.addedNodes, ...r.removedNodes]) {
					if (n instanceof Element && !n.classList.contains('search-box__clear')) {
						changes.push(`dom ${n.tagName}.${n.className}`);
					}
				}
			}
		}).observe(form, { childList: true, subtree: true });
	});
}

const layoutChanges = (page: Page) =>
	page.evaluate(() => (window as unknown as { layoutChanges: string[] }).layoutChanges);

async function typeAndDelete(page: Page, text: string) {
	await anyField(page).pressSequentially(text);
	await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(text);
	await page.waitForTimeout(200);
	for (let i = 0; i < text.length; i++) await anyField(page).press('Backspace');
	await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(null);
}

test.describe('US3: type without blinking', () => {
	const text = '245 grâce infinie de Dieu';
	for (const width of [360, 1280]) {
		for (const mode of ['word', 'meaning'] as const) {
			test(`nothing moves while typing (${mode} mode, ${width} px)`, async ({ page }) => {
				await page.setViewportSize({ width, height: 800 });
				await page.goto(mode === 'meaning' ? '/?sens=1' : '/');
				await expect(meaningButton(page)).toHaveAttribute(
					'aria-checked',
					String(mode === 'meaning')
				);
				// Let the search worker start, so its answers come while typing.
				await expect(page.locator('main .search__help')).toBeVisible();
				const before = await meaningButton(page).boundingBox();
				await watchLayout(page);
				await typeAndDelete(page, text);
				expect(await layoutChanges(page)).toEqual([]);
				expect(await meaningButton(page).boundingBox()).toEqual(before);
			});
		}
	}

	test('nothing moves while typing before the search is ready', async ({ page }) => {
		await page.route('**/data/index.*.json', async (route) => {
			await new Promise((r) => setTimeout(r, 1500));
			await route.continue().catch(() => {});
		});
		await page.goto('/');
		await watchLayout(page);
		await anyField(page).pressSequentially('grâce');
		await expect(results(page).first()).toBeVisible({ timeout: 10_000 });
		expect(await layoutChanges(page)).toEqual([]);
	});

	test('without meaning data: no button, a full-width field, nothing moves', async ({ page }) => {
		await page.route('**/data/manifest.json', async (route) => {
			const response = await route.fetch();
			const manifest = await response.json();
			delete manifest.meaning;
			await route.fulfill({ response, json: manifest });
		});
		await page.goto('/?q=gr%C3%A2ce&sens=1');
		await expect(searchField(page)).toBeVisible();
		await expect(meaningButton(page)).toHaveCount(0);
		await expect(page).not.toHaveURL(/sens=1/);
		const field = (await frame(page).boundingBox())!;
		const form = (await page.getByRole('search').boundingBox())!;
		expect(Math.abs(field.x + field.width - (form.x + form.width))).toBeLessThanOrEqual(1);
		await anyField(page).fill('');
		await watchLayout(page);
		await typeAndDelete(page, text);
		expect(await layoutChanges(page)).toEqual([]);
	});
});
