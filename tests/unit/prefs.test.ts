import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { clampTextScale, createPrefsStore, DEFAULT_PREFS, sanitizePrefs } from '$lib/prefs/prefs';

function memoryStorage(initial: Record<string, string> = {}): Storage {
	const data = new Map(Object.entries(initial));
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (k) => data.get(k) ?? null,
		key: (i) => [...data.keys()][i] ?? null,
		removeItem: (k) => void data.delete(k),
		setItem: (k, v) => void data.set(k, v)
	};
}

describe('reading preferences (FR-015, FR-017)', () => {
	it('keeps textScale between 0.85 and 2.0', () => {
		expect(clampTextScale(0.5)).toBe(0.85);
		expect(clampTextScale(3)).toBe(2);
		expect(clampTextScale(Number.NaN)).toBe(1);
	});

	it('falls back to defaults for invalid stored values', () => {
		expect(sanitizePrefs({ theme: 'blue', textScale: 'big', hymnalFilter: [1, 'ce'] })).toEqual({
			textScale: 1,
			theme: 'system',
			hymnalFilter: ['ce']
		});
	});

	it('saves and restores across sessions', () => {
		const storage = memoryStorage();
		const first = createPrefsStore(storage);
		first.update((p) => ({ ...p, textScale: 1.4, theme: 'dark' }));
		expect(get(createPrefsStore(storage))).toMatchObject({ textScale: 1.4, theme: 'dark' });
	});

	it('works when storage throws', () => {
		const broken = memoryStorage();
		broken.getItem = () => {
			throw new Error('blocked');
		};
		broken.setItem = () => {
			throw new Error('blocked');
		};
		const store = createPrefsStore(broken);
		expect(get(store)).toEqual(DEFAULT_PREFS);
		expect(() => store.set({ ...DEFAULT_PREFS, textScale: 1.2 })).not.toThrow();
	});
});
