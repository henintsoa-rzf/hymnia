/**
 * Word matching rules shared by the index search (MiniSearch options), the ranking tiers and
 * the excerpt highlighter, so they always agree (contracts/search.md, "Text matching").
 */

/** Minimum length for a typo to be allowed (FR-006: one typo for words of 5+ letters). */
export const FUZZY_MIN_LENGTH = 5;

/**
 * Prefix matching ("results while typing"). Single letters never match by prefix, otherwise
 * "a" would match every word starting with "a". The word being typed (the last one) may match
 * from 2 letters, the others from 3.
 */
export function allowsPrefix(token: string, isLast: boolean): boolean {
	return token.length >= 3 || (isLast && token.length >= 2);
}

export function allowsTypo(token: string): boolean {
	return token.length >= FUZZY_MIN_LENGTH;
}

/** True if the edit distance between a and b is at most 1. */
export function withinOneEdit(a: string, b: string): boolean {
	if (a === b) return true;
	const la = a.length;
	const lb = b.length;
	if (Math.abs(la - lb) > 1) return false;
	let i = 0;
	while (i < la && i < lb && a[i] === b[i]) i++;
	if (la === lb) return a.slice(i + 1) === b.slice(i + 1); // substitution
	if (la > lb) return a.slice(i + 1) === b.slice(i); // deletion
	return a.slice(i) === b.slice(i + 1); // insertion
}

/** Does a normalised query token match a normalised word of the text? */
export function tokenMatches(token: string, word: string, isLast: boolean): boolean {
	if (token === word) return true;
	if (allowsPrefix(token, isLast) && word.startsWith(token)) return true;
	return allowsTypo(token) && withinOneEdit(token, word);
}

/** True if every query token matches at least one of the words. */
export function allTokensMatch(tokens: string[], words: string[]): boolean {
	return (
		tokens.length > 0 &&
		tokens.every((t, i) => words.some((w) => tokenMatches(t, w, i === tokens.length - 1)))
	);
}

/**
 * True if the query tokens appear one after the other in the words (a phrase of the lyrics,
 * across line breaks), each matching by the same rules as above.
 */
export function phraseMatches(tokens: string[], words: string[]): boolean {
	const n = tokens.length;
	if (n === 0 || n > words.length) return false;
	const last = n - 1;
	for (let start = 0; start + n <= words.length; start++) {
		let i = 0;
		while (i < n && tokenMatches(tokens[i], words[start + i], i === last)) i++;
		if (i === n) return true;
	}
	return false;
}
