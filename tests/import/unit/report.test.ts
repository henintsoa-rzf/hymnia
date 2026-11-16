// Run reports: the "À vérifier à la main" section (specs/010-pasteur-compagnie-hymnal, T010).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyHymnalReport, loadReport, renderMarkdown, type RunReport } from '../../../scripts/import/report';
import { REPORTS_DIR } from '../../../scripts/import/store/state';
import { makeWorkspace } from '../helpers/workspace';

const report = (perHymnal: RunReport['perHymnal']): RunReport => ({
	runId: '20261116-120000',
	startedAt: '2026-11-16T12:00:00.000Z',
	finishedAt: '2026-11-16T12:01:00.000Z',
	args: { source: 'petc', hymnals: ['pasteur-compagnie'], offline: false, dryRun: true },
	perSource: { petc: { status: 'ok', pages: 1, failures: 0, reasons: {} } },
	perHymnal
});

describe('report: hymns to check by hand', () => {
	it('renders the toCheck rows', () => {
		const h = emptyHymnalReport();
		h.toCheck.push({ number: '1012', hymnId: 'roc-des-ages', title: 'Roc des âges', warnings: ['a', 'b'] });
		const md = renderMarkdown(report({ 'pasteur-compagnie': h }));
		expect(md).toContain('| À vérifier à la main | 1 |');
		expect(md).toContain('### À vérifier à la main');
		expect(md).toContain('| 1012 | Roc des âges : a ; b | `roc-des-ages` |');
	});

	it('loads a report written before toCheck existed', async () => {
		const root = await makeWorkspace();
		const h = emptyHymnalReport() as Partial<ReturnType<typeof emptyHymnalReport>>;
		delete h.toCheck;
		await mkdir(join(root, REPORTS_DIR), { recursive: true });
		await writeFile(join(root, REPORTS_DIR, '20261101-000000.json'), JSON.stringify(report({ jem: h as never })));
		const loaded = await loadReport(root);
		expect(loaded?.perHymnal.jem.toCheck).toEqual([]);
		expect(() => renderMarkdown(loaded!)).not.toThrow();
	});
});
