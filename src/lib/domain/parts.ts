/**
 * Hymnal parts (JEM volumes, Écritures albums, Psalmodie programmes): splits a hymnal's
 * entries, already in number order, into the parts declared in `content/hymnals.json`.
 */
import type { HymnalPart, SortKey } from './schema';
import { NO_NUMBER } from './numbering';

export type PartGroup<T> = {
	/** `undefined` for entries before the first part or with no number. */
	part?: HymnalPart;
	items: T[];
};

/**
 * One group per part that has entries, in order. Entries below the first part, or with no
 * leading number, go in a group with no part: first and last respectively.
 */
export function groupByPart<T>(
	items: T[],
	parts: HymnalPart[] | undefined,
	keyOf: (item: T) => SortKey
): PartGroup<T>[] {
	if (!parts?.length) return items.length ? [{ items }] : [];
	const before: T[] = [];
	const after: T[] = [];
	const byPart: T[][] = parts.map(() => []);
	for (const item of items) {
		const [n] = keyOf(item);
		if (n === NO_NUMBER) after.push(item);
		else if (n < parts[0].first) before.push(item);
		else byPart[parts.findLastIndex((p) => p.first <= n)].push(item);
	}
	const groups: PartGroup<T>[] = [];
	if (before.length) groups.push({ items: before });
	parts.forEach((part, i) => byPart[i].length && groups.push({ part, items: byPart[i] }));
	if (after.length) groups.push({ items: after });
	return groups;
}
