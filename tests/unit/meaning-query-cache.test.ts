import { describe, expect, it } from 'vitest';
import { createQueryCache, QUERY_CACHE_KEY, queryKey } from '../../src/lib/meaning/query-cache';
import { MemoryStorage } from '../helpers/memory-storage';

const v = (x: number) => Float32Array.of(x, 1 - x);

describe('query cache', () => {
	it('normalises keys', () => {
		expect(queryKey('  Grâce  divine ')).toBe('grâce divine');
		const cache = createQueryCache({ storage: new MemoryStorage(), configId: 'c1' });
		cache.put('Grâce  divine', v(0.5));
		expect(Array.from(cache.get('grâce divine')!)).toEqual([0.5, 0.5]);
	});

	it('keeps at most 50 entries, least recently used dropped first', () => {
		let t = 0;
		const storage = new MemoryStorage();
		const cache = createQueryCache({ storage, configId: 'c1', now: () => ++t });
		for (let i = 0; i < 50; i++) cache.put(`q${i}`, v(i / 100));
		cache.get('q0'); // refreshed: q1 is now the oldest
		cache.put('q50', v(0.9));
		expect(cache.get('q0')).toBeDefined();
		expect(cache.get('q1')).toBeUndefined();
		const stored = JSON.parse(storage.getItem(QUERY_CACHE_KEY)!);
		expect(stored).toMatchObject({ v: 1, configId: 'c1' });
		expect(stored.items).toHaveLength(50);
	});

	it('drops a store of another configId or invalid JSON', () => {
		const storage = new MemoryStorage();
		createQueryCache({ storage, configId: 'old' }).put('grâce', v(0.1));
		expect(createQueryCache({ storage, configId: 'new' }).get('grâce')).toBeUndefined();
		storage.setItem(QUERY_CACHE_KEY, '{bad');
		expect(createQueryCache({ storage, configId: 'new' }).get('grâce')).toBeUndefined();
		storage.setItem(
			QUERY_CACHE_KEY,
			JSON.stringify({ v: 1, configId: 'new', items: [{ key: 1 }] })
		);
		expect(createQueryCache({ storage, configId: 'new' }).get('grâce')).toBeUndefined();
	});

	it('swallows storage errors', () => {
		const storage = new MemoryStorage();
		storage.failReads = true;
		storage.failWrites = true;
		const cache = createQueryCache({ storage, configId: 'c1' });
		expect(() => cache.put('grâce', v(0.2))).not.toThrow();
		// Kept in memory for the visit.
		expect(cache.get('grâce')).toBeDefined();
		expect(createQueryCache({ storage: undefined, configId: 'c1' }).get('x')).toBeUndefined();
	});
});
