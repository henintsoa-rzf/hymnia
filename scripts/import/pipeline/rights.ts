/**
 * Rights decisions (FR-006, FR-019, FR-020; data-model "Derived values").
 *
 * The most specific decision wins: hymn, then its hymnals, then its sources. `permission` and
 * `licence` give `confirmed`, `public-domain` gives `public-domain`, `refused` or no decision
 * gives `unconfirmed`. A hymn in several hymnals (or from several sources) is covered when
 * any of them is.
 *
 * Only imported hymns (with a link) and hymns with a decision of their own are ever changed:
 * other hymns keep the rights written in their file (e.g. the public-domain sample hymns).
 */
import type { Hymn, Rights } from '../../../src/lib/domain/schema';
import {
	loadState,
	saveState,
	validateState,
	type Link,
	type RightsDecision
} from '../store/state';
import { loadContentIndex, validateAfter, writeHymn } from './content';

export type ComputedRights = { rights: Rights; inherited: boolean };

const fromBasis = (basis: RightsDecision['basis']): Rights =>
	basis === 'public-domain' ? 'public-domain' : basis === 'refused' ? 'unconfirmed' : 'confirmed';

/** Decisions of one scope for these targets: covered (best basis), refused, or none. */
function decide(decisions: RightsDecision[], scope: RightsDecision['scope'], targets: string[]) {
	const found = decisions.filter((d) => d.scope === scope && targets.includes(d.target));
	if (found.length === 0) return undefined;
	const covered = found.filter((d) => d.basis !== 'refused');
	if (covered.length === 0) return 'unconfirmed' as Rights;
	return covered.some((d) => d.basis === 'public-domain') ? 'public-domain' : 'confirmed';
}

export function computeRights(
	hymn: Hymn,
	decisions: RightsDecision[],
	sources: string[]
): ComputedRights {
	const own = decisions.find((d) => d.scope === 'hymn' && d.target === hymn.id);
	if (own) return { rights: fromBasis(own.basis), inherited: false };
	const hymnals = [...new Set(hymn.entries.map((e) => e.hymnal))];
	const byHymnal = decide(decisions, 'hymnal', hymnals);
	if (byHymnal) return { rights: byHymnal, inherited: true };
	const bySource = decide(decisions, 'source', sources);
	if (bySource) return { rights: bySource, inherited: true };
	return { rights: 'unconfirmed', inherited: false };
}

const sourcesOf = (hymnId: string, links: Link[]) =>
	[...new Set(links.filter((l) => l.hymnId === hymnId).map((l) => l.source))];

/** Hymns whose rights change under these decisions, with only `rights` changed. */
export function applyRights(hymns: Hymn[], decisions: RightsDecision[], links: Link[]): Hymn[] {
	const changed: Hymn[] = [];
	for (const hymn of hymns) {
		const sources = sourcesOf(hymn.id, links);
		const own = decisions.some((d) => d.scope === 'hymn' && d.target === hymn.id);
		if (sources.length === 0 && !own) continue;
		const { rights } = computeRights(hymn, decisions, sources);
		if (rights !== hymn.rights) changed.push({ ...hymn, rights });
	}
	return changed;
}

/** `rightsFor` hook for reconciliation: the hymn being written comes from `source`. */
export function rightsHook(decisions: RightsDecision[], links: Link[], source: string) {
	return (hymn: Hymn) =>
		computeRights(hymn, decisions, [...new Set([...sourcesOf(hymn.id, links), source])]);
}

/** Records a decision (replacing one with the same scope and target) and applies it. */
export async function setRights(root: string, decision: RightsDecision) {
	const state = await loadState(root);
	const content = await loadContentIndex(root);
	const next = {
		...state,
		rights: [
			...state.rights.filter((d) => !(d.scope === decision.scope && d.target === decision.target)),
			decision
		]
	};
	const errors = validateState(next, {
		hymnalIds: new Set(content.hymnals.map((h) => h.id)),
		hymnIds: new Set(content.hymns.keys())
	});
	if (errors.length > 0) throw new Error(errors.join('\n'));
	const changed = applyRights([...content.hymns.values()], next.rights, next.links);
	const invalid = validateAfter(content, { write: changed });
	if (invalid.length > 0) throw new Error(invalid.join('\n'));
	await saveState(root, next);
	for (const hymn of changed) await writeHymn(root, hymn);
	return changed;
}

/** Each decision with the number of hymns it currently decides. */
export async function listRights(root: string) {
	const state = await loadState(root);
	const content = await loadContentIndex(root);
	const hymns = [...content.hymns.values()];
	return state.rights.map((d) => ({
		...d,
		hymns: hymns.filter((h) => {
			const sources = sourcesOf(h.id, state.links);
			if (d.scope === 'hymn') return h.id === d.target;
			if (d.scope === 'hymnal') return (sources.length > 0) && h.entries.some((e) => e.hymnal === d.target);
			return sources.includes(d.target);
		}).length
	}));
}

/** Published / unpublished counts per hymnal, for the report. */
export function rightsSummary(hymns: Iterable<Hymn>, hymnals: string[]) {
	const summary: Record<string, { published: number; unpublished: number }> = {};
	for (const h of hymnals) summary[h] = { published: 0, unpublished: 0 };
	for (const hymn of hymns) {
		for (const hymnal of new Set(hymn.entries.map((e) => e.hymnal))) {
			if (!summary[hymnal]) continue;
			if (hymn.rights === 'unconfirmed') summary[hymnal].unpublished++;
			else summary[hymnal].published++;
		}
	}
	return summary;
}
