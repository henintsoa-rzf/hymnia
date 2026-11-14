/**
 * The history as the search screen shows it (specs/006-search-start-panel/data-model.md,
 * "Resolution for display"). Entries resolve like Répertoire entries: a renumbered or merged
 * hymn is followed, an unpublished one is left out.
 */
import type { CatalogApi } from '../data/catalog';
import type { PublishedHymn, PublishedHymnal } from '../domain/schema';
import { resolveEntry } from '../repertoire/resolve';
import type { HistoryDoc } from './schema';

export type RecentHymn = {
	hymnal: string;
	number: string;
	hymn: PublishedHymn;
	hymnalInfo?: PublishedHymnal;
};

export const RECENT_SHOWN = 8;

export function recentHymns(
	catalog: CatalogApi,
	doc: HistoryDoc,
	limit = RECENT_SHOWN
): RecentHymn[] {
	const rows: RecentHymn[] = [];
	const seen = new Set<string>();
	for (const stored of doc.entries) {
		if (rows.length >= limit) break;
		const { entry, hymn, hymnal } = resolveEntry(catalog, stored);
		if (!hymn || seen.has(hymn.id)) continue;
		seen.add(hymn.id);
		rows.push({ hymnal: entry.hymnal, number: entry.number, hymn, hymnalInfo: hymnal });
	}
	return rows;
}
