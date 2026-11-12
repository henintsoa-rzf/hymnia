/**
 * One import run for one source (contracts/cli.md, "Behaviour guaranteed by `run`"):
 *
 * 1. permission refused → no request; unknown → warning, needs --yes;
 * 2. polite fetcher (robots.txt, delay, User-Agent);
 * 3. every page is fetched and parsed before anything is written; more than 20 % failures →
 *    nothing written for the source (FR-024);
 * 4. atomic, stable writes (FR-009, FR-013);
 * 5. untouched hymns and manual work are never rewritten (FR-010);
 * 6. a report is always written, even when the run stops early.
 */
import { join } from 'node:path';
import { HymnSchema } from '../../../src/lib/domain/schema';
import { getContact } from '../env';
import { createFetcher, FetchError } from '../fetcher';
import { emptyHymnalReport, runIdOf, writeReport, type RunReport } from '../report';
import '../sources/all';
import { getAdapter } from '../sources/index';
import { RawHymnSchema, type SourceAdapter } from '../sources/types';
import {
	CACHE_DIR,
	loadPending,
	loadState,
	removePending,
	savePending,
	saveState
} from '../store/state';
import { loadContentIndex, validateAfter, writeHymn } from './content';
import { reconcile, type Matcher, type Outcome, type ReconcileInput } from './reconcile';
import { rightsSummary } from './rights';

/** FR-024: a source with more failures than this share of its pages writes nothing. */
export const MAX_FAILURE_SHARE = 0.2;

export type RunOptions = {
	root: string;
	source: string;
	hymnals?: string[];
	offline?: boolean;
	dryRun?: boolean;
	/** Run even when the source's permission is "unknown". */
	yes?: boolean;
	contact?: string;
	fetchImpl?: typeof fetch;
	now?: () => Date;
	sleep?: (ms: number) => Promise<void>;
	log?: (message: string) => void;
	/** Test hook: use this adapter instead of the registered one. */
	adapter?: SourceAdapter;
	/** Hooks filled by later stories (matching, rights). */
	hooks?: (
		ctx: HookContext
	) => Pick<ReconcileInput, 'match' | 'remember' | 'sameHymn' | 'rightsFor' | 'prefersSource'>;
};

export type HookContext = Pick<ReconcileInput, 'content' | 'state' | 'source' | 'today'>;

function failureReason(error: unknown, savedPages = false): string {
	if (error instanceof FetchError) {
		if (/not in the cache/.test(error.message)) return savedPages ? 'page not saved' : 'not in cache';
		if (/robots\.txt/.test(error.message)) return 'disallowed by robots.txt';
		if (error.status) return `HTTP ${error.status}`;
	}
	return (error as Error).message;
}

