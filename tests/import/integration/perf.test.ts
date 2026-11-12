// Processing a cached hymnal is fast (plan.md, Performance Goals; task T075): 1,000 hymns —
// extraction, matching and writing — in under a minute. Synthetic pages from a fixture.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { runImport } from '../../../scripts/import/pipeline/run';
import { cdl, CDL_BASE } from '../../../scripts/import/sources/cdl';
import type { SourceAdapter } from '../../../scripts/import/sources/types';
import { fixturePage } from '../helpers/fixtures';
import { cachePage, makeWorkspace } from '../helpers/workspace';

const COUNT = 1000;

describe('performance', () => {
	it(`processes ${COUNT} cached hymns in under a minute`, { timeout: 120_000 }, async () => {
		const root = await makeWorkspace();
		const template = fixturePage('cdl', 'hymn-1413.html');
		for (let i = 1; i <= COUNT; i++) {
			// Distinct titles and first lines, so every page is a new hymn.
			const page = template
				.replace(/<h2>[\s\S]*?<\/h2>/, `<h2>Cantique numéro ${i}</h2>`)
				.replace('Rendez&nbsp;à&nbsp;Dieu,', `Chant&nbsp;${i}&nbsp;mot${i}&nbsp;rendez&nbsp;à&nbsp;Dieu,`);
			await cachePage(root, 'cdl', `${CDL_BASE}/p${i}`, page);
		}
		const adapter: SourceAdapter = {
			id: 'cdl',
			listEntries: async (hymnal) =>
				Array.from({ length: COUNT }, (_, i) => ({ hymnal, number: String(i + 1), url: `${CDL_BASE}/p${i + 1}` })),
			parseHymn: cdl.parseHymn
		};
		const started = performance.now();
		const report = await runImport({
			root,
			source: 'cdl',
			hymnals: ['jem'],
			offline: true,
			yes: true,
			adapter,
			hooks: importHooks
		});
		const seconds = (performance.now() - started) / 1000;
		expect(report.perSource.cdl.status).toBe('ok');
		expect(report.perHymnal.jem.new).toHaveLength(COUNT);
		expect((await readdir(join(root, 'content/hymns'))).length).toBeGreaterThanOrEqual(COUNT);
		console.log(`${COUNT} hymns processed in ${seconds.toFixed(1)} s`);
		expect(seconds).toBeLessThan(60);
	});
});
