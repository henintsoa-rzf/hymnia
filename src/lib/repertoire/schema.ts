/**
 * Stored Répertoire (specs/003-repertoire-collections/contracts/storage.md, "Document (v2)").
 * User data, kept apart from hymn data (constitution, Principle IV).
 */
import { z } from 'zod';

const isoDateTime = z.string().datetime();

export const EntryRefSchema = z.object({
	hymnal: z.string().min(1),
	number: z.string().min(1)
});

export const CollectionEntrySchema = EntryRefSchema.extend({ addedAt: isoDateTime });

export const CollectionSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	createdAt: isoDateTime,
	updatedAt: isoDateTime,
	entries: z.array(CollectionEntrySchema)
});

export const RepertoireDocSchema = z.object({
	version: z.literal(2),
	collections: z.array(CollectionSchema)
});

/** A hymn reference: hymnal id and number as printed. */
export type EntryRef = z.infer<typeof EntryRefSchema>;
export type CollectionEntry = z.infer<typeof CollectionEntrySchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type RepertoireDoc = z.infer<typeof RepertoireDocSchema>;

export const EMPTY_DOC: RepertoireDoc = Object.freeze({
	version: 2,
	collections: []
}) as RepertoireDoc;
