/**
 * Source adapter interface (specs/002-hymnal-import/contracts/source-adapter.md) and the hymn
 * an adapter extracts (data-model.md, "RawHymn").
 */
import { z } from 'zod';
import { CreditSchema, SectionSchema } from '../../../src/lib/domain/schema';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');

export const RawHymnSchema = z.strictObject({
	source: z.string().min(1),
	hymnal: z.string().min(1),
	/** As printed. */
	number: z.string().min(1),
	url: z.string().url(),
	/** "Non-empty". */
	title: z.string().trim().min(1),
	/** "≥ 1, chords removed, NFC". */
	sections: z.array(SectionSchema).min(1),
	/** "May be empty (reported as 'no credits')". */
	credits: z.array(CreditSchema),
	/** Counts of removed chord/annotation kinds, for the report. */
	strippedMarkup: z.record(z.string(), z.number().int().nonnegative()),
	/** Credit labels the adapter could not map to a role (reported, not stored). */
	unknownCredits: z.array(z.string()).default([])
});

export type RawHymn = z.infer<typeof RawHymnSchema>;

/** A RawHymn with the date its page was retrieved (from the page cache). */
export const FetchedHymnSchema = RawHymnSchema.extend({ retrievedAt: isoDate });
export type FetchedHymn = z.infer<typeof FetchedHymnSchema>;

export type EntryRef = { hymnal: string; number: string; url: string };

export type ParseResult = { ok: true; hymn: RawHymn } | { ok: false; reason: string };

export type AdapterContext = {
	/** Polite, cached fetcher (research R3/R4). Adapters never call the network directly. */
	fetch(url: string): Promise<string>;
	log(message: string): void;
};

export interface SourceAdapter {
	/** Matches import/sources.json. */
	id: string;
	/** Lists the (number, URL) pairs of a hymnal. Uses ctx.fetch only. */
	listEntries(hymnal: string, ctx: AdapterContext): Promise<EntryRef[]>;
	/** Pure function: no network, no file access. */
	parseHymn(html: string, ref: EntryRef): ParseResult;
}
