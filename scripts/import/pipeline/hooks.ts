/**
 * Hooks plugged into reconciliation by the later stories: matching (US3) and rights (US4).
 * Kept in one place so that `run` from the command line always uses all of them.
 */
import { createMatcher } from './match';
import { prefersSource } from './merge';
import { rightsHook } from './rights';
import type { RunOptions } from './run';

export const importHooks: NonNullable<RunOptions['hooks']> = ({ content, state, source }) => {
	const matcher = createMatcher(content, state.merges);
	return {
		match: matcher.match,
		remember: matcher.remember,
		sameHymn: matcher.sameHymn,
		prefersSource: prefersSource(state),
		rightsFor: rightsHook(state.rights, state.links, source.id)
	};
};
