/**
 * The sequence that shows a search by meaning happening (feature 017,
 * specs/017-meaning-results-transition/contracts/meaning-reveal.md): the list on screen leaves,
 * a placeholder in the meaning color stands in while the search runs, then the results come in.
 * Motion is CSS only; this module holds the steps and their timings.
 */

export type RevealPhase = 'none' | 'clearing' | 'waiting' | 'revealing';

/** clearing → waiting. */
export const CLEAR_MS = 180;
/** From the last launch to the earliest reveal, so a cached answer still shows the change. */
export const MIN_WAIT_MS = 400;
/** revealing → none. */
export const REVEAL_MS = 500;
/** Delay between two rows coming in. */
export const ROW_STAGGER_MS = 30;
/** Rows past this index share the last delay, so long lists don't drag. */
export const ROW_STAGGER_CAP = 10;

/** Resolves when `minMs` have passed since `start` (at once if already passed). */
export function holdUntil(
	start: number,
	minMs: number,
	now: () => number = () => performance.now()
): Promise<void> {
	const left = start + minMs - now();
	return left > 0 ? new Promise((resolve) => setTimeout(resolve, left)) : Promise.resolve();
}

/** First step of a launch: clear what is on screen, or go straight to waiting. */
export function launchPhase(current: RevealPhase, listOnScreen: boolean): RevealPhase {
	if (current === 'clearing' || current === 'waiting') return current;
	return listOnScreen ? 'clearing' : 'waiting';
}

export type ListView = 'none' | 'list' | 'leaving-list' | 'placeholder' | 'revealing-list';

/** What the list area renders; `hasList` says a result list would show. */
export function listView(input: { reveal: RevealPhase; hasList: boolean }): ListView {
	const { reveal, hasList } = input;
	if (reveal === 'waiting') return 'placeholder';
	if (reveal === 'clearing') return hasList ? 'leaving-list' : 'placeholder';
	if (!hasList) return 'none';
	return reveal === 'revealing' ? 'revealing-list' : 'list';
}
