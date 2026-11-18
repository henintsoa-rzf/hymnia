// US4: rebuilds embed only new or changed stanzas, and give identical files for unchanged content.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmbedder } from '../../scripts/semantic/embed';
import { buildMeaningData, type MeaningBuild } from '../../scripts/semantic/build';
import { MEANING_CONFIG } from '../../src/lib/meaning/config';
import type { Catalog } from '../../src/lib/domain/schema';
import { fakeEmbed } from '../helpers/fake-embedder';
import { themesFor } from '../helpers/themes';
import { loadSample } from '../helpers/sample';

let dir: string;
let sent: string[];
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'hymnia-incr-'));
	sent = [];
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const embedder = (model = 'text-embedding-3-large') =>
	createEmbedder({
		model,
		apiKey: 'test',
		cacheDir: dir,
		embedBatch: async (texts) => {
			sent.push(...texts);
			return fakeEmbed(texts);
		}
	});

async function build(catalog: Catalog, config = MEANING_CONFIG, model?: string) {
	const out = await buildMeaningData(catalog, config, embedder(model), themesFor(catalog));
	if (!('vectors' in out)) throw new Error(JSON.stringify(out));
	return out;
}

const digest = (b: MeaningBuild) =>
	createHash('sha256').update(b.vectors).update(b.rowMap).digest('hex');

describe('incremental meaning build', () => {
	it('embeds nothing for unchanged content and writes identical bytes', async () => {
		const { catalog } = await loadSample();
		const first = await build(catalog);
		sent = [];
		const second = await build(catalog);
		expect(sent).toEqual([]);
		expect(second.report).toMatchObject({ embedded: 0 });
		expect(digest(second)).toBe(digest(first));
	});

	it('embeds only the changed stanza of a changed hymn', async () => {
		const { catalog } = await loadSample();
		await build(catalog);
		sent = [];
		const changed = structuredClone(catalog);
		const hymn = changed.hymns.find((h) => h.sections.length > 1)!;
		hymn.sections[1] = { ...hymn.sections[1], lines: [...hymn.sections[1].lines] };
		hymn.sections[1].lines[0] = 'Une ligne toute nouvelle pour ce couplet changé';
		await build(changed);
		expect(sent).toHaveLength(1);
		expect(sent[0]).toContain('Une ligne toute nouvelle');
	});

	it('embeds only the stanzas of an added hymn', async () => {
		const { catalog } = await loadSample();
		await build(catalog);
		sent = [];
		const added = structuredClone(catalog);
		added.hymns.push({
			...structuredClone(added.hymns[0]),
			id: 'zz-nouveau',
			title: 'Un chant nouveau',
			sections: [
				{
					type: 'verse',
					number: 1,
					lines: ['Chantez au Seigneur un chant nouveau, toute la terre']
				}
			]
		});
		await build(added);
		expect(sent).toEqual([
			'Un chant nouveau — Thèmes de Un chant nouveau.\n\n' +
				'Chantez au Seigneur un chant nouveau, toute la terre'
		]);
	});

	it('re-embeds everything for another representation or model', async () => {
		const { catalog } = await loadSample();
		const first = await build(catalog);
		sent = [];
		await build(catalog, { ...MEANING_CONFIG, representation: 'stanza' });
		expect(sent.length).toBe(first.rows);
		sent = [];
		await build(catalog, MEANING_CONFIG, 'another-model');
		expect(sent.length).toBe(first.rows);
	});
});
