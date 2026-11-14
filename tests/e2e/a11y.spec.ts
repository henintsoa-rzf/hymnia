// WCAG 2.2 AA on every screen (contracts/routes.md), light and dark, text at 100 % and 200 %.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedCollections } from './helpers';

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

// Feature 003: Répertoire, collection, add screen, bookmark sheet and name dialog (SC-006).
const COLLECTION_SCREENS = ['/repertoire', '/repertoire/c1', '/repertoire/c1/ajouter?q=gloire'];

for (const colorScheme of ['light', 'dark'] as const) {
	for (const textScale of [1, 2]) {
		test(`collections: no violations, ${colorScheme}, text ${textScale * 100} %`, async ({
			page
		}) => {
			await page.emulateMedia({ colorScheme });
			await page.addInitScript((scale) => {
				localStorage.setItem(
					'hymnia.prefs',
					JSON.stringify({ textScale: scale, theme: 'system', hymnalFilter: [] })
				);
			}, textScale);
			await seedCollections(page, [
				{
					name: 'Culte du 16 novembre',
					entries: [
						['ce', '1'],
						['he', '13'],
						['ce', '999']
					]
				},
				{ name: 'Mariage' }
			]);
			const check = async (label: string) => {
				const { violations } = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
					.analyze();
				expect(
					violations.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.help}`),
					label
				).toEqual([]);
			};
			for (const url of COLLECTION_SCREENS) {
				await page.goto(url);
				await page.waitForLoadState('networkidle');
				await check(url);
			}
			// Empty Répertoire is covered by the main test ('/repertoire' without collections).
			await page.goto('/recueils/ce/1');
			await page.getByRole('button', { name: 'Ajouter à une collection' }).first().click();
			await check('bookmark sheet');
			await page.getByRole('button', { name: 'Nouvelle collection' }).click();
			const dialog = page.getByRole('dialog', { name: 'Nouvelle collection' });
			await dialog.getByRole('button', { name: 'Créer' }).click();
			await expect(dialog.getByRole('alert')).toBeVisible();
			await check('name dialog with an error');
		});
	}
}

// Feature 006: the search screen's start content. A fresh visit (examples) is covered by the main
// test ('/'); here, with recent hymns and collections, at phone and desktop width (SC-006).
for (const colorScheme of ['light', 'dark'] as const) {
	test(`search start content: no violations, ${colorScheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme });
		await seedCollections(page, [{ name: 'Culte', entries: [['ce', '1']] }, { name: 'Mariage' }]);
		for (const url of ['/recueils/ce/1', '/recueils/he/13']) {
			await page.goto(url);
			await expect(page.locator('main h1')).toBeVisible();
		}
		for (const size of [null, { width: 1280, height: 800 }]) {
			if (size) await page.setViewportSize(size);
			await page.goto('/');
			await page.waitForLoadState('networkidle');
			await expect(page.getByRole('region', { name: 'Récemment consultés' })).toBeVisible();
			const { violations } = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
				.analyze();
			const label = size ? 'desktop' : 'phone';
			expect(
				violations.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.help}`),
				label
			).toEqual([]);
		}
	});
}
