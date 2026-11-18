/**
 * Measured choice of what to index (User Story 3, FR-019 to FR-021, research R2–R6).
 *
 * Builds every candidate in memory from the embedding cache: representation × dims × float/int8,
 * plus the full 3,072-dim float vectors as a ceiling. It scores each on the reference set
 * (tests/queries/meaning-queries.json), then the blend with word search over a grid of weights,
 * and word search alone. It applies the decision rules, prints a table and writes
 * tests/queries/meaning-evaluation.json. The chosen values are then set by hand in
 * src/lib/meaning/config.ts (task T048).
 *
 * Usage:
 *   npx tsx scripts/semantic/evaluate.ts          # Mammouth, through the cache (MAMMOUTH_API_KEY)
 *   npx tsx scripts/semantic/evaluate.ts --fake   # fake embedder: checks the pipeline, no cost
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { buildData } from '../build-data';
import type { Catalog } from '../../src/lib/domain/schema';
import {
	FULL_DIMS,
	MEANING_CONFIG,
	configId,
	type MeaningConfig,
	type Representation
} from '../../src/lib/meaning/config';
import type { MeaningData } from '../../src/lib/meaning/load';
import { rankMeaning } from '../../src/lib/meaning/rank';
import { searchByMeaning } from '../../src/lib/meaning/search';
import type { Themes } from '../../src/lib/meaning/stanzas';
import { cutAndNormalize, quantizeInt8 } from '../../src/lib/meaning/vector';
import { createEngine, type SearchEngine } from '../../src/lib/search/engine';
import { catalogTexts } from './build';
import { createEmbedder, envOptions, type Embedder } from './embed';
import { queryText } from './query-vectors';
import { THEMES_FILE } from './build';

const QUERIES = 'tests/queries/meaning-queries.json';
const OUT = 'tests/queries/meaning-evaluation.json';
const MB = 1024 * 1024;
const DIMS = [256, 512, 1024] as const;
const WEIGHTS = [0.5, 1, 1.5, 2];
/** Word weights: 0 is the meaning order alone (exact titles still first). */
const WORD_WEIGHTS = [0, ...WEIGHTS];
/** FR-021: a smaller candidate within this many top-10 points of the best is preferred. */
const SMALLER_WITHIN = 5;
/** Research R4: 1,024 dims (and 20 MB) only for a gain of at least this many top-10 points. */
const BIGGER_GAIN = 3;

type MeaningQuery = { id: string; category: string; query: string; expect: string[] };
export type Scores = { top1: number; top10: number; top50: number; mrr: number };
export type Candidate = Scores & {
	configId: string;
	representation: Representation;
	dims: number;
	quant: 'f32' | 'i8';
	bytes: number;
	fusion?: { wMeaning: number; wWords: number };
};

/** Scores as percentages of the queries (top-N) and mean reciprocal rank (cut at 50). */
export function score(ranks: number[]): Scores {
	const n = ranks.length;
	const pct = (k: number) => Math.round((1000 * ranks.filter((r) => r <= k).length) / n) / 10;
	const mrr = ranks.reduce((s, r) => s + (r <= 50 ? 1 / r : 0), 0) / n;
	return { top1: pct(1), top10: pct(10), top50: pct(50), mrr: Math.round(mrr * 1000) / 1000 };
}

const rankOf = (ids: string[], expect: string[]) => {
	const i = ids.findIndex((id) => expect.includes(id));
	return i < 0 ? Infinity : i + 1;
};

/** Float ranking (no quantisation): best row per hymn, top 50 hymn ids. */
function rankFloat(
	rows: Float32Array[],
	hymnIndex: number[],
	query: Float32Array,
	catalog: Catalog
): string[] {
	const best = new Map<number, number>();
	rows.forEach((row, r) => {
		let s = 0;
		for (let i = 0; i < query.length; i++) s += query[i] * row[i];
		const h = hymnIndex[r];
		if (s > (best.get(h) ?? -Infinity)) best.set(h, s);
	});
	return [...best.entries()]
		.sort((a, b) => b[1] - a[1] || a[0] - b[0])
		.slice(0, 50)
		.map(([h]) => catalog.hymns[h].id);
}

function toMeaningData(
	rows: Float32Array[],
	items: { hymnIndex: number; section: number }[],
	dims: number
): MeaningData {
	const vectors = new Int8Array(rows.length * dims);
	const scale = new Float32Array(rows.length);
	rows.forEach((row, r) => {
		const q = quantizeInt8(row);
		vectors.set(q.q, r * dims);
		scale[r] = q.scale;
	});
	return {
		configId: 'eval',
		dims,
		rows: rows.length,
		vectors,
		hymnIndex: Uint16Array.from(items.map((i) => i.hymnIndex)),
		section: Uint16Array.from(items.map((i) => i.section)),
		scale
	};
}

