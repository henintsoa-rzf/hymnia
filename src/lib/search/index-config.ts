/**
 * Search index settings, shared by the data build (scripts/build-data.ts) and the app, so the
 * index is always built and searched with the same rules (data-model.md, "Search index").
 */
import type { Options } from 'minisearch';
import type { PublishedHymn } from '../domain/schema';
import { tokenize } from './normalize';

export type IndexDocument = {
	id: string;
	title: string;
	firstLine: string;
	lyrics: string;
};

export const FIELD_BOOST = { title: 3, firstLine: 2, lyrics: 1 } as const;

export const INDEX_OPTIONS: Options<IndexDocument> = {
	fields: ['title', 'firstLine', 'lyrics'],
	storeFields: [],
	// tokenize already normalises (case, accents, ligatures, punctuation).
	tokenize: (text) => tokenize(text),
	processTerm: (term) => term || null
};

export function toIndexDocument(hymn: PublishedHymn): IndexDocument {
	return {
		id: hymn.id,
		title: hymn.title,
		firstLine: hymn.firstLine,
		lyrics: hymn.sections.flatMap((s) => s.lines).join('\n')
	};
}
