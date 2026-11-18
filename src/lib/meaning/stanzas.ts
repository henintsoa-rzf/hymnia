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
	// 1. Distinct sections: a chorus sung after every verse is indexed once.
	const seen = new Set<string>();
	const distinct: { section: number; lines: string[] }[] = [];
	hymn.sections.forEach((s, section) => {
		const key = s.lines.join('\n');
		if (seen.has(key)) return;
		seen.add(key);
		distinct.push({ section, lines: s.lines });
	});

	// 2. Short sections join the previous group, or the next one when they come first.
	const groups: { section: number; lines: string[] }[] = [];
	let carry: { section: number; lines: string[] } | undefined;
	for (const s of distinct) {
		const short = s.lines.join('\n').length < minSectionChars;
		if (carry) {
			carry = { section: carry.section, lines: [...carry.lines, ...s.lines] };
			if (carry.lines.join('\n').length >= minSectionChars) {
				groups.push(carry);
				carry = undefined;
			}
			continue;
		}
		if (short && groups.length > 0) {
			const last = groups[groups.length - 1];
			groups[groups.length - 1] = { section: last.section, lines: [...last.lines, ...s.lines] };
		} else if (short) {
			carry = { section: s.section, lines: [...s.lines] };
		} else {
			groups.push({ section: s.section, lines: [...s.lines] });
		}
	}
	if (carry) groups.push(carry);

	// 3. Text of the representation, without duplicates.
	const prefix = textPrefix(hymn, representation, themes);
	const texts = new Set<string>();
	const rows: IndexedText[] = [];
	for (const g of groups) {
		const text = prefix + g.lines.join('\n');
		if (texts.has(text)) continue;
		texts.add(text);
		rows.push({ hymnIndex, section: g.section, text });
	}
	return rows;
}

function textPrefix(hymn: PublishedHymn, representation: Representation, themes?: Themes) {
	switch (representation) {
		case 'stanza':
			return '';
		case 'title+stanza':
			return `${hymn.title}\n\n`;
		case 'title+theme+stanza': {
			const theme = themes?.[hymn.id]?.text;
			if (!theme) throw new Error(`No theme description for hymn ${hymn.id}`);
			return `${hymn.title} — ${theme}\n\n`;
		}
	}
}
