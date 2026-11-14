// Feature 008, User Story 1: reorder a collection by drag-and-drop (spec.md, US1; contracts/ui.md).
import { expect, test, type Page } from '@playwright/test';
import { collectionTitles, seedCollections } from './helpers';

const ALL: [string, string][] = [
	['ce', '1'],
	['ce', '2'],
	['ce', '3'],
	['ce', '5'],
	['ce', '7'],
	['ce', '8'],
	['ce', '12'],
	['ce', '20'],
	['ce', '23'],
	['he', '12'],
	['he', '13']
];

const row = (page: Page, n: number) => page.locator(`ol.collection__list li[data-row="${n}"]`);
const handle = (page: Page, n: number) => row(page, n).locator('.collection__handle');
const status = (page: Page) => page.locator('p.hb-sr[aria-live]');

async function centre(page: Page, n: number) {
	const box = await handle(page, n).boundingBox();
	if (!box) throw new Error(`no handle on row ${n}`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function rowBox(page: Page, n: number) {
	const box = await row(page, n).boundingBox();
	if (!box) throw new Error(`no row ${n}`);
	return box;
}

/** Press the handle of row `from`, move to `toY` in steps (mouse pointer), optionally release. */
async function mouseDrag(page: Page, from: number, toY: number, release = true) {
	const { x, y } = await centre(page, from);
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, toY, { steps: 12 });
	if (release) await page.mouse.up();
}

/** Same with a touch pointer (synthetic Pointer Events, like the swipe test in us9). */
async function touchDrag(page: Page, target: ReturnType<typeof handle>, toY: number) {
	await target.evaluate((el, endY) => {
		const box = el.getBoundingClientRect();
		const x = box.left + box.width / 2;
		const startY = box.top + box.height / 2;
		const fire = (type: string, y: number) =>
			el.dispatchEvent(
				new PointerEvent(type, {
					pointerId: 7,
					pointerType: 'touch',
					isPrimary: true,
					button: 0,
					buttons: type === 'pointerup' ? 0 : 1,
					clientX: x,
					clientY: y,
					bubbles: true,
					cancelable: true
				})
			);
		fire('pointerdown', startY);
		for (let i = 1; i <= 10; i++) fire('pointermove', startY + ((endY - startY) * i) / 10);
		fire('pointerup', endY);
	}, toY);
}

async function startOrdering(page: Page, id = 'c1') {
	await page.goto(`/repertoire/${id}`);
	await page.getByRole('button', { name: 'Plus d’options' }).click();
	await page.getByRole('button', { name: 'Modifier l’ordre' }).click();
}

const START = [
	'À toi la gloire',
	'C’est un rempart que notre Dieu',
	'Torrents d’amour et de grâce',
	'Plus près de toi, mon Dieu',
	'Douce nuit, sainte nuit'
];

test.beforeEach(async ({ page }) => {
	await seedCollections(page, [
		{
			name: 'Culte',
			entries: [
				['ce', '1'],
				['ce', '2'],
				['ce', '3'],
				['ce', '5'],
				['he', '13']
			]
		},
		{ name: 'Long', entries: ALL }
	]);
});

test('1. each row has a handle hidden from assistive tech, next to the arrows', async ({
	page
}) => {
	await startOrdering(page);
	const handles = page.locator('ol.collection__list .collection__handle');
	await expect(handles).toHaveCount(5);
	for (const h of await handles.all()) {
		await expect(h).toHaveAttribute('aria-hidden', 'true');
		await expect(h).not.toHaveAttribute('tabindex', /.*/);
	}
	await expect(page.getByRole('button', { name: /^Monter « / })).toHaveCount(5);
	await expect(page.getByRole('button', { name: /^Descendre « / })).toHaveCount(5);
});

test('2. mouse: drag the last hymn to the top, kept after a reload', async ({ page }) => {
	await startOrdering(page);
	const top = await rowBox(page, 0);
	await mouseDrag(page, 4, top.y + 5);
	const expected = [START[4], ...START.slice(0, 4)];
	await expect(collectionTitles(page)).toHaveText(expected);
	await expect(status(page)).toHaveText('« Douce nuit, sainte nuit » déplacé en position 1');
	await page.getByRole('button', { name: 'Terminé' }).click();
	await page.reload();
	await expect(collectionTitles(page)).toHaveText(expected);
});

test('3. touch: drag the first hymn below the third', async ({ page }) => {
	await startOrdering(page);
	const third = await rowBox(page, 2);
	await touchDrag(page, handle(page, 0), third.y + third.height - 5);
	await expect(collectionTitles(page)).toHaveText([
		START[1],
		START[2],
		START[0],
		START[3],
		START[4]
	]);
});

test('4. while dragging, rows make room; Escape cancels', async ({ page }) => {
	await startOrdering(page);
	const second = await rowBox(page, 1);
	await mouseDrag(page, 0, second.y + second.height - 5, false);
	await expect(row(page, 0)).toHaveClass(/is-dragging/);
	await expect
		.poll(() => row(page, 1).evaluate((el) => getComputedStyle(el).transform))
		.not.toBe('none');
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await expect(collectionTitles(page)).toHaveText(START);
	await expect(page.locator('ol.collection__list .is-dragging')).toHaveCount(0);
	const transforms = await page.$$eval('ol.collection__list > li', (els) =>
		els.map((el) => (el as HTMLElement).style.transform)
	);
	expect(transforms).toEqual(['', '', '', '', '']);
});

test('5. dropping at the starting place changes nothing', async ({ page }) => {
	await startOrdering(page);
	const { x, y } = await centre(page, 1);
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, y + 30, { steps: 5 });
	await page.mouse.move(x, y, { steps: 5 });
	await page.mouse.up();
	await expect(collectionTitles(page)).toHaveText(START);
	await expect(status(page)).toHaveText('');
});

