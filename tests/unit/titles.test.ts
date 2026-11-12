import { describe, expect, it } from 'vitest';
import { allTitles, titleIn } from '$lib/domain/titles';

const hymn = {
	title: 'C’est vers toi que je me tourne',
	entries: [
		{ hymnal: 'atg', number: '42' },
		{ hymnal: 'jem', number: '232', title: 'Ma joie de t’appartenir' },
		{ hymnal: 'cd', number: '300', title: 'C’est vers toi' }
	]
};

describe('titles (HymnalEntry.title)', () => {
	it('gives the title a hymnal prints, or the hymn’s title', () => {
		expect(titleIn(hymn, 'jem', '0232')).toBe('Ma joie de t’appartenir');
		expect(titleIn(hymn, 'atg', '42')).toBe('C’est vers toi que je me tourne');
		expect(titleIn(hymn, 'xyz', '1')).toBe('C’est vers toi que je me tourne');
	});

	it('lists every distinct title, the hymn’s first', () => {
		expect(allTitles(hymn)).toEqual([
			'C’est vers toi que je me tourne',
			'Ma joie de t’appartenir',
			'C’est vers toi'
		]);
	});
});
