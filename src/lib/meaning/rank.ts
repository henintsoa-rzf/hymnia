/**
 * Meaning ranking on the device (research R5): one exhaustive pass over every row, best row per
 * hymn, hymnal filter (FR-006) and hymns in use (`allow`, feature 014), top N. About 10 ms for 10,000 rows of 512 dims.
 */
import type { PublishedHymn } from '../domain/schema';
import type { MeaningData } from './load';
import { dotInt8 } from './vector';

export type MeaningHit = { hymnIndex: number; section: number; score: number };

export function rankMeaning(
	data: MeaningData,
	query: Float32Array,
	hymns: { entries: Pick<PublishedHymn['entries'][number], 'hymnal'>[] }[],
	options: { hymnals?: string[]; allow?: (hymnIndex: number) => boolean; limit?: number } = {}
): MeaningHit[] {
	if (query.length !== data.dims) {
		throw new Error(`Query has ${query.length} dims, the meaning data ${data.dims} dims`);
	}
	const allowed = options.hymnals?.length ? new Set(options.hymnals) : null;
	const allow = options.allow;
	const allowedCache = new Map<number, boolean>();
	const isAllowed = (h: number) => {
		if (!allowed && !allow) return true;
		let ok = allowedCache.get(h);
		if (ok === undefined) {
			ok =
				(!allowed || (hymns[h]?.entries.some((e) => allowed.has(e.hymnal)) ?? false)) &&
				(!allow || allow(h));
			allowedCache.set(h, ok);
		}
		return ok;
	};

	const best = new Map<number, MeaningHit>();
	for (let r = 0; r < data.rows; r++) {
		const h = data.hymnIndex[r];
		if (!isAllowed(h)) continue;
		const score = dotInt8(query, data.vectors, r, data.dims) * data.scale[r];
		const current = best.get(h);
		if (!current || score > current.score)
			best.set(h, { hymnIndex: h, section: data.section[r], score });
	}
	return [...best.values()]
		.sort((a, b) => b.score - a.score || a.hymnIndex - b.hymnIndex)
		.slice(0, options.limit ?? 100);
}
