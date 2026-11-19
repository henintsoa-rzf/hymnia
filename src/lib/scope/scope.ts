/**
 * Hymnals and parts the user leaves out in Settings (specs/014-hymnal-scope-settings,
 * contracts/scope.md §1). Stored as what is left out, so a hymnal or a part added later is in use
 * by default (research R1). A part is keyed by its `first` number.
 *
 * Pure: used by the screens, the search worker and Node tests.
 */
import { NO_NUMBER } from '../domain/numbering';
import type { Hymnal, SortKey } from '../domain/schema';

export type Exclusions = {
	/** Hymnal ids left out entirely. */
	hymnals: string[];
	/** Hymnal id → `first` number of each part left out, for hymnals still partly in use. */
	parts: Record<string, number[]>;
};

export const NO_EXCLUSIONS: Exclusions = Object.freeze({
	hymnals: Object.freeze([]) as unknown as string[],
	parts: Object.freeze({}) as Record<string, number[]>
});

export type HymnalState = 'all' | 'some' | 'none';

type ScopeHymnal = Pick<Hymnal, 'id' | 'parts'>;
type EntryLike = { hymnal: string; sortKey: SortKey };

export type Scope = {
	/** Nothing is left out: every check is true. */
	isEmpty: boolean;
	hymnalState(hymnalId: string): HymnalState;
	includesPart(hymnalId: string, first: number): boolean;
	includesEntry(entry: EntryLike): boolean;
	includesHymn(hymn: { entries: EntryLike[] }): boolean;
	/** False when leaving `target` out would leave nothing in use. */
	canLeaveOut(target: { hymnal: string; part?: number }): boolean;
};

const unique = <T>(values: T[]) => [...new Set(values)];
const isEmptyChoice = (e: Exclusions) =>
	e.hymnals.length === 0 && Object.keys(e.parts).length === 0;

/** Type check only (stored value). */
export function sanitizeExclusions(value: unknown): Exclusions {
	if (!value || typeof value !== 'object') return NO_EXCLUSIONS;
	const v = value as { hymnals?: unknown; parts?: unknown };
	const hymnals = Array.isArray(v.hymnals)
		? unique(v.hymnals.filter((x): x is string => typeof x === 'string'))
		: [];
	const parts: Record<string, number[]> = {};
	if (v.parts && typeof v.parts === 'object' && !Array.isArray(v.parts)) {
		for (const [id, list] of Object.entries(v.parts)) {
			if (!Array.isArray(list)) continue;
			const firsts = unique(list.filter((n): n is number => Number.isInteger(n) && n > 0));
			if (firsts.length) parts[id] = firsts;
		}
	}
	return hymnals.length || Object.keys(parts).length ? { hymnals, parts } : NO_EXCLUSIONS;
}

/** Steps 1–3 of the normal form; `null` when nothing would be left in use. */
function normalise(excluded: Exclusions, hymnals: ScopeHymnal[]): Exclusions | null {
	const out: Exclusions = { hymnals: [], parts: {} };
	let inUse = 0;
	for (const h of hymnals) {
		if (excluded.hymnals.includes(h.id)) {
			out.hymnals.push(h.id);
			continue;
		}
		const firsts = (h.parts ?? []).map((p) => p.first);
		const left = firsts.filter((f) => excluded.parts[h.id]?.includes(f));
		if (firsts.length > 0 && left.length === firsts.length) {
			out.hymnals.push(h.id);
			continue;
		}
		inUse++;
		if (left.length) out.parts[h.id] = left;
	}
	return inUse === 0 ? null : out;
}

/** Normal form against the catalog's hymnals (data-model.md). */
export function cleanExclusions(excluded: Exclusions, hymnals: ScopeHymnal[]): Exclusions {
	const out = normalise(excluded, hymnals);
	return !out || isEmptyChoice(out) ? NO_EXCLUSIONS : out;
}

