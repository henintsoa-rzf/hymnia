/**
 * Content schemas. Source: specs/001-hymnal-browse-search/data-model.md and
 * contracts/content-schema.md. Feature 002 (import) writes files that must pass these schemas.
 *
 * Schemas are strict: an unknown or misspelt field fails the build instead of being dropped.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug');
const text = z.string().min(1);

/** Longest short code (first abbreviation) a hymnal tile can show. */
export const MAX_SHORT_CODE = 3;

/** Hymnal id: "Unique, lowercase slug (`jem`, `adf`, `atg`). Used in URLs. Never changes." */
export const HymnalSchema = z.strictObject({
	id: slug,
	name: text,
	/**
	 * "At least one". Unique across all hymnals once normalised. The first one is the short code
	 * shown in tiles and references ("JEM 12"), so it has at most 3 characters; longer forms
	 * ("Psalmodie") go after it and still work in search.
	 */
	abbreviations: z
		.array(text)
		.min(1)
		.refine((a) => [...a[0].normalize('NFC')].length <= MAX_SHORT_CODE, {
			message: `the first abbreviation is the short code and has at most ${MAX_SHORT_CODE} characters`
		}),
	sortOrder: z.number().int(),
	/**
	 * Optional parts of the hymnal (JEM volumes, albums, concert programmes), shown as headed
	 * groups on the hymnal page. Part `i` holds the numbers from its `first` up to the next
	 * part's `first`; listed in increasing `first` order.
	 */
	parts: z
		.array(z.strictObject({ name: text, first: z.number().int().positive() }))
		.min(1)
		.refine((p) => p.every((part, i) => i === 0 || part.first > p[i - 1].first), {
			message: 'parts are listed in increasing `first` order'
		})
		.optional()
});

/** "`verse`, `chorus`, `bridge`, `other`" */
export const SectionTypeSchema = z.enum(['verse', 'chorus', 'bridge', 'other']);

export const SectionSchema = z.strictObject({
	type: SectionTypeSchema,
	/** Verse number, as in the source. `null` for chorus and bridge. */
	number: z.number().int().positive().nullable(),
	/** "At least one". Text in Unicode NFC, unchanged from the source. */
	lines: z.array(z.string()).min(1)
});

export const HymnalEntrySchema = z.strictObject({
	hymnal: slug,
	/** As printed ("245", "123a", "123 bis"). */
	number: text,
	/**
	 * The title this hymnal prints, only when it differs from the hymn's `title` (hymnals often
	 * retitle a hymn: JEM 232 "Ma joie de t'appartenir" is ATG 42 "C'est vers toi que je me
	 * tourne"). Searched like the title, and shown when the hymn is read from this entry.
	 */
	title: text.optional()
});

/**
 * "`lyrics`, `music`, `translation`, `arrangement`", plus `unspecified` (feature 002) for a
 * source that names its authors without saying who wrote the words and who wrote the music.
 */
export const CreditRoleSchema = z.enum([
	'lyrics',
	'music',
	'translation',
	'arrangement',
	'unspecified'
]);

export const CreditSchema = z.strictObject({
	name: text,
	role: CreditRoleSchema
});

export const SourceSchema = z.strictObject({
	name: text,
	url: z.string().url().nullable(),
	retrievedAt: isoDate
});

export const CorrectionSchema = z.strictObject({
	date: isoDate,
	description: text
});

/** "`confirmed`, `public-domain`, `unconfirmed`. Only the first two are published." */
export const RightsSchema = z.enum(['confirmed', 'public-domain', 'unconfirmed']);

export const HymnSchema = z.strictObject({
	id: slug,
	title: text,
	/** "At least one". */
	entries: z.array(HymnalEntrySchema).min(1),
	/** "At least one, in source order". */
	sections: z.array(SectionSchema).min(1),
	credits: z.array(CreditSchema),
	source: SourceSchema,
	rights: RightsSchema,
	corrections: z.array(CorrectionSchema),
	/**
	 * Feature 002: other sources that provide the same hymn after a merge. Optional, absent
	 * meaning none. Not published in the catalog (not shown in the app yet).
	 */
	alternateSources: z.array(SourceSchema).optional()
});

export const HymnalListSchema = z.array(HymnalSchema);

/**
 * Feature 002 (FR-026): `content/redirects.json` maps a hymn id removed by a merge to the id
 * it was merged into. Sources are never live hymn ids; targets are existing hymns, never
 * another redirect (no chains).
 */
export const RedirectsSchema = z.record(slug, slug);
export type Redirects = z.infer<typeof RedirectsSchema>;

export type Hymnal = z.infer<typeof HymnalSchema>;
export type HymnalPart = NonNullable<Hymnal['parts']>[number];
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
	/** Merged hymn id → kept hymn id (`content/redirects.json`). */
	redirects: Redirects;
};

export type DataManifest = {
	version: string;
	catalog: string;
	index: string;
};
