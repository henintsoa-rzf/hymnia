// Reconciliation of extracted hymns with content and links (research R6, task T042).
import { describe, expect, it } from 'vitest';
import { indexContent } from '../../../scripts/import/pipeline/content';
import { fingerprint } from '../../../scripts/import/pipeline/fingerprint';
import { reconcile, type Outcome } from '../../../scripts/import/pipeline/reconcile';
import type { FetchedHymn } from '../../../scripts/import/sources/types';
import { emptyState, type Link, type SourceConfig } from '../../../scripts/import/store/state';
import type { Hymn } from '../../../src/lib/domain/schema';

const TODAY = '2026-11-12';
const source: SourceConfig = {
	id: 'cdl',
	name: 'Conducteur de louange',
	baseUrl: 'https://example.org',
	hymnals: ['jem'],
	minDelayMs: 1000,
	terms: { url: null, summary: '', checkedAt: '2026-11-11' },
	permission: 'unknown'
};

const raw = (number: string, title: string, lines = [title]): FetchedHymn => ({
	source: 'cdl',
	hymnal: 'jem',
	number,
	url: `https://example.org/${number}`,
	title,
	sections: [{ type: 'verse', number: 1, lines }],
	credits: [{ name: 'A', role: 'unspecified' }],
	strippedMarkup: {},
	unknownCredits: [],
	retrievedAt: '2026-11-11'
});

const hymnOf = (r: FetchedHymn, id: string): Hymn => ({
	id,
	title: r.title,
	entries: [{ hymnal: r.hymnal, number: r.number }],
	sections: r.sections,
	credits: r.credits,
	source: { name: source.name, url: r.url, retrievedAt: r.retrievedAt },
	rights: 'unconfirmed',
	corrections: []
});

const linkOf = (r: FetchedHymn, hymnId: string, over: Partial<Link> = {}): Link => ({
	source: 'cdl',
	hymnal: r.hymnal,
	number: r.number,
	hymnId,
	url: r.url,
	acceptedFingerprint: fingerprint(r),
	status: 'active',
	lastSeenAt: TODAY,
	...over
});

function setup(hymns: Hymn[], links: Link[]) {
	const content = indexContent({
		hymnals: { file: 'hymnals.json', data: [{ id: 'jem', name: 'JEM', abbreviations: ['JEM'], sortOrder: 1 }] },
		hymns: hymns.map((data) => ({ file: `hymns/${data.id}.json`, data })),
		redirects: { file: 'redirects.json', data: {} }
	});
	const state = { ...emptyState(), sources: [source], links };
	return (outcomes: Outcome[]) =>
		reconcile({ source, hymnals: ['jem'], outcomes, content, state, pending: [], today: TODAY });
}
const ok = (hymn: FetchedHymn): Outcome => ({ ref: { hymnal: 'jem', number: hymn.number, url: hymn.url }, ok: true, hymn });

describe('reconcile', () => {
	const one = raw('1', 'Gloire');

	it('does not write a linked hymn whose text did not change', () => {
		const plan = setup([hymnOf(one, 'gloire')], [linkOf(one, 'gloire')])([ok(one)]);
		expect(plan.hymns).toEqual([]);
		expect(plan.pending).toEqual([]);
		expect(plan.perHymnal.jem.unchanged).toEqual([{ number: '1', hymnId: 'gloire', title: 'Gloire' }]);
		expect(plan.links).toEqual([linkOf(one, 'gloire')]);
	});

	it('ignores whitespace-only differences at the source', () => {
		const spaced = raw('1', 'Gloire', ['  Gloire ']);
		const plan = setup([hymnOf(one, 'gloire')], [linkOf(one, 'gloire')])([ok(spaced)]);
		expect(plan.pending).toEqual([]);
	});

	it('turns a changed source text into a pending change, without touching content', () => {
		const changed = raw('1', 'Gloire', ['Gloire à toi']);
		const plan = setup([hymnOf(one, 'gloire')], [linkOf(one, 'gloire')])([ok(changed)]);
		expect(plan.hymns).toEqual([]);
		expect(plan.pending).toHaveLength(1);
		expect(plan.pending[0]).toMatchObject({
			hymnId: 'gloire',
			source: 'cdl',
			hymnal: 'jem',
			number: '1',
			detectedAt: TODAY,
			oldFingerprint: fingerprint(one),
			newFingerprint: fingerprint(changed),
			proposed: changed
		});
		expect(plan.pending[0].diff).toMatch(/-Gloire\n\+Gloire à toi/);
		expect(plan.perHymnal.jem.changed.map((c) => c.hymnId)).toEqual(['gloire']);
		// The accepted fingerprint stays until the change is accepted.
		expect(plan.links[0].acceptedFingerprint).toBe(fingerprint(one));
	});

	it('marks an entry no longer listed as missing, and deletes nothing', () => {
		const two = raw('2', 'Paix');
		const plan = setup(
			[hymnOf(one, 'gloire'), hymnOf(two, 'paix')],
			[linkOf(one, 'gloire'), linkOf(two, 'paix')]
		)([ok(one)]);
		expect(plan.links.find((l) => l.number === '2')?.status).toBe('missing');
		expect(plan.perHymnal.jem.missing).toEqual([{ number: '2', hymnId: 'paix', title: 'Paix' }]);
		expect(plan.hymns).toEqual([]);
	});

	it('makes a missing entry active again when it is listed again', () => {
		const plan = setup([hymnOf(one, 'gloire')], [linkOf(one, 'gloire', { status: 'missing' })])([
			ok(one)
		]);
		expect(plan.links[0].status).toBe('active');
		expect(plan.perHymnal.jem.missing).toEqual([]);
	});

	it('reports a number already used by another hymn as a conflict, and writes nothing', () => {
		const other = raw('1', 'Autre chant');
		const plan = setup([hymnOf(other, 'autre-chant')], [])([ok(one)]);
		expect(plan.hymns).toEqual([]);
		expect(plan.links).toEqual([]);
		expect(plan.perHymnal.jem.conflicts[0].reason).toMatch(/already used by "autre-chant"/);
	});

	it('links a hymn already in content with the same text (interrupted run)', () => {
		const plan = setup([hymnOf(one, 'gloire')], [])([ok(one)]);
		expect(plan.hymns).toEqual([]);
		expect(plan.links).toEqual([linkOf(one, 'gloire')]);
	});

	it('updates lastSeenAt only when the date changed', () => {
		const old = linkOf(one, 'gloire', { lastSeenAt: '2026-10-01' });
		const plan = setup([hymnOf(one, 'gloire')], [old])([ok(one)]);
		expect(plan.links[0].lastSeenAt).toBe(TODAY);
	});
});