const ALL: Scope = {
	isEmpty: true,
	hymnalState: () => 'all',
	includesPart: () => true,
	includesEntry: () => true,
	includesHymn: () => true,
	canLeaveOut: () => true
};

export function createScope(excluded: Exclusions | undefined, hymnals: ScopeHymnal[]): Scope {
	if (!excluded || isEmptyChoice(excluded)) return withLeaveOut(ALL, NO_EXCLUSIONS, hymnals);
	const choice = cleanExclusions(excluded, hymnals);
	if (isEmptyChoice(choice)) return withLeaveOut(ALL, NO_EXCLUSIONS, hymnals);

	const none = new Set(choice.hymnals);
	const parts = new Map(hymnals.map((h) => [h.id, h.parts ?? []]));
	const leftParts = new Map(Object.entries(choice.parts).map(([id, f]) => [id, new Set(f)]));

	const hymnalState = (id: string): HymnalState =>
		none.has(id) ? 'none' : leftParts.has(id) ? 'some' : 'all';

	const includesEntry = ({ hymnal, sortKey }: EntryLike) => {
		if (none.has(hymnal)) return false;
		const left = leftParts.get(hymnal);
		if (!left) return true;
		const list = parts.get(hymnal) ?? [];
		const n = sortKey[0];
		if (n === NO_NUMBER || list.length === 0 || n < list[0].first) return true;
		const part = list.findLast((p) => p.first <= n)!;
		return !left.has(part.first);
	};

	const scope: Scope = {
		isEmpty: false,
		hymnalState,
		includesPart: (id, first) => !none.has(id) && !leftParts.get(id)?.has(first),
		includesEntry,
		includesHymn: (hymn) => hymn.entries.some(includesEntry),
		canLeaveOut: () => true
	};
	return withLeaveOut(scope, choice, hymnals);
}

function withLeaveOut(scope: Scope, choice: Exclusions, hymnals: ScopeHymnal[]): Scope {
	const leaveOut = ({ hymnal, part }: { hymnal: string; part?: number }) =>
		part === undefined
			? withHymnal(choice, hymnal, false)
			: withPart(choice, hymnals, hymnal, part, false);
	return { ...scope, canLeaveOut: (target) => normalise(leaveOut(target), hymnals) !== null };
}

function withHymnal(e: Exclusions, id: string, inUse: boolean): Exclusions {
	const parts = { ...e.parts };
	delete parts[id];
	const others = e.hymnals.filter((h) => h !== id);
	return { hymnals: inUse ? others : [...others, id], parts };
}

function withPart(
	e: Exclusions,
	hymnals: ScopeHymnal[],
	id: string,
	first: number,
	inUse: boolean
): Exclusions {
	// A hymnal left out entirely has every part out.
	const all = (hymnals.find((h) => h.id === id)?.parts ?? []).map((p) => p.first);
	const current = e.hymnals.includes(id) ? all : (e.parts[id] ?? []);
	const list = inUse ? current.filter((f) => f !== first) : unique([...current, first]);
	const parts = { ...e.parts };
	if (list.length) parts[id] = list;
	else delete parts[id];
	return { hymnals: e.hymnals.filter((h) => h !== id), parts };
}

/** Settings action: select all of a hymnal, or leave it out. Returns the normal form. */
export function setHymnal(
	excluded: Exclusions,
	hymnals: ScopeHymnal[],
	id: string,
	inUse: boolean
): Exclusions {
	const next = withHymnal(excluded, id, inUse);
	if (!inUse && normalise(next, hymnals) === null) return excluded;
	return cleanExclusions(next, hymnals);
}

/** Settings action: select a part, or leave it out. Returns the normal form. */
export function setPart(
	excluded: Exclusions,
	hymnals: ScopeHymnal[],
	id: string,
	first: number,
	inUse: boolean
): Exclusions {
	const next = withPart(excluded, hymnals, id, first, inUse);
	if (!inUse && normalise(next, hymnals) === null) return excluded;
	return cleanExclusions(next, hymnals);
}
