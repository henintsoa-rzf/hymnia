/**
 * The stanza to mark when a hymn is opened from a search-by-meaning result
 * (specs/013-meaning-stanza-highlight/contracts/stanza-mark.md). `?passage=<n>` names the first
 * section of a stanza group; the whole group is marked, as it is what was embedded and matched.
 * Anything else marks nothing: no mark is safer than a wrong one (FR-010).
 */
import { MEANING_CONFIG } from './config';
import { stanzaGroups } from './stanzas';

export function markedSections(
	sections: { lines: string[] }[],
	param: string | null,
	minSectionChars = MEANING_CONFIG.minSectionChars
): number[] {
	if (!param || !/^\d+$/.test(param)) return [];
	const start = Number(param);
	if (start >= sections.length) return [];
	const group = stanzaGroups(sections, minSectionChars).find((g) => g.sections[0] === start);
	return group ? group.sections : [];
}
