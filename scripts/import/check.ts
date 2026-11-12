/**
 * `check`: validates import/ and content/ with no network (contracts/cli.md, FR-003, FR-004).
 *
 * - import records against their schemas and the cross-file rules (state.ts);
 * - content against feature 001's build rules, redirects included;
 * - every `merge` decision has its redirect;
 * - every imported hymn's text matches its source page in the cache, apart from whitespace and
 *   Unicode form, unless a correction explains the difference (FR-004).
 */
import { join } from 'node:path';
import { loadContent, validateContent } from '../build-data';
import { createFetcher } from './fetcher';
import { indexContent } from './pipeline/content';
import { fingerprint } from './pipeline/fingerprint';
import './sources/all';
import { getAdapter, hasAdapter } from './sources/index';
import { CACHE_DIR, loadPending, loadState, validateState } from './store/state';

export type CheckResult = { errors: string[]; warnings: string[]; checkedTexts: number };

export async function checkImport(root: string): Promise<CheckResult> {
	const errors: string[] = [];
	const warnings: string[] = [];

	const raw = await loadContent(join(root, 'content'));
	errors.push(...validateContent(raw).errors);
	const content = indexContent(raw);

	let state;
	try {
		state = await loadState(root);
		await loadPending(root);
	} catch (error) {
		return { errors: [...errors, (error as Error).message], warnings, checkedTexts: 0 };
	}
	errors.push(
		...validateState(state, {
			hymnalIds: new Set(content.hymnals.map((h) => h.id)),
			hymnIds: new Set(content.hymns.keys())
		})
	);

	for (const m of state.merges) {
		if (m.decision !== 'merge') continue;
		if (content.redirects[m.b] !== m.a && content.redirects[m.a] !== m.b) {
			errors.push(`import/decisions/merges.json: "${m.a}" + "${m.b}" merged, but no redirect between them`);
		}
	}

	let checkedTexts = 0;
	for (const link of state.links) {
		const hymn = content.hymns.get(link.hymnId);
		// Only the source that holds the hymn's reference text is compared with it.
		if (!hymn || link.status !== 'active' || hymn.source.url !== link.url) continue;
		const source = state.sources.find((s) => s.id === link.source);
		if (!source || !hasAdapter(link.source)) continue;
		const fetcher = createFetcher({ source, cacheDir: join(root, CACHE_DIR, source.id), offline: true });
		let page;
		try {
			page = await fetcher.fetchPage(link.url);
		} catch {
			warnings.push(`${link.hymnId}: source page not in the cache (${link.url}); text not checked`);
			continue;
		}
		const parsed = getAdapter(link.source).parseHymn(page.body, {
			hymnal: link.hymnal,
			number: link.number,
			url: link.url
		});
		if (!parsed.ok) {
			warnings.push(`${link.hymnId}: cached page no longer parses (${parsed.reason})`);
			continue;
		}
		checkedTexts++;
		if (fingerprint(parsed.hymn) === fingerprint(hymn)) continue;
		if (fingerprint(parsed.hymn) !== link.acceptedFingerprint) {
			warnings.push(`${link.hymnId}: the cached page differs from the accepted text (pending change?)`);
		} else if (hymn.corrections.length === 0) {
			errors.push(
				`content/hymns/${hymn.id}.json: text differs from its source page and no correction explains it (FR-004)`
			);
		}
	}
	return { errors, warnings, checkedTexts };
}
