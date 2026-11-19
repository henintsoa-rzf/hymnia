// Hymnals and parts the user leaves out (specs/014-hymnal-scope-settings/contracts/scope.md §1).
import { describe, expect, it } from 'vitest';
import { NO_NUMBER } from '$lib/domain/numbering';
import type { Hymnal, SortKey } from '$lib/domain/schema';
import {
	cleanExclusions,
	createScope,
	NO_EXCLUSIONS,
	sanitizeExclusions,
	setHymnal,
	setPart,
	type Exclusions
} from '$lib/scope/scope';

const hymnal = (id: string, parts?: number[]): Hymnal => ({
	id,
	name: id.toUpperCase(),
	abbreviations: [id.toUpperCase()],
	sortOrder: 0,
	...(parts ? { parts: parts.map((first) => ({ name: `${id}${first}`, first })) } : {})
});

const HYMNALS = [hymnal('a'), hymnal('b'), hymnal('p', [1, 10, 20])];
const ex = (hymnals: string[] = [], parts: Record<string, number[]> = {}): Exclusions => ({
	hymnals,
	parts
});
const entry = (hymnal: string, n: number): { hymnal: string; sortKey: SortKey } => ({
	hymnal,
	sortKey: [n, '']
});

describe('sanitizeExclusions', () => {
	it('returns the default for anything that is not an object', () => {
		expect(sanitizeExclusions(undefined)).toEqual(NO_EXCLUSIONS);
		expect(sanitizeExclusions('jem')).toEqual(NO_EXCLUSIONS);
		expect(sanitizeExclusions(null)).toEqual(NO_EXCLUSIONS);
	});

	it('keeps strings and positive integers only, without duplicates or empty lists', () => {
		expect(
			sanitizeExclusions({
				hymnals: ['a', 1, 'a', null],
				parts: { p: [10, 10, -1, 0, 1.5, '20', 20], q: [], r: 'x' }
			})
		).toEqual({ hymnals: ['a'], parts: { p: [10, 20] } });
	});
});

describe('cleanExclusions', () => {
	it('drops unknown hymnals and unknown parts', () => {
		expect(cleanExclusions(ex(['zz', 'a'], { p: [10, 99], zz: [1] }), HYMNALS)).toEqual(
			ex(['a'], { p: [10] })
		);
	});

	it('removes the parts of a hymnal left out entirely', () => {
		expect(cleanExclusions(ex(['p'], { p: [10] }), HYMNALS)).toEqual(ex(['p']));
	});

	it('leaves a hymnal out entirely when all its parts are left out', () => {
		expect(cleanExclusions(ex([], { p: [1, 10, 20] }), HYMNALS)).toEqual(ex(['p']));
	});

	it('uses everything when nothing would be left', () => {
		expect(cleanExclusions(ex(['a', 'b', 'p']), HYMNALS)).toEqual(NO_EXCLUSIONS);
		expect(cleanExclusions(ex(['a', 'b'], { p: [1, 10, 20] }), HYMNALS)).toEqual(NO_EXCLUSIONS);
	});
});

