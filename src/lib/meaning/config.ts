/**
 * How meaning vectors are made (data-model.md, MeaningConfig). The build, the search worker and
 * the Cloudflare Worker all import this module, so they cannot disagree. Any change to a field
 * below gives a new id, which makes devices drop their old data and query cache.
 */

export type Representation = 'stanza' | 'title+stanza' | 'title+theme+stanza';

export type Fusion = { k: number; wMeaning: number; wWords: number };

export type MeaningConfig = {
	model: string;
	representation: Representation;
	dims: 256 | 512 | 1024;
	quant: 'i8';
	/** Bumped when the way texts or vectors are made changes with the fields above unchanged. */
	rev: number;
	/** Reciprocal Rank Fusion of the meaning and word lists (research R6). */
	fusion: Fusion;
	/** Shorter sections join a neighbour (research R2). */
	minSectionChars: number;
	/** Size limit of the meaning data: 10 MB, or 20 MB under the rule of research R4 (SC-004). */
	maxBytes: number;
};

/** Length of the vectors returned by `text-embedding-3-large`. */
export const FULL_DIMS = 3072;

const MB = 1024 * 1024;

/** The shipped configuration, set by the measured comparison (FR-021, research.md). */
export const MEANING_CONFIG: MeaningConfig = {
	model: 'text-embedding-3-large',
	representation: 'title+theme+stanza',
	dims: 1024,
	quant: 'i8',
	rev: 1,
	fusion: { k: 60, wMeaning: 1, wWords: 0 },
	minSectionChars: 40,
	maxBytes: 20 * MB
};

const MODEL_SHORT: Record<string, string> = { 'text-embedding-3-large': 'te3-large' };

export function configId(
	c: Pick<MeaningConfig, 'model' | 'representation' | 'dims' | 'quant' | 'rev'>
): string {
	const model = MODEL_SHORT[c.model] ?? c.model.replaceAll('/', '_');
	return `${model}/${c.representation}/${c.dims}/${c.quant}/v${c.rev}`;
}

/** Longest query sent for embedding, in Unicode code points (contracts/embed-api.md). */
export const MAX_QUERY_CHARS = 500;

/** The query text as embedded: NFC, trimmed, spaces collapsed (Worker and reference vectors). */
export const tidyQuery = (text: string) => text.normalize('NFC').trim().replace(/\s+/gu, ' ');
