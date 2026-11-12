/**
 * Data build: validate content/, leave out hymns whose rights are not confirmed, and write the
 * catalog and the search index to static/data/ (specs/001-hymnal-browse-search/plan.md).
 *
 * Personal use: with HYMNIA_PERSONAL_USE=1 (in `.env`, never committed), hymns whose rights are
 * not confirmed are published too, for a copy of the app only its maintainer uses. Their
 * `rights` field is unchanged, so turning the setting off publishes only covered hymns again.
 *
 * Usage: npm run data   (tsx scripts/build-data.ts [contentDir] [outDir])
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import MiniSearch from 'minisearch';
import {
	HymnalListSchema,
	HymnSchema,
	RedirectsSchema,
	type Redirects,
	type Catalog,
	type DataManifest,
	type Hymn,
	type Hymnal,
	type PublishedHymn
} from '../src/lib/domain/schema';
import { compareSortKeys, normalizeNumber, sortKey } from '../src/lib/domain/numbering';
import { compactKey } from '../src/lib/search/normalize';
import { INDEX_OPTIONS, toIndexDocument, type IndexDocument } from '../src/lib/search/index-config';

/** Maximum compressed size of catalog + index (plan.md, Constraints). */
export const MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;

export type RawContent = {
	hymnals: { file: string; data: Hymnal[] };
	hymns: { file: string; data: Hymn }[];
	/** `redirects.json`; `{}` when the file does not exist. */
	redirects: { file: string; data: Redirects };
};

export type BuildReport = {
	hymnals: number;
	hymns: number;
	excluded: number;
	/** Personal use only: hymns published although their rights are not confirmed. */
	unconfirmedIncluded?: number;
};

export type BuildOptions = {
	/** Publish hymns whose rights are not confirmed (personal use, HYMNIA_PERSONAL_USE). */
	personalUse?: boolean;
	/** Hymnal ids that must not appear (the sample hymnals, when building from content/). */
	reservedHymnalIds?: string[];
};

/**
 * The fictional sample hymnals of feature 001, kept in tests/fixtures/sample-content/ for the
 * tests. Their ids are reserved: content/ never uses them (feature 002, FR-028).
 */
export const SAMPLE_HYMNAL_IDS = ['ce', 'he'];

export type BuildResult = {
	errors: string[];
	report: BuildReport;
	catalog?: Catalog;
	indexJson?: string;
};

/* ------------------------------------------------------------------ load */

async function readJsonIfExists(path: string, fallback: unknown): Promise<unknown> {
	try {
		return JSON.parse(await readFile(path, 'utf8'));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
		throw error;
	}
}

export async function loadContent(contentDir: string): Promise<RawContent> {
	const hymnalsFile = join(contentDir, 'hymnals.json');
	const hymnsDir = join(contentDir, 'hymns');
	const files = (await readdir(hymnsDir)).filter((f) => f.endsWith('.json')).sort();
	return {
		hymnals: { file: 'hymnals.json', data: JSON.parse(await readFile(hymnalsFile, 'utf8')) },
		hymns: await Promise.all(
			files.map(async (f) => ({
				file: `hymns/${f}`,
				data: JSON.parse(await readFile(join(hymnsDir, f), 'utf8'))
			}))
		),
		redirects: {
			file: 'redirects.json',
			data: (await readJsonIfExists(join(contentDir, 'redirects.json'), {})) as Redirects
		}
	};
}

/* -------------------------------------------------------------- validate */

function zodErrors(file: string, error: { issues: { path: PropertyKey[]; message: string }[] }) {
	return error.issues.map(
		(i) => `${file}: ${i.path.map(String).join('.') || '(root)'}: ${i.message}`
	);
}

/** Rule 4: every text field is in Unicode NFC. */
function nfcErrors(file: string, value: unknown, path: string[] = []): string[] {
	if (typeof value === 'string') {
		return value === value.normalize('NFC')
			? []
			: [`${file}: text not in Unicode NFC at ${path.join('.') || '(root)'}`];
	}
	if (Array.isArray(value))
		return value.flatMap((v, i) => nfcErrors(file, v, [...path, String(i)]));
	if (value && typeof value === 'object') {
		return Object.entries(value).flatMap(([k, v]) => nfcErrors(file, v, [...path, k]));
	}
	return [];
}

