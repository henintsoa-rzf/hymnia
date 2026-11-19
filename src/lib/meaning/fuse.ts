/**
 * Blended list of meaning and word results (contracts/meaning-search.md "Ranking", research R6):
 * exact titles first, then Reciprocal Rank Fusion. No reranker (FR-007).
 */
import type { Excerpt, SearchResult } from '../search/types';
import type { Fusion } from './config';

/** A meaning hit, with its result (title, references) and the best stanza's excerpt. */
export type MeaningCandidate = {
	result: SearchResult;
	excerpt: Excerpt;
	/** First section of the best stanza group (feature 013). */
	matchedSection: number;
};

export const MEANING_EXCERPT_LENGTH = 160;

/** The best stanza's first 2 lines, original text, no highlights. */
export function meaningExcerpt(lines: string[]): Excerpt {
	let text = lines
		.map((l) => l.trim())
		.filter(Boolean)
		.slice(0, 2)
		.join(' / ');
	if (text.length > MEANING_EXCERPT_LENGTH) {
		text = text.slice(0, MEANING_EXCERPT_LENGTH - 1).trimEnd() + '…';
	}
	return { text, highlights: [] };
}

export function fuse(input: {
	meaning: MeaningCandidate[];
	words: SearchResult[];
	fusion: Fusion;
	limit: number;
}): SearchResult[] {
	const { meaning, words, fusion, limit } = input;
	const meaningRank = new Map(meaning.map((m, i) => [m.result.hymnId, i + 1]));
	const wordRank = new Map(words.map((w, i) => [w.hymnId, i + 1]));
	const byMeaning = new Map(meaning.map((m) => [m.result.hymnId, m]));
	const byWords = new Map(words.map((w) => [w.hymnId, w]));

	const term = (weight: number, rank: number | undefined) =>
		rank === undefined ? 0 : weight / (fusion.k + rank);

	const build = (hymnId: string): SearchResult => {
		const m = byMeaning.get(hymnId);
		const w = byWords.get(hymnId);
		if (!w)
			return {
				...m!.result,
				tier: 6,
				excerpt: m!.excerpt,
				matchedBy: 'meaning',
				matchedSection: m!.matchedSection
			};
		if (!m) return { ...w, matchedBy: 'words' };
		const meaningWins =
			term(fusion.wMeaning, meaningRank.get(hymnId)) > term(fusion.wWords, wordRank.get(hymnId));
		// The stanza is carried only when the list shows its excerpt (feature 013).
		const showsStanza = meaningWins || !w.excerpt;
		return {
			...w,
			...(showsStanza
				? { excerpt: m.excerpt, matchedSection: m.matchedSection }
				: w.excerpt
					? { excerpt: w.excerpt }
					: {}),
			matchedBy: 'both'
		};
	};

	const pinned = words.filter((w) => w.tier === 2).map((w) => w.hymnId);
	const pinnedSet = new Set(pinned);
	const rest = [...new Set([...meaning.map((m) => m.result.hymnId), ...words.map((w) => w.hymnId)])]
		.filter((id) => !pinnedSet.has(id))
		.map((id) => ({
			id,
			score: term(fusion.wMeaning, meaningRank.get(id)) + term(fusion.wWords, wordRank.get(id)),
			mRank: meaningRank.get(id) ?? Infinity,
			wRank: wordRank.get(id) ?? Infinity
		}))
		.sort((a, b) => b.score - a.score || a.mRank - b.mRank || a.wRank - b.wRank)
		.map((x) => x.id);

	return [...pinned, ...rest].slice(0, limit).map(build);
}
