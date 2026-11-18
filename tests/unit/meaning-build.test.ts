import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmbedder } from '../../scripts/semantic/embed';
import { buildMeaningData, readRowMap } from '../../scripts/semantic/build';
import { MEANING_CONFIG, configId } from '../../src/lib/meaning/config';
import type { Catalog } from '../../src/lib/domain/schema';
import { fakeEmbed } from '../helpers/fake-embedder';
import { loadSample } from '../helpers/sample';
import { themesFor } from '../helpers/themes';

let dir: string;
let catalog: Catalog;
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'hymnia-meaning-'));
	catalog = (await loadSample()).catalog;
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const embedder = (withKey = true) =>
	createEmbedder({ apiKey: withKey ? 'test' : undefined, cacheDir: dir, embedBatch: fakeEmbed });

describe('buildMeaningData', () => {
	it('writes rows × dims int8 values and an 8-byte row map', async () => {
		const out = await buildMeaningData(catalog, MEANING_CONFIG, embedder(), themesFor(catalog));
		if (!('vectors' in out)) throw new Error(JSON.stringify(out));
		const { dims } = MEANING_CONFIG;
		expect(out.configId).toBe(configId(MEANING_CONFIG));
		expect(out.vectors.byteLength).toBe(out.rows * dims);
		expect(out.rowMap.byteLength).toBe(out.rows * 8);
		expect(out.report).toMatchObject({ embedded: out.rows, cached: 0 });

		const rows = readRowMap(out.rowMap);
		for (let r = 1; r < rows.length; r++) {
			const a = rows[r - 1];
			const b = rows[r];
			expect(
				a.hymnIndex < b.hymnIndex || (a.hymnIndex === b.hymnIndex && a.section < b.section)
			).toBe(true);
		}
		const covered = new Set(rows.map((r) => r.hymnIndex));
		catalog.hymns.forEach((h, i) => {
			if (h.sections.length > 0) expect(covered.has(i)).toBe(true);
		});
		expect(
			rows.every((r) => r.scale > 0 && r.section < catalog.hymns[r.hymnIndex].sections.length)
		).toBe(true);
	});

	it('little-endian row map: uint16 hymnIndex, uint16 section, float32 scale', async () => {
		const out = await buildMeaningData(catalog, MEANING_CONFIG, embedder(), themesFor(catalog));
		if (!('rowMap' in out)) throw new Error('skipped');
		const view = new DataView(out.rowMap.buffer, out.rowMap.byteOffset);
		const last = readRowMap(out.rowMap).at(-1)!;
		const o = (out.rows - 1) * 8;
		expect(view.getUint16(o, true)).toBe(last.hymnIndex);
		expect(view.getUint16(o + 2, true)).toBe(last.section);
		expect(view.getFloat32(o + 4, true)).toBe(last.scale);
	});

	it('is skipped with no credentials and an incomplete cache', async () => {
		expect(
			await buildMeaningData(catalog, MEANING_CONFIG, embedder(false), themesFor(catalog))
		).toEqual({
			skipped: 'no-credentials'
		});
		// With a complete cache, no credentials are needed.
		await buildMeaningData(catalog, MEANING_CONFIG, embedder(), themesFor(catalog));
		const out = await buildMeaningData(
			catalog,
			MEANING_CONFIG,
			embedder(false),
			themesFor(catalog)
		);
		expect('vectors' in out && out.report.cached).toBeGreaterThan(0);
	});

	it('fails over maxBytes', async () => {
		const out = await buildMeaningData(
			catalog,
			{ ...MEANING_CONFIG, maxBytes: 100 },
			embedder(),
			themesFor(catalog)
		);
		expect(out).toMatchObject({ error: expect.stringMatching(/limit/) });
	});

	describe('theme descriptions (T053)', () => {
		it('fails when the themes file is missing', async () => {
			const out = await buildMeaningData(catalog, MEANING_CONFIG, embedder());
			expect(out).toMatchObject({ error: expect.stringMatching(/themes\.json.*generate-themes/) });
		});

		it('fails when a description is older than its lyrics, naming the hymn', async () => {
			const themes = themesFor(catalog);
			const id = catalog.hymns[0].id;
			themes[id] = { ...themes[id], lyricsHash: 'older lyrics' };
			const out = await buildMeaningData(catalog, MEANING_CONFIG, embedder(), themes);
			expect(out).toMatchObject({
				error: expect.stringMatching(new RegExp(`older lyrics.*${id}.*generate-themes`))
			});
		});

		it('indexes a hymn without a description by its title, and reports it', async () => {
			const themes = themesFor(catalog);
			const id = catalog.hymns[0].id;
			delete themes[id];
			const out = await buildMeaningData(catalog, MEANING_CONFIG, embedder(), themes);
			if (!('report' in out)) throw new Error(JSON.stringify(out));
			expect(out.report.withoutTheme).toEqual([id]);
		});

		it('needs no descriptions for a representation without themes', async () => {
			const config = { ...MEANING_CONFIG, representation: 'title+stanza' as const };
			const out = await buildMeaningData(catalog, config, embedder());
			expect('vectors' in out).toBe(true);
		});
	});
});
