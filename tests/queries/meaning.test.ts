/**
 * Feature 011 regression test of search by meaning on the built data (`npm run data`, real
 * content), with the committed query vectors of the reference set, so it runs offline:
 * - SC-001: ≥ 50% of queries have an expected hymn in the top 10, ≥ 75% in the top 50;
 * - SC-002: the blend finds at least twice as many in the top 10 as word search alone;
 * - SC-008: no generated theme description in the catalog.
 * Skipped, with a notice, when the build has no meaning data or another configuration.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Catalog, DataManifest } from '$lib/domain/schema';
import { loadMeaningData } from '$lib/meaning/load';
import { searchByMeaning } from '$lib/meaning/search';
import { fromBase64 } from '$lib/meaning/vector';
import { createEngine } from '$lib/search/engine';
import queries from './meaning-queries.json';

const DATA = fileURLToPath(new URL('../../static/data/', import.meta.url));
const VECTORS = fileURLToPath(new URL('./meaning-query-vectors.json', import.meta.url));
const THEMES = fileURLToPath(new URL('../../content/generated/themes.json', import.meta.url));

type MeaningQuery = { id: string; query: string; expect: string[] };

const read = (name: string) => readFileSync(DATA + name);
const manifest: DataManifest | undefined = existsSync(DATA + 'manifest.json')
	? JSON.parse(read('manifest.json').toString())
	: undefined;
const vectorsFile: { configId: string; vectors: Record<string, string> } | undefined = existsSync(
	VECTORS
)
	? JSON.parse(readFileSync(VECTORS, 'utf8'))
	: undefined;

const skip = !manifest?.meaning
	? 'the build has no meaning data (run `npm run data` with MAMMOUTH_API_KEY)'
	: !vectorsFile
		? 'tests/queries/meaning-query-vectors.json is missing (run scripts/semantic/query-vectors.ts)'
		: vectorsFile.configId !== manifest.meaning.configId
			? `query vectors are for ${vectorsFile.configId}, the build is ${manifest.meaning.configId}`
			: '';
if (skip) console.warn(`⚠ meaning.test.ts skipped: ${skip}`);

describe.skipIf(Boolean(skip))('search by meaning on the reference set', () => {
	const load = () => {
		const meta = manifest!.meaning!;
		const catalogText = read(manifest!.catalog).toString();
		const catalog: Catalog = JSON.parse(catalogText);
		const engine = createEngine(catalog, read(manifest!.index).toString());
		const buffer = (b: Buffer) => new Uint8Array(b).buffer;
		const data = loadMeaningData(
			meta,
			buffer(read(meta.vectors)),
			buffer(read(meta.rowMap)),
			catalog
		);
		return { catalog, catalogText, engine, data };
	};

	it('meets SC-001 and SC-002', () => {
		const { catalog, engine, data } = load();
		const all = queries as MeaningQuery[];
		const rankIn = (ids: string[], expect: string[]) => {
			const i = ids.findIndex((id) => expect.includes(id));
			return i < 0 ? Infinity : i + 1;
		};
		const blended = all.map((q) => {
			const vector = fromBase64(vectorsFile!.vectors[q.id]);
			const ids = searchByMeaning(
				engine,
				data,
				vector,
				{ query: q.query },
				catalog.hymns
			).results.map((r) => r.hymnId);
			return { q, rank: rankIn(ids, q.expect) };
		});
		const words = all.map((q) =>
			rankIn(
				engine.search({ query: q.query }).results.map((r) => r.hymnId),
				q.expect
			)
		);
		const top10 = blended.filter((b) => b.rank <= 10).length;
		const top50 = blended.filter((b) => b.rank <= 50).length;
		const wordsTop10 = words.filter((r) => r <= 10).length;
		const misses = blended
			.filter((b) => b.rank > 10)
			.map((b) => `${b.q.id} (${b.q.query}) → ${b.rank}`);
		console.log(
			`meaning: top10 ${top10}/${all.length}, top50 ${top50}/${all.length}, words-only top10 ${wordsTop10}`
		);
		expect(top10 / all.length, `outside the top 10:\n${misses.join('\n')}`).toBeGreaterThanOrEqual(
			0.5
		);
		expect(top50 / all.length).toBeGreaterThanOrEqual(0.75);
		expect(top10).toBeGreaterThanOrEqual(2 * wordsTop10);
	});

	it('never puts a generated theme description in the catalog (SC-008)', () => {
		const { catalogText } = load();
		if (!existsSync(THEMES)) return;
		const themes: Record<string, { text: string }> = JSON.parse(readFileSync(THEMES, 'utf8'));
		const leaked = Object.entries(themes).filter(([, t]) => catalogText.includes(t.text));
		expect(leaked.map(([id]) => id)).toEqual([]);
	});
});