test('6. releasing far outside the list changes nothing', async ({ page }) => {
	await startOrdering(page);
	const last = await rowBox(page, 4);
	await mouseDrag(page, 0, last.y + last.height * 4);
	await expect(collectionTitles(page)).toHaveText(START);
});

test('7. a tap on the handle does nothing; a drop over a title does not navigate', async ({
	page
}) => {
	await startOrdering(page);
	const { x, y } = await centre(page, 2);
	await page.mouse.click(x, y);
	await expect(collectionTitles(page)).toHaveText(START);
	const first = await rowBox(page, 0);
	await page.mouse.move(x, y);
	await page.mouse.down();
	// Leave the handle sideways over the first row's title, then release there.
	await page.mouse.move(first.x + 80, first.y + 5, { steps: 12 });
	await page.mouse.up();
	await expect(page).toHaveURL(/\/repertoire\/c1$/);
	await expect(collectionTitles(page).first()).toHaveText(START[2]);
});

test('8. reading in order follows the dragged order', async ({ page }) => {
	await startOrdering(page);
	const top = await rowBox(page, 0);
	await mouseDrag(page, 4, top.y + 5);
	await page.getByRole('button', { name: 'Terminé' }).click();
	await page.getByRole('link', { name: 'Lire dans l’ordre' }).click();
	await expect(page).toHaveURL(/\/recueils\/he\/13\?collection=c1$/);
});

test('9. long list: the page scrolls near the edge so a hymn reaches the end', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 500 });
	await startOrdering(page, 'c2');
	await row(page, 0).scrollIntoViewIfNeeded();
	const { x, y } = await centre(page, 0);
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, 485, { steps: 10 });
	const before = await page.evaluate(() => window.scrollY);
	// Hold near the bottom edge: small moves keep the pointer there while the page scrolls.
	for (let i = 0; i < 40; i++) {
		await page.mouse.move(x, 485 + (i % 2));
		await page.waitForTimeout(40);
	}
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
	await expect
		.poll(async () => {
			await page.mouse.move(x, 486);
			return page.evaluate(() => {
				const last = document.querySelector('ol.collection__list li:last-child');
				return last ? last.getBoundingClientRect().bottom <= window.innerHeight : false;
			});
		})
		.toBe(true);
	// Release just below the list, above the bottom tab bar and outside the scroll band.
	await page.mouse.move(x, 430, { steps: 4 });
	await page.mouse.up();
	await expect(collectionTitles(page).last()).toHaveText('À toi la gloire');
});

test('10. a swipe on a title scrolls and moves nothing', async ({ page }) => {
	await startOrdering(page);
	const title = row(page, 1).locator('.hb-item__title');
	const second = await rowBox(page, 3);
	await touchDrag(page, title, second.y + 5);
	await expect(collectionTitles(page)).toHaveText(START);
});
