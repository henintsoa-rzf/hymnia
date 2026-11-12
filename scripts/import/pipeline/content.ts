/**
 * The importer's view of content/: hymns by id, who owns each (hymnal, number), ids already
 * used, and the writes the importer makes (always through the strict content schema).
 */
import { join } from 'node:path';
import {
	loadContent,
	SAMPLE_HYMNAL_IDS,
	validateContent,
	type RawContent
} from '../../build-data';
import { normalizeNumber } from '../../../src/lib/domain/numbering';
import type { HymnalEntry } from '../../../src/lib/domain/schema';
import { normalizeText } from '../../../src/lib/search/normalize';
import {
	HymnSchema,
	RedirectsSchema,
	type Hymn,
	type Hymnal,
	type Redirects
} from '../../../src/lib/domain/schema';
import { removeFile, writeJsonStable } from '../store/files';

export type ContentIndex = {
	hymnals: Hymnal[];
	hymns: Map<string, Hymn>;
	redirects: Redirects;
	/** The hymn that has this hymnal and number, if any. */
	owner(hymnal: string, number: string): string | undefined;
	/** Every id ever used: hymn files and redirect sources (FR-028: never reused). */
	takenIds(): Set<string>;
};

/**
 * The fictional sample hymnals of feature 001 (tests/fixtures/sample-content/). Their ids are
 * reserved (FR-028) and their hymns are never matched with imported ones, in the tests'
 * workspaces where both live side by side.
 */
export const SAMPLE_HYMNALS = SAMPLE_HYMNAL_IDS;

/**
 * Entries keep their own title (HymnalEntry.title) only when it differs from the hymn's title
 * once normalised: "Chœur des bienheureux." and "Choeur des bienheureux" are the same title.
 */
export function tidyEntryTitles(entries: HymnalEntry[], hymnTitle: string): HymnalEntry[] {
	const main = normalizeText(hymnTitle);
	return entries.map(({ title, ...entry }) =>
		title && normalizeText(title) !== main ? { ...entry, title } : entry
	);
}

export const entryKey = (hymnal: string, number: string) => `${hymnal} ${normalizeNumber(number)}`;

export function indexContent(raw: RawContent): ContentIndex {
	const hymns = new Map<string, Hymn>();
	for (const { data } of raw.hymns) hymns.set(data.id, data);
	const owners = new Map<string, string>();
	for (const hymn of hymns.values()) {
		for (const e of hymn.entries) owners.set(entryKey(e.hymnal, e.number), hymn.id);
	}
	const redirects = raw.redirects.data;
	return {
		hymnals: raw.hymnals.data,
		hymns,
		redirects,
		owner: (hymnal, number) => owners.get(entryKey(hymnal, number)),
		takenIds: () => new Set([...hymns.keys(), ...Object.keys(redirects)])
	};
}

/** Loads content/ and refuses to work on content that does not build. */
export async function loadContentIndex(root: string): Promise<ContentIndex> {
	const raw = await loadContent(join(root, 'content'));
	const { errors } = validateContent(raw);
	if (errors.length > 0) {
		throw new Error(`content/ is invalid; fix it before importing:\n  ${errors.join('\n  ')}`);
	}
	return indexContent(raw);
}

/** Validates the content as it would be after these changes (FR-003). */
export function validateAfter(
	content: ContentIndex,
	changes: { write?: Hymn[]; remove?: string[]; redirects?: Redirects }
): string[] {
	const hymns = new Map(content.hymns);
	for (const id of changes.remove ?? []) hymns.delete(id);
	for (const h of changes.write ?? []) hymns.set(h.id, h);
	const raw: RawContent = {
		hymnals: { file: 'hymnals.json', data: content.hymnals },
		hymns: [...hymns.values()].map((data) => ({ file: `hymns/${data.id}.json`, data })),
		redirects: { file: 'redirects.json', data: changes.redirects ?? content.redirects }
	};
	return validateContent(raw).errors;
}

export async function writeHymn(root: string, hymn: Hymn) {
	await writeJsonStable(join(root, 'content', 'hymns', `${hymn.id}.json`), HymnSchema.parse(hymn));
}

export async function deleteHymn(root: string, id: string) {
	await removeFile(join(root, 'content', 'hymns', `${id}.json`));
}

export async function writeRedirects(root: string, redirects: Redirects) {
	const sorted = Object.fromEntries(Object.entries(redirects).sort(([a], [b]) => a.localeCompare(b)));
	await writeJsonStable(join(root, 'content', 'redirects.json'), RedirectsSchema.parse(sorted));
}
