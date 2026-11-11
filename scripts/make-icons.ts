/**
 * App icons (design/decisions.md §11): a Literata "H", paper colour, on the rubric red, with a
 * short rule under the letter. Rendered with Playwright's Chromium so the real font is used.
 *
 * Usage: npx tsx scripts/make-icons.ts  → static/icons/*.png
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const RUBRIC = '#9c3a2b';
const PAPER = '#faf8f4';
const OUT = fileURLToPath(new URL('../static/icons/', import.meta.url));
const FONT = fileURLToPath(
	new URL(
		'../node_modules/@fontsource-variable/literata/files/literata-latin-opsz-normal.woff2',
		import.meta.url
	)
);

type Icon = { file: string; size: number; radius: number; letter: number; rule: boolean };

// Rounded corners for icons shown as they are; square for maskable and iOS (the OS masks them).
const ICONS: Icon[] = [
	{ file: 'icon-512.png', size: 512, radius: 0.22, letter: 0.66, rule: true },
	{ file: 'icon-192.png', size: 192, radius: 0.22, letter: 0.66, rule: true },
	// Maskable: everything inside the central 80 % safe zone.
	{ file: 'icon-512-maskable.png', size: 512, radius: 0, letter: 0.52, rule: true },
	{ file: 'apple-touch-icon-180.png', size: 180, radius: 0, letter: 0.62, rule: true },
	{ file: 'favicon-32.png', size: 32, radius: 0.22, letter: 0.72, rule: false }
];

function html(icon: Icon, font: string): string {
	const { size } = icon;
	const letter = Math.round(size * icon.letter);
	const rule = icon.rule
		? `<span style="display:block;width:${Math.round(size * 0.25)}px;height:${Math.max(2, Math.round(size / 128))}px;border-radius:2px;background:${PAPER};opacity:.7"></span>`
		: '';
	return `<!doctype html><html><head><style>
		@font-face { font-family: L; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 900; }
		html, body { margin: 0; background: transparent; }
		.icon { width: ${size}px; height: ${size}px; border-radius: ${Math.round(size * icon.radius)}px;
			background: ${RUBRIC}; display: flex; flex-direction: column; align-items: center;
			justify-content: center; gap: ${Math.round(size * 0.02)}px; }
		.h { font-family: L; font-size: ${letter}px; line-height: ${letter}px; font-weight: ${size <= 32 ? 500 : 400};
			color: ${PAPER}; font-variation-settings: 'opsz' 72; }
	</style></head><body><div class="icon"><span class="h">H</span>${rule}</div></body></html>`;
}

const font = (await readFile(FONT)).toString('base64');
const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	for (const icon of ICONS) {
		await page.setViewportSize({ width: icon.size, height: icon.size });
		await page.setContent(html(icon, font));
		await page.evaluate(() => document.fonts.ready);
		await page.locator('.icon').screenshot({ path: OUT + icon.file, omitBackground: true });
		console.log(`static/icons/${icon.file}`);
	}
} finally {
	await browser.close();
}