export async function evaluate(options: {
	catalog: Catalog;
	engine: SearchEngine;
	embedder: Embedder;
	queries: MeaningQuery[];
	themes?: Themes;
	log?: (line: string) => void;
}) {
	const { catalog, engine, embedder, queries, themes, log = () => {} } = options;
	// Nearly every hymn: a few descriptions are always rejected, as they would quote the lyrics.
	const missing = themes ? catalog.hymns.filter((h) => !themes[h.id]).length : Infinity;
	const covered = missing <= catalog.hymns.length * 0.01;
	if (themes && covered && missing > 0) log(`  (${missing} hymns without a theme description)`);
	const representations: Representation[] = ['stanza', 'title+stanza'];
	if (covered) representations.push('title+theme+stanza');
	else log('  (title+theme+stanza left out: no theme description for every hymn)');

	const queryFull = (await embedder.embed(queries.map((q) => queryText(q.query)))).vectors;
	const candidates: Candidate[] = [];
	const data = new Map<string, MeaningData>();
	const base = (representation: Representation, dims: number) =>
		configId({ ...MEANING_CONFIG, representation, dims: dims as MeaningConfig['dims'] });

	for (const representation of representations) {
		const items = catalogTexts(catalog, { ...MEANING_CONFIG, representation }, themes);
		const { vectors: full, embedded, cached } = await embedder.embed(items.map((i) => i.text));
		log(`  ${representation}: ${items.length} rows (embedded ${embedded}, cached ${cached})`);
		const hymnIndex = items.map((i) => i.hymnIndex);
		for (const dims of [...DIMS, FULL_DIMS]) {
			const rows = full.map((v) => cutAndNormalize(v, dims));
			const queriesCut = queryFull.map((v) => cutAndNormalize(v, dims));
			const id = base(representation, Math.min(dims, 1024));
			const floatRanks = queries.map((q, i) =>
				rankOf(rankFloat(rows, hymnIndex, queriesCut[i], catalog), q.expect)
			);
			candidates.push({
				configId:
					dims === FULL_DIMS
						? id.replace('/1024/', '/3072/').replace('/i8/', '/f32/')
						: id.replace('/i8/', '/f32/'),
				representation,
				dims,
				quant: 'f32',
				bytes: items.length * (dims * 4 + 8),
				...score(floatRanks)
			});
			if (dims === FULL_DIMS) continue;
			const d = toMeaningData(rows, items, dims);
			data.set(id, d);
			const intRanks = queries.map((q, i) =>
				rankOf(
					rankMeaning(d, queriesCut[i], catalog.hymns, { limit: 50 }).map(
						(h) => catalog.hymns[h.hymnIndex].id
					),
					q.expect
				)
			);
			candidates.push({
				configId: id,
				representation,
				dims,
				quant: 'i8',
				bytes: items.length * (dims + 8),
				...score(intRanks)
			});
		}
	}

	// Decision (FR-021, research R4) on int8 candidates, meaning list alone.
	const int8 = candidates.filter((c) => c.quant === 'i8');
	const top10Of = (rep: Representation, dims: number) =>
		int8.find((c) => c.representation === rep && c.dims === dims)!.top10;
	const allowBig = (rep: Representation) => top10Of(rep, 1024) - top10Of(rep, 512) >= BIGGER_GAIN;
	const limitFor = (c: Candidate) =>
		c.dims === 1024 && allowBig(c.representation) ? 20 * MB : 10 * MB;
	const eligible = int8.filter((c) => c.bytes <= limitFor(c));
	const best = Math.max(...eligible.map((c) => c.top10));
	const simpler = (c: Candidate) => representations.indexOf(c.representation);
	const chosen = eligible
		.filter((c) => c.top10 >= best - SMALLER_WITHIN)
		.sort((a, b) => a.bytes - b.bytes || simpler(a) - simpler(b) || b.top10 - a.top10)[0];
	const maxBytes = chosen.dims === 1024 ? 20 * MB : 10 * MB;

	// Blend weights for the chosen candidate (research R6).
	const chosenData = data.get(chosen.configId)!;
	const chosenQueries = queryFull.map((v) => cutAndNormalize(v, chosen.dims));
	const blends: Candidate[] = [];
	for (const wMeaning of WEIGHTS) {
		for (const wWords of WORD_WEIGHTS) {
			// With no word weight, every meaning weight gives the same order: measure it once.
			if (wWords === 0 && wMeaning !== 1) continue;
			const fusion = { k: MEANING_CONFIG.fusion.k, wMeaning, wWords };
			const ranks = queries.map((q, i) =>
				rankOf(
					searchByMeaning(
						engine,
						chosenData,
						chosenQueries[i],
						{ query: q.query },
						catalog.hymns,
						fusion
					).results.map((r) => r.hymnId),
					q.expect
				)
			);
			blends.push({ ...chosen, fusion: { wMeaning, wWords }, ...score(ranks) });
		}
	}
	const bestBlend = [...blends].sort(
		(a, b) =>
			b.top10 - a.top10 ||
			b.mrr - a.mrr ||
			// Ties: the plain 1:1 blend first.
			Math.abs(a.fusion!.wMeaning - a.fusion!.wWords) -
				Math.abs(b.fusion!.wMeaning - b.fusion!.wWords)
	)[0];

	const wordsOnly = score(
		queries.map((q) =>
			rankOf(
				engine.search({ query: q.query }).results.map((r) => r.hymnId),
				q.expect
			)
		)
	);

	return {
		date: new Date().toISOString().slice(0, 10),
		queries: queries.length,
		chosen: chosen.configId,
		maxBytes,
		fusion: bestBlend.fusion!,
		candidates: [...candidates, ...blends],
		wordsOnly
	};
}

