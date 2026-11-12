/** Saved source pages for importer tests (tests/import/fixtures/<source>/). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AdapterContext } from '../../../scripts/import/sources/types';

export const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

export function fixturePage(source: string, file: string): string {
	return readFileSync(join(FIXTURES, source, file), 'utf8');
}

/** `index.json` of a source's fixtures: file → { url, retrievedAt }. */
export function fixtureIndex(source: string): Record<string, { url: string; retrievedAt: string }> {
	return JSON.parse(readFileSync(join(FIXTURES, source, 'index.json'), 'utf8'));
}

/** Minimal HTML entity decoding, independent of the adapters' parser. */
export function decodeEntities(text: string): string {
	return text
		.replace(/&nbsp;/g, ' ')
		.replace(/&#0*39;|&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&amp;/g, '&');
}

/**
 * An adapter context that serves saved pages by URL (url → file of the given source folder,
 * or full path). With `emptyListing`, unknown URLs get an empty page instead of an error.
 */
export function fixtureContext(
	pages: Record<string, string>,
	options: { source?: string; emptyListing?: boolean } = {}
): AdapterContext & { fetched: string[]; logs: string[] } {
	const { source = 'cdl', emptyListing = false } = options;
	const fetched: string[] = [];
	const logs: string[] = [];
	return {
		fetched,
		logs,
		async fetch(url) {
			fetched.push(url);
			const file = pages[url];
			if (file) return fixturePage(source, file);
			if (emptyListing) return '<html><body><ul></ul></body></html>';
			throw new Error(`No fixture for ${url}`);
		},
		log: (message) => logs.push(message)
	};
}
