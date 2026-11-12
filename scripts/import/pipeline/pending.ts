/**
 * Pending changes (research R6, FR-011): the source text of a linked hymn changed. Content is
 * only rewritten when the maintainer accepts the change.
 */
import { createPatch } from 'diff';
import type { Hymn, Section } from '../../../src/lib/domain/schema';
import type { FetchedHymn } from '../sources/types';
import {
	loadPending,
	loadState,
	removePending,
	saveState,
	type ImportState,
	type Link,
	type PendingChange
} from '../store/state';
import {
	entryKey,
	loadContentIndex,
	tidyEntryTitles,
	validateAfter,
	writeHymn
} from './content';

/** Text compared in a pending change: title, then each section with its label. */
export function hymnText(hymn: { title: string; sections: Section[] }): string {
	const lines = [hymn.title];
	for (const s of hymn.sections) {
		lines.push('', `[${s.type}${s.number === null ? '' : ` ${s.number}`}]`, ...s.lines);
	}
	return lines.join('\n') + '\n';
}

export function createPendingChange(
	current: Hymn,
	link: Link,
	proposed: FetchedHymn,
	newFingerprint: string,
	today: string
): PendingChange {
	return {
		hymnId: current.id,
		source: link.source,
		hymnal: link.hymnal,
		number: link.number,
		detectedAt: today,
		oldFingerprint: link.acceptedFingerprint,
		newFingerprint,
		diff: createPatch(`${current.id}.json`, hymnText(current), hymnText(proposed), 'actuel', 'source'),
		proposed
	};
}

/* ------------------------------------------------------- accept / reject */

async function findPending(root: string, hymnId: string, source?: string) {
	const all = (await loadPending(root)).filter(
		(p) => p.hymnId === hymnId && (source === undefined || p.source === source)
	);
	if (all.length === 0) throw new Error(`No pending change for "${hymnId}"`);
	if (all.length > 1) {
		throw new Error(
			`Several pending changes for "${hymnId}" (sources: ${all.map((p) => p.source).join(', ')}); use --source`
		);
	}
	return all[0];
}

function updateLink(state: ImportState, change: PendingChange) {
	const link = state.links.find(
		(l) => l.source === change.source && entryKey(l.hymnal, l.number) === entryKey(change.hymnal, change.number)
	);
	if (!link) throw new Error(`No link for ${change.source} ${change.hymnal} ${change.number}`);
	link.acceptedFingerprint = change.newFingerprint;
	return link;
}

/**
 * Applies a pending change: the hymn's title, sections and credits become the source's, and
 * its retrieval date is updated. Corrections stay in the log. When the change comes from a
 * source that is not the hymn's reference text (an alternate source after a merge), only the
 * fingerprint is updated.
 */
export async function acceptChange(root: string, hymnId: string, source?: string) {
	const change = await findPending(root, hymnId, source);
	const state = await loadState(root);
	const content = await loadContentIndex(root);
	const current = content.hymns.get(hymnId);
	if (!current) throw new Error(`Hymn "${hymnId}" does not exist`);
	const link = updateLink(state, change);
	const { proposed } = change;
	let next: Hymn = current;
	if (current.source.url === link.url || current.source.url === proposed.url) {
		next = {
			...current,
			title: proposed.title,
			// The source's entry takes the new title; the other entries keep the title they
			// print (HymnalEntry.title).
			entries: tidyEntryTitles(
				current.entries.map((e) =>
					entryKey(e.hymnal, e.number) === entryKey(link.hymnal, link.number)
						? { hymnal: e.hymnal, number: e.number }
						: { ...e, title: e.title ?? current.title }
				),
				proposed.title
			),
			sections: proposed.sections,
			credits: proposed.credits,
			source: { ...current.source, url: proposed.url, retrievedAt: proposed.retrievedAt }
		};
		const errors = validateAfter(content, { write: [next] });
		if (errors.length > 0) throw new Error(`The change does not validate:\n  ${errors.join('\n  ')}`);
		await writeHymn(root, next);
	}
	await saveState(root, state);
	await removePending(root, change.hymnId, change.source);
	return { change, hymn: next };
}

/** Dismisses a pending change: the stored text stays; the source text is not proposed again. */
export async function rejectChange(root: string, hymnId: string, source?: string) {
	const change = await findPending(root, hymnId, source);
	const state = await loadState(root);
	updateLink(state, change);
	await saveState(root, state);
	await removePending(root, change.hymnId, change.source);
	return change;
}
