/**
 * History of opened hymns: pure operations (specs/006-search-start-panel/data-model.md).
 * Each returns a new document and never changes the one it is given.
 */
import type { EntryRef } from '../repertoire/schema';
import { HISTORY_MAX, HistoryDocSchema, type HistoryDoc } from './schema';

/** The stored value, or an empty history when it is missing or unreadable. */
export function parseHistory(raw: string | null): HistoryDoc {
	if (raw === null) return clearHistory();
	try {
		const parsed = HistoryDocSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : clearHistory();
	} catch {
		return clearHistory();
	}
}

/** The hymn just shown goes first, under the reference it was opened with. */
export function recordOpened(
	doc: HistoryDoc,
	ref: EntryRef,
	hymnId: string,
	now: string
): HistoryDoc {
	const others = doc.entries.filter((e) => e.hymnId !== hymnId);
	return {
		version: 1,
		entries: [{ hymnal: ref.hymnal, number: ref.number, hymnId, openedAt: now }, ...others].slice(
			0,
			HISTORY_MAX
		)
	};
}

export function clearHistory(): HistoryDoc {
	return { version: 1, entries: [] };
}
