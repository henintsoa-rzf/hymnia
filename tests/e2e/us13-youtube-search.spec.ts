// Feature 007, User Story 1: search the hymn on YouTube (spec.md, US1; contracts/ui.md).
import { expect, test, type Page } from '@playwright/test';
import { seedCollections } from './helpers';

const SEARCH = 'https://www.youtube.com/results?search_query=';
const link = (page: Page) =>
	page.getByRole('link', { name: 'Rechercher sur YouTube', exact: true });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(page.locator('main h1')).toBeVisible();
}

test('1. the link searches the displayed title, in a new tab, without referrer', async ({
	page
}) => {
	await open(page, '/recueils/ce/1');
	await expect(link(page)).toBeVisible();
	await expect(link(page)).toHaveAttribute('href', `${SEARCH}%C3%80%20toi%20la%20gloire`);
	await expect(link(page)).toHaveAttribute('target', '_blank');
	await expect(link(page)).toHaveAttribute('rel', /noopener/);
	await expect(link(page)).toHaveAttribute('rel', /noreferrer/);
});

test('2. the link sits under the credits, not in the top bar or the reading bar', async ({
	page
}) => {
	await open(page, '/recueils/ce/1');
	await expect(page.locator('main .hb-credits + .hymn__youtube a')).toHaveCount(1);
	await expect(page.locator('.hymn-top').getByRole('link', { name: /YouTube/ })).toHaveCount(0);
	await expect(
		page.getByRole('toolbar', { name: 'Lecture' }).getByRole('link', { name: /YouTube/ })
	).toHaveCount(0);
});

test('3. the search follows the hymn shown, also after « Chant suivant »', async ({ page }) => {
	await open(page, '/recueils/ce/1');
	await page
		.getByRole('toolbar', { name: 'Lecture' })
		.getByRole('link', { name: /Chant suivant/ })
		.click();
	await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
	await expect(link(page)).toHaveAttribute(
		'href',
		`${SEARCH}C%E2%80%99est%20un%20rempart%20que%20notre%20Dieu`
	);
});

test('4. the link is there when reading a collection', async ({ page }) => {
	await seedCollections(page, [{ name: 'Culte', entries: [['ce', '1']] }]);
	await open(page, '/recueils/ce/1?collection=c1');
	await expect(link(page)).toHaveAttribute('href', `${SEARCH}%C3%80%20toi%20la%20gloire`);
});

test('5. loading a hymn makes no request to YouTube', async ({ page }) => {
	const youtube: string[] = [];
	page.on('request', (r) => {
		if (/youtube\.com|ytimg\.com|googlevideo\.com/.test(r.url())) youtube.push(r.url());
	});
	await page.goto('/recueils/ce/1');
	await page.waitForLoadState('networkidle');
	await expect(link(page)).toBeVisible();
	expect(youtube).toEqual([]);
});

test('6. following the link opens YouTube and leaves the hymn as it was', async ({
	page,
	context
}) => {
	await context.route('**/www.youtube.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: '<title>YouTube</title>' })
	);
	await open(page, '/recueils/ce/1');
	const [tab] = await Promise.all([context.waitForEvent('page'), link(page).click()]);
	await tab.waitForLoadState();
	expect(tab.url().startsWith(SEARCH)).toBe(true);
	await expect(page).toHaveURL(/\/recueils\/ce\/1$/);
	await expect(page.locator('main h1')).toContainText('À toi la gloire');
});

test('7. desktop: under the credits, not in the tools row', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await open(page, '/recueils/ce/1');
	await expect(link(page)).toBeVisible();
	await expect(page.locator('.hymn__tools').getByRole('link', { name: /YouTube/ })).toHaveCount(0);
});

test('8. keyboard: the link is the next stop after the top bar (no other link in the lyrics)', async ({
	page,
	browserName
}) => {
	test.skip(browserName === 'webkit', 'WebKit does not Tab to links by default');
	await open(page, '/recueils/ce/1');
	await page.locator('.hymn-top').getByRole('button', { name: 'Ajouter à une collection' }).focus();
	await page.keyboard.press('Tab');
	await expect(link(page)).toBeFocused();
});
