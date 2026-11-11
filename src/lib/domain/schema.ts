/**
 * Content schemas. Source: specs/001-hymnal-browse-search/data-model.md and
 * contracts/content-schema.md. Feature 002 (import) writes files that must pass these schemas.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug');
const text = z.string().min(1);

/** Hymnal id: "Unique, lowercase slug (`jem`, `adf`, `atg`). Used in URLs. Never changes." */
export const HymnalSchema = z.object({
	id: slug,
	name: text,
	/** "At least one". Unique across all hymnals once normalised. */
	abbreviations: z.array(text).min(1),
	sortOrder: z.number().int()
});

/** "`verse`, `chorus`, `bridge`, `other`" */
export const SectionTypeSchema = z.enum(['verse', 'chorus', 'bridge', 'other']);

export const SectionSchema = z.object({
	type: SectionTypeSchema,
	/** Verse number, as in the source. `null` for chorus and bridge. */
	number: z.number().int().positive().nullable(),
	/** "At least one". Text in Unicode NFC, unchanged from the source. */
	lines: z.array(z.string()).min(1)
});

export const HymnalEntrySchema = z.object({
	hymnal: slug,
	/** As printed ("245", "123a", "123 bis"). */
	number: text
});

/** "`lyrics`, `music`, `translation`, `arrangement`" */
export const CreditRoleSchema = z.enum(['lyrics', 'music', 'translation', 'arrangement']);

export const CreditSchema = z.object({
	name: text,
	role: CreditRoleSchema
});

export const SourceSchema = z.object({
	name: text,
	url: z.string().url().nullable(),
	retrievedAt: isoDate
});

export const CorrectionSchema = z.object({
	date: isoDate,
	description: text
});

/** "`confirmed`, `public-domain`, `unconfirmed`. Only the first two are published." */
export const RightsSchema = z.enum(['confirmed', 'public-domain', 'unconfirmed']);

export const HymnSchema = z.object({
	id: slug,
	title: text,
	/** "At least one". */
	entries: z.array(HymnalEntrySchema).min(1),
	/** "At least one, in source order". */
	sections: z.array(SectionSchema).min(1),
	credits: z.array(CreditSchema),
	source: SourceSchema,
	rights: RightsSchema,
	corrections: z.array(CorrectionSchema)
});

export const HymnalListSchema = z.array(HymnalSchema);

export type Hymnal = z.infer<typeof HymnalSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = z.infer<typeof SectionTypeSchema>;
export type HymnalEntry = z.infer<typeof HymnalEntrySchema>;
export type Credit = z.infer<typeof CreditSchema>;
export type CreditRole = z.infer<typeof CreditRoleSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type Rights = z.infer<typeof RightsSchema>;
export type Hymn = z.infer<typeof HymnSchema>;

/* ---------- Published catalog (build output, internal to the app) ---------- */

export type SortKey = [number, string];

export type PublishedHymnal = Hymnal & { hymnCount: number };

export type PublishedEntry = HymnalEntry & { sortKey: SortKey };

export type PublishedHymn = {
	id: string;
	title: string;
	firstLine: string;
	sections: Section[];
	credits: Credit[];
	source: Source;
	entries: PublishedEntry[];
};

export type Catalog = {
	/** Content hash of this catalog; changes whenever the content changes. */
	version: string;
	hymnals: PublishedHymnal[];
	hymns: PublishedHymn[];
};

export type DataManifest = {
	version: string;
	catalog: string;
	index: string;
};
