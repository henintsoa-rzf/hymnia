// Resolving collection entries (specs/003-repertoire-collections/data-model.md, "Resolving an
// entry"; feature 002 FR-027, task T024).
import { describe, expect, it } from 'vitest';
import { createCatalog } from '$lib/data/catalog';
import { sortKey } from '$lib/domain/numbering';
import type { Catalog, PublishedHymn } from '$lib/domain/schema';
import { collectRepairs, hymnIdOf, resolveEntries } from '$lib/repertoire/resolve';
import type { Collection, CollectionEntry } from '$lib/repertoire/schema';

const T = '2026-11-11T09:00:00.000Z';

function hymn(id: string, ...refs: [string, string][]): PublishedHymn {
	return {
		id,
		title: id,
		firstLine: id,
		sections: [{ type: 'verse', number: 1, lines: [id] }],
		credits: [],
		source: { name: 'Test', url: null, retrievedAt: '2026-11-11' },
		entries: refs.map(([hymnal, number]) => ({ hymnal, number, sortKey: sortKey(number) }))
	};
}

// Today's catalog: "gloire" moved from JEM 12 to JEM 13, and "ancien" was merged into "kept".
// JEM 12 is now another hymn ("autre").
const data: Catalog = {
	version: 'v2',
	hymnals: [
		{ id: 'jem', name: 'J’aime l’Éternel', abbreviations: ['JEM'], sortOrder: 1, hymnCount: 3 },
		{ id: 'atg', name: 'À Toi la Gloire', abbreviations: ['ATG'], sortOrder: 2, hymnCount: 2 }
	],
	hymns: [
		hymn('gloire', ['atg', '1'], ['jem', '13']),
		hymn('autre', ['jem', '12']),
		hymn('kept', ['jem', '20'], ['atg', '5'])
	],
	redirects: { ancien: 'kept' }
};
const catalog = createCatalog(data);

const collection = (...entries: CollectionEntry[]): Collection => ({
	id: 'c1',
	name: 'Culte',
	createdAt: T,
	updatedAt: T,
	entries
});
const entry = (hymnal: string, number: string, hymnId?: string): CollectionEntry => ({
	hymnal,
	number,
	addedAt: T,
	...(hymnId ? { hymnId } : {})
});

describe('resolveEntries', () => {
	it('keeps an entry whose reference still points to its hymn', () => {
		const [row] = resolveEntries(catalog, collection(entry('jem', '13', 'gloire')));
		expect(row.available).toBe(true);
		expect(row.hymn?.id).toBe('gloire');
		expect(row.repair).toBeUndefined();
	});

	it('follows a renumbered hymn instead of opening the hymn that now has the number', () => {
		const [row] = resolveEntries(catalog, collection(entry('jem', '12', 'gloire')));
		expect(row.available).toBe(true);
		expect(row.hymn?.id).toBe('gloire');
		// Same hymnal when the hymn is still in it.
		expect(row.entry).toMatchObject({ hymnal: 'jem', number: '13', hymnId: 'gloire' });
		expect(row.repair).toEqual({ hymnal: 'jem', number: '13', hymnId: 'gloire' });
	});

	it('uses the hymn’s first entry when it left the hymnal', () => {
		const [row] = resolveEntries(catalog, collection(entry('he', '4', 'gloire')));
		expect(row.repair).toEqual({ hymnal: 'atg', number: '1', hymnId: 'gloire' });
	});

	it('follows a merged hymn id through the redirects', () => {
		const [row] = resolveEntries(catalog, collection(entry('jem', '20', 'ancien')));
		expect(row.hymn?.id).toBe('kept');
		expect(row.repair).toEqual({ hymnal: 'jem', number: '20', hymnId: 'kept' });
	});

	it('shows an unpublished hymn as unavailable, even when its number now points elsewhere', () => {
		const [row] = resolveEntries(catalog, collection(entry('jem', '12', 'retire')));
		expect(row.available).toBe(false);
		expect(row.hymn).toBeUndefined();
		expect(row.repair).toBeUndefined();
		expect(row.entry).toMatchObject({ hymnal: 'jem', number: '12', hymnId: 'retire' });
	});

	it('resolves an older entry with no hymnId by reference, and reports the id to store', () => {
		const [row] = resolveEntries(catalog, collection(entry('jem', '12')));
		expect(row.hymn?.id).toBe('autre');
		expect(row.repair).toEqual({ hymnal: 'jem', number: '12', hymnId: 'autre' });
	});

	it('leaves an older entry that does not resolve unavailable, with nothing to store', () => {
		const [row] = resolveEntries(catalog, collection(entry('jem', '999')));
		expect(row.available).toBe(false);
		expect(row.repair).toBeUndefined();
	});
});

describe('hymnIdOf', () => {
	it('uses the stored hymnId, through redirects, before the reference', () => {
		const idOf = hymnIdOf(catalog);
		expect(idOf({ hymnal: 'jem', number: '12' })).toBe('autre');
		expect(idOf({ hymnal: 'jem', number: '12', hymnId: 'gloire' })).toBe('gloire');
		expect(idOf({ hymnal: 'jem', number: '20', hymnId: 'ancien' })).toBe('kept');
	});
});

describe('collectRepairs', () => {
	it('lists the repairs of every collection, with their position', () => {
		const repairs = collectRepairs(catalog, [
			collection(entry('jem', '13', 'gloire'), entry('jem', '12', 'gloire')),
			{ ...collection(entry('jem', '20', 'ancien')), id: 'c2' }
		]);
		expect(repairs).toEqual([
			{ collectionId: 'c1', index: 1, repair: { hymnal: 'jem', number: '13', hymnId: 'gloire' } },
			{ collectionId: 'c2', index: 0, repair: { hymnal: 'jem', number: '20', hymnId: 'kept' } }
		]);
	});
});

describe('catalog.resolveHymnId', () => {
	it('follows a redirect and leaves other ids as they are', () => {
		expect(catalog.resolveHymnId('ancien')).toBe('kept');
		expect(catalog.resolveHymnId('gloire')).toBe('gloire');
		expect(catalog.resolveHymnId('inconnu')).toBe('inconnu');
	});

	it('works with a catalog built before redirects existed', () => {
		const old = createCatalog({ ...data, redirects: undefined } as unknown as Catalog);
		expect(old.resolveHymnId('ancien')).toBe('ancien');
	});
});
