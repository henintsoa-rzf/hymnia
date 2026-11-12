/**
 * Reconciliation (research R6): turns what was extracted from a source into planned writes.
 * Nothing is written here; run.ts applies the plan.
 *
 * For each extracted hymn:
 * - linked, same fingerprint → unchanged (no write);
 * - linked, new fingerprint → pending change (content changes only on `accept`);
 * - not linked, its hymnal + number already owned by a hymn with the same text → adopted;
 *   owned by a hymn with other text → conflict (nothing written);
 * - not linked, free → new hymn (or attached to an existing one by matching, US3).
 * Linked entries no longer listed at the source → missing (never deleted).
 */
import type { Hymn, Rights } from '../../../src/lib/domain/schema';
import type { DuplicateItem, HymnalReport } from '../report';
import { emptyHymnalReport } from '../report';
import type { EntryRef, FetchedHymn } from '../sources/types';
import type { ImportState, Link, PendingChange, SourceConfig } from '../store/state';
import { entryKey, tidyEntryTitles, type ContentIndex } from './content';
import { fingerprint } from './fingerprint';
import { newHymnId } from './ids';
import { createPendingChange } from './pending';

export type Outcome =
	| { ref: EntryRef; ok: true; hymn: FetchedHymn }
	| { ref: EntryRef; ok: false; reason: string };

/** Matching hook (US3): which existing hymn, if any, the extracted hymn is. */
export type MatchResult =
	| { kind: 'merge'; hymnId: string }
	| { kind: 'possible'; candidates: DuplicateItem[] }
	| { kind: 'distinct' };
export type Matcher = (hymn: FetchedHymn, newId: string) => MatchResult;

export type ReconcileInput = {
	source: SourceConfig;
	/** Hymnals whose listing was read completely (missing entries are only detected there). */
	hymnals: string[];
	outcomes: Outcome[];
	content: ContentIndex;
	state: ImportState;
	pending: PendingChange[];
	today: string;
	match?: Matcher;
	/** Tells the matcher about hymns created during the run. */
	remember?: (hymn: Hymn) => void;
	/** Whether an extracted hymn is the same hymn as an existing one (another source). */
	sameHymn?: (raw: FetchedHymn, hymn: Hymn) => boolean;
	/** Rights of a new or changed hymn (US4). Default: unconfirmed. */
	rightsFor?: (hymn: Hymn) => { rights: Rights; inherited: boolean };
	/** Whether a hymn's source should be the reference text (source priority, US3). */
	prefersSource?: (hymnal: string, current: string, candidate: string) => boolean;
};

export type Plan = {
	/** Hymn files to write (new, or existing hymns gaining an entry). */
	hymns: Hymn[];
	links: Link[];
	pending: PendingChange[];
	/** Pending changes that no longer apply (the source went back to the accepted text). */
	stalePending: { hymnId: string; source: string }[];
	perHymnal: Record<string, HymnalReport>;
};

const linkKey = (source: string, hymnal: string, number: string) =>
	`${source} ${entryKey(hymnal, number)}`;

export function newHymn(id: string, raw: FetchedHymn, source: SourceConfig): Hymn {
	return {
		id,
		title: raw.title,
		entries: [{ hymnal: raw.hymnal, number: raw.number }],
		sections: raw.sections,
		credits: raw.credits,
		source: { name: source.name, url: raw.url, retrievedAt: raw.retrievedAt },
		rights: 'unconfirmed',
		corrections: []
	};
}

