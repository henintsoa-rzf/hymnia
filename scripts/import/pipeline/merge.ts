/**
 * Maintainer decisions on duplicates (FR-015, FR-016, FR-026): `merge a b` folds hymn b into
 * hymn a now; `distinct a b` records that they are different hymns. Both are kept in
 * import/decisions/merges.json and applied on every later run.
 */
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { Hymn, Rights } from '../../../src/lib/domain/schema';
import {
	loadPending,
	loadState,
	PENDING_DIR,
	pendingFile,
	saveState,
	type ImportState,
	type MergeDecision
} from '../store/state';
import {
	deleteHymn,
	loadContentIndex,
	tidyEntryTitles,
	validateAfter,
	writeHymn,
	writeRedirects,
	type ContentIndex
} from './content';
import { applyRights } from './rights';

const RIGHTS_ORDER: Rights[] = ['unconfirmed', 'confirmed', 'public-domain'];

/** Source ids ranked for a hymnal in source-priority.json (none: no preference). */
export function sourceRank(state: ImportState, hymnal: string): string[] {
	return state.priority[hymnal] ?? [];
}

/**
 * True when `candidate` ranks above `current` for this hymnal (FR-017). A hymnal with no
 * priority in source-priority.json prefers no source: the current reference text stays (a hymn
 * of JEM and Célébrons Dieu keeps its jemaf.fr text when conducteurdelouange.com adds CD).
 */
export function prefersSource(state: ImportState) {
	return (hymnal: string, current: string, candidate: string) => {
		const rank = sourceRank(state, hymnal);
		const c = rank.indexOf(candidate);
		const k = rank.indexOf(current);
		return c !== -1 && (k === -1 || c < k);
	};
}

/** The source id a hymn's reference text comes from, through its links. */
export function sourceOf(hymn: Hymn, state: ImportState): string | undefined {
	return state.links.find((l) => l.hymnId === hymn.id && l.url === hymn.source.url)?.source;
}

function record(state: ImportState, a: string, b: string, decision: MergeDecision['decision'], date: string) {
	const [x, y] = a < b ? [a, b] : [b, a];
	state.merges = state.merges.filter((m) => !(m.a === x && m.b === y));
	state.merges.push({ a: x, b: y, decision, date });
}

/** The merged hymn: a's entries then b's, reference text from the preferred source. */
export function mergedHymn(a: Hymn, b: Hymn, state: ImportState): Hymn {
	const prefer = prefersSource(state);
	const sourceA = sourceOf(a, state) ?? '';
	const sourceB = sourceOf(b, state) ?? '';
	const useB = sourceB !== '' && b.entries.some((e) => prefer(e.hymnal, sourceA, sourceB));
	const [text, other] = useB ? [b, a] : [a, b];
	// Every entry keeps the title its hymnal prints (HymnalEntry.title).
	const titled = (h: Hymn) => h.entries.map((e) => ({ ...e, title: e.title ?? h.title }));
	const entries = titled(a);
	for (const e of titled(b)) {
		if (!entries.some((x) => x.hymnal === e.hymnal && x.number === e.number)) entries.push(e);
	}
	const alternateSources = [
		...(text.alternateSources ?? []),
		other.source,
		...(other.alternateSources ?? [])
	].filter((s, i, all) => all.findIndex((x) => x.name === s.name && x.url === s.url) === i);
	const rights = RIGHTS_ORDER[Math.max(RIGHTS_ORDER.indexOf(a.rights), RIGHTS_ORDER.indexOf(b.rights))];
	return {
		id: a.id,
		title: text.title,
		entries: tidyEntryTitles(entries, text.title),
		sections: text.sections,
		credits: text.credits.length > 0 ? text.credits : other.credits,
		source: text.source,
		rights,
		corrections: text.corrections,
		alternateSources
	};
}

export async function mergeHymns(root: string, aId: string, bId: string, today: string) {
	if (aId === bId) throw new Error('Cannot merge a hymn with itself');
	const content: ContentIndex = await loadContentIndex(root);
	const state = await loadState(root);
	const a = content.hymns.get(aId);
	const b = content.hymns.get(bId);
	if (!a) throw new Error(`Hymn "${aId}" does not exist`);
	if (!b) throw new Error(`Hymn "${bId}" does not exist`);

	const merged = mergedHymn(a, b, state);
	for (const link of state.links) if (link.hymnId === bId) link.hymnId = aId;
	const [rights] = applyRights([merged], state.rights, state.links);
	if (rights) merged.rights = rights.rights;
	const redirects = { ...content.redirects };
	for (const [from, to] of Object.entries(redirects)) if (to === bId) redirects[from] = aId;
	redirects[bId] = aId;

	const errors = validateAfter(content, { write: [merged], remove: [bId], redirects });
	if (errors.length > 0) throw new Error(`The merge does not validate:\n  ${errors.join('\n  ')}`);

	record(state, aId, bId, 'merge', today);

	// Pending changes of b now concern a.
	for (const p of await loadPending(root)) {
		if (p.hymnId !== bId) continue;
		await rename(
			join(root, PENDING_DIR, pendingFile(bId, p.source)),
			join(root, PENDING_DIR, pendingFile(aId, p.source))
		).catch(() => {});
	}

	await writeHymn(root, merged);
	await writeRedirects(root, redirects);
	await saveState(root, state);
	await deleteHymn(root, bId);
	return merged;
}

export async function markDistinct(root: string, aId: string, bId: string, today: string) {
	if (aId === bId) throw new Error('A hymn is not distinct from itself');
	const content = await loadContentIndex(root);
	for (const id of [aId, bId]) if (!content.hymns.has(id)) throw new Error(`Hymn "${id}" does not exist`);
	const state = await loadState(root);
	record(state, aId, bId, 'distinct', today);
	await saveState(root, state);
}
