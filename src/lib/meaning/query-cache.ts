/**
 * The last 50 query vectors on this device (data-model.md QueryVector, FR-013), so a repeated
 * search by meaning works offline. User data, kept apart from hymn data. When storage is missing
 * or refuses, the cache lives in memory for the visit.
 */
import { fromBase64, toBase64 } from './vector';

export const QUERY_CACHE_KEY = 'hymnia.meaning.queries';
export const QUERY_CACHE_SIZE = 50;

type Item = { key: string; vector: string; usedAt: number };
type Doc = { v: 1; configId: string; items: Item[] };

/** NFC, lower case, trimmed, spaces collapsed: « Grâce  divine » = « grâce divine ». */
export function queryKey(text: string): string {
	return text.normalize('NFC').toLowerCase().trim().replace(/\s+/gu, ' ');
}

function parse(raw: string | null, configId: string): Doc {
	const empty: Doc = { v: 1, configId, items: [] };
	if (!raw) return empty;
	try {
		const doc = JSON.parse(raw) as Doc;
		if (doc?.v !== 1 || doc.configId !== configId || !Array.isArray(doc.items)) return empty;
		const valid = doc.items.every(
			(i) =>
				typeof i?.key === 'string' && typeof i.vector === 'string' && typeof i.usedAt === 'number'
		);
		return valid ? { v: 1, configId, items: doc.items.slice(0, QUERY_CACHE_SIZE) } : empty;
	} catch {
		return empty;
	}
}

export type QueryCache = {
	get(text: string): Float32Array | undefined;
	put(text: string, vector: Float32Array): void;
};

export function createQueryCache(options: {
	storage: Storage | undefined;
	configId: string;
	now?: () => number;
}): QueryCache {
	const { storage, configId, now = () => Date.now() } = options;
	let raw: string | null = null;
	try {
		raw = storage?.getItem(QUERY_CACHE_KEY) ?? null;
	} catch {
		// Blocked: start empty.
	}
	const doc = parse(raw, configId);

	const save = () => {
		try {
			storage?.setItem(QUERY_CACHE_KEY, JSON.stringify(doc));
		} catch {
			// Full or blocked: kept for this visit only.
		}
	};

	return {
		get(text) {
			const item = doc.items.find((i) => i.key === queryKey(text));
			if (!item) return undefined;
			try {
				const vector = fromBase64(item.vector);
				item.usedAt = now();
				save();
				return vector;
			} catch {
				return undefined;
			}
		},
		put(text, vector) {
			const key = queryKey(text);
			doc.items = doc.items.filter((i) => i.key !== key);
			doc.items.push({ key, vector: toBase64(vector), usedAt: now() });
			doc.items.sort((a, b) => b.usedAt - a.usedAt);
			doc.items = doc.items.slice(0, QUERY_CACHE_SIZE);
			save();
		}
	};
}

/** The app's query cache for a configuration (`localStorage`). */
export function browserQueryCache(configId: string): QueryCache {
	let storage: Storage | undefined;
	try {
		storage = typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		storage = undefined;
	}
	return createQueryCache({ storage, configId });
}
