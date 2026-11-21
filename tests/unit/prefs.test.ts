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
			hymnalFilter: ['ce'],
			excluded: { hymnals: [], parts: {} },
			bibleAt: null,
			lyricFont: 'serif',
			lineSpacing: 'normal',
			stanzaNumbers: true,
			chorus: 'once',
			keepAwake: false
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

	it('keeps the hymnals left out in Settings (feature 014)', () => {
		expect(DEFAULT_PREFS.excluded).toEqual({ hymnals: [], parts: {} });
		// Prefs saved before feature 014 have no `excluded`.
		expect(sanitizePrefs({ theme: 'dark' }).excluded).toEqual({ hymnals: [], parts: {} });
		expect(
			sanitizePrefs({ excluded: { hymnals: ['he'], parts: { jem: [801] } } }).excluded
		).toEqual({ hymnals: ['he'], parts: { jem: [801] } });
		expect(
			sanitizePrefs({ excluded: { hymnals: [3, 'he'], parts: { jem: ['x'] } } }).excluded
		).toEqual({ hymnals: ['he'], parts: {} });
	});
});

describe('Bible reading position (feature 015)', () => {
	it('defaults to null', () => {
		expect(DEFAULT_PREFS.bibleAt).toBeNull();
		expect(sanitizePrefs({}).bibleAt).toBeNull();
	});

	it('keeps a valid chapter', () => {
		expect(sanitizePrefs({ bibleAt: { book: 'JHN', chapter: 3 } }).bibleAt).toEqual({
			book: 'JHN',
			chapter: 3
		});
	});

	it('drops an unknown book or an out-of-range chapter', () => {
		for (const bibleAt of [
			{ book: 'XXX', chapter: 1 },
			{ book: 'JHN', chapter: 0 },
			{ book: 'JHN', chapter: 22 },
			{ book: 'JHN', chapter: 2.5 },
			{ book: 'JHN' },
			'JHN.3',
			7
		]) {
			expect(sanitizePrefs({ bibleAt }).bibleAt).toBeNull();
		}
	});

	it('is saved with the other preferences', () => {
		const storage = memoryStorage();
		createPrefsStore(storage).update((p) => ({ ...p, bibleAt: { book: 'ROM', chapter: 8 } }));
		expect(get(createPrefsStore(storage)).bibleAt).toEqual({ book: 'ROM', chapter: 8 });
	});
});

describe('Lecture preferences (feature 016, FR-021, FR-022)', () => {
	it('defaults to the current reading layout', () => {
		expect(DEFAULT_PREFS).toMatchObject({
			lyricFont: 'serif',
			lineSpacing: 'normal',
			stanzaNumbers: true,
			chorus: 'once',
			keepAwake: false
		});
	});

	it('keeps valid values', () => {
		const value = {
			lyricFont: 'sans',
			lineSpacing: 'loose',
			stanzaNumbers: false,
			chorus: 'each',
			keepAwake: true
		};
		expect(sanitizePrefs(value)).toMatchObject(value);
		expect(sanitizePrefs({ lineSpacing: 'tight' }).lineSpacing).toBe('tight');
	});

	it('falls back to the default for invalid values', () => {
		expect(
			sanitizePrefs({
				lyricFont: 'comic',
				lineSpacing: 'huge',
				stanzaNumbers: 'yes',
				chorus: 2,
				keepAwake: 1
			})
		).toMatchObject({
			lyricFont: 'serif',
			lineSpacing: 'normal',
			stanzaNumbers: true,
			chorus: 'once',
			keepAwake: false
		});
	});

	it('keeps preferences saved before this feature (SC-008)', () => {
		const old = {
			textScale: 1.3,
			theme: 'dark',
			hymnalFilter: ['ce'],
			excluded: { hymnals: ['he'], parts: {} },
			bibleAt: { book: 'JHN', chapter: 3 }
		};
		expect(sanitizePrefs(old)).toMatchObject(old);
	});
});
