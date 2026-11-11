/**
 * Shared text normalisation, used for both indexing and queries (research.md §3, FR-005).
 * Only used for matching: the displayed text is never changed (FR-020).
 */

const LIGATURES: Record<string, string> = { œ: 'oe', Œ: 'oe', æ: 'ae', Æ: 'ae', ß: 'ss' };
const COMBINING = /\p{M}/u;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Fold a string for matching and keep, for every output character, the index of the
 * original character it comes from. Non-word characters (punctuation, apostrophes,
 * symbols such as "°") become a single space. Leading/trailing spaces are removed.
 */
export function foldWithMap(input: string): { text: string; map: number[] } {
	let text = '';
	const map: number[] = [];
	let pendingSpace = false;

	// Iterate by code point so that the index always refers to the original string.
	let index = 0;
	for (const char of input) {
		const start = index;
		index += char.length;

		const ligature = LIGATURES[char];
		const pieces = ligature ?? char.normalize('NFD').toLowerCase();

		for (const piece of pieces) {
			if (COMBINING.test(piece)) continue;
			if (!WORD_CHAR.test(piece)) {
				pendingSpace = text.length > 0;
				continue;
			}
			if (pendingSpace) {
				text += ' ';
				map.push(start);
				pendingSpace = false;
			}
			text += piece;
			map.push(start);
		}
	}
	return { text, map };
}

/** Normalised text: lowercase, no accents, ligatures expanded, words separated by one space. */
export function normalizeText(input: string): string {
	return foldWithMap(input).text;
}

/** Normalised words. */
export function tokenize(input: string): string[] {
	const text = normalizeText(input);
	return text === '' ? [] : text.split(' ');
}

/** Normalised text with no spaces, used for hymnal abbreviations and names ("A d F" → "adf"). */
export function compactKey(input: string): string {
	return normalizeText(input).replaceAll(' ', '');
}