export async function runImport(options: RunOptions): Promise<RunReport> {
	const { root, dryRun = false, yes = false } = options;
	const now = options.now ?? (() => new Date());
	const log = options.log ?? (() => {});
	const started = now();
	const today = started.toISOString().slice(0, 10);

	const state = await loadState(root);
	const source = state.sources.find((s) => s.id === options.source);
	if (!source) throw new Error(`Unknown source "${options.source}" (see import/sources.json)`);
	// A saved-pages source is never requested: its pages come from `add-pages` (004, R3).
	const savedPages = source.access === 'saved-pages';
	const offline = savedPages || options.offline === true;
	if (savedPages) log(`source ${source.id}: saved pages only, no request is sent`);
	const hymnals = options.hymnals ?? source.hymnals;
	for (const h of hymnals) {
		if (!source.hymnals.includes(h)) {
			throw new Error(`Source "${source.id}" does not cover hymnal "${h}" (import/sources.json)`);
		}
	}

	const report: RunReport = {
		runId: runIdOf(started),
		startedAt: started.toISOString(),
		finishedAt: started.toISOString(),
		args: { source: source.id, hymnals, offline, dryRun },
		perSource: { [source.id]: { status: 'ok', pages: 0, failures: 0, reasons: {} } },
		perHymnal: Object.fromEntries(hymnals.map((h) => [h, emptyHymnalReport()]))
	};
	const status = report.perSource[source.id];
	const finish = async () => {
		report.finishedAt = now().toISOString();
		await writeReport(root, report);
		return report;
	};

	if (source.permission === 'refused') {
		status.status = 'skipped-permission';
		status.message = `Permission refused by ${source.name}: nothing fetched.`;
		log(status.message);
		return finish();
	}
	if (source.permission === 'unknown' && !yes) {
		status.status = 'skipped-permission';
		status.message =
			`The permission of ${source.name} is unknown (import/sources.json). ` +
			'Check its terms of use, then run again with --yes.';
		log(`⚠ ${status.message}`);
		return finish();
	}
	if (source.permission === 'unknown') {
		log(`⚠ The permission of ${source.name} is unknown: nothing will be published until rights are recorded.`);
	}

	const content = await loadContentIndex(root);
	const adapter = options.adapter ?? getAdapter(source.id);
	const fetcher = createFetcher({
		source,
		cacheDir: join(root, CACHE_DIR, source.id),
		offline,
		contact: options.contact ?? getContact(),
		fetchImpl: options.fetchImpl,
		sleep: options.sleep,
		log,
		...(options.now ? { now: () => now().getTime() } : {})
	});
	const ctx = { fetch: fetcher.fetch, log };

	// 1. List every hymnal; a listing that fails stops the source.
	const refs = [];
	for (const hymnal of hymnals) {
		try {
			const listed = await adapter.listEntries(hymnal, ctx);
			log(`${hymnal}: ${listed.length} hymns listed`);
			refs.push(...listed);
		} catch (error) {
			status.status = 'unreachable';
			status.message = `Listing of ${hymnal} failed: ${failureReason(error, savedPages)}`;
			log(`✗ ${status.message}`);
			return finish();
		}
	}

	// 2. Fetch and parse every page, in memory.
	const outcomes: Outcome[] = [];
	for (const [i, ref] of refs.entries()) {
		let outcome: Outcome;
		try {
			const page = await fetcher.fetchPage(ref.url);
			const parsed = adapter.parseHymn(page.body, ref);
			if (!parsed.ok) {
				outcome = { ref, ok: false, reason: parsed.reason };
			} else {
				const checked = RawHymnSchema.safeParse(parsed.hymn);
				outcome = checked.success
					? { ref, ok: true, hymn: { ...checked.data, retrievedAt: page.meta.retrievedAt.slice(0, 10) } }
					: { ref, ok: false, reason: `invalid extraction: ${checked.error.issues[0].message}` };
			}
		} catch (error) {
			outcome = { ref, ok: false, reason: failureReason(error, savedPages) };
		}
		if (!outcome.ok) {
			status.failures += 1;
			status.reasons[outcome.reason] = (status.reasons[outcome.reason] ?? 0) + 1;
		}
		outcomes.push(outcome);
		if ((i + 1) % 50 === 0) log(`${i + 1}/${refs.length} pages`);
	}
	status.pages = refs.length;

	// 3. FR-024: too many failures → nothing is written for this source.
	if (refs.length > 0 && status.failures / refs.length > MAX_FAILURE_SHARE) {
		status.status = 'aborted';
		status.message = `${status.failures} of ${refs.length} pages failed (more than ${MAX_FAILURE_SHARE * 100} %): nothing was written. The site's layout may have changed.`;
		log(`✗ ${status.message}`);
		for (const o of outcomes) {
			if (!o.ok) report.perHymnal[o.ref.hymnal].skipped.push({ number: o.ref.number, url: o.ref.url, reason: o.reason });
		}
		return finish();
	}

	// 4. Plan, check, write.
	const pending = await loadPending(root);
	const hooks = options.hooks?.({ content, state, source, today }) ?? {};
	const plan = reconcile({ source, hymnals, outcomes, content, state, pending, today, ...hooks });
	report.perHymnal = plan.perHymnal;

	const invalid = plan.hymns.filter((h) => !HymnSchema.safeParse(h).success);
	const errors = validateAfter(content, { write: plan.hymns });
	if (invalid.length > 0 || errors.length > 0) {
		status.status = 'invalid';
		status.message = `The planned content does not validate; nothing was written:\n${errors.join('\n')}`;
		log(`✗ ${status.message}`);
		return finish();
	}

	const after = new Map(content.hymns);
	for (const hymn of plan.hymns) after.set(hymn.id, hymn);
	report.rights = rightsSummary(after.values(), hymnals);

	if (!dryRun) {
		for (const hymn of plan.hymns) await writeHymn(root, hymn);
		for (const change of plan.pending) await savePending(root, change);
		for (const stale of plan.stalePending) await removePending(root, stale.hymnId, stale.source);
		await saveState(root, { ...state, links: plan.links });
	}
	return finish();
}

export type { Matcher };