export function validateContent(
	raw: RawContent,
	options: BuildOptions = {}
): {
	errors: string[];
	hymnals: Hymnal[];
	published: Hymn[];
	excluded: number;
	unconfirmedIncluded: number;
	redirects: Redirects;
} {
	const errors: string[] = [];

	// Hymnals
	const hymnalsResult = HymnalListSchema.safeParse(raw.hymnals.data);
	if (!hymnalsResult.success) errors.push(...zodErrors(raw.hymnals.file, hymnalsResult.error));
	const hymnals = hymnalsResult.success ? hymnalsResult.data : [];
	errors.push(...nfcErrors(raw.hymnals.file, raw.hymnals.data));

	const hymnalIds = new Set<string>();
	for (const h of hymnals) {
		if (hymnalIds.has(h.id)) errors.push(`${raw.hymnals.file}: duplicate hymnal id "${h.id}"`);
		hymnalIds.add(h.id);
	}

	// Rule 3: abbreviations (and full names) are unique across hymnals after normalisation.
	const keyOwner = new Map<string, string>();
	for (const h of hymnals) {
		for (const label of [...h.abbreviations, h.name]) {
			const key = compactKey(label);
			const owner = keyOwner.get(key);
			if (owner && owner !== h.id) {
				errors.push(
					`${raw.hymnals.file}: hymnal "${h.id}": abbreviation "${label}" conflicts with hymnal "${owner}"`
				);
			} else {
				keyOwner.set(key, h.id);
			}
		}
	}

	for (const id of options.reservedHymnalIds ?? []) {
		if (hymnals.some((h) => h.id === id)) {
			errors.push(`${raw.hymnals.file}: "${id}" is reserved for the sample hymnals of the tests`);
		}
	}

	// Hymns
	const valid: Hymn[] = [];
	const hymnIds = new Map<string, string>();
	const numberOwner = new Map<string, string>();

	for (const { file, data } of raw.hymns) {
		const result = HymnSchema.safeParse(data);
		if (!result.success) {
			errors.push(...zodErrors(file, result.error));
			continue;
		}
		const hymn = result.data;
		const hymnErrors: string[] = [];

		const expectedId = basename(file, '.json');
		if (hymn.id !== expectedId) {
			hymnErrors.push(`${file}: id "${hymn.id}" does not match the file name "${expectedId}"`);
		}
		const previous = hymnIds.get(hymn.id);
		if (previous) hymnErrors.push(`${file}: hymn id "${hymn.id}" already used in ${previous}`);
		hymnIds.set(hymn.id, file);

		hymnErrors.push(...nfcErrors(file, data));

		// Rule 5
		if (!hymn.sections.some((s) => s.lines.some((l) => l.trim() !== ''))) {
			hymnErrors.push(`${file}: needs at least one section with a non-empty line`);
		}

		hymn.entries.forEach((entry, i) => {
			// Rule 1
			if (!hymnalIds.has(entry.hymnal)) {
				hymnErrors.push(`${file}: entries.${i}: unknown hymnal "${entry.hymnal}"`);
			}
			// Rule 2
			const key = `${entry.hymnal} ${normalizeNumber(entry.number)}`;
			const owner = numberOwner.get(key);
			if (owner) {
				hymnErrors.push(
					`${file}: ${entry.hymnal} ${entry.number} is used by "${owner}" and "${hymn.id}"`
				);
			} else {
				numberOwner.set(key, hymn.id);
			}
		});

		errors.push(...hymnErrors);
		if (hymnErrors.length === 0) valid.push(hymn);
	}

	// Feature 002 (FR-026): redirects from merged hymn ids.
	const redirects = validateRedirects(raw, new Set(hymnIds.keys()), errors);

	// Rule 6 (all of them for personal use)
	const unconfirmed = valid.filter((h) => h.rights === 'unconfirmed').length;
	const published = options.personalUse ? valid : valid.filter((h) => h.rights !== 'unconfirmed');
	const excluded = valid.length - published.length;
	const unconfirmedIncluded = options.personalUse ? unconfirmed : 0;
	return { errors, hymnals, published, excluded, unconfirmedIncluded, redirects };
}

function validateRedirects(raw: RawContent, hymnIds: Set<string>, errors: string[]): Redirects {
	const { file, data } = raw.redirects;
	const result = RedirectsSchema.safeParse(data);
	if (!result.success) {
		errors.push(...zodErrors(file, result.error));
		return {};
	}
	const redirects = result.data;
	for (const [from, to] of Object.entries(redirects)) {
		if (hymnIds.has(from)) {
			errors.push(`${file}: "${from}" is the id of an existing hymn file; it cannot be redirected`);
		}
		if (to in redirects) {
			errors.push(`${file}: "${from}" → "${to}" is a chain: "${to}" is itself redirected`);
		} else if (!hymnIds.has(to)) {
			errors.push(`${file}: "${from}" → "${to}": no hymn has the id "${to}"`);
		}
	}
	return redirects;
}

/* ----------------------------------------------------------------- build */

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 10);