export function reconcile(input: ReconcileInput): Plan {
	const { source, content, state, today } = input;
	const perHymnal: Record<string, HymnalReport> = {};
	const report = (hymnal: string) => (perHymnal[hymnal] ??= emptyHymnalReport());
	for (const h of input.hymnals) report(h);

	const links = state.links.map((l) => ({ ...l }));
	const byKey = new Map(links.map((l) => [linkKey(l.source, l.hymnal, l.number), l]));
	const writes = new Map<string, Hymn>();
	const pending: PendingChange[] = [];
	const stalePending: Plan['stalePending'] = [];
	const taken = content.takenIds();
	const plannedOwners = new Map<string, string>();
	const seen = new Set<string>();

	const hymnById = (id: string) => writes.get(id) ?? content.hymns.get(id);
	const ownerOf = (hymnal: string, number: string) =>
		plannedOwners.get(entryKey(hymnal, number)) ?? content.owner(hymnal, number);

	for (const outcome of input.outcomes) {
		const { ref } = outcome;
		const r = report(ref.hymnal);
		if (!outcome.ok) {
			r.skipped.push({ number: ref.number, url: ref.url, reason: outcome.reason });
			continue;
		}
		const raw = outcome.hymn;
		const key = linkKey(source.id, raw.hymnal, raw.number);
		seen.add(key);
		const fp = fingerprint(raw);
		for (const [kind, n] of Object.entries(raw.strippedMarkup)) {
			r.strippedMarkup[kind] = (r.strippedMarkup[kind] ?? 0) + n;
		}
		if (raw.unknownCredits.length > 0) {
			r.unknownCredits.push({ number: raw.number, labels: raw.unknownCredits });
		}
		const item = (hymnId: string) => ({ number: raw.number, hymnId, title: raw.title });

		const link = byKey.get(key);
		if (link) {
			const current = hymnById(link.hymnId);
			if (!current) {
				r.conflicts.push({ number: raw.number, reason: `linked hymn "${link.hymnId}" not found` });
				continue;
			}
			if (link.status === 'missing') link.status = 'active';
			if (link.lastSeenAt !== today) link.lastSeenAt = today;
			link.url = raw.url;
			if (fp === link.acceptedFingerprint) {
				r.unchanged.push(item(link.hymnId));
				if (input.pending.some((p) => p.hymnId === link.hymnId && p.source === source.id)) {
					stalePending.push({ hymnId: link.hymnId, source: source.id });
				}
				continue;
			}
			const existing = input.pending.find(
				(p) => p.hymnId === link.hymnId && p.source === source.id && p.newFingerprint === fp
			);
			pending.push(existing ?? createPendingChange(current, link, raw, fp, today));
			r.changed.push(item(link.hymnId));
			continue;
		}

		/** Adds this source's entry (if new) and text to an existing hymn. */
		const attach = (targetId: string) => {
			const target = hymnById(targetId)!;
			const hasEntry = target.entries.some(
				(e) => entryKey(e.hymnal, e.number) === entryKey(raw.hymnal, raw.number)
			);
			const updated: Hymn = {
				...target,
				entries: hasEntry
					? target.entries
					: [...target.entries, { hymnal: raw.hymnal, number: raw.number }]
			};
			const otherSource = { name: source.name, url: raw.url, retrievedAt: raw.retrievedAt };
			const switches = input.prefersSource?.(
				raw.hymnal,
				sourceIdOf(target, state, links),
				source.id
			);
			// Each hymnal keeps the title it prints (HymnalEntry.title): the new entry gets this
			// page's title; when the reference text changes, the other entries keep the old one.
			const isNew = (e: { hymnal: string; number: string }) =>
				entryKey(e.hymnal, e.number) === entryKey(raw.hymnal, raw.number);
			updated.entries = updated.entries.map((e) =>
				isNew(e) && (!hasEntry || switches)
					? { hymnal: e.hymnal, number: e.number, title: raw.title }
					: switches && !e.title
						? { ...e, title: target.title }
						: e
			);
			if (switches) {
				updated.title = raw.title;
				updated.sections = raw.sections;
				updated.credits = raw.credits.length > 0 ? raw.credits : target.credits;
				updated.source = otherSource;
				updated.alternateSources = [...(target.alternateSources ?? []), target.source];
			} else {
				updated.alternateSources = [...(target.alternateSources ?? []), otherSource];
			}
			updated.entries = tidyEntryTitles(updated.entries, updated.title);
			const rights = input.rightsFor?.(updated);
			if (rights) updated.rights = rights.rights;
			writes.set(updated.id, updated);
			// The matcher must see the new entry: a hymnal never holds the same hymn twice.
			input.remember?.(updated);
			plannedOwners.set(entryKey(raw.hymnal, raw.number), updated.id);
			const created = newLink(source.id, raw, updated.id, fp, today);
			links.push(created);
			byKey.set(key, created);
			r.autoMerged.push(item(updated.id));
		};

		const owner = ownerOf(raw.hymnal, raw.number);
		if (owner) {
			const ownerHymn = hymnById(owner);
			if (ownerHymn && fingerprint(ownerHymn) === fp) {
				// Already in content (e.g. written by an interrupted run, or another source with the
				// same text): link it.
				const adopted = newLink(source.id, raw, owner, fp, today);
				links.push(adopted);
				byKey.set(key, adopted);
				r.unchanged.push(item(owner));
			} else if (ownerHymn && input.sameHymn?.(raw, ownerHymn)) {
				// The same hymn from another source: an alternate source (FR-017).
				attach(owner);
			} else {
				r.conflicts.push({
					number: raw.number,
					reason: `${raw.hymnal} ${raw.number} is already used by "${owner}" with another text`
				});
			}
			continue;
		}

		const id = newHymnId(raw.title, raw.hymnal, raw.number, taken);
		const match = input.match?.(raw, id) ?? { kind: 'distinct' };
		if (match.kind === 'merge') {
			attach(match.hymnId);
			continue;
		}

		const hymn = newHymn(id, raw, source);
		const rights = input.rightsFor?.(hymn);
		if (rights) {
			hymn.rights = rights.rights;
			if (rights.inherited && rights.rights !== 'unconfirmed') r.rightsInherited.push(item(id));
		}
		taken.add(id);
		writes.set(id, hymn);
		input.remember?.(hymn);
		plannedOwners.set(entryKey(raw.hymnal, raw.number), id);
		const created = newLink(source.id, raw, id, fp, today);
		links.push(created);
		byKey.set(key, created);
		r.new.push(item(id));
		if (raw.credits.length === 0) r.noCredits.push(item(id));
		if (match.kind === 'possible') r.possibleDuplicates.push(...match.candidates);
	}

	for (const link of links) {
		if (link.source !== source.id || !input.hymnals.includes(link.hymnal)) continue;
		if (seen.has(linkKey(link.source, link.hymnal, link.number))) continue;
		if (link.status !== 'missing') link.status = 'missing';
		report(link.hymnal).missing.push({
			number: link.number,
			hymnId: link.hymnId,
			title: hymnById(link.hymnId)?.title
		});
	}

	return { hymns: [...writes.values()], links, pending, stalePending, perHymnal };
}

function newLink(source: string, raw: FetchedHymn, hymnId: string, fp: string, today: string): Link {
	return {
		source,
		hymnal: raw.hymnal,
		number: raw.number,
		hymnId,
		url: raw.url,
		acceptedFingerprint: fp,
		status: 'active',
		lastSeenAt: today
	};
}

/** The source id the hymn's reference text comes from (from its links), or '' if unknown. */
function sourceIdOf(hymn: Hymn, state: ImportState, links: Link[]): string {
	const link = [...links, ...state.links].find((l) => l.hymnId === hymn.id && l.url === hymn.source.url);
	return link?.source ?? '';
}
