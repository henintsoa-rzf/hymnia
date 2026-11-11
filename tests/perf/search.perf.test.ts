/**
 * SC-002: results in ≤ 200 ms per keystroke on a mid-range phone, for ~6,000 hymns.
 * A mid-range phone is taken as about 4× slower than a development machine, so each search must
 * take ≤ 50 ms here. Data size is also checked against the 5 MB compressed limit.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { buildCatalog, buildIndex, MAX_COMPRESSED_BYTES } from '../../scripts/build-data';
import { createEngine, type SearchEngine } from '$lib/search/engine';
import { generateCorpus } from './generate-corpus';

const PHONE_SLOWDOWN = 4;
const BUDGET_MS = 200 / PHONE_SLOWDOWN;

let engine: SearchEngine;
let catalogJson = '';
let indexJson = '';
let loadMs = 0;

beforeAll(() => {
	const { hymnals, hymns } = generateCorpus(6000);
	const catalog = buildCatalog(hymnals, hymns);
	catalogJson = JSON.stringify(catalog);
	indexJson = buildIndex(catalog);
	const t = performance.now();
	engine = createEngine(JSON.parse(catalogJson), indexJson);
	loadMs = performance.now() - t;
});

// What a user types, keystroke by keystroke, plus typical whole queries.
const QUERIES = [
	...['g', 'gl', 'glo', 'gloi', 'gloir', 'gloire'],
	...['gloire a', 'gloire au', 'gloire au sei', 'gloire au seigneur'],
	'R3 245',
	'r7 12',
	'245',
	'seigneur jesus christ',
	'eternel mon berger',
	'agneau de dieu',
	'glorie', // typo
	'esperance foi priere amour grace paix joie louange coeur ame vie croix sang agneau roi',
	'lumiere chemin verite force refuge rocher'
];

describe('search performance (SC-002)', () => {
	it(`answers every query in ≤ ${BUDGET_MS} ms on 6,000 hymns`, () => {
		// Warm up (JIT), as the worker would after the first query.
		for (const query of QUERIES) engine.search({ query });

		const slow: string[] = [];
		let worst = 0;
		for (const query of QUERIES) {
			const t = performance.now();
			const response = engine.search({ query });
			const ms = performance.now() - t;
			worst = Math.max(worst, ms);
			if (ms > BUDGET_MS)
				slow.push(`"${query}": ${ms.toFixed(1)} ms (${response.results.length} results)`);
		}
		console.info(`Slowest search: ${worst.toFixed(1)} ms. Index load: ${loadMs.toFixed(0)} ms.`);
		expect(slow).toEqual([]);
	});

	it('keeps catalog + index under 5 MB compressed', () => {
		const bytes = gzipSync(catalogJson).length + gzipSync(indexJson).length;
		console.info(`Compressed data: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
		expect(bytes).toBeLessThanOrEqual(MAX_COMPRESSED_BYTES);
	});
});
