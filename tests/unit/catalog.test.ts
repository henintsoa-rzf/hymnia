import { beforeAll, describe, expect, it } from 'vitest';
import { createCatalog, type CatalogApi } from '$lib/data/catalog';
import { loadSample } from '../helpers/sample';

let catalog: CatalogApi;
beforeAll(async () => {
	catalog = createCatalog((await loadSample()).catalog);
});

describe('catalog lookups', () => {
	it('lists hymnals in sortOrder with their hymn count (FR-011)', () => {
		expect(catalog.getHymnals().map((h) => [h.id, h.hymnCount])).toEqual([
			['ce', 10],
			['he', 7]
		]);
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