function firstLine(hymn: Hymn): string {
	for (const section of hymn.sections) {
		const line = section.lines.find((l) => l.trim() !== '');
		if (line) return line.trim();
	}
	return '';
}

export function buildCatalog(hymnals: Hymnal[], hymns: Hymn[], redirects: Redirects = {}): Catalog {
	const publishedHymns: PublishedHymn[] = [...hymns]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((h) => ({
			id: h.id,
			title: h.title,
			firstLine: firstLine(h),
			sections: h.sections,
			credits: h.credits,
			source: h.source,
			entries: h.entries
				.map((e) => ({ ...e, sortKey: sortKey(e.number) }))
				.sort((a, b) => a.hymnal.localeCompare(b.hymnal) || compareSortKeys(a.sortKey, b.sortKey))
		}));

	const counts = new Map<string, number>();
	for (const h of publishedHymns) {
		for (const e of h.entries) counts.set(e.hymnal, (counts.get(e.hymnal) ?? 0) + 1);
	}

	const publishedHymnals = [...hymnals]
		.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
		.map((h) => ({ ...h, hymnCount: counts.get(h.id) ?? 0 }));

	const sortedRedirects = Object.fromEntries(
		Object.entries(redirects).sort(([a], [b]) => a.localeCompare(b))
	);
	const body = { hymnals: publishedHymnals, hymns: publishedHymns, redirects: sortedRedirects };
	return { version: hash(JSON.stringify(body)), ...body };
}

export function buildIndex(catalog: Catalog): string {
	const index = new MiniSearch<IndexDocument>(INDEX_OPTIONS);
	index.addAll(catalog.hymns.map(toIndexDocument));
	return JSON.stringify(index);
}

export async function buildData(
	contentDir: string,
	options: BuildOptions = {}
): Promise<BuildResult> {
	const raw = await loadContent(contentDir);
	const { errors, hymnals, published, excluded, unconfirmedIncluded, redirects } = validateContent(
		raw,
		options
	);
	const report: BuildReport = { hymnals: hymnals.length, hymns: published.length, excluded };
	if (options.personalUse) report.unconfirmedIncluded = unconfirmedIncluded;
	if (errors.length > 0) return { errors, report };
	const catalog = buildCatalog(hymnals, published, redirects);
	return { errors, report, catalog, indexJson: buildIndex(catalog) };
}

/* ------------------------------------------------------------------ write */

export async function writeOutput(outDir: string, catalog: Catalog, indexJson: string) {
	const catalogJson = JSON.stringify(catalog);
	const manifest: DataManifest = {
		version: catalog.version,
		catalog: `catalog.${hash(catalogJson)}.json`,
		index: `index.${hash(indexJson)}.json`
	};
	await rm(outDir, { recursive: true, force: true });
	await mkdir(outDir, { recursive: true });
	await writeFile(join(outDir, manifest.catalog), catalogJson);
	await writeFile(join(outDir, manifest.index), indexJson);
	await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, '\t'));
	const compressed = gzipSync(catalogJson).length + gzipSync(indexJson).length;
	return { manifest, compressed };
}

async function main() {
	const contentDir = resolve(process.argv[2] ?? 'content');
	const outDir = resolve(process.argv[3] ?? 'static/data');
	if (existsSync('.env')) process.loadEnvFile('.env');
	const personalUse = process.env.HYMNIA_PERSONAL_USE === '1';
	// The sample hymnals belong to the tests: the real collection never uses their ids.
	const reservedHymnalIds = contentDir === resolve('content') ? SAMPLE_HYMNAL_IDS : [];
	const { errors, report, catalog, indexJson } = await buildData(contentDir, {
		personalUse,
		reservedHymnalIds
	});

	if (errors.length > 0 || !catalog || !indexJson) {
		console.error(`✗ Content is invalid (${errors.length} error(s)):`);
		for (const e of errors) console.error(`  - ${e}`);
		process.exit(1);
	}

	const { manifest, compressed } = await writeOutput(outDir, catalog, indexJson);
	const mb = (compressed / 1024 / 1024).toFixed(2);
	console.log(
		`✓ ${report.hymnals} hymnals, ${report.hymns} hymns published, ` +
			`${report.excluded} left out (rights not confirmed)`
	);
	if (report.unconfirmedIncluded) {
		console.log(
			`  ⚠ Personal use (HYMNIA_PERSONAL_USE): ${report.unconfirmedIncluded} hymns published ` +
				'although their rights are not confirmed. Do not distribute this build.'
		);
	}
	console.log(`  ${manifest.catalog}, ${manifest.index} — ${mb} MB compressed`);

	if (compressed > MAX_COMPRESSED_BYTES) {
		console.error(`✗ Data is over the 5 MB compressed limit (${mb} MB).`);
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	await main();
}
