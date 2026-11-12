/**
 * Import records kept under import/ (specs/002-hymnal-import/data-model.md,
 * contracts/import-files.md): sources, decisions, links and pending changes.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { normalizeNumber } from '../../../src/lib/domain/numbering';
import { FetchedHymnSchema } from '../sources/types';
import { readJson, readJsonOr, removeFile, writeJsonStable } from './files';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug');
const text = z.string().min(1);
const fingerprintText = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'must be sha256:<hex>');

/* ---------------------------------------------------------------- schemas */

export const PermissionSchema = z.enum(['unknown', 'requested', 'granted', 'refused']);

export const SourceConfigSchema = z.strictObject({
	id: slug,
	name: text,
	baseUrl: z.string().url(),
	hymnals: z.array(slug).min(1),
	/** "≥ 1000". The fetcher uses the larger of this and the site's Crawl-delay. */
	minDelayMs: z.number().int().min(1000),
	terms: z.strictObject({ url: z.string().url().nullable(), summary: z.string(), checkedAt: isoDate }),
	permission: PermissionSchema
});

export const LinkSchema = z.strictObject({
	source: slug,
	hymnal: slug,
	number: text,
	hymnId: slug,
	url: z.string().url(),
	acceptedFingerprint: fingerprintText,
	status: z.enum(['active', 'missing']),
	lastSeenAt: isoDate
});

export const RightsDecisionSchema = z.strictObject({
	scope: z.enum(['source', 'hymnal', 'hymn']),
	target: slug,
	basis: z.enum(['permission', 'licence', 'public-domain', 'refused']),
	date: isoDate,
	note: z.string()
});

export const MergeDecisionSchema = z
	.strictObject({ a: slug, b: slug, decision: z.enum(['merge', 'distinct']), date: isoDate })
	.refine((m) => m.a < m.b, { message: 'the pair must be stored with a < b', path: ['b'] });

/** Hymnal id → source ids, highest priority first. */
export const SourcePrioritySchema = z.record(slug, z.array(slug));

