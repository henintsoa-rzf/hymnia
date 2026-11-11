// WCAG 2.2 AA on every screen (contracts/routes.md), light and dark, text at 100 % and 200 %.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SCREENS = [
	'/',
	'/?q=ce7',
	'/?q=fleuve&recueils=he',
	'/?q=CE%209999',
	'/recueils',
	'/recueils/ce',
	'/recueils/ce/1',
	'/reglages',
	'/repertoire',
	'/recueils/ce/99'
];

for (const colorScheme of ['light', 'dark'] as const) {
	for (const textScale of [1, 2]) {
		test(`no violations, ${colorScheme}, text ${textScale * 100} %`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await page.addInitScript((scale) => {
				localStorage.setItem(
					'hymnia.prefs',
					JSON.stringify({ textScale: scale, theme: 'system', hymnalFilter: [] })
				);
			}, textScale);
			for (const url of SCREENS) {
				await page.goto(url);
				await page.waitForLoadState('networkidle');
				const { violations } = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
					.analyze();
				expect(
					violations.map((v) => `${url}: ${v.id} (${v.nodes.length}) ${v.help}`),
					url
				).toEqual([]);
			}
		});
	}
}
