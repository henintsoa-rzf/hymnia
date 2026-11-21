import { describe, expect, it } from 'vitest';
import type { DataManifest } from '$lib/domain/schema';
import {
	formatBytes,
	itemStates,
	offlineItems,
	offlineOverview,
	type OfflineStatus
} from '$lib/offline/status';

// Feature 016, story 3 (FR-016, FR-017, research R7).
const manifest: DataManifest = {
	version: 'v',
	catalog: 'catalog.a.json',
	index: 'index.b.json',
	meaning: {
		configId: 'c',
		dims: 4,
		rows: 1,
		vectors: 'meaning.c.bin',
		rowMap: 'meaning-rows.d.bin',
		bytes: 8
	},
	bible: { translation: 'lsg1910', file: 'bible.e.json', bytes: 10, verses: 1 }
};

describe('offlineItems', () => {
	it('lists hymns, Bible and meaning data with their files', () => {
		expect(offlineItems(manifest)).toEqual([
			{ id: 'hymns', label: 'Chants et recueils', files: ['catalog.a.json', 'index.b.json'] },
			{ id: 'bible', label: 'Bible', files: ['bible.e.json'] },
			{
				id: 'meaning',
				label: 'Recherche par le sens',
				files: ['meaning.c.bin', 'meaning-rows.d.bin']
			}
		]);
	});

	it('leaves out what the build does not have', () => {
		const bare = { version: 'v', catalog: 'catalog.a.json', index: 'index.b.json' };
		expect(offlineItems(bare).map((i) => i.id)).toEqual(['hymns']);
	});
});

describe('itemStates', () => {
	const items = offlineItems(manifest);

	it('is ready only when every file of the item is cached', () => {
		const cached = new Set(['catalog.a.json', 'index.b.json', 'meaning.c.bin']);
		expect(itemStates(items, cached, 'absent').map((i) => [i.id, i.state])).toEqual([
			['hymns', 'ready'],
			['bible', 'missing'],
			['meaning', 'missing']
		]);
	});

	it('shows meaning data downloading while the worker downloads it', () => {
		expect(itemStates(items, new Set(), 'downloading').at(-1)!.state).toBe('downloading');
		const all = new Set(items.flatMap((i) => i.files));
		expect(itemStates(items, all, 'downloading').at(-1)!.state).toBe('ready');
	});
});

describe('offlineOverview', () => {
	const status = (states: string[], cacheAvailable = true): OfflineStatus => ({
		cacheAvailable,
		items: offlineItems(manifest).map((item, i) => ({
			id: item.id,
			label: item.label,
			state: states[i] as 'ready'
		}))
	});

	it('is ready when every item is', () => {
		expect(offlineOverview(status(['ready', 'ready', 'ready']))).toEqual({ kind: 'ready' });
	});

	it('names the first item that is not ready', () => {
		expect(offlineOverview(status(['ready', 'missing', 'downloading']))).toEqual({
			kind: 'item',
			label: 'Bible',
			state: 'missing'
		});
	});

	it('is unavailable without a cache', () => {
		expect(offlineOverview(status(['missing', 'missing', 'missing'], false))).toEqual({
			kind: 'unavailable'
		});
	});
});

describe('formatBytes', () => {
	it('writes megabytes the French way', () => {
		expect(formatBytes(18_400_000)).toBe('18,4 Mo');
		expect(formatBytes(940_000)).toBe('0,9 Mo');
		expect(formatBytes(undefined)).toBeUndefined();
	});
});
