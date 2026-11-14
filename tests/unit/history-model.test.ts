// History of opened hymns: pure operations (specs/006-search-start-panel/data-model.md, task T005).
import { describe, expect, it } from 'vitest';
import { clearHistory, parseHistory, recordOpened } from '$lib/history/model';
import { HISTORY_MAX, type HistoryDoc } from '$lib/history/schema';

const T1 = '2026-11-14T09:00:00.000Z';
const T2 = '2026-11-14T09:05:00.000Z';
const EMPTY = { version: 1, entries: [] };

const doc = (...ids: string[]): HistoryDoc => ({
	version: 1,
	entries: ids.map((id, i) => ({ hymnal: 'ce', number: String(i + 1), hymnId: id, openedAt: T1 }))
});

describe('parseHistory', () => {
	it('reads a valid document', () => {
		const valid = doc('a', 'b');
		expect(parseHistory(JSON.stringify(valid))).toEqual(valid);
	});

	it.each([
		['no value', null],
		['invalid JSON', '{nope'],
		['another version', JSON.stringify({ version: 2, entries: [] })],
		['a missing field', JSON.stringify({ version: 1, entries: [{ hymnal: 'ce', number: '1' }] })],
		[
			'a date that is not ISO',
			JSON.stringify({
				version: 1,
				entries: [{ hymnal: 'ce', number: '1', hymnId: 'a', openedAt: 'hier' }]
			})
		],
		['not an object', '"text"']
	])('returns an empty history for %s', (_, raw) => {
		expect(parseHistory(raw)).toEqual(EMPTY);
	});
});

describe('recordOpened', () => {
	it('puts the opened hymn first', () => {
		const next = recordOpened(doc('a'), { hymnal: 'he', number: '7' }, 'b', T2);
		expect(next.entries.map((e) => e.hymnId)).toEqual(['b', 'a']);
		expect(next.entries[0]).toEqual({ hymnal: 'he', number: '7', hymnId: 'b', openedAt: T2 });
	});

	it('keeps at most one entry per hymn, with the reference it was last opened under', () => {
		const next = recordOpened(doc('a', 'b', 'c'), { hymnal: 'he', number: '7' }, 'b', T2);
		expect(next.entries.map((e) => e.hymnId)).toEqual(['b', 'a', 'c']);
		expect(next.entries[0]).toMatchObject({ hymnal: 'he', number: '7', openedAt: T2 });
	});

	it('only updates the top entry when the same hymn is opened again', () => {
		const next = recordOpened(doc('a', 'b'), { hymnal: 'ce', number: '1' }, 'a', T2);
		expect(next.entries).toHaveLength(2);
		expect(next.entries[0]).toEqual({ hymnal: 'ce', number: '1', hymnId: 'a', openedAt: T2 });
	});

	it(`keeps at most ${HISTORY_MAX} entries, dropping the oldest`, () => {
		const full = doc(...Array.from({ length: HISTORY_MAX }, (_, i) => `h${i}`));
		const next = recordOpened(full, { hymnal: 'ce', number: '99' }, 'new', T2);
		expect(next.entries).toHaveLength(HISTORY_MAX);
		expect(next.entries[0].hymnId).toBe('new');
		expect(next.entries.map((e) => e.hymnId)).not.toContain(`h${HISTORY_MAX - 1}`);
	});

	it('never changes the document it is given', () => {
		const before = doc('a', 'b');
		const copy = structuredClone(before);
		recordOpened(before, { hymnal: 'ce', number: '9' }, 'b', T2);
		expect(before).toEqual(copy);
	});
});

describe('clearHistory', () => {
	it('returns an empty version 1 document', () => {
		expect(clearHistory()).toEqual(EMPTY);
	});
});
