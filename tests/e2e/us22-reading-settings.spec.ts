// Feature 016, story 2: Réglages › Lecture lays out the lyrics of every hymn
// (specs/016-settings-menu-sections, FR-008 to FR-015). Sample hymn CE 1 « À toi la gloire »:
// verse 1, chorus, verse 2, verse 3.
import { expect, test, type Page } from '@playwright/test';

declare global {
	interface Window {
		__wake: { requests: number; releases: number };
	}
}

/** A fake Screen Wake Lock that counts requests and releases. */
async function fakeWakeLock(page: Page) {
	await page.addInitScript(() => {
		window.__wake = { requests: 0, releases: 0 };
		Object.defineProperty(navigator, 'wakeLock', {
			configurable: true,
			value: {
				request: async () => {
					window.__wake.requests++;
					return {
						release: async () => {
							window.__wake.releases++;
						}
					};
				}
			}
		});
	});
}

const pick = (page: Page, group: string, name: string) =>
	page.getByRole('group', { name: group }).getByRole('button', { name, exact: true });
const preview = (page: Page) => page.getByRole('group', { name: 'Aperçu' });
const wake = (page: Page) => page.evaluate(() => window.__wake);

test('the Lecture settings change the preview at once and every hymn (FR-009 to FR-012)', async ({
	page
}) => {
	await page.goto('/reglages/lecture');
	await expect(page.getByRole('heading', { level: 2 })).toHaveText([
		'Taille du texte',
		'Police des paroles',
		'Interligne',
		'Numéros des strophes',
		'Refrain',
		'Garder l’écran allumé'
	]);
	await expect(preview(page).locator('.hb-stanza--refrain')).toHaveCount(1);
	await expect(preview(page).locator('.hb-stanza__num')).toHaveCount(2);

	await pick(page, 'Police des paroles', 'Sans empattement').click();
	await pick(page, 'Interligne', 'Aéré').click();
	await page.getByRole('switch', { name: 'Afficher les numéros' }).uncheck();
	await pick(page, 'Refrain', 'Après chaque strophe').click();

	const stanza = preview(page).locator('.hb-stanza').first();
	expect(await stanza.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
		'Instrument Sans'
	);
	await expect(preview(page).locator('.hb-stanza__num')).toHaveCount(0);
	await expect(preview(page).locator('.hb-stanza--refrain')).toHaveCount(2);

	await page.goto('/recueils/ce/1');
	const first = page.locator('.hb-stanza').first();
	const ratio = await first.evaluate((el) => {
		const style = getComputedStyle(el);
		return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
	});
	expect(ratio).toBeCloseTo(1.85, 2);
	await expect(page.locator('.hb-stanza__num')).toHaveCount(0);
	// Numbers are still announced to screen readers.
	await expect(page.locator('.hb-stanza').first()).toContainText('Strophe 1');
	await expect(page.locator('.hb-stanza--refrain')).toHaveCount(3);
	// Titles keep their font.
	expect(
		await page.locator('.hb-header__title').evaluate((el) => getComputedStyle(el).fontFamily)
	).toContain('Literata');

	await page.reload();
	await expect(page.locator('.hb-stanza--refrain')).toHaveCount(3);
	await page.goto('/reglages/lecture');
	await expect(pick(page, 'Interligne', 'Aéré')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('switch', { name: 'Afficher les numéros' })).not.toBeChecked();
});

test('defaults keep the current layout', async ({ page }) => {
	await page.goto('/recueils/ce/1');
	await expect(page.locator('.hb-stanza__num')).toHaveText(['Strophe 1', 'Strophe 2', 'Strophe 3']);
	await expect(page.locator('.hb-stanza--refrain')).toHaveCount(1);
	const ratio = await page
		.locator('.hb-stanza')
		.first()
		.evaluate(
			(el) =>
				parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize)
		);
	expect(ratio).toBeCloseTo(1.6, 2);
});

test('the screen is kept on only while a hymn is open (FR-013)', async ({ page }) => {
	await fakeWakeLock(page);
	await page.goto('/recueils/ce/1');
	await expect(page.locator('.hb-stanza').first()).toBeVisible();
	expect((await wake(page)).requests).toBe(0);

	await page.goto('/reglages/lecture');
	await page.getByRole('switch', { name: 'Empêcher la mise en veille' }).check();
	// A fresh page load resets the counters; the setting is kept on the device.
	await page.goto('/recueils/ce/1');
	await expect.poll(async () => (await wake(page)).requests).toBe(1);
	// Next hymn: same lock.
	await page.getByRole('link', { name: /^Chant suivant/ }).click();
	await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
	expect(await wake(page)).toEqual({ requests: 1, releases: 0 });
	await page.getByRole('link', { name: /^Retour à/ }).click();
	await expect.poll(async () => (await wake(page)).releases).toBe(1);
});

test('without wake lock support, the switch is disabled with a note', async ({ page }) => {
	await page.addInitScript(() => {
		// @ts-expect-error: removing the API to emulate an older browser.
		delete Navigator.prototype.wakeLock;
	});
	await page.goto('/reglages/lecture');
	await expect(page.getByRole('switch', { name: 'Empêcher la mise en veille' })).toBeDisabled();
	await expect(page.getByText('Non disponible sur cet appareil')).toBeVisible();
});

test('large text with « Aéré » keeps lines apart', async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem('hymnia.prefs', JSON.stringify({ textScale: 2, lineSpacing: 'loose' }))
	);
	await page.goto('/recueils/ce/1');
	const boxes = await page
		.locator('.hb-stanza')
		.first()
		.locator('.hb-stanza__line')
		.evaluateAll((els) =>
			els.map((el) => el.getBoundingClientRect()).map((r) => [r.top, r.bottom])
		);
	for (let i = 1; i < boxes.length; i++)
		expect(boxes[i][0]).toBeGreaterThanOrEqual(boxes[i - 1][1] - 0.5);
});
