import { describe, expect, it } from 'vitest';
import { parseQuery } from '$lib/search/query-parser';
import { compactKey } from '$lib/search/normalize';

const keys = new Map([
	['jem', 'jem'],
	['jaimeleternel', 'jem'],
	['adf', 'adf'],
	['ailesdelafoi', 'adf'],
	['ce', 'ce']
]);
const resolve = (label: string) => keys.get(compactKey(label));
const parse = (q: string) => parseQuery(q, resolve);

describe('query interpretation (contracts/search.md)', () => {
	it('1. empty after trimming', () => {
		expect(parse('')).toEqual({ kind: 'empty' });
		expect(parse('   ')).toEqual({ kind: 'empty' });
		expect(parse(' , ')).toEqual({ kind: 'empty' });
	});

	it.each([
		['JEM 245', '245'],
		['jem245', '245'],
		['JEM n°245', '245'],
		['jem no 245', '245'],
		['JEM #245', '245'],
		['Jem   245', '245'],
		['JEM 0245', '0245']
	])('2. hymnal + number: %s', (q, number) => {
		expect(parse(q)).toEqual({ kind: 'hymnal-number', hymnal: 'jem', number });
	});

	it('2. accepts the full hymnal name, with or without accents', () => {
		expect(parse('Ailes de la foi 12')).toEqual({
			kind: 'hymnal-number',
			hymnal: 'adf',
			number: '12'
		});
		expect(parse('J’aime l’Éternel 3')).toEqual({
			kind: 'hymnal-number',
			hymnal: 'jem',
			number: '3'
		});
	});

	it('2. keeps number suffixes', () => {
		expect(parse('CE 12a')).toEqual({ kind: 'hymnal-number', hymnal: 'ce', number: '12a' });
		expect(parse('ce12 bis')).toEqual({ kind: 'hymnal-number', hymnal: 'ce', number: '12 bis' });
	});

	it('2. an unknown hymnal part is plain text, with the label kept for the message', () => {
		expect(parse('Psaume 23')).toEqual({ kind: 'text', text: 'Psaume 23', hymnalLabel: 'PSAUME' });
		expect(parse('xyz 12')).toEqual({ kind: 'text', text: 'xyz 12', hymnalLabel: 'XYZ' });
		expect(parse('ABC n°245')).toEqual({ kind: 'text', text: 'ABC n°245', hymnalLabel: 'ABC' });
		// Several words or a long word do not look like a hymnal abbreviation.
		expect(parse('il est 12')).toEqual({ kind: 'text', text: 'il est 12' });
		expect(parse('alleluiaaa 3')).toEqual({ kind: 'text', text: 'alleluiaaa 3' });
	});

	it.each([
		['245', '245'],
		['12a', '12a'],
		['12 bis', '12 bis'],
		['12bis', '12 bis'],
		[' 7 ', '7'],
		['#7', '7'],
		['n°7', '7']
	])('3. number alone: %s', (q, number) => {
		expect(parse(q)).toEqual({ kind: 'number', number });
	});

	it('4. one or two characters', () => {
		expect(parse('a')).toEqual({ kind: 'short', text: 'a' });
		expect(parse('Ô')).toEqual({ kind: 'short', text: 'Ô' });
		expect(parse('to')).toEqual({ kind: 'short', text: 'to' });
	});

	it('5. otherwise text', () => {
		expect(parse('gloire')).toEqual({ kind: 'text', text: 'gloire' });
		expect(parse('à toi la gloire')).toEqual({ kind: 'text', text: 'à toi la gloire' });
	});

	it('a hymnal name alone is text, not a number query', () => {
		expect(parse('JEM')).toEqual({ kind: 'text', text: 'JEM' });
	});
});
