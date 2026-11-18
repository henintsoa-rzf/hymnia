/**
 * Feature 011 (SC-003, plan.md Performance Goals): a search by meaning ranks every row on the
 * device. On 20,000 rows × the shipped dims (twice today's collection), meaning ranking plus the blend
 * with word search take < 50 ms median here, about 200 ms on a mid-range phone (4× slower).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog, buildIndex } from '../../scripts/build-data';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import type { Catalog } from '$lib/domain/schema';
import type { MeaningData } from '$lib/meaning/load';
import { rankMeaning } from '$lib/meaning/rank';
import { searchByMeaning } from '$lib/meaning/search';
import { MEANING_CONFIG } from '$lib/meaning/config';
import { cutAndNormalize, quantizeInt8 } from '$lib/meaning/vector';
import { generateCorpus } from './generate-corpus';

const ROWS = 20_000;
const DIMS = MEANING_CONFIG.dims;
const RUNS = 20;

let engine: SearchEngine;
let catalog: Catalog;
let data: MeaningData;

function prng(seed: number) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296 - 0.5;
	};
}

const randomUnit = (rand: () => number) =>
	cutAndNormalize(Float32Array.from({ length: DIMS }, rand), DIMS);

beforeAll(() => {
	const { hymnals, hymns } = generateCorpus(6000);
	catalog = buildCatalog(hymnals, hymns);
	engine = createEngine(catalog, buildIndex(catalog));
	const rand = prng(7);
	const vectors = new Int8Array(ROWS * DIMS);
	const hymnIndex = new Uint16Array(ROWS);
	const section = new Uint16Array(ROWS);
	const scale = new Float32Array(ROWS);
	for (let r = 0; r < ROWS; r++) {
		const { q, scale: s } = quantizeInt8(randomUnit(rand));
		vectors.set(q, r * DIMS);
		hymnIndex[r] = Math.floor((r * catalog.hymns.length) / ROWS);
		section[r] = 0;
		scale[r] = s;
	}
	data = { configId: 'perf', dims: DIMS, rows: ROWS, vectors, hymnIndex, section, scale };
}, 120_000);

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function time(run: () => void): number {
	const times: number[] = [];
	for (let i = 0; i < RUNS; i++) {
		const t = performance.now();
		run();
		times.push(performance.now() - t);
	}
	return median(times);
}

describe('search by meaning performance', () => {
	it(`ranks ${ROWS} rows × ${DIMS} dims and blends in < 50 ms (median)`, () => {
		const rand = prng(99);
		const queries = Array.from({ length: RUNS }, () => randomUnit(rand));
		let i = 0;
		const rankOnly = time(() => rankMeaning(data, queries[i++ % RUNS], catalog.hymns));
		i = 0;
		const full = time(() =>
			searchByMeaning(engine, data, queries[i++ % RUNS], { query: 'agneau de dieu' }, catalog.hymns)
		);
		console.log(
			`meaning: rank ${rankOnly.toFixed(1)} ms, rank + words + blend ${full.toFixed(1)} ms`
		);
		expect(full).toBeLessThan(50);
	});
});
