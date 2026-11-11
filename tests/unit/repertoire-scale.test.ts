// Reference size of the Répertoire: 50 collections of 100 hymns (spec SC-003, plan constraints).
import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { collectionsWith, type HymnIdOf } from '$lib/repertoire/model';
import { parseDocument } from '$lib/repertoire/model';
import type { RepertoireDoc } from '$lib/repertoire/schema';
import { createRepertoireStore, STORAGE_KEY } from '$lib/repertoire/store';

const AT = '2026-11-11T09:00:00.000Z';

function bigDocument(): RepertoireDoc {
	return {
		version: 2,
		collections: Array.from({ length: 50 }, (_, c) => ({
			id: `00000000-0000-4000-8000-${String(c).padStart(12, '0')}`,
			name: `Culte du dimanche numéro ${c + 1}`,
			createdAt: AT,
			updatedAt: AT,
			entries: Array.from({ length: 100 }, (_, e) => ({
				hymnal: ['ce', 'he', 'jem', 'adf'][e % 4],
				number: String(c * 100 + e + 1),
				addedAt: AT
			}))
		}))
	};
}

describe('50 collections of 100 hymns', () => {
	const doc = bigDocument();
	const json = JSON.stringify(doc);

	it('fits in under 1 MB of storage', () => {
		expect(new TextEncoder().encode(json).length).toBeLessThan(1024 * 1024);
	});

	it('loads and answers "which collections hold this hymn" quickly', () => {
		const hymnIdOf: HymnIdOf = (ref) => `${ref.hymnal}-${ref.number}`;
		const storage = {
			getItem: (key: string) => (key === STORAGE_KEY ? json : null),
			setItem: () => {},
			removeItem: () => {},
			clear: () => {},
			key: () => null,
			length: 1
		} as Storage;

		const started = performance.now();
		const store = createRepertoireStore({ storage, listen: false, persist: false });
		const loaded = get(store);
		const holders = collectionsWith(loaded, { hymnal: 'ce', number: '4901' }, hymnIdOf);
		const took = performance.now() - started;

		expect(loaded.collections).toHaveLength(50);
		expect(holders).toEqual([doc.collections[49].id]);
		expect(parseDocument(json).ok).toBe(true);
		expect(took).toBeLessThan(50);
	});
});
