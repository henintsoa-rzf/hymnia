// Feature 015, User Story 2: find hymns from chosen verses (spec.md US2, contracts/bible-ui.md
// §3–4), with /api/embed answered by the fake embedder of the tests.
import { expect, test, type Page } from '@playwright/test';
import { mockEmbed, results } from './helpers';

const verse = (page: Page, n: number) => page.locator(`#v${n} button`);
const bar = (page: Page) => page.getByRole('region', { name: 'Versets choisis' });

test('verses are chosen across chapters, in Bible order', async ({ page }) => {
	await page.goto('/bible/romains/8');
	await verse(page, 38).click();
	await verse(page, 39).click();
	await expect(verse(page, 38)).toHaveAttribute('aria-pressed', 'true');
	await expect(bar(page)).toContainText('2 versets · Romains 8:38-39');

	await page.goto('/bible/psaumes/23');
	await verse(page, 1).click();
	await expect(bar(page)).toContainText('3 versets · Psaume 23:1 ; Romains 8:38-39');

	await verse(page, 1).click();
	await expect(verse(page, 1)).toHaveAttribute('aria-pressed', 'false');
	await expect(bar(page)).toContainText('2 versets');

	await bar(page).getByRole('button', { name: 'Effacer' }).click();
	await expect(bar(page)).toHaveCount(0);
});

test('« Chercher des chants » finds hymns from the verses’ text, once', async ({ page }) => {
	const posted = await mockEmbed(page);
	await page.goto('/bible/romains/8');
	await verse(page, 38).click();
	await verse(page, 39).click();
	await page.goto('/bible/psaumes/23');
	await verse(page, 1).click();
	const texts = await page.evaluate(() => ({
		psalm: document.querySelector('#v1 .verse__text')?.textContent ?? ''
	}));

	await bar(page).getByRole('link', { name: 'Chercher des chants' }).click();
	await expect(page).toHaveURL(/\/bible\/chants\?versets=psaumes\.23\.1~romains\.8\.38-39$/);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(
		'Psaume 23:1 ; Romains 8:38-39'
	);
	await expect(results(page).first()).toBeVisible();
	expect(posted).toHaveLength(1);
	// The measured query form (research R4): the label, then the verses' text in Bible order.
	expect(posted[0].startsWith('Psaume 23:1 ; Romains 8:38-39 — ')).toBe(true);
	expect(posted[0]).toContain(texts.psalm.replace(/\u00a0/g, ' ').slice(0, 20));
	expect(posted[0]).toContain('ni la mort ni la vie');

	// A result opens its hymn with the matching stanza marked (feature 013).
	await results(page).first().click();
	await expect(page).toHaveURL(/passage=\d+/);
	await page.goBack();
	await expect(results(page).first()).toBeVisible();
	expect(posted).toHaveLength(1); // the vector came from the query cache

	await page.getByRole('link', { name: 'Retour aux versets' }).click();
	await expect(page).toHaveURL(/\/bible\/psaumes\/23\?v=1$/);
	await expect(bar(page)).toContainText('3 versets');
});

test('without a connection, the search says so and can be tried again', async ({ page }) => {
	// The network is cut for the embedding call only: the app itself is loaded (in real use the
	// service worker serves it offline, see us19 and offline.spec.ts).
	await page.route('**/api/embed', (route) => route.abort('internetdisconnected'));
	await page.goto('/bible/jean/3');
	await verse(page, 16).click();
	await bar(page).getByRole('link', { name: 'Chercher des chants' }).click();
	await expect(page.getByText('La recherche par le sens nécessite une connexion.')).toBeVisible();
	await page.unroute('**/api/embed');
	await mockEmbed(page);
	await page.getByRole('button', { name: 'Réessayer' }).click();
	await expect(results(page).first()).toBeVisible();
});

test('the selection stops at the length limit', async ({ page }) => {
	await page.goto('/bible/psaumes/119');
	for (let n = 1; n <= 40; n++) await verse(page, n).click();
	await expect(bar(page).getByText(/Limite atteinte/)).toBeVisible();
	const chosen = await page
		.locator('.verse__toggle[aria-pressed="true"] .verse__text')
		.allTextContents();
	expect(chosen.length).toBeLessThan(40);
	expect(chosen.join(' ').length).toBeLessThanOrEqual(2000);
});

test('hymnals left out in Settings never appear', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'hymnia.prefs',
			JSON.stringify({ excluded: { hymnals: ['he'], parts: {} } })
		);
	});
	await mockEmbed(page);
	await page.goto('/bible/chants?versets=luc.2.10-14');
	await expect(results(page).first()).toBeVisible();
	for (const refs of await results(page).locator('.hy-result__refs').allTextContents()) {
		expect(refs).not.toMatch(/HE/);
	}
});

test('an empty or invalid selection says no verse is chosen', async ({ page }) => {
	await page.goto('/bible/chants?versets=nope');
	await expect(page.getByText('Aucun verset choisi')).toBeVisible();
});

test.describe('User Story 3: copy the chosen verses', () => {
	test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

	test('« Copier » gives the text, then the reference and the translation', async ({
		page,
		browserName
	}) => {
		await page.goto('/bible/jean/3');
		await verse(page, 16).click();
		await verse(page, 17).click();
		await bar(page).getByRole('button', { name: 'Copier' }).click();
		await expect(bar(page).getByText('Versets copiés')).toBeVisible();
		test.skip(browserName !== 'chromium', 'clipboard reads need Chromium');
		const copied = await page.evaluate(() => navigator.clipboard.readText());
		expect(copied).toMatch(
			/^Car Dieu a tant aimé le monde .+\n— Jean 3:16-17 \(Louis Segond 1910\)$/s
		);
	});
});