export const PendingChangeSchema = z.strictObject({
	hymnId: slug,
	source: slug,
	hymnal: slug,
	number: text,
	detectedAt: isoDate,
	oldFingerprint: fingerprintText,
	newFingerprint: fingerprintText,
	/** Unified diff of the title and section lines. */
	diff: z.string(),
	proposed: FetchedHymnSchema
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type RightsDecision = z.infer<typeof RightsDecisionSchema>;
export type MergeDecision = z.infer<typeof MergeDecisionSchema>;
export type SourcePriority = z.infer<typeof SourcePrioritySchema>;
export type PendingChange = z.infer<typeof PendingChangeSchema>;

export type ImportState = {
	sources: SourceConfig[];
	rights: RightsDecision[];
	merges: MergeDecision[];
	priority: SourcePriority;
	links: Link[];
};

export const emptyState = (): ImportState => ({
	sources: [],
	rights: [],
	merges: [],
	priority: {},
	links: []
});

/* ------------------------------------------------------------------ files */

const FILES = {
	sources: { path: 'import/sources.json', schema: z.array(SourceConfigSchema), empty: [] },
	rights: { path: 'import/decisions/rights.json', schema: z.array(RightsDecisionSchema), empty: [] },
	merges: { path: 'import/decisions/merges.json', schema: z.array(MergeDecisionSchema), empty: [] },
	priority: { path: 'import/decisions/source-priority.json', schema: SourcePrioritySchema, empty: {} },
	links: { path: 'import/state/links.json', schema: z.array(LinkSchema), empty: [] }
} as const;

export const PENDING_DIR = 'import/pending';
export const REPORTS_DIR = 'import/reports';
export const CACHE_DIR = 'import/cache';

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
	const result = schema.safeParse(value);
	if (result.success) return result.data;
	const issues = result.error.issues.map(
		(i) => `${file}: ${i.path.map(String).join('.') || '(root)'}: ${i.message}`
	);
	throw new Error(`Invalid import file\n  ${issues.join('\n  ')}`);
}

export async function loadState(root: string): Promise<ImportState> {
	const state = emptyState() as Record<keyof ImportState, unknown>;
	for (const [key, file] of Object.entries(FILES) as [keyof ImportState, (typeof FILES)[keyof typeof FILES]][]) {
		const raw = await readJsonOr(join(root, file.path), file.empty);
		state[key] = parseOrThrow(file.schema as z.ZodType<unknown>, raw, file.path);
	}
	return state as ImportState;
}

export async function saveState(root: string, state: ImportState) {
	for (const [key, file] of Object.entries(FILES) as [keyof ImportState, (typeof FILES)[keyof typeof FILES]][]) {
		const value = parseOrThrow(file.schema as z.ZodType<unknown>, state[key], file.path);
		await writeJsonStable(join(root, file.path), value);
	}
}

/* --------------------------------------------------------- pending changes */

export const pendingFile = (hymnId: string, source: string) => `${hymnId}--${source}.json`;

export async function loadPending(root: string): Promise<PendingChange[]> {
	let names: string[];
	try {
		names = (await readdir(join(root, PENDING_DIR))).filter((n) => n.endsWith('.json')).sort();
	} catch {
		return [];
	}
	return Promise.all(
		names.map(async (n) =>
			parseOrThrow(PendingChangeSchema, await readJson(join(root, PENDING_DIR, n)), `${PENDING_DIR}/${n}`)
		)
	);
}

export async function savePending(root: string, change: PendingChange) {
	const value = parseOrThrow(PendingChangeSchema, change, PENDING_DIR);
	await writeJsonStable(join(root, PENDING_DIR, pendingFile(change.hymnId, change.source)), value);
}

export async function removePending(root: string, hymnId: string, source: string) {
	await removeFile(join(root, PENDING_DIR, pendingFile(hymnId, source)));
}

/* -------------------------------------------------------------- validation */

export type ValidationContext = { hymnalIds: ReadonlySet<string>; hymnIds: ReadonlySet<string> };

/** Cross-file rules 2 and 3 of data-model.md ("Validation rules"). */
export function validateState(state: ImportState, ctx: ValidationContext): string[] {
	const errors: string[] = [];
	const sourceIds = new Set<string>();

	for (const s of state.sources) {
		if (sourceIds.has(s.id)) errors.push(`${FILES.sources.path}: duplicate source id "${s.id}"`);
		sourceIds.add(s.id);
		for (const h of s.hymnals) {
			if (!ctx.hymnalIds.has(h)) {
				errors.push(`${FILES.sources.path}: source "${s.id}": hymnal "${h}" is not in content/hymnals.json`);
			}
		}
	}

	const targets = { source: sourceIds, hymnal: ctx.hymnalIds, hymn: ctx.hymnIds };
	const decided = new Set<string>();
	for (const d of state.rights) {
		if (!targets[d.scope].has(d.target)) {
			errors.push(`${FILES.rights.path}: ${d.scope} "${d.target}" does not exist`);
		}
		const key = `${d.scope} ${d.target}`;
		if (decided.has(key)) {
			errors.push(`${FILES.rights.path}: only one decision is allowed per scope and target (${key})`);
		}
		decided.add(key);
	}

	for (const [hymnal, sources] of Object.entries(state.priority)) {
		if (!ctx.hymnalIds.has(hymnal)) errors.push(`${FILES.priority.path}: unknown hymnal "${hymnal}"`);
		for (const s of sources) {
			if (!sourceIds.has(s)) errors.push(`${FILES.priority.path}: ${hymnal}: unknown source "${s}"`);
		}
	}

	const linkKeys = new Set<string>();
	const owners = new Map<string, string>();
	for (const l of state.links) {
		const where = `${l.source} ${l.hymnal} ${l.number}`;
		const key = `${l.source} ${l.hymnal} ${normalizeNumber(l.number)}`;
		if (linkKeys.has(key)) {
			errors.push(`${FILES.links.path}: (source, hymnal, number) must be unique: ${where}`);
		}
		linkKeys.add(key);
		if (!sourceIds.has(l.source)) errors.push(`${FILES.links.path}: ${where}: unknown source`);
		if (!ctx.hymnIds.has(l.hymnId)) {
			errors.push(`${FILES.links.path}: ${where}: hymn "${l.hymnId}" does not exist`);
		}
		const numberKey = `${l.hymnal} ${normalizeNumber(l.number)}`;
		const owner = owners.get(numberKey);
		if (owner && owner !== l.hymnId) {
			errors.push(
				`${FILES.links.path}: conflict: ${l.hymnal} ${l.number} is linked to "${owner}" and "${l.hymnId}"`
			);
		} else {
			owners.set(numberKey, l.hymnId);
		}
	}

	return errors;
}
