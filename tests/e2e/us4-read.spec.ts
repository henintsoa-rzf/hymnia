// User Story 4: read a hymn comfortably (spec.md, acceptance scenarios 1–5, FR-015, FR-017).
import { expect, test } from '@playwright/test';

test('1. verses are numbered and the chorus is labelled', async ({ page }) => {
	await page.goto('/recueils/ce/1');
	await expect(page.locator('.hb-stanza__num')).toHaveText(['Strophe 1', 'Strophe 2', 'Strophe 3']);
	await expect(page.locator('.hb-stanza--refrain .hb-stanza__label')).toHaveText('Refrain');
	// Printed once, after the first verse.
	await expect(page.locator('.hb-stanza--refrain')).toHaveCount(1);
});

test('2. the text size is kept for the next hymn and after a reload', async ({ page }) => {
	await page.goto('/recueils/ce/1');
	await page.getByRole('button', { name: 'Agrandir le texte' }).click();
	await page.getByRole('button', { name: 'Agrandir le texte' }).click();
	const toolbar = page.getByRole('toolbar', { name: 'Lecture' });
	await expect(toolbar.locator('output')).toHaveText('130 %');
	const size = await page
		.locator('.hb-stanza')
		.first()
		.evaluate((el) => getComputedStyle(el).fontSize);
	expect(size).toBe('26px');

	await toolbar.getByRole('link', { name: /Chant suivant/ }).click();
	await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
	await expect(toolbar.locator('output')).toHaveText('130 %');

	await page.reload();
	await expect(page.getByRole('toolbar', { name: 'Lecture' }).locator('output')).toHaveText(
		'130 %'
	);
});

test('3. every other reference is shown and opens the hymn there', async ({ page }) => {
	await page.goto('/recueils/ce/1');
	const also = page.getByRole('region', { name: 'Aussi dans' });
	await expect(also).toContainText('HE 7');
	await also.getByRole('link').click();
	await expect(page).toHaveURL(/\/recueils\/he\/7$/);
});

test('4. credits and source are shown', async ({ page }) => {
	await page.goto('/recueils/ce/1');
	const credits = page.locator('.hb-credits');
	await expect(credits).toContainText('Paroles');
	await expect(credits).toContainText('Edmond Budry');
	await expect(credits).toContainText('Musique');
	await expect(credits).toContainText('Source');
});

test('5. next and previous move within the hymnal; swipe does too', async ({ page }) => {
	await page.goto('/recueils/ce/2');
	const toolbar = page.getByRole('toolbar', { name: 'Lecture' });
	await toolbar.getByRole('link', { name: /Chant précédent/ }).click();
	await expect(page).toHaveURL(/\/recueils\/ce\/1$/);
	await expect(toolbar.getByRole('button', { name: /Pas de chant précédent/ })).toBeDisabled();

	// Swipe left on the lyrics: next hymn.
	await page.locator('.hymn__swipe').evaluate((el) => {
		const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
		el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(300)], bubbles: true }));
		el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(100)], bubbles: true }));
	});
	await expect(page).toHaveURL(/\/recueils\/ce\/2$/);
});

test('the theme can be chosen in Réglages (FR-017)', async ({ page }) => {
	await page.goto('/reglages');
	const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	await page.getByRole('button', { name: 'Sombre' }).click();
	await expect(page.getByRole('button', { name: 'Sombre' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	expect(await bg()).toBe('rgb(20, 19, 17)');
	await page.reload();
	expect(await bg()).toBe('rgb(20, 19, 17)');
	await page.getByRole('button', { name: 'Clair' }).click();
	expect(await bg()).toBe('rgb(250, 248, 244)');
});
