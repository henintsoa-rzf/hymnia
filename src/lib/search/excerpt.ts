/**
 * Excerpts for lyric matches (contracts/search.md, FR-008). The excerpt is taken from the
 * original text (FR-020); matches found on the normalised text are mapped back to it.
 */
import { foldWithMap } from './normalize';
import { tokenMatches } from './match';
import type { Excerpt } from './types';

export const MAX_EXCERPT_LENGTH = 120;
const CONTEXT_BEFORE = 30;

type Range = [number, number];

function highlightsInLine(line: string, tokens: string[]): Range[] {
	const { text, map } = foldWithMap(line);
	const ranges: Range[] = [];
	let start = 0;
	for (const word of text.split(' ')) {
		const end = start + word.length;
		const matched = tokens.some((t, i) => tokenMatches(t, word, i === tokens.length - 1));
		if (word && matched) {
			const from = map[start];
			const lastChar = map[end - 1];
			const to = lastChar + String.fromCodePoint(line.codePointAt(lastChar)!).length;
			ranges.push([from, to]);
		}
		start = end + 1;
	}
	return ranges;
}

function shorten(line: string, highlights: Range[]): Excerpt {
	if (line.length <= MAX_EXCERPT_LENGTH) return { text: line, highlights };

	let from = Math.max(0, highlights[0][0] - CONTEXT_BEFORE);
	if (from > 0) {
		const space = line.indexOf(' ', from);
		if (space >= 0 && space < highlights[0][0]) from = space + 1;
	}
	const to = Math.min(line.length, from + MAX_EXCERPT_LENGTH);
	const before = from > 0 ? '…' : '';
	const after = to < line.length ? '…' : '';
	const shift = before.length - from;

	return {
		text: before + line.slice(from, to) + after,
		highlights: highlights
			.filter(([s, e]) => s >= from && e <= to)
			.map(([s, e]) => [s + shift, e + shift] as Range)
	};
}

/**
 * Pick the line with the most matched words (earliest line on a tie) and return it with the
 * matched words' ranges. `tokens` are normalised query tokens.
 */
export function buildExcerpt(lines: string[], tokens: string[]): Excerpt | undefined {
	if (tokens.length === 0) return undefined;
	let best: { line: string; highlights: Range[] } | undefined;
	for (const line of lines) {
		const highlights = highlightsInLine(line, tokens);
		if (highlights.length > (best?.highlights.length ?? 0)) best = { line, highlights };
	}
	return best && shorten(best.line, best.highlights);
}
