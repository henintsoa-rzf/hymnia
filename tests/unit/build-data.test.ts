import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { buildCatalog, buildData, loadContent, validateContent } from '../../scripts/build-data';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function validRaw() {
	return loadContent(fixture('content-valid'));
}

describe('valid content', () => {
	it('builds with no errors and leaves out unconfirmed hymns (FR-019)', async () => {
		const result = await buildData(fixture('content-valid'));
		expect(result.errors).toEqual([]);
		expect(result.report).toEqual({ hymnals: 2, hymns: 2, excluded: 1 });
		const ids = result.catalog!.hymns.map((h) => h.id).sort();
		expect(ids).toEqual(['deuxieme-chant', 'premier-chant']);
	});

	it('publishes unconfirmed hymns too for personal use, and counts them', async () => {
		const result = await buildData(fixture('content-valid'), { personalUse: true });
		expect(result.errors).toEqual([]);
		expect(result.report).toEqual({ hymnals: 2, hymns: 3, excluded: 0, unconfirmedIncluded: 1 });
	});

	it('derives firstLine, sortKey and hymnCount', async () => {
		const { catalog } = await buildData(fixture('content-valid'));
		const first = catalog!.hymns.find((h) => h.id === 'premier-chant')!;
		expect(first.firstLine).toBe('Louez l’Éternel, ô mon âme');
		const second = catalog!.hymns.find((h) => h.id === 'deuxieme-chant')!;
		expect(second.entries[0].sortKey).toEqual([2, 'a']);
		const counts = Object.fromEntries(catalog!.hymnals.map((h) => [h.id, h.hymnCount]));
		// bb 3 is unconfirmed, so bb only counts "premier-chant"
		expect(counts).toEqual({ aa: 2, bb: 1 });
	});

	it('produces a serialised search index', async () => {
		const { indexJson } = await buildData(fixture('content-valid'));
		expect(typeof indexJson).toBe('string');
		expect(JSON.parse(indexJson!).documentCount).toBe(2);
	});
});

describe('schema errors', () => {
	it('reports every invalid field and the file name / id mismatch', async () => {
		const result = await buildData(fixture('content-invalid'));
		expect(result.catalog).toBeUndefined();
		const all = result.errors.join('\n');
		expect(all).toMatch(/mauvais-chant/);
		expect(all).toMatch(/entries/);
		expect(all).toMatch(/sections/);
		expect(all).toMatch(/role/);
		expect(all).toMatch(/retrievedAt/);
		expect(all).toMatch(/rights/);
		expect(all).toMatch(/nom-different.*autre-id|autre-id.*nom-different/);
	});
});

describe('reserved hymnal ids (feature 002, FR-028)', () => {
	it('rejects the sample hymnal ids when asked to (building from content/)', async () => {
		const raw = await validRaw();
		raw.hymnals.data = [
			...raw.hymnals.data,
			{ id: 'ce', name: 'Exemple', abbreviations: ['CE'], sortOrder: 9 }
		];
		expect(validateContent(raw).errors).toEqual([]);
		expect(validateContent(raw, { reservedHymnalIds: ['ce', 'he'] }).errors.join('\n')).toMatch(
			/"ce" is reserved/
		);
	});
});

describe('validation rules from data-model.md', () => {
	it('rule 1: every entries[].hymnal matches an existing hymnal', async () => {
		const raw = await validRaw();
		raw.hymns[0].data.entries.push({ hymnal: 'zz', number: '1' });
		expect(validateContent(raw).errors.join('\n')).toMatch(/unknown hymnal "zz"/);
	});

	it('rule 2: no two entries share the same hymnal and number', async () => {
		const raw = await validRaw();
		const first = raw.hymns.find((h) => h.data.id === 'premier-chant')!;
		const second = raw.hymns.find((h) => h.data.id === 'deuxieme-chant')!;
		second.data.entries = [{ hymnal: 'aa', number: first.data.entries[0].number }];
		expect(validateContent(raw).errors.join('\n')).toMatch(/aa 1.*used by/);
	});

	it('rule 2: number variants such as "12 bis" and "12bis" count as the same number', async () => {
		const raw = await validRaw();
		raw.hymns[0].data.entries = [
			{ hymnal: 'aa', number: '12 bis' },
			{ hymnal: 'aa', number: '12bis' }
		];
		expect(validateContent(raw).errors.join('\n')).toMatch(/used by/);
	});

	it('rule 3: hymnal abbreviations are unique after normalisation', async () => {
		const raw = await validRaw();
		raw.hymnals.data[1].abbreviations.push('a-a');
		expect(validateContent(raw).errors.join('\n')).toMatch(/abbreviation "a-a".*aa/);
	});

	it('rule 3b: the first abbreviation has at most 3 characters', async () => {
		const raw = await validRaw();
		raw.hymnals.data[1].abbreviations.unshift('Beta');
		expect(validateContent(raw).errors.join('\n')).toMatch(/at most 3 characters/);
	});

	it('rule 4: every text field is in Unicode NFC', async () => {
		const raw = await validRaw();
		raw.hymns[0].data.title = 'Gloire à Dieu'; // "à" written as a + combining accent
		expect(validateContent(raw).errors.join('\n')).toMatch(/NFC.*title/);
	});

	it('rule 5: every hymn has at least one non-empty line', async () => {
		const raw = await validRaw();
		raw.hymns[0].data.sections = [{ type: 'verse', number: 1, lines: ['   '] }];
		expect(validateContent(raw).errors.join('\n')).toMatch(/non-empty line/);
	});

	it('rule 6: unconfirmed hymns are excluded and counted', async () => {
		const raw = await validRaw();
		const { published, excluded } = validateContent(raw);
		expect(excluded).toBe(1);
		expect(published.every((h) => h.rights !== 'unconfirmed')).toBe(true);
	});
});

