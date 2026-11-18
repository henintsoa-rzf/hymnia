/**
 * Feature 011 (FR-019): the reference set of search by meaning is well formed and points at
 * real hymns of content/ (personal-use build, as the other real-content query tests).
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildData } from '../../scripts/build-data';
import queries from './meaning-queries.json';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const CATEGORIES = ['theme', 'occasion', 'short', 'long', 'bible', 'paraphrase'];

type MeaningQuery = {
	id: string;
	category: string;
	query: string;
	expect: string[];
	note?: string;
};
const all = queries as MeaningQuery[];

let ids: Set<string>;
beforeAll(async () => {
	const { errors, catalog } = await buildData(CONTENT, { personalUse: true });
	if (errors.length || !catalog) throw new Error(errors.join('\n'));
	ids = new Set(catalog.hymns.map((h) => h.id));
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
});
