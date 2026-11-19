/**
 * The texts embedded for one hymn (research R2, data-model.md IndexedStanza): one per distinct
 * stanza, with very short sections joined to a neighbour. The lyrics are only read.
 */
import type { PublishedHymn } from '../domain/schema';
import { MEANING_CONFIG, type Representation } from './config';

export type IndexedText = { hymnIndex: number; section: number; text: string };

/** Generated theme descriptions by hymn id (research R11). Never displayed (FR-022). */
export type Themes = Record<string, { text: string }>;

export function indexedStanzas(
	hymn: PublishedHymn,
	hymnIndex: number,
	representation: Representation,
	themes?: Themes,
	minSectionChars = MEANING_CONFIG.minSectionChars
): IndexedText[] {
	const groups = stanzaGroups(hymn.sections, minSectionChars);

	// Text of the representation, without duplicates.
	const prefix = textPrefix(hymn, representation, themes);
	const texts = new Set<string>();
	const rows: IndexedText[] = [];
	for (const g of groups) {
		const text = prefix + g.lines.join('\n');
		if (texts.has(text)) continue;
		texts.add(text);
		rows.push({ hymnIndex, section: g.sections[0], text });
	}
	return rows;
}

/**
 * One embedded stanza: the indices in `hymn.sections` it covers (first occurrences only) and its
 * lines. `sections[0]` is the meaning row's `section`. Feature 013 rebuilds these groups in the
 * reading view to mark the stanza that matched.
 */
export type StanzaGroup = { sections: number[]; lines: string[] };

/** Distinct sections (a chorus sung after every verse once), short ones joined to a neighbour. */
export function stanzaGroups(
	sections: { lines: string[] }[],
	minSectionChars = MEANING_CONFIG.minSectionChars
): StanzaGroup[] {
	// 1. Distinct sections: a chorus sung after every verse is indexed once.
	const seen = new Set<string>();
	const distinct: { section: number; lines: string[] }[] = [];
	sections.forEach((s, section) => {
		const key = s.lines.join('\n');
		if (seen.has(key)) return;
		seen.add(key);
		distinct.push({ section, lines: s.lines });
	});

	// 2. Short sections join the previous group, or the next one when they come first.
	const groups: StanzaGroup[] = [];
	let carry: StanzaGroup | undefined;
	for (const s of distinct) {
		const short = s.lines.join('\n').length < minSectionChars;
		if (carry) {
			carry = { sections: [...carry.sections, s.section], lines: [...carry.lines, ...s.lines] };
			if (carry.lines.join('\n').length >= minSectionChars) {
				groups.push(carry);
				carry = undefined;
			}
			continue;
		}
		if (short && groups.length > 0) {
			const last = groups[groups.length - 1];
			groups[groups.length - 1] = {
				sections: [...last.sections, s.section],
				lines: [...last.lines, ...s.lines]
			};
		} else if (short) {
			carry = { sections: [s.section], lines: [...s.lines] };
		} else {
			groups.push({ sections: [s.section], lines: [...s.lines] });
		}
	}
	if (carry) groups.push(carry);
	return groups;
}

function textPrefix(hymn: PublishedHymn, representation: Representation, themes?: Themes) {
	switch (representation) {
		case 'stanza':
			return '';
		case 'title+stanza':
			return `${hymn.title}\n\n`;
		case 'title+theme+stanza': {
			// A hymn whose description was always rejected (it would quote the lyrics) keeps the
			// title alone, as in title+stanza. A stale description is caught by build-data.
			const theme = themes?.[hymn.id]?.text;
			return theme ? `${hymn.title} — ${theme}\n\n` : `${hymn.title}\n\n`;
		}
	}
}
