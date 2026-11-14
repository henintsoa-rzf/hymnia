import { beforeAll, describe, expect, it } from 'vitest';
import { createCatalog, type CatalogApi } from '$lib/data/catalog';
import type { Catalog } from '$lib/domain/schema';
import { loadSample } from '../helpers/sample';

let catalog: CatalogApi;
let catalogData: Catalog;
beforeAll(async () => {
	catalogData = (await loadSample()).catalog;
	catalog = createCatalog(catalogData);
});

describe('catalog lookups', () => {
	it('lists hymnals in sortOrder with their hymn count (FR-011)', () => {
		expect(catalog.getHymnals().map((h) => [h.id, h.hymnCount])).toEqual([
			['ce', 10],
			['he', 7]
		]);
	});

	it('lists only hymnals that have published hymns, but still knows the others', () => {
		const data = structuredClone(catalogData);
		data.hymnals.push({
			id: 'vide',
			name: 'Recueil vide',
			abbreviations: ['RV'],
			sortOrder: 99,
			hymnCount: 0
		});
		const withEmpty = createCatalog(data);
		expect(withEmpty.getHymnals().map((h) => h.id)).toEqual(['ce', 'he']);
		expect(withEmpty.getHymnal('vide')?.name).toBe('Recueil vide');
	});

	it('finds an entry whatever the number spelling', () => {
		expect(catalog.getEntry('he', '3bis')?.hymn.id).toBe('que-dieu-se-montre-seulement');
		expect(catalog.getEntry('he', '3 BIS')?.entry.number).toBe('3 bis');
		expect(catalog.getEntry('ce', '999')).toBeUndefined();
		expect(catalog.getEntry('zz', '1')).toBeUndefined();
	});

	it('lists a hymnal in number order (FR-012)', () => {
		expect(catalog.listEntries('he').map((r) => r.entry.number)).toEqual([
			'1',
			'2',
			'3',
			'3 bis',
			'7',
			'12',
			'13'
		]);
	});

	it('gives next and previous within the same hymnal (FR-016)', () => {
		const { previous, next } = catalog.neighbours('ce', '12');
		expect(previous?.entry.number).toBe('8');
		expect(next?.entry.number).toBe('12a');
		expect(catalog.neighbours('ce', '1').previous).toBeUndefined();
	});
});

describe('hymnals by name (feature 009)', () => {
	const hymnal = (id: string, name: string, sortOrder: number, hymnCount = 1) => ({
		id,
		name,
		abbreviations: [id.toUpperCase()],
		sortOrder,
		hymnCount
	});
	const REAL = [
		hymnal('jem', 'J’aime l’Éternel', 3),
		hymnal('adf', 'Ailes de la Foi', 4),
		hymnal('atg', 'À Toi la Gloire', 5),
		hymnal('cd', 'Célébrons Dieu', 6),
		hymnal('exo', 'Exo', 7),
		hymnal('ecriture', 'Écritures', 8),
		hymnal('psalmodie', 'Chorale Psalmodie', 9),
		hymnal('evangile21', 'Evangile21', 10),
		hymnal('arc', 'Arc-en-ciel', 11)
	];
	const withHymnals = (hymnals: ReturnType<typeof hymnal>[]) => {
		const data = structuredClone(catalogData);
		data.hymnals = hymnals;
		return createCatalog(data);
	};

	it('lists the hymnals in French alphabetical order of name (SC-001, FR-001, FR-002)', () => {
		expect(
			withHymnals(REAL)
				.getHymnalsByName()
				.map((h) => h.name)
		).toEqual([
			'À Toi la Gloire',
			'Ailes de la Foi',
			'Arc-en-ciel',
			'Célébrons Dieu',
			'Chorale Psalmodie',
			'Écritures',
			'Evangile21',
			'Exo',
			'J’aime l’Éternel'
		]);
	});

	it('keeps getHymnals() in sortOrder (FR-006)', () => {
		expect(
			withHymnals(REAL)
				.getHymnals()
				.map((h) => h.id)
		).toEqual(['jem', 'adf', 'atg', 'cd', 'exo', 'ecriture', 'psalmodie', 'evangile21', 'arc']);
	});

	it('lists the same hymnals as getHymnals(), without empty ones (FR-007)', () => {
		const c = withHymnals([...REAL, hymnal('vide', 'Aaa vide', 99, 0)]);
		const ids = (list: { id: string }[]) => list.map((h) => h.id).sort();
		expect(ids(c.getHymnalsByName())).toEqual(ids(c.getHymnals()));
		expect(ids(c.getHymnalsByName())).not.toContain('vide');
	});

	it('breaks ties on the id, whatever the input order (FR-003)', () => {
		const a = hymnal('a', 'echo', 2);
		const b = hymnal('b', 'Écho', 1);
		for (const input of [
			[a, b],
			[b, a]
		]) {
			expect(
				withHymnals(input)
					.getHymnalsByName()
					.map((h) => h.id)
			).toEqual(['a', 'b']);
		}
	});

	it('sorts a name starting with a digit before the letters', () => {
		const c = withHymnals([...REAL, hymnal('mille', '1000 chants', 12)]);
		expect(c.getHymnalsByName()[0].id).toBe('mille');
	});

	it('returns the same list on every call', () => {
		const c = withHymnals(REAL);
		expect(c.getHymnalsByName()).toBe(c.getHymnalsByName());
	});
});