describe('strict content schemas (feature 002, T013)', () => {
	it('rejects an unknown or misspelt field instead of dropping it', async () => {
		const raw = await validRaw();
		(raw.hymns[0].data as Record<string, unknown>).credit = [];
		(raw.hymnals.data[0] as Record<string, unknown>).abbreviation = 'X';
		const errors = validateContent(raw).errors.join('\n');
		expect(errors).toMatch(/credit/);
		expect(errors).toMatch(/abbreviation/);
	});

	it('accepts alternateSources, which is not published in the catalog', async () => {
		const raw = await validRaw();
		const hymn = raw.hymns.find((h) => h.data.id === 'premier-chant')!;
		hymn.data.alternateSources = [
			{ name: 'Autre source', url: 'https://example.org/1', retrievedAt: '2026-11-11' }
		];
		const { errors, published } = validateContent(raw);
		expect(errors).toEqual([]);
		const catalog = buildCatalog(raw.hymnals.data, published, {});
		const built = catalog.hymns.find((h) => h.id === 'premier-chant')!;
		expect('alternateSources' in built).toBe(false);
	});
});

describe('hymn redirects (feature 002, FR-026, T023)', () => {
	it('treats a missing redirects.json as {} and publishes an empty map', async () => {
		const raw = await validRaw();
		expect(raw.redirects.data).toEqual({});
		const { catalog } = await buildData(fixture('content-valid'));
		expect(catalog!.redirects).toEqual({});
	});

	it('publishes a valid map in the catalog', async () => {
		const raw = await validRaw();
		raw.redirects.data = { 'ancien-chant': 'premier-chant' };
		const { errors, published, redirects } = validateContent(raw);
		expect(errors).toEqual([]);
		expect(buildCatalog(raw.hymnals.data, published, redirects).redirects).toEqual({
			'ancien-chant': 'premier-chant'
		});
	});

	it('fails when a source is the id of an existing hymn file', async () => {
		const raw = await validRaw();
		raw.redirects.data = { 'deuxieme-chant': 'premier-chant' };
		expect(validateContent(raw).errors.join('\n')).toMatch(/redirects\.json.*deuxieme-chant/);
	});

	it('fails when a target is not an existing hymn id', async () => {
		const raw = await validRaw();
		raw.redirects.data = { 'ancien-chant': 'introuvable' };
		expect(validateContent(raw).errors.join('\n')).toMatch(/introuvable/);
	});

	it('fails on a chain (a target that is itself redirected)', async () => {
		const raw = await validRaw();
		raw.redirects.data = { 'tres-ancien': 'ancien-chant', 'ancien-chant': 'premier-chant' };
		expect(validateContent(raw).errors.join('\n')).toMatch(/chain/);
	});

	it('fails on an invalid map', async () => {
		const raw = await validRaw();
		raw.redirects.data = { 'Pas Un Slug': 'premier-chant' } as Record<string, string>;
		expect(validateContent(raw).errors.join('\n')).toMatch(/redirects\.json/);
	});
});

describe('credit roles (feature 002)', () => {
	it('accepts "unspecified" for sources that do not say who wrote what', async () => {
		const raw = await validRaw();
		raw.hymns[0].data.credits = [{ name: 'Louis Bourgeois', role: 'unspecified' }];
		expect(validateContent(raw).errors).toEqual([]);
	});
});