function table(result: Awaited<ReturnType<typeof evaluate>>): string {
	const pad = (s: string | number, n: number) => String(s).padEnd(n);
	const head = `${pad('candidate', 38)}${pad('blend', 10)}${pad('top1', 7)}${pad('top10', 7)}${pad('top50', 7)}${pad('MRR', 7)}MB`;
	const lines = result.candidates.map(
		(c) =>
			`${pad(c.configId, 38)}${pad(c.fusion ? `${c.fusion.wMeaning}:${c.fusion.wWords}` : '', 10)}` +
			`${pad(c.top1, 7)}${pad(c.top10, 7)}${pad(c.top50, 7)}${pad(c.mrr, 7)}${(c.bytes / MB).toFixed(1)}`
	);
	const w = result.wordsOnly;
	lines.push(
		`${pad('words only', 48)}${pad(w.top1, 7)}${pad(w.top10, 7)}${pad(w.top50, 7)}${w.mrr}`
	);
	return [head, ...lines].join('\n');
}

async function main() {
	if (existsSync('.env')) process.loadEnvFile('.env');
	const fake = process.argv.includes('--fake');
	const { errors, catalog, indexJson } = await buildData('content', {
		personalUse: process.env.HYMNIA_PERSONAL_USE === '1'
	});
	if (errors.length || !catalog || !indexJson) throw new Error(errors.join('\n'));

	let embedder: Embedder;
	if (fake) {
		const { fakeEmbed } = await import('../../tests/helpers/fake-embedder');
		embedder = createEmbedder({
			model: 'fake',
			apiKey: 'fake',
			cacheDir: '.cache/embeddings-fake',
			embedBatch: fakeEmbed
		});
	} else {
		embedder = createEmbedder(envOptions());
		if (!embedder.hasCredentials())
			console.warn('⚠ no MAMMOUTH_API_KEY: only cached texts can be used');
	}
	const themes: Themes | undefined = existsSync(THEMES_FILE)
		? JSON.parse(await readFile(THEMES_FILE, 'utf8'))
		: undefined;
	const queries: MeaningQuery[] = JSON.parse(await readFile(QUERIES, 'utf8'));

	console.log(
		`Comparing candidates on ${queries.length} reference queries${fake ? ' (FAKE embedder)' : ''}…`
	);
	const result = await evaluate({
		catalog,
		engine: createEngine(catalog, indexJson),
		embedder,
		queries,
		themes,
		log: (l) => console.log(l)
	});
	console.log('\n' + table(result));
	console.log(
		`\nChosen: ${result.chosen}, fusion ${result.fusion.wMeaning}:${result.fusion.wWords}, ` +
			`maxBytes ${result.maxBytes / MB} MB`
	);
	if (fake) {
		console.log('(fake embedder: nothing written)');
		return;
	}
	await writeFile(OUT, JSON.stringify(result, null, '\t') + '\n');
	console.log(`✓ written to ${OUT}. Set these values in src/lib/meaning/config.ts (task T048).`);
}

if (process.argv[1]?.endsWith('evaluate.ts')) await main();
