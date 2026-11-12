/**
 * A hymn's title as a hymnal prints it: the entry's own title when it has one, the hymn's
 * title otherwise (HymnalEntry.title, feature 002).
 */
import { normalizeNumber } from './numbering';

type Titled = { title: string; entries: { hymnal: string; number: string; title?: string }[] };

export function titleIn(hymn: Titled, hymnal: string, number: string): string {
	const key = normalizeNumber(number);
	const entry = hymn.entries.find((e) => e.hymnal === hymnal && normalizeNumber(e.number) === key);
	return entry?.title ?? hymn.title;
}

/** Every distinct title of the hymn: its own first, then its entries' titles. */
export function allTitles(hymn: Titled): string[] {
	return [...new Set([hymn.title, ...hymn.entries.flatMap((e) => (e.title ? [e.title] : []))])];
}
