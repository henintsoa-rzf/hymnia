// WCAG 2.2 AA on every screen (contracts/routes.md), light and dark, text at 100 % and 200 %.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockEmbed, seedCollections } from './helpers';

const SCREENS = [
	'/',
	'/?q=ce7',
	'/?q=fleuve&recueils=he',
	'/?q=CE%209999',
	'/recueils',
	'/recueils/ce',
	'/recueils/ce/1',
	'/reglages',
	// Feature 016: the settings sections.
	'/reglages/affichage',
	'/reglages/lecture',
	'/reglages/recueils',
	'/reglages/hors-ligne',
	'/repertoire',
	'/recueils/ce/99',
	// Feature 011: a blended meaning list; feature 012: the field in the search-by-meaning mode.
	'/?q=la%20gloire%20de%20Dieu&sens=1',
	// Feature 012: the empty field in the search-by-meaning mode.
	'/?sens=1'
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
			await mockEmbed(page);
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
			// Feature 008: ordering mode (drag handles and muted arrows).
			await page.goto('/repertoire/c1');
			await page.getByRole('button', { name: 'Plus d’options' }).click();
			await page.getByRole('button', { name: 'Modifier l’ordre' }).click();
			await expect(page.locator('.collection__handle').first()).toBeVisible();
			await check('/repertoire/c1 (ordre)');
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

// Feature 014: the « Recueils » settings with parts unfolded and one part left out, and the screens
// that report what is left out.
for (const colorScheme of ['light', 'dark'] as const) {
	test(`hymnals left out: no violations, ${colorScheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme });
		const check = async (label: string) => {
			const { violations } = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(
				violations.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.help}`),
				label
			).toEqual([]);
		};
		await page.goto('/reglages/recueils');
		await page.getByRole('button', { name: 'Afficher les parties de Hymnes d’exemple' }).click();
		await page.getByRole('checkbox', { name: 'Noël', exact: true }).uncheck();
		await page.getByRole('checkbox', { name: 'Cantiques d’exemple', exact: true }).uncheck();
		await expect(page.getByRole('button', { name: 'Tout sélectionner' })).toBeVisible();
		await check('/reglages/recueils (parts, last item kept)');
		for (const url of ['/recueils', '/recueils/he', '/recueils/ce', '/?q=HE%2012', '/?q=endormi']) {
			await page.goto(url);
			await page.waitForLoadState('networkidle');
			await check(url);
		}
	});
}

// Feature 015: the Bible screens, with verses chosen (selection bar) and the hymns found from them,
// light and dark, text at 100 % and 200 %.
for (const colorScheme of ['light', 'dark'] as const) {
	for (const textScale of [1, 2]) {
		test(`Bible: no violations, ${colorScheme}, text ${textScale * 100} %`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await page.addInitScript((scale) => {
				localStorage.setItem(
					'hymnia.prefs',
					JSON.stringify({ textScale: scale, theme: 'system', hymnalFilter: [] })
				);
			}, textScale);
			await mockEmbed(page);
			const check = async (label: string) => {
				const { violations } = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
					.analyze();
				expect(
					violations.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.help}`),
					label
				).toEqual([]);
			};
			for (const url of ['/bible?livres', '/bible/jean', '/bible/jean/22']) {
				await page.goto(url);
				await page.waitForLoadState('networkidle');
				await check(url);
			}
			await page.goto('/bible/jean/3');
			await page.locator('#v16 button').click();
			await page.locator('#v17 button').click();
			await expect(page.getByRole('region', { name: 'Versets choisis' })).toBeVisible();
			await check('/bible/jean/3 (two verses chosen)');
			await page.goto('/bible/chants?versets=jean.3.16');
			await expect(page.locator('main .hy-result').first()).toBeVisible();
			await check('/bible/chants?versets=jean.3.16');
		});
	}
}
