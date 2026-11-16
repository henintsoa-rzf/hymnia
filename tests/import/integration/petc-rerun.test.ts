// Re-running the Pasteur & Compagnie import (specs/010-pasteur-compagnie-hymnal, US4, task
// T036). Offline: every page comes from the workspace cache, and the fetch implementation
// throws if it is ever called.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { runImport } from '../../../scripts/import/pipeline/run';
import {
	createPetcAdapter,
	PETC_ALBUMS_URL,
	PETC_LIST_URL,
	type PinnedNumber
} from '../../../scripts/import/sources/petc';
import { cachePage, makeWorkspace, seedCache, snapshot } from '../helpers/workspace';

const NOW = new Date('2026-11-16T18:00:00.000Z');
const noNetwork = (() => {
	throw new Error('network used');
}) as unknown as typeof fetch;

/** The fixture songs, with their pinned numbers (Coule à flots is on two albums). */
const songs = [
	{ handle: 'jesus-merci-jesus-thank-you', title: 'Jésus merci (Jesus Thank You)' },
	{ handle: 'coule-a-flots-come-thou-fount', title: 'Coule à flots (Come Thou Fount)' },
	{ handle: 'redempteur-adorable', title: 'Rédempteur adorable' },
	{ handle: 'lespoir-1', title: "L'espoir" },
	{ handle: 'noel-jesus-est-ne', title: 'Noël, Jésus est né' },
	{ handle: 'papa-cest-quoi-une-ame-partition', title: "Papa c'est quoi une âme ? (partition)" }
];
const numbers: PinnedNumber[] = [
	{ number: 105, page: 'coule-a-flots-come-thou-fount' },
	{ number: 303, page: 'jesus-merci-jesus-thank-you' },
	{ number: 402, page: 'album-kids-paroles#2' },
	{ number: 411, page: 'papa-cest-quoi-une-ame-partition' },
	{ number: 505, page: 'coule-a-flots-come-thou-fount' },
	{ number: 510, page: 'lespoir-1' },
	{ number: 1014, page: 'redempteur-adorable' },
	{ number: 1026, page: 'noel-jesus-est-ne' }
];

const grid = (cards: { handle: string; title: string }[]) =>
	`<html><body>${cards
		.map(
			(c) =>
				`<div class="grid-view-item"><a class="grid-view-item__link" href="/collections/partitions/products/${c.handle}"></a><div class="product-card__title">${c.title}</div></div>`
		)
		.join('')}</body></html>`;

let root: string;
const run = () =>
	runImport({
		root,
		source: 'petc',
		offline: true,
		yes: true,
		now: () => NOW,
		fetchImpl: noNetwork,
		adapter: createPetcAdapter(numbers, []),
		hooks: importHooks
	});
const listSongs = async (cards: typeof songs) => {
	await cachePage(root, 'petc', `${PETC_LIST_URL}?page=1`, grid(cards));
	await cachePage(root, 'petc', `${PETC_LIST_URL}?page=2`, grid([]));
};
const links = async () =>
	(JSON.parse(await readFile(join(root, 'import', 'state', 'links.json'), 'utf8')) as {
		source: string;
		number: string;
		hymnId: string;
		status: string;
	}[]).filter((l) => l.source === 'petc');

beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'petc');
	await listSongs(songs);
	await cachePage(root, 'petc', PETC_ALBUMS_URL, grid([]));
});

describe('Pasteur & Compagnie re-runs (US4)', () => {
	it('imports the fixture songs, one hymn for a song on two albums', async () => {
		const report = await run();
		expect(report.perSource.petc.status).toBe('ok');
		expect(report.perSource.petc.failures).toBe(0);
		const byNumber = Object.fromEntries((await links()).map((l) => [l.number, l.hymnId]));
		expect(Object.keys(byNumber).sort()).toEqual(numbers.map((n) => String(n.number)).sort());
		expect(byNumber['105']).toBe(byNumber['505']);
		const hymn = JSON.parse(await readFile(join(root, 'content', 'hymns', `${byNumber['105']}.json`), 'utf8'));
		expect(hymn.entries).toEqual([
			{ hymnal: 'pasteur-compagnie', number: '105' },
			{ hymnal: 'pasteur-compagnie', number: '505' }
		]);
		expect(hymn.alternateSources).toBeUndefined();
	});

	it('changes no file on a second run', async () => {
		await run();
		const content = await snapshot(join(root, 'content'));
		const state = await snapshot(join(root, 'import', 'state'));
		const report = await run();
		expect(await snapshot(join(root, 'content'))).toEqual(content);
		expect(await snapshot(join(root, 'import', 'state'))).toEqual(state);
		expect(report.perHymnal['pasteur-compagnie'].unchanged).toHaveLength(numbers.length);
	});

	it('keeps a song no list shows any more, with its number', async () => {
		await run();
		const before = await links();
		await listSongs(songs.filter((s) => s.handle !== 'noel-jesus-est-ne'));
		const report = await run();
		expect(report.perHymnal['pasteur-compagnie'].missing).toEqual([]);
		expect(await links()).toEqual(before);
	});
});
