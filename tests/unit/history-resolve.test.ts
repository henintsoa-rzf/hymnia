// Resolving the history for display (specs/006-search-start-panel/data-model.md, task T007).
import { describe, expect, it } from 'vitest';
import { createCatalog } from '$lib/data/catalog';
import { sortKey } from '$lib/domain/numbering';
import type { Catalog, PublishedHymn } from '$lib/domain/schema';
import { recentHymns } from '$lib/history/resolve';
import type { HistoryDoc, HistoryEntry } from '$lib/history/schema';

const T = '2026-11-14T09:00:00.000Z';

function hymn(id: string, ...refs: [string, string][]): PublishedHymn {
	return {
		id,
		title: id,
		firstLine: id,
		sections: [{ type: 'verse', number: 1, lines: [id] }],
		credits: [],
		source: { name: 'Test', url: null, retrievedAt: '2026-11-14' },
		entries: refs.map(([hymnal, number]) => ({ hymnal, number, sortKey: sortKey(number) }))
	};
}

// "gloire" moved from JEM 12 to JEM 13; "ancien" was merged into "kept"; JEM 12 is now "autre".
const data: Catalog = {
	version: 'v2',
	hymnals: [
		{ id: 'jem', name: 'J’aime l’Éternel', abbreviations: ['JEM'], sortOrder: 1, hymnCount: 12 },
		{ id: 'atg', name: 'À Toi la Gloire', abbreviations: ['ATG'], sortOrder: 2, hymnCount: 2 }
	],
	hymns: [
		hymn('gloire', ['atg', '1'], ['jem', '13']),
		hymn('autre', ['jem', '12']),
		hymn('kept', ['jem', '20'], ['atg', '5']),
		...Array.from({ length: 10 }, (_, i) => hymn(`h${i}`, ['jem', String(100 + i)]))
	],
	redirects: { ancien: 'kept' }
};
const catalog = createCatalog(data);

const entry = (hymnal: string, number: string, hymnId: string): HistoryEntry => ({
	hymnal,
	number,
	hymnId,
	openedAt: T
});
const doc = (...entries: HistoryEntry[]): HistoryDoc => ({ version: 1, entries });

describe('recentHymns', () => {
	it('lists the hymns in stored order, with their reference, hymn and hymnal', () => {
		const rows = recentHymns(
			catalog,
			doc(entry('jem', '12', 'autre'), entry('atg', '1', 'gloire'))
		);
		expect(rows.map((r) => [r.hymnal, r.number, r.hymn.id])).toEqual([
			['jem', '12', 'autre'],
			['atg', '1', 'gloire']
		]);
		expect(rows[0].hymnalInfo?.abbreviations[0]).toBe('JEM');
	});

	it('skips hymns that are not published, without counting them', () => {
		const rows = recentHymns(
			catalog,
			doc(entry('jem', '99', 'gone'), entry('jem', '12', 'autre'), entry('atg', '1', 'gloire')),
			2
		);
		expect(rows.map((r) => r.hymn.id)).toEqual(['autre', 'gloire']);
	});

	it('follows a merged hymn', () => {
		const [row] = recentHymns(catalog, doc(entry('jem', '20', 'ancien')));
		expect(row).toMatchObject({ hymnal: 'jem', number: '20' });
		expect(row.hymn.id).toBe('kept');
	});

	it('opens a renumbered hymn at its current number in the same hymnal', () => {
		const [row] = recentHymns(catalog, doc(entry('jem', '12', 'gloire')));
		expect(row).toMatchObject({ hymnal: 'jem', number: '13' });
		expect(row.hymn.id).toBe('gloire');
	});

	it('lists a hymn once when two entries resolve to it', () => {
		const rows = recentHymns(
			catalog,
			doc(entry('jem', '20', 'kept'), entry('atg', '5', 'ancien'), entry('jem', '12', 'autre'))
		);
		expect(rows.map((r) => r.hymn.id)).toEqual(['kept', 'autre']);
	});

	it('shows 8 hymns by default', () => {
		const many = doc(
			...Array.from({ length: 10 }, (_, i) => entry('jem', String(100 + i), `h${i}`))
		);
		expect(recentHymns(catalog, many)).toHaveLength(8);
		expect(recentHymns(catalog, many, 3)).toHaveLength(3);
	});
});
