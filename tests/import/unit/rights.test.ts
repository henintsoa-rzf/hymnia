// Rights computed from decisions (data-model "Derived values", tasks T056/T058).
import { describe, expect, it } from 'vitest';
import { applyRights, computeRights } from '../../../scripts/import/pipeline/rights';
import type { Link, RightsDecision } from '../../../scripts/import/store/state';
import type { Hymn } from '../../../src/lib/domain/schema';

const hymn = (id: string, hymnals: string[], rights: Hymn['rights'] = 'unconfirmed'): Hymn => ({
	id,
	title: id,
	entries: hymnals.map((h, i) => ({ hymnal: h, number: String(i + 1) })),
	sections: [{ type: 'verse', number: 1, lines: [id] }],
	credits: [],
	source: { name: 'S', url: null, retrievedAt: '2026-11-11' },
	rights,
	corrections: []
});
const decision = (
	scope: RightsDecision['scope'],
	target: string,
	basis: RightsDecision['basis']
): RightsDecision => ({ scope, target, basis, date: '2026-11-11', note: '' });

const sources = ['cdl'];

describe('computeRights', () => {
	it('is unconfirmed without any decision', () => {
		expect(computeRights(hymn('a', ['jem']), [], sources)).toEqual({ rights: 'unconfirmed', inherited: false });
	});

	it('is confirmed by a hymnal permission or licence, inherited', () => {
		for (const basis of ['permission', 'licence'] as const) {
			expect(computeRights(hymn('a', ['jem']), [decision('hymnal', 'jem', basis)], sources)).toEqual({
				rights: 'confirmed',
				inherited: true
			});
		}
	});

	it('gives public-domain from a hymn decision even when the hymnal has none', () => {
		expect(computeRights(hymn('a', ['atg']), [decision('hymn', 'a', 'public-domain')], sources)).toEqual({
			rights: 'public-domain',
			inherited: false
		});
	});

	it('applies the most specific scope: hymn, then hymnal, then source', () => {
		const all = [
			decision('source', 'cdl', 'permission'),
			decision('hymnal', 'jem', 'refused'),
			decision('hymn', 'b', 'public-domain')
		];
		expect(computeRights(hymn('a', ['jem']), all, sources).rights).toBe('unconfirmed');
		expect(computeRights(hymn('b', ['jem']), all, sources).rights).toBe('public-domain');
		expect(computeRights(hymn('c', ['adf']), all, sources).rights).toBe('confirmed');
	});

	it('is unconfirmed when refused, even with a broader permission', () => {
		const all = [decision('source', 'cdl', 'permission'), decision('hymn', 'a', 'refused')];
		expect(computeRights(hymn('a', ['jem']), all, sources).rights).toBe('unconfirmed');
	});

	it('is confirmed when either of its hymnals is covered', () => {
		expect(
			computeRights(hymn('a', ['atg', 'jem']), [decision('hymnal', 'jem', 'permission')], sources).rights
		).toBe('confirmed');
	});

	it('is covered by the permission of any source it comes from', () => {
		expect(computeRights(hymn('a', ['jem']), [decision('source', 'jemaf', 'licence')], ['cdl', 'jemaf']).rights).toBe('confirmed');
	});
});

describe('applyRights', () => {
	const link = (hymnId: string): Link => ({
		source: 'cdl',
		hymnal: 'jem',
		number: hymnId,
		hymnId,
		url: `https://example.org/${hymnId}`,
		acceptedFingerprint: 'sha256:' + '0'.repeat(64),
		status: 'active',
		lastSeenAt: '2026-11-11'
	});

	it('changes only the rights field, and only where it differs', () => {
		const hymns = [hymn('a', ['jem']), hymn('b', ['atg']), hymn('c', ['jem'], 'confirmed')];
		const changed = applyRights(hymns, [decision('hymnal', 'jem', 'permission')], [link('a'), link('b'), link('c')]);
		expect(changed).toEqual([{ ...hymns[0], rights: 'confirmed' }]);
	});

	it('never touches a hymn that was not imported and has no decision of its own', () => {
		const sample = hymn('sample', ['ce'], 'public-domain');
		expect(applyRights([sample], [decision('hymnal', 'jem', 'permission')], [])).toEqual([]);
		expect(applyRights([sample], [decision('hymn', 'sample', 'refused')], [])).toEqual([
			{ ...sample, rights: 'unconfirmed' }
		]);
	});
});
