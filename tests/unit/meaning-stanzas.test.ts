import { describe, expect, it } from 'vitest';
import type { PublishedHymn, Section } from '../../src/lib/domain/schema';
import { indexedStanzas } from '../../src/lib/meaning/stanzas';

const verse = (n: number, lines: string[]): Section => ({ type: 'verse', number: n, lines });
const chorus = (lines: string[]): Section => ({ type: 'chorus', number: null, lines });

function hymn(sections: Section[]): PublishedHymn {
	return {
		id: 'h1',
		title: 'À toi la gloire',
		firstLine: sections[0].lines[0],
		sections,
		credits: [],
		source: { name: 'test', url: null, retrievedAt: '2026-01-01' },
		entries: []
	};
}

const LONG_A = ['À toi la gloire, ô Ressuscité,', 'à toi la victoire pour l’éternité.'];
const LONG_B = [
	'Brillant de lumière, l’ange est descendu,',
	'il roule la pierre du tombeau vaincu.'
];
const CHORUS = ['Gloire, gloire, gloire à toi, Seigneur, notre Rédempteur !', 'Alléluia !'];

describe('indexedStanzas', () => {
	it('indexes a repeated chorus once', () => {
		const h = hymn([
			verse(1, LONG_A),
			chorus(CHORUS),
			verse(2, LONG_B),
			chorus(CHORUS),
			chorus(CHORUS)
		]);
		const rows = indexedStanzas(h, 3, 'stanza');
		expect(rows.map((r) => r.section)).toEqual([0, 1, 2]);
		expect(rows.every((r) => r.hymnIndex === 3)).toBe(true);
	});

	it('joins a short section to the previous one, or the next one when it is first', () => {
		const short = chorus(['Alléluia !']);
		const rows = indexedStanzas(hymn([verse(1, LONG_A), short, verse(2, LONG_B)]), 0, 'stanza');
		expect(rows.map((r) => r.section)).toEqual([0, 2]);
		expect(rows[0].text).toBe([...LONG_A, 'Alléluia !'].join('\n'));

		const first = indexedStanzas(hymn([short, verse(1, LONG_A)]), 0, 'stanza');
		expect(first).toHaveLength(1);
		expect(first[0].section).toBe(0);
		expect(first[0].text).toBe(['Alléluia !', ...LONG_A].join('\n'));
	});

	it('keeps a hymn whose only section is short', () => {
		const rows = indexedStanzas(hymn([chorus(['Alléluia !'])]), 0, 'stanza');
		expect(rows).toEqual([{ hymnIndex: 0, section: 0, text: 'Alléluia !' }]);
	});

	it('builds the text of each representation', () => {
		const h = hymn([verse(1, LONG_A)]);
		const stanza = LONG_A.join('\n');
		expect(indexedStanzas(h, 0, 'stanza')[0].text).toBe(stanza);
		expect(indexedStanzas(h, 0, 'title+stanza')[0].text).toBe(`À toi la gloire\n\n${stanza}`);
		expect(
			indexedStanzas(h, 0, 'title+theme+stanza', { h1: { text: 'Chant de Pâques.' } })[0].text
		).toBe(`À toi la gloire — Chant de Pâques.\n\n${stanza}`);
		// No description (always rejected): the title alone, as in title+stanza.
		expect(indexedStanzas(h, 0, 'title+theme+stanza', {})[0].text).toBe(
			`À toi la gloire\n\n${stanza}`
		);
	});

	it('never mutates the lyrics', () => {
		const h = hymn([verse(1, LONG_A), chorus(['Alléluia !']), verse(2, LONG_B)]);
		const before = JSON.stringify(h);
		indexedStanzas(h, 0, 'title+stanza');
		expect(JSON.stringify(h)).toBe(before);
	});
});
