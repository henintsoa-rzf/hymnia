/**
 * Stored history of opened hymns (specs/006-search-start-panel/contracts/storage.md).
 * User data on this device only, kept apart from hymn data and from the Répertoire
 * (constitution, Principle IV).
 */
import { z } from 'zod';

/** Entries kept on the device; the search screen shows fewer (see `recentHymns`). */
export const HISTORY_MAX = 20;

export const HistoryEntrySchema = z.object({
	hymnal: z.string().min(1),
	number: z.string().min(1),
	/** The hymn shown, followed through redirects when the data changes. */
	hymnId: z.string().min(1),
	openedAt: z.string().datetime()
});

export const HistoryDocSchema = z.object({
	version: z.literal(1),
	/** Most recent first, at most one per hymn. */
	entries: z.array(HistoryEntrySchema).max(HISTORY_MAX)
});

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export type HistoryDoc = z.infer<typeof HistoryDocSchema>;

export const EMPTY_HISTORY: HistoryDoc = Object.freeze({
	version: 1,
	entries: []
}) as HistoryDoc;
