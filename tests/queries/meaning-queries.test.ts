/**
 * Feature 011 (FR-019): the reference set of search by meaning is well formed and points at
 * real hymns of content/ (personal-use build, as the other real-content query tests). Each query
 * targets one or more stanzas and shares no word (stop words aside) with them or their hymn's
 * title, so it can only be found by meaning.
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildData } from '../../scripts/build-data';
import type { PublishedHymn } from '../../src/lib/domain/schema';
import { sharedWords } from '../helpers/query-words';
import queries from './meaning-queries.json';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const CATEGORIES = ['theme', 'occasion', 'short', 'long', 'bible', 'paraphrase'];

type MeaningQuery = {
	id: string;
	category: string;
	query: string;
	targets: { hymn: string; section: number }[];
	expect: string[];
	note?: string;
};
const all = queries as MeaningQuery[];

let ids: Set<string>;
let hymns: Map<string, PublishedHymn>;
beforeAll(async () => {
	const { errors, catalog } = await buildData(CONTENT, { personalUse: true });
	if (errors.length || !catalog) throw new Error(errors.join('\n'));
	ids = new Set(catalog.hymns.map((h) => h.id));
	hymns = new Map(catalog.hymns.map((h) => [h.id, h]));
});

describe('meaning reference queries', () => {
	it('has at least 40 queries, with unique ids', () => {
		expect(all.length).toBeGreaterThanOrEqual(40);
		expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
	});

	it('covers every category at least 3 times', () => {
		for (const category of CATEGORIES) {
			expect(all.filter((q) => q.category === category).length, category).toBeGreaterThanOrEqual(3);
		}
		expect(all.filter((q) => !CATEGORIES.includes(q.category))).toEqual([]);
	});

	it('expects only hymns that exist', () => {
		const missing = all.flatMap((q) =>
			q.expect.filter((id) => !ids.has(id)).map((id) => `${q.id}: ${id}`)
		);
		expect(missing).toEqual([]);
		expect(all.filter((q) => q.expect.length === 0)).toEqual([]);
	});

	it('expects exactly the hymns of its target stanzas', () => {
		const wrong = all.filter(
			(q) =>
				q.targets.length === 0 ||
				[...new Set(q.targets.map((t) => t.hymn))].sort().join() !== [...q.expect].sort().join()
		);
		expect(wrong.map((q) => q.id)).toEqual([]);
		const missing = all.flatMap((q) =>
			q.targets
				.filter((t) => !hymns.get(t.hymn)?.sections[t.section])
				.map((t) => `${q.id}: ${t.hymn}[${t.section}]`)
		);
		expect(missing).toEqual([]);
	});

	it('shares no word with its target stanzas or their titles', () => {
		const shared = all.flatMap((q) =>
			q.targets.flatMap((t) => {
				const hymn = hymns.get(t.hymn);
				const section = hymn?.sections[t.section];
				if (!hymn || !section) return [];
				const words = sharedWords(q.query, [hymn.title, ...section.lines].join('\n'));
				return words.length ? [`${q.id} → ${t.hymn}[${t.section}]: ${words.join(', ')}`] : [];
			})
		);
		expect(shared).toEqual([]);
	});
});
