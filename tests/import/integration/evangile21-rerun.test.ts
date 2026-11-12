// Re-running the Evangile21 import (specs/004-evangile21-hymnal, US3, task T030). Offline: the
// source is saved-pages only and the fetch implementation throws if it is ever called.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { importHooks } from '../../../scripts/import/pipeline/hooks';
import { runImport } from '../../../scripts/import/pipeline/run';
import {
	createEvangile21Adapter,
	EVANGILE21_BASE,
	EVANGILE21_NUMBERS,
	EVANGILE21_SERIES_URL
} from '../../../scripts/import/sources/evangile21';
import { fixtureIndex, fixturePage } from '../helpers/fixtures';
import { cachePage, makeWorkspace, seedCache, snapshot } from '../helpers/workspace';

const NOW = new Date('2026-11-12T18:00:00.000Z');
const noNetwork = (() => {
	throw new Error('network used');
}) as unknown as typeof fetch;

/** Song pages of the fixtures (the Psaume 150 video page is a skipped duplicate). */
const pages = Object.entries(fixtureIndex('evangile21'))
	.filter(([file]) => file.startsWith('hymn-') && !file.endsWith('-full.html') && !file.includes('video'))
	.map(([file, { url }]) => ({ file, path: new URL(url).pathname }));
const pinned = EVANGILE21_NUMBERS.filter((n) => pages.some((p) => p.path === n.path));

/** A series page listing these paths, newest first (like the site). */
const seriesPage = (paths: string[]) =>
	`<html><body>${paths
		.map(
			(p) =>
				`<article class="left_image_article_card"><h2 class="article_title"><a class="article_link" href="${EVANGILE21_BASE}${p}">${p}</a></h2></article>`
		)
		.join('')}</body></html>`;
const newestFirst = (paths: string[]) =>
	[...paths].sort(
		(a, b) => (pinned.find((n) => n.path === b)?.number ?? 99) - (pinned.find((n) => n.path === a)?.number ?? 99)
	);

let root: string;
const run = () =>
	runImport({
		root,
		source: 'evangile21',
		yes: true,
		now: () => NOW,
		fetchImpl: noNetwork,
		adapter: createEvangile21Adapter(pinned, []),
		hooks: importHooks
	});
const listSeries = (paths: string[]) => cachePage(root, 'evangile21', EVANGILE21_SERIES_URL, seriesPage(paths));
const links = async () =>
	(JSON.parse(await readFile(join(root, 'import', 'state', 'links.json'), 'utf8')) as {
		source: string;
		number: string;
		url: string;
		hymnId: string;
		status: string;
	}[]).filter((l) => l.source === 'evangile21');

beforeEach(async () => {
	root = await makeWorkspace();
	await seedCache(root, 'evangile21');
	await listSeries(newestFirst(pages.map((p) => p.path)));
});

describe('Evangile21 re-runs (US3)', () => {
	it('imports the fixture songs, then a second run changes no file', async () => {
		const first = await run();
		expect(first.perSource.evangile21.status).toBe('ok');
		expect(first.perSource.evangile21.failures).toBe(0);
		const content = await snapshot(join(root, 'content'));
		const state = await snapshot(join(root, 'import', 'state'));
		await run();
		expect(await snapshot(join(root, 'content'))).toEqual(content);
		expect(await snapshot(join(root, 'import', 'state'))).toEqual(state);
	});

	it('a new song gets the next number and no other number changes', async () => {
		await run();
		const before = Object.fromEntries((await links()).map((l) => [l.url, l.number]));
		const max = Math.max(...pinned.map((n) => n.number));

		const path = '/article/nouveau-chant/';
		const html = fixturePage('evangile21', 'hymn-viens-suis-moi.html').replace(/Viens suis-moi/g, 'Viens, avance');
		await cachePage(root, 'evangile21', `${EVANGILE21_BASE}${path}`, html);
		await listSeries([path, ...newestFirst(pages.map((p) => p.path))]);

		const report = await run();
		expect(report.perSource.evangile21.status).toBe('ok');
		const after = Object.fromEntries((await links()).map((l) => [l.url, l.number]));
		expect(after[`${EVANGILE21_BASE}${path}`]).toBe(String(max + 1));
		for (const [url, number] of Object.entries(before)) expect(after[url]).toBe(number);
	});

	it('a changed song text becomes a pending change; content is untouched until accepted', async () => {
		await run();
		const content = await snapshot(join(root, 'content'));
		const url = `${EVANGILE21_BASE}/article/roc-des-ages/`;
		await cachePage(
			root,
			'evangile21',
			url,
			fixturePage('evangile21', 'hymn-roc-des-ages.html').replace('Sauve-moi et rends-moi pur', 'Sauve-moi, rends-moi pur')
		);
		const report = await run();
		expect(report.perHymnal.evangile21.changed.length).toBe(1);
		expect(await snapshot(join(root, 'content'))).toEqual(content);
	});

	it('a song removed from the list is reported missing and kept', async () => {
		await run();
		const content = await snapshot(join(root, 'content'));
		await listSeries(newestFirst(pages.map((p) => p.path).filter((p) => p !== '/article/roc-des-ages/')));
		const report = await run();
		expect(report.perHymnal.evangile21.missing.length).toBe(1);
		const after = await snapshot(join(root, 'content'));
		expect(Object.keys(after).filter((f) => f.includes('roc-des-ages'))).toEqual(
			Object.keys(content).filter((f) => f.includes('roc-des-ages'))
		);
		expect((await links()).find((l) => l.url.endsWith('/article/roc-des-ages/'))?.status).toBe('missing');
	});
});
