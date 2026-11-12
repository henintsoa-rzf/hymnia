// SC-005 (task T050): on a reference list of hymns known to be shared by several hymnals,
// ≥ 90 % are merged automatically, and no known distinct pair is merged. Runs on the real page
// cache (import/cache, not committed), so it is skipped when the cache is not there (run the
// imports of research R13 first).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexContent } from '../../scripts/import/pipeline/content';
import { createMatcher } from '../../scripts/import/pipeline/match';
import { newHymn } from '../../scripts/import/pipeline/reconcile';
import { createFetcher } from '../../scripts/import/fetcher';
import '../../scripts/import/sources/all';
import { getAdapter } from '../../scripts/import/sources/index';
import type { FetchedHymn } from '../../scripts/import/sources/types';
import { LinkSchema, SourceConfigSchema, type SourceConfig } from '../../scripts/import/store/state';

type Ref = { source: string; hymnal: string; number: string };
const list = JSON.parse(readFileSync('tests/import/reference-duplicates.json', 'utf8')) as {
	shared: Ref[][];
	distinct: [Ref, Ref][];
};
const ready =
	list.shared.length >= 30 && list.distinct.length >= 10 && existsSync('import/cache/jemaf');

async function extract(ref: Ref): Promise<FetchedHymn> {
	const links = LinkSchema.array().parse(JSON.parse(readFileSync('import/state/links.json', 'utf8')));
	const link = links.find((l) => l.source === ref.source && l.hymnal === ref.hymnal && l.number === ref.number);
	if (!link) throw new Error(`No link for ${ref.source} ${ref.hymnal} ${ref.number}: import it first`);
	const source = sources.find((s) => s.id === ref.source)!;
	const fetcher = createFetcher({ source, cacheDir: join('import/cache', ref.source), offline: true });
	const page = await fetcher.fetchPage(link.url);
	const parsed = getAdapter(ref.source).parseHymn(page.body, { ...ref, url: link.url });
	if (!parsed.ok) throw new Error(`${link.url}: ${parsed.reason}`);
	return { ...parsed.hymn, retrievedAt: page.meta.retrievedAt.slice(0, 10) };
}

const sources = SourceConfigSchema.array().parse(
	JSON.parse(readFileSync('import/sources.json', 'utf8'))
);
const sourceOf = (hymn: FetchedHymn): SourceConfig => sources.find((s) => s.id === hymn.source)!;

const empty = () =>
	indexContent({
		hymnals: { file: 'hymnals.json', data: [] },
		hymns: [],
		redirects: { file: 'redirects.json', data: {} }
	});

describe.skipIf(!ready)('reference duplicates (SC-005)', () => {
	it('merges at least 90 % of the known shared hymns automatically', async () => {
		let merged = 0;
		for (const group of list.shared) {
			const matcher = createMatcher(empty(), []);
			const [first, ...others] = await Promise.all(group.map(extract));
			matcher.remember(newHymn('reference', first, sourceOf(first)));
			if (others.every((o) => matcher.match(o, 'other').kind === 'merge')) merged++;
		}
		expect(merged / list.shared.length).toBeGreaterThanOrEqual(0.9);
	});

	it('never merges a known distinct pair', async () => {
		for (const [a, b] of list.distinct) {
			const matcher = createMatcher(empty(), []);
			const [x, y] = await Promise.all([extract(a), extract(b)]);
			matcher.remember(newHymn('reference', x, sourceOf(x)));
			expect(matcher.match(y, 'other').kind, `${a.hymnal} ${a.number} / ${b.hymnal} ${b.number}`).not.toBe('merge');
		}
	});
});

it('the reference list is well formed', () => {
	expect(Array.isArray(list.shared) && Array.isArray(list.distinct)).toBe(true);
});
