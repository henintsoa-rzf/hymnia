/**
 * Reading preferences, per device (data-model.md, "Reading preferences"). Kept apart from hymn
 * data (Principle IV). Storage may be unavailable (private mode): every access is guarded and the
 * defaults are used instead.
 */
import { writable, type Writable } from 'svelte/store';
import { bookByCode, type BookCode } from '../bible/books';
import { NO_EXCLUSIONS, sanitizeExclusions, type Exclusions } from '../scope/scope';

export type Theme = 'system' | 'light' | 'dark';

export type Prefs = {
	/** "0.85 to 2.0, default 1.0" */
	textScale: number;
	/** `system` (default), `light`, `dark` */
	theme: Theme;
	/** Selected hymnal ids; empty means all. */
	hymnalFilter: string[];
	/** Hymnals and parts left out in Settings (feature 014); empty means all. */
	excluded: Exclusions;
	/** Last Bible chapter read (feature 015); null before the first one. */
	bibleAt: { book: BookCode; chapter: number } | null;
};

export const TEXT_SCALE_MIN = 0.85;
export const TEXT_SCALE_MAX = 2.0;
export const DEFAULT_PREFS: Prefs = {
	textScale: 1.0,
	theme: 'system',
	hymnalFilter: [],
	excluded: NO_EXCLUSIONS,
	bibleAt: null
};

const STORAGE_KEY = 'hymnia.prefs';

export function clampTextScale(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_PREFS.textScale;
	return Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value)) * 100) / 100;
}

/** Keep only valid values; anything else falls back to the default. */
export function sanitizePrefs(value: unknown): Prefs {
	const v = (value && typeof value === 'object' ? value : {}) as Partial<
		Record<keyof Prefs, unknown>
	>;
	return {
		textScale:
			typeof v.textScale === 'number' ? clampTextScale(v.textScale) : DEFAULT_PREFS.textScale,
		theme: v.theme === 'light' || v.theme === 'dark' || v.theme === 'system' ? v.theme : 'system',
		hymnalFilter: Array.isArray(v.hymnalFilter)
			? v.hymnalFilter.filter((x): x is string => typeof x === 'string')
			: [],
		excluded: sanitizeExclusions(v.excluded),
		bibleAt: sanitizeBibleAt(v.bibleAt)
	};
}

/** A known book and an existing chapter, or null. */
function sanitizeBibleAt(value: unknown): Prefs['bibleAt'] {
	if (!value || typeof value !== 'object') return null;
	const { book, chapter } = value as { book?: unknown; chapter?: unknown };
	const known = typeof book === 'string' ? bookByCode(book) : undefined;
	if (!known || !Number.isInteger(chapter)) return null;
	const n = chapter as number;
	return n >= 1 && n <= known.chapters ? { book: known.code, chapter: n } : null;
}

function read(storage: Storage | undefined): Prefs {
	try {
		const raw = storage?.getItem(STORAGE_KEY);
		return raw ? sanitizePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS };
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

function safeStorage(): Storage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		return undefined;
	}
}

export function createPrefsStore(storage: Storage | undefined = safeStorage()): Writable<Prefs> {
	const store = writable<Prefs>(read(storage));
	store.subscribe((value) => {
		try {
			storage?.setItem(STORAGE_KEY, JSON.stringify(sanitizePrefs(value)));
		} catch {
			// Storage full or blocked: preferences only last for this visit.
		}
	});
	return store;
}

export const prefs = createPrefsStore();
