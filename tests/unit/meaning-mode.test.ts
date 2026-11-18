import { describe, expect, it } from 'vitest';
import { decideSubmit, singleLine } from '$lib/meaning/mode';
import type { ParsedQuery } from '$lib/search/query-parser';

type Kind = ParsedQuery['kind'];

describe('decideSubmit: what Enter does (feature 012, research R6)', () => {
	it.each<[Kind, boolean]>([
		['empty', false],
		['number', false],
		['hymnal-number', false],
		['short', false],
		['text', false],
		['text', true]
	])('word mode, %s query (current %s): opens the first result', (queryKind, meaningCurrent) => {
		expect(decideSubmit({ mode: 'word', queryKind, meaningCurrent })).toBe('open-first');
	});

	it('meaning mode, empty query: nothing', () => {
		expect(decideSubmit({ mode: 'meaning', queryKind: 'empty', meaningCurrent: false })).toBe(
			'none'
		);
	});

	it.each<Kind>(['number', 'hymnal-number'])(
		'meaning mode, %s query: opens the first result (word search answers numbers)',
		(queryKind) => {
			expect(decideSubmit({ mode: 'meaning', queryKind, meaningCurrent: false })).toBe(
				'open-first'
			);
		}
	);

	it.each<Kind>(['short', 'text'])(
		'meaning mode, %s query without current results: runs the search by meaning',
		(queryKind) => {
			expect(decideSubmit({ mode: 'meaning', queryKind, meaningCurrent: false })).toBe(
				'run-meaning'
			);
		}
	);

	it.each<Kind>(['short', 'text'])(
		'meaning mode, %s query with current results: opens the first result',
		(queryKind) => {
			expect(decideSubmit({ mode: 'meaning', queryKind, meaningCurrent: true })).toBe('open-first');
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
