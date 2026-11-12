/**
 * Hymn numbers are kept "as printed" ("245", "123a", "123 bis"). These helpers derive a sort
 * key and a lookup key without changing the printed value.
 */
import type { SortKey } from './schema';

const NUMBER = /^\s*0*(\d+)\s*(.*?)\s*$/;

/**
 * Sort key of a number with no leading digits. A finite value, so that it survives JSON (where
 * `Infinity` becomes `null` and would sort first).
 */
export const NO_NUMBER = Number.MAX_SAFE_INTEGER;

/** Numeric part, then lowercase suffix. Numbers with no leading digits sort last. */
export function sortKey(printed: string): SortKey {
	const match = NUMBER.exec(printed);
	if (!match) return [NO_NUMBER, printed.trim().toLowerCase()];
	return [Number(match[1]), match[2].toLowerCase().replace(/\s+/g, ' ')];
}

export function compareSortKeys(a: SortKey, b: SortKey): number {
	if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
	if (a[1] === b[1]) return 0;
	return a[1] < b[1] ? -1 : 1;
}

export function compareNumbers(a: string, b: string): number {
	return compareSortKeys(sortKey(a), sortKey(b));
}

/** Lookup key: "12 bis", "12bis", "012 BIS" → "12bis". */
export function normalizeNumber(printed: string): string {
	const [num, suffix] = sortKey(printed);
	const head = num === NO_NUMBER ? '' : String(num);
	return head + suffix.replace(/[^\p{L}\p{N}]/gu, '');
}
