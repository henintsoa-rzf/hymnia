/**
 * The two modes of the search field (feature 012, specs/012-meaning-search-mode/contracts/
 * search-mode.md): word search as you type, or search by meaning, run with Enter.
 */
import type { ParsedQuery } from '../search/query-parser';

export type SearchMode = 'word' | 'meaning';
export type SubmitAction = 'open-first' | 'run-meaning' | 'none';

/**
 * What Enter does (research R6). `queryKind` comes from `parseQuery`, which is synchronous, so the
 * answer never waits on the search worker.
 */
export function decideSubmit(input: {
	mode: SearchMode;
	queryKind: ParsedQuery['kind'];
	/** Results by meaning are shown for this text and filter. */
	meaningCurrent: boolean;
}): SubmitAction {
	const { mode, queryKind, meaningCurrent } = input;
	if (mode === 'word') return 'open-first';
	if (queryKind === 'empty') return 'none';
	if (queryKind === 'number' || queryKind === 'hymnal-number') return 'open-first';
	return meaningCurrent ? 'open-first' : 'run-meaning';
}

/** Line breaks (typed or pasted) become one space, with the spaces around them. */
export function singleLine(text: string): string {
	return text.replace(/[ \t]*(?:\r\n|\r|\n)+[ \t]*/g, ' ');
}
