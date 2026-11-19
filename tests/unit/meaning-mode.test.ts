import { describe, expect, it } from 'vitest';
import { decideSubmit, singleLine } from '$lib/meaning/mode';
import type { ParsedQuery } from '$lib/search/query-parser';

type Kind = ParsedQuery['kind'];

describe('decideSubmit: what Enter or the launch button does (feature 012, research R6)', () => {
	it.each<Kind>(['empty', 'number', 'hymnal-number', 'short', 'text'])(
		'word mode, %s query: opens the first result',
		(queryKind) => {
			expect(decideSubmit({ mode: 'word', queryKind })).toBe('open-first');
		}
	);

	it('meaning mode, empty query: nothing', () => {
		expect(decideSubmit({ mode: 'meaning', queryKind: 'empty' })).toBe('none');
	});

	it.each<Kind>(['number', 'hymnal-number'])(
		'meaning mode, %s query: opens the first result (word search answers numbers)',
		(queryKind) => {
			expect(decideSubmit({ mode: 'meaning', queryKind })).toBe('open-first');
		}
	);

	it.each<Kind>(['short', 'text'])(
		'meaning mode, %s query: runs the search by meaning, again if already shown',
		(queryKind) => {
			expect(decideSubmit({ mode: 'meaning', queryKind })).toBe('run-meaning');
		}
	);
});

describe('singleLine: the query is always one line (data-model.md)', () => {
	it.each([
		['a\nb', 'a b'],
		['a \r\n  b', 'a b'],
		['a\n\nb', 'a b'],
		['a\rb', 'a b'],
		['la grâce de Dieu', 'la grâce de Dieu'],
		['grâce ', 'grâce '],
		['  grâce', '  grâce'],
		['', '']
	])('%j → %j', (text, expected) => {
		expect(singleLine(text)).toBe(expected);
	});
});
