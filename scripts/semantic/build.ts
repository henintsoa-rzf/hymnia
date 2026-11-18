/**
 * Meaning data of one build (contracts/meaning-data.md): one int8 vector per distinct stanza of
 * every published hymn, plus the row map. Called by scripts/build-data.ts and the comparison.
 */
import type { Catalog } from '../../src/lib/domain/schema';
import { configId, type MeaningConfig } from '../../src/lib/meaning/config';
import { writeRowMap, type RowInfo } from '../../src/lib/meaning/load';
import { indexedStanzas, type IndexedText, type Themes } from '../../src/lib/meaning/stanzas';
import { cutAndNormalize, quantizeInt8 } from '../../src/lib/meaning/vector';
import type { Embedder } from './embed';

export { readRowMap } from '../../src/lib/meaning/load';

export type MeaningBuild = {
	configId: string;
	dims: number;
	rows: number;
	vectors: Uint8Array;
	rowMap: Uint8Array;
	bytes: number;
	report: { embedded: number; cached: number };
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
	themes?: Themes
): Promise<MeaningBuildResult> {
	if (catalog.hymns.length > 0xffff) return { error: 'More than 65,535 hymns: row map overflow' };
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
		report: { embedded, cached }
	};
}
