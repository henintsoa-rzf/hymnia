/**
 * Meaning data of one build (contracts/meaning-data.md): one int8 vector per distinct stanza of
 * every published hymn, plus the row map. Called by scripts/build-data.ts and the comparison.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Catalog, PublishedHymn } from '../../src/lib/domain/schema';
import { configId, type MeaningConfig } from '../../src/lib/meaning/config';
import { writeRowMap, type RowInfo } from '../../src/lib/meaning/load';
import { indexedStanzas, type IndexedText, type Themes } from '../../src/lib/meaning/stanzas';
import { cutAndNormalize, quantizeInt8 } from '../../src/lib/meaning/vector';
import type { Embedder } from './embed';

export { readRowMap } from '../../src/lib/meaning/load';

/** Generated theme descriptions (research R11), written by generate-themes.ts. */
export const THEMES_FILE = 'content/generated/themes.json';

/** One entry of THEMES_FILE: `lyricsHash` tells which lyrics it describes. */
export type ThemeDescription = {
	text: string;
	lyricsHash: string;
	model: string;
	generatedAt: string;
};
export type ThemesFile = Record<string, ThemeDescription>;

/** sha256 of a hymn's lines: a description is stale when its hymn's lyrics changed. */
export const lyricsHash = (hymn: Pick<PublishedHymn, 'sections'>) =>
	createHash('sha256')
		.update(hymn.sections.flatMap((s) => s.lines).join('\n'))
		.digest('hex');

export async function readThemes(file = THEMES_FILE): Promise<ThemesFile | undefined> {
	return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : undefined;
}

const usesThemes = (config: Pick<MeaningConfig, 'representation'>) =>
	config.representation === 'title+theme+stanza';

export type MeaningBuild = {
	configId: string;
	dims: number;
	rows: number;
	vectors: Uint8Array;
	rowMap: Uint8Array;
	bytes: number;
	report: {
		embedded: number;
		cached: number;
		/** Hymns indexed without a theme description (always rejected, or new). */
		withoutTheme?: string[];
	};
};

export type MeaningBuildResult = MeaningBuild | { skipped: 'no-credentials' } | { error: string };

/** Texts to embed for the whole catalog, ordered by hymn then section. */
export function catalogTexts(
	catalog: Catalog,
	config: Pick<MeaningConfig, 'representation' | 'minSectionChars'>,
	themes?: Themes
): IndexedText[] {
	return catalog.hymns.flatMap((hymn, i) =>
		indexedStanzas(hymn, i, config.representation, themes, config.minSectionChars)
	);
}

export async function buildMeaningData(
	catalog: Catalog,
	config: MeaningConfig,
	embedder: Embedder,
	themes?: Themes & Partial<ThemesFile>
): Promise<MeaningBuildResult> {
	if (catalog.hymns.length > 0xffff) return { error: 'More than 65,535 hymns: row map overflow' };
	let withoutTheme: string[] | undefined;
	if (usesThemes(config)) {
		const fix = 'run `npx tsx scripts/semantic/generate-themes.ts` (needs ANTHROPIC_API_KEY)';
		if (!themes) return { error: `${THEMES_FILE} is missing: ${fix}` };
		const stale = catalog.hymns.filter((h) => {
			const hash = themes[h.id]?.lyricsHash;
			return hash !== undefined && hash !== lyricsHash(h);
		});
		if (stale.length > 0) {
			const ids = stale.map((h) => h.id);
			return {
				error:
					`${stale.length} theme description(s) describe older lyrics ` +
					`(${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''}): ${fix}`
			};
		}
		withoutTheme = catalog.hymns.filter((h) => !themes[h.id]?.text).map((h) => h.id);
	}
	const items = catalogTexts(catalog, config, themes);
	const covered = new Set(items.map((t) => t.hymnIndex));
	const missingHymn = catalog.hymns.findIndex((h, i) => h.sections.length > 0 && !covered.has(i));
	if (missingHymn >= 0)
		return { error: `Hymn ${catalog.hymns[missingHymn].id} has no meaning row` };

	const texts = items.map((t) => t.text);
	if (!embedder.hasCredentials() && (await embedder.missing(texts)) > 0) {
		return { skipped: 'no-credentials' };
	}

	const bytes = items.length * (config.dims + 8);
	if (bytes > config.maxBytes) {
		const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
		return {
			error: `Meaning data is ${mb(bytes)} MB, over the ${mb(config.maxBytes)} MB limit (SC-004)`
		};
	}

	const { vectors: full, embedded, cached } = await embedder.embed(texts);
	const vectors = new Int8Array(items.length * config.dims);
	const rows: RowInfo[] = items.map((item, r) => {
		const { q, scale } = quantizeInt8(cutAndNormalize(full[r], config.dims));
		vectors.set(q, r * config.dims);
		return { hymnIndex: item.hymnIndex, section: item.section, scale };
	});

	return {
		configId: configId(config),
		dims: config.dims,
		rows: items.length,
		vectors: new Uint8Array(vectors.buffer),
		rowMap: writeRowMap(rows),
		bytes,
		report: { embedded, cached, ...(withoutTheme ? { withoutTheme } : {}) }
	};
}
