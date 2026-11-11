/**
 * Query interpretation, in order (contracts/search.md):
 * empty → hymnal + number → number alone → 1–2 characters → text.
 */
import { normalizeText } from './normalize';

export type ParsedQuery =
	| { kind: 'empty' }
	| { kind: 'hymnal-number'; hymnal: string; number: string }
	| { kind: 'number'; number: string }
	| { kind: 'short'; text: string }
	| {
			kind: 'text';
			text: string;
			/** Set when the query looks like "<abbreviation> <number>" with an unknown hymnal. */
			hymnalLabel?: string;
	  };

/** Returns the hymnal id for an abbreviation or full name, or undefined. */
export type HymnalResolver = (label: string) => string | undefined;

// On normalised text: optional prefix, digits, optional suffix ("a", "bis", "ter").
const NUMBER_AT_END = /^(.*?) ?(\d+) ?([a-z]|bis|ter)?$/;
// A single short word: what an unknown hymnal abbreviation looks like ("JEM").
const LOOKS_LIKE_HYMNAL = /^[a-z]{1,8}$/;
// "n°", "no", "num", "numero" written before the number.
const NUMBER_MARKER = / ?\b(?:n|no|num|numero)$/;

function printedNumber(digits: string, suffix: string | undefined): string {
	if (!suffix) return digits;
	return suffix.length > 1 ? `${digits} ${suffix}` : `${digits}${suffix}`;
}

export function parseQuery(query: string, resolveHymnal: HymnalResolver): ParsedQuery {
	const normalized = normalizeText(query);
	if (normalized === '') return { kind: 'empty' };

	const text = query.trim();
	let hymnalLabel: string | undefined;
	const match = NUMBER_AT_END.exec(normalized);
	if (match) {
		const [, prefix, digits, suffix] = match;
		const number = printedNumber(digits, suffix);
		const label = prefix.replace(NUMBER_MARKER, '');
		if (label === '') return { kind: 'number', number };
		const hymnal = resolveHymnal(prefix) ?? resolveHymnal(label);
		if (hymnal) return { kind: 'hymnal-number', hymnal, number };
		if (LOOKS_LIKE_HYMNAL.test(label)) hymnalLabel = label.toUpperCase();
	}

	if (normalized.length <= 2) return { kind: 'short', text };
	return hymnalLabel ? { kind: 'text', text, hymnalLabel } : { kind: 'text', text };
}
