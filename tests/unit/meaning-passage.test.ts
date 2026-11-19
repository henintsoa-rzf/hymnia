import { describe, expect, it } from 'vitest';
import { markedSections } from '../../src/lib/meaning/passage';

// Feature 013: `?passage=<n>` on a hymn opened from a search-by-meaning result.
const LONG_A = { lines: ['À toi la gloire, ô Ressuscité,', 'à toi la victoire pour l’éternité.'] };
const LONG_B = {
	lines: ['Brillant de lumière, l’ange est descendu,', 'il roule la pierre du tombeau vaincu.']
};
const SHORT = { lines: ['Alléluia !'] };
const CHORUS = { lines: ['Gloire, gloire, gloire à toi, Seigneur, notre Rédempteur !'] };

// Groups: [0, 1] (verse + short), [2] (chorus), [3] (verse); 4 repeats the chorus.
const sections = [LONG_A, SHORT, CHORUS, LONG_B, CHORUS];

describe('markedSections', () => {
	it('marks every section of the group that starts at the index', () => {
		expect(markedSections(sections, '0')).toEqual([0, 1]);
		expect(markedSections(sections, '2')).toEqual([2]);
		expect(markedSections(sections, '3')).toEqual([3]);
	});

	it('marks a short first section with the one it was joined to', () => {
		expect(markedSections([SHORT, LONG_A], '0')).toEqual([0, 1]);
	});

	it('marks nothing for a missing or malformed parameter', () => {
		for (const param of [null, '', 'abc', '-1', '1.5', ' 2', '2 ', '0x1', '1e0']) {
			expect(markedSections(sections, param), String(param)).toEqual([]);
		}
	});

	it('marks nothing out of range', () => {
		expect(markedSections(sections, '5')).toEqual([]);
		expect(markedSections(sections, '999')).toEqual([]);
		expect(markedSections([], '0')).toEqual([]);
	});

	it('marks nothing for a section that does not start a group', () => {
		expect(markedSections(sections, '1')).toEqual([]); // joined to 0
		expect(markedSections(sections, '4')).toEqual([]); // repeated chorus
	});
});
