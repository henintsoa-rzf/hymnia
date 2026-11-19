/**
 * Feature 015 regression test of the search from verses on the built data (`npm run data`, real
 * content), with the committed query vectors of the verse reference set, so it runs offline:
 * - SC-004: ≥ 60 % of the selections have an expected hymn in the top 10;
 * - research R4: the two query forms (verses' text; label first) are scored, the scores and the
 *   form in use are written to verse-evaluation.json, and the form in use is the better one
 *   (the label form only wins with at least 3 more points of top 10).
 * Skipped, with a notice, when the build has no meaning data or another configuration.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Catalog, DataManifest } from '$lib/domain/schema';
import { VERSE_QUERY_FORM } from '$lib/bible/query';
import { loadMeaningData } from '$lib/meaning/load';
import { searchByMeaning } from '$lib/meaning/search';
import { fromBase64 } from '$lib/meaning/vector';
import { createEngine } from '$lib/search/engine';
import queries from './verse-queries.json';

const DATA = fileURLToPath(new URL('../../static/data/', import.meta.url));
const VECTORS = fileURLToPath(new URL('./verse-query-vectors.json', import.meta.url));
const EVALUATION = fileURLToPath(new URL('./verse-evaluation.json', import.meta.url));

type VerseQuery = { id: string; refs: string[]; expect: string[] };
type Form = 'plain' | 'labelled';

const read = (name: string) => readFileSync(DATA + name);
const manifest: DataManifest | undefined = existsSync(DATA + 'manifest.json')
	? JSON.parse(read('manifest.json').toString())
	: undefined;
const vectorsFile: ({ configId: string } & Record<Form, Record<string, string>>) | undefined =
	existsSync(VECTORS) ? JSON.parse(readFileSync(VECTORS, 'utf8')) : undefined;

const skip = !manifest?.meaning
	? 'the build has no meaning data (run `npm run data` with MAMMOUTH_API_KEY)'
	: !vectorsFile
		? 'tests/queries/verse-query-vectors.json is missing (run scripts/semantic/query-vectors.ts)'
		: vectorsFile.configId !== manifest.meaning.configId
			? `verse vectors are for ${vectorsFile.configId}, the build is ${manifest.meaning.configId}`
			: '';
if (skip) console.warn(`⚠ verse-meaning.test.ts skipped: ${skip}`);

describe.skipIf(Boolean(skip))('search from verses on the reference set', () => {
	it('has at least 20 selections, with single verses and selections across books', () => {
		const all = queries as VerseQuery[];
		expect(all.length).toBeGreaterThanOrEqual(20);
		expect(all.filter((q) => q.refs.length === 1).length).toBeGreaterThanOrEqual(5);
		const books = (q: VerseQuery) => new Set(q.refs.map((r) => r.split('.').slice(0, 2).join('.')));
		expect(all.filter((q) => books(q).size > 1).length).toBeGreaterThanOrEqual(3);
	});

	it('meets SC-004 with the better query form (research R4)', () => {
		const meta = manifest!.meaning!;
		const catalog: Catalog = JSON.parse(read(manifest!.catalog).toString());
		const engine = createEngine(catalog, read(manifest!.index).toString());
		const buffer = (b: Buffer) => new Uint8Array(b).buffer;
		const data = loadMeaningData(
			meta,
			buffer(read(meta.vectors)),
			buffer(read(meta.rowMap)),
			catalog
		);
		const all = queries as VerseQuery[];

		const score = (form: Form) => {
			const ranks = all.map((q) => {
				const vector = fromBase64(vectorsFile![form][q.id]);
				const ids = searchByMeaning(engine, data, vector, { query: '' }, catalog.hymns).results.map(
					(r) => r.hymnId
				);
				const i = ids.findIndex((id) => q.expect.includes(id));
				return { id: q.id, rank: i < 0 ? Infinity : i + 1 };
			});
			const share = (n: number) =>
				Math.round((ranks.filter((r) => r.rank <= n).length / all.length) * 1000) / 10;
			const mrr =
				ranks.reduce((s, r) => s + (r.rank === Infinity ? 0 : 1 / r.rank), 0) / all.length;
			return {
				top1: share(1),
				top10: share(10),
				top50: share(50),
				mrr: Math.round(mrr * 1000) / 1000,
				misses: ranks.filter((r) => r.rank > 10).map((r) => `${r.id} → ${r.rank}`)
			};
		};

		const plain = score('plain');
		const labelled = score('labelled');
		const chosen: Form = labelled.top10 >= plain.top10 + 3 ? 'labelled' : 'plain';
		const evaluation = {
			date: new Date().toISOString().slice(0, 10),
			selections: all.length,
			configId: meta.configId,
			chosen,
			candidates: {
				plain,
				labelled
			}
		};
		writeFileSync(EVALUATION, JSON.stringify(evaluation, null, '\t') + '\n');
		console.log(
			`verses: plain top10 ${plain.top10} %, labelled top10 ${labelled.top10} % → ${chosen}`
		);

		expect(VERSE_QUERY_FORM, 'the app uses the better form (research R4)').toBe(chosen);
		const used = chosen === 'plain' ? plain : labelled;
		expect(used.top10, `outside the top 10:\n${used.misses.join('\n')}`).toBeGreaterThanOrEqual(60);
	});
});