describe('createScope', () => {
	it('includes everything with no choice', () => {
		for (const choice of [undefined, NO_EXCLUSIONS]) {
			const scope = createScope(choice, HYMNALS);
			expect(scope.isEmpty).toBe(true);
			expect(scope.hymnalState('p')).toBe('all');
			expect(scope.includesEntry(entry('p', 10))).toBe(true);
			expect(scope.includesPart('p', 10)).toBe(true);
		}
	});

	it('gives the state of each hymnal', () => {
		const scope = createScope(ex(['a'], { p: [10] }), HYMNALS);
		expect(scope.isEmpty).toBe(false);
		expect(scope.hymnalState('a')).toBe('none');
		expect(scope.hymnalState('b')).toBe('all');
		expect(scope.hymnalState('p')).toBe('some');
	});

	it('treats a hymnal it does not know as in use', () => {
		expect(createScope(ex(['a']), HYMNALS).hymnalState('zz')).toBe('all');
		expect(createScope(ex(['a']), HYMNALS).includesEntry(entry('zz', 1))).toBe(true);
	});

	it('finds the part that holds a number', () => {
		const scope = createScope(ex([], { p: [10] }), HYMNALS);
		expect(scope.includesEntry(entry('p', 10))).toBe(false);
		expect(scope.includesEntry(entry('p', 15))).toBe(false);
		expect(scope.includesEntry(entry('p', 9))).toBe(true);
		expect(scope.includesEntry(entry('p', 20))).toBe(true);
		expect(scope.includesPart('p', 10)).toBe(false);
		expect(scope.includesPart('p', 20)).toBe(true);
	});

	it('keeps numbers outside every part while the hymnal is partly in use', () => {
		const scope = createScope(ex([], { p: [1] }), HYMNALS);
		expect(scope.includesEntry(entry('p', 0))).toBe(true);
		expect(scope.includesEntry(entry('p', NO_NUMBER))).toBe(true);
	});

	it('leaves out every entry of a hymnal left out entirely', () => {
		const scope = createScope(ex(['p']), HYMNALS);
		expect(scope.includesEntry(entry('p', 0))).toBe(false);
		expect(scope.includesEntry(entry('p', NO_NUMBER))).toBe(false);
		expect(scope.includesEntry(entry('p', 15))).toBe(false);
		expect(scope.includesPart('p', 1)).toBe(false);
	});

	it('includes a hymn when one of its entries is in use', () => {
		const scope = createScope(ex(['a']), HYMNALS);
		expect(scope.includesHymn({ entries: [entry('a', 1), entry('b', 2)] })).toBe(true);
		expect(scope.includesHymn({ entries: [entry('a', 1)] })).toBe(false);
	});

	it('refuses to leave out the last item in use', () => {
		const scope = createScope(ex(['a', 'b'], { p: [1, 10] }), HYMNALS);
		expect(scope.canLeaveOut({ hymnal: 'p' })).toBe(false);
		expect(scope.canLeaveOut({ hymnal: 'p', part: 20 })).toBe(false);
		const two = createScope(ex(['a'], { p: [1, 10] }), HYMNALS);
		expect(two.canLeaveOut({ hymnal: 'p' })).toBe(true);
		expect(two.canLeaveOut({ hymnal: 'p', part: 20 })).toBe(true);
		expect(two.canLeaveOut({ hymnal: 'b' })).toBe(true);
	});
});

describe('setHymnal and setPart', () => {
	it('selects all of a hymnal partly or not in use', () => {
		expect(setHymnal(ex([], { p: [10] }), HYMNALS, 'p', true)).toEqual(NO_EXCLUSIONS);
		expect(setHymnal(ex(['p', 'a']), HYMNALS, 'p', true)).toEqual(ex(['a']));
	});

	it('leaves a hymnal out entirely', () => {
		expect(setHymnal(NO_EXCLUSIONS, HYMNALS, 'p', false)).toEqual(ex(['p']));
		expect(setHymnal(ex([], { p: [10] }), HYMNALS, 'p', false)).toEqual(ex(['p']));
	});

	it('moves a hymnal through all, some and none part by part, and back', () => {
		let choice = setPart(NO_EXCLUSIONS, HYMNALS, 'p', 1, false);
		expect(createScope(choice, HYMNALS).hymnalState('p')).toBe('some');
		choice = setPart(choice, HYMNALS, 'p', 10, false);
		choice = setPart(choice, HYMNALS, 'p', 20, false);
		expect(choice).toEqual(ex(['p']));
		choice = setPart(choice, HYMNALS, 'p', 10, true);
		expect(choice).toEqual(ex([], { p: [1, 20] }));
		choice = setPart(setPart(choice, HYMNALS, 'p', 1, true), HYMNALS, 'p', 20, true);
		expect(choice).toEqual(NO_EXCLUSIONS);
	});

	it('does not leave out the last item in use', () => {
		const last = ex(['a', 'b'], { p: [1, 10] });
		expect(setPart(last, HYMNALS, 'p', 20, false)).toBe(last);
		expect(setHymnal(last, HYMNALS, 'p', false)).toBe(last);
		const lastHymnal = ex(['a', 'p']);
		expect(setHymnal(lastHymnal, HYMNALS, 'b', false)).toBe(lastHymnal);
	});
});
