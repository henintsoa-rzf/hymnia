/**
 * The blocks a hymn prints, in order (feature 016, FR-012, research R5). Display only: the
 * stored sections never change (Principle III).
 *
 * - `once` (default, decisions §7.1): a chorus is printed once, and again only where its words
 *   change.
 * - `each`: every source section is printed; after a verse not directly followed by a chorus,
 *   the last chorus printed so far is printed again, as a `repeat` block.
 */
import type { Section } from '../domain/schema';
import type { ChorusMode } from '../prefs/prefs';

export type Block = {
	section: Section;
	/** Index of the section in `hymn.sections`. */
	index: number;
	/** Printed again by « Après chaque strophe »: never marked, no anchor of its own. */
	repeat: boolean;
	/** Unique across the blocks of a hymn. */
	key: string;
};

export function layoutSections(sections: Section[], { chorus }: { chorus: ChorusMode }): Block[] {
	const out: Block[] = [];
	let last: number | undefined;

	if (chorus === 'once') {
		let lastText: string | undefined;
		sections.forEach((section, index) => {
			if (section.type === 'chorus') {
				const text = section.lines.join('\n');
				if (text === lastText) return;
				lastText = text;
			}
			out.push({ section, index, repeat: false, key: String(index) });
		});
		return out;
	}

	sections.forEach((section, index) => {
		out.push({ section, index, repeat: false, key: String(index) });
		if (section.type === 'chorus') last = index;
		const next = sections[index + 1];
		if (section.type === 'verse' && last !== undefined && next?.type !== 'chorus') {
			out.push({ section: sections[last], index: last, repeat: true, key: `${last}-r${index}` });
		}
	});
	return out;
}
