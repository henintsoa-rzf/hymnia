/**
 * Recognising the same hymn across hymnals and sources (research R7, FR-014 to FR-016).
 *
 * Title and lyrics are normalised with the search normalisation (no accents, case or
 * punctuation); lyrics are compared on word 3-grams with two measures:
 * - Jaccard similarity (shared / all): reported to the maintainer;
 * - containment (shared / the smaller hymn's 3-grams), with the size ratio of the two hymns:
 *   one hymnal often prints only some of the verses (À Toi la Gloire keeps 3 of 5).
 *
 * - same title, containment ≥ TITLE_MERGE_CONTAINMENT and size ratio ≥ MIN_SIZE_RATIO → merge;
 * - any title, containment ≥ MERGE_THRESHOLD and size ratio ≥ MIN_SIZE_RATIO → merge (hymnals
 *   often retitle a hymn: JEM 232 "Ma joie de t'appartenir" is ATG 42 "C'est vers toi…");
 * - same title, or Jaccard or containment ≥ POSSIBLE_THRESHOLD → possible duplicate;
 * - otherwise distinct.
 * The size ratio keeps a short chorus apart from a longer hymn that quotes it. Thresholds are
 * tuned on the first real import (research R7, tests/import/reference-duplicates.json): hymns
 * with the same title and different lyrics never shared more than 25 % of their 3-grams.
 * The maintainer's decisions (import/decisions/merges.json) are applied first. Candidates come
 * from an index of titles and of first-line 3-grams, never from comparing every pair.
 *
 * A hymn is never matched with another hymn of the same hymnal, except for lettered variants:
 * "309A" joins the hymn numbered "309" (or "309B"…) in that hymnal when the lyrics are the same
 * (similarity ≥ MERGE_THRESHOLD, whatever the title). Ailes de la Foi prints the same text
 * with another tune this way.
 */
import type { Hymn, Section } from '../../../src/lib/domain/schema';
import { normalizeText, tokenize } from '../../../src/lib/search/normalize';
import type { DuplicateItem } from '../report';
import type { FetchedHymn } from '../sources/types';
import type { MergeDecision } from '../store/state';
import { SAMPLE_HYMNALS, type ContentIndex } from './content';
import type { MatchResult } from './reconcile';

export const MERGE_THRESHOLD = 0.85;
export const TITLE_MERGE_CONTAINMENT = 0.6;
export const MIN_SIZE_RATIO = 0.4;
export const POSSIBLE_THRESHOLD = 0.5;

type Comparable = { id?: string; title: string; sections: Section[] };

const linesOf = (sections: Section[] | string[]) =>
	typeof sections[0] === 'string'
		? (sections as string[])
		: (sections as Section[]).flatMap((s) => s.lines);

function grams(words: string[], n = 3): string[] {
	if (words.length < n) return words.length > 0 ? [words.join(' ')] : [];
	return Array.from({ length: words.length - n + 1 }, (_, i) => words.slice(i, i + n).join(' '));
}

/** Word 3-grams of the lyrics, normalised. */
export function shingles(lyrics: Section[] | string[]): Set<string> {
	return new Set(grams(tokenize(linesOf(lyrics).join(' '))));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1;
	let common = 0;
	for (const g of a) if (b.has(g)) common++;
	return common / (a.size + b.size - common);
}

export type LyricsComparison = { similarity: number; containment: number; sizeRatio: number };

export function compareLyrics(a: Set<string>, b: Set<string>): LyricsComparison {
	let common = 0;
	for (const g of a) if (b.has(g)) common++;
	const small = Math.min(a.size, b.size);
	const large = Math.max(a.size, b.size);
	return {
		similarity: a.size + b.size === 0 ? 1 : common / (a.size + b.size - common),
		containment: small === 0 ? (large === 0 ? 1 : 0) : common / small,
		sizeRatio: large === 0 ? 1 : small / large
	};
}

/** Whether two compared hymns are the same hymn, without the maintainer. */
export function isAutoMerge(c: LyricsComparison, sameTitle: boolean): boolean {
	if (c.sizeRatio < MIN_SIZE_RATIO) return false;
	return c.containment >= (sameTitle ? TITLE_MERGE_CONTAINMENT : MERGE_THRESHOLD);
}

const isPossible = (c: LyricsComparison, sameTitle: boolean) =>
	sameTitle || c.similarity >= POSSIBLE_THRESHOLD || c.containment >= POSSIBLE_THRESHOLD;

const titleKey = (title: string) => normalizeText(title);
const firstLineGrams = (sections: Section[]) => {
	const first = sections.flatMap((s) => s.lines).find((l) => l.trim() !== '') ?? '';
	return grams(tokenize(first));
};
const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);

/** "309A" → "309"; null for a number with no letter suffix. */
export function variantBase(number: string): string | null {
	const m = /^0*(\d+)\s*([a-z]+)$/iu.exec(number.trim());
	return m ? m[1] : null;
}
const baseOf = (number: string) => variantBase(number) ?? /^0*(\d+)$/u.exec(number.trim())?.[1];
const variantKey = (hymnal: string, base: string) => `${hymnal} ${base}`;

/** A hymn that only exists in the fictional sample hymnals is never a match. */
const isSampleOnly = (hymn: Hymn) => hymn.entries.every((e) => SAMPLE_HYMNALS.includes(e.hymnal));

export function createMatcher(content: ContentIndex, decisions: MergeDecision[]) {
	const decided = new Map(decisions.map((d) => [pairKey(d.a, d.b), d.decision]));
	/** Ids a hymn was merged with by a decision, whatever its title or text. */
	const forcedMerges = (id: string) =>
		decisions
			.filter((d) => d.decision === 'merge' && (d.a === id || d.b === id))
			.map((d) => (d.a === id ? d.b : d.a));
	const byTitle = new Map<string, Set<string>>();
	const byGram = new Map<string, Set<string>>();
	/** "hymnal base-number" → hymns with that number or a lettered variant of it. */
	const byBase = new Map<string, Set<string>>();
	const hymns = new Map<string, Hymn>();
	const cache = new Map<string, Set<string>>();
	let compared = 0;

	const add = (map: Map<string, Set<string>>, key: string, id: string) => {
		if (!map.has(key)) map.set(key, new Set());
		map.get(key)!.add(id);
	};

	/** Adds a hymn, or updates one that gained an entry or a text, in the indexes. */
	function remember(hymn: Hymn) {
		if (isSampleOnly(hymn)) return;
		hymns.set(hymn.id, hymn);
		cache.delete(hymn.id);
		add(byTitle, titleKey(hymn.title), hymn.id);
		for (const g of firstLineGrams(hymn.sections)) add(byGram, g, hymn.id);
		for (const e of hymn.entries) {
			const base = baseOf(e.number);
			if (base) add(byBase, variantKey(e.hymnal, base), hymn.id);
		}
	}
	for (const hymn of content.hymns.values()) remember(hymn);

	const lyricsOf = (hymn: Hymn) => {
		let s = cache.get(hymn.id);
		if (!s) cache.set(hymn.id, (s = shingles(hymn.sections)));
		return s;
	};

	function candidatesFor(item: Comparable): Set<string> {
		const ids = new Set(byTitle.get(titleKey(item.title)) ?? []);
		for (const g of firstLineGrams(item.sections)) for (const id of byGram.get(g) ?? []) ids.add(id);
		if (item.id) ids.delete(item.id);
		return ids;
	}

	/** Compares one hymn with its candidates; `hymnal` excludes hymns already in that hymnal. */
	function compare(item: Comparable, itemId: string, hymnal?: string) {
		const own = shingles(item.sections);
		const results: (LyricsComparison & { id: string; sameTitle: boolean; decision?: string })[] =
			[];
		for (const id of candidatesFor({ ...item, id: itemId })) {
			const other = hymns.get(id)!;
			if (hymnal && other.entries.some((e) => e.hymnal === hymnal)) continue;
			compared++;
			results.push({
				id,
				...compareLyrics(own, lyricsOf(other)),
				sameTitle: titleKey(other.title) === titleKey(item.title),
				decision: decided.get(pairKey(id, itemId))
			});
		}
		return results.sort(
			(a, b) => b.containment - a.containment || b.similarity - a.similarity || a.id.localeCompare(b.id)
		);
	}

	function match(raw: FetchedHymn, newId: string): MatchResult {
		const forcedId = forcedMerges(newId).find((id) => {
			const other = hymns.get(id);
			return other && !other.entries.some((e) => e.hymnal === raw.hymnal);
		});
		if (forcedId) return { kind: 'merge', hymnId: forcedId };
		const variantOf = sameTextVariant(raw, newId);
		if (variantOf) return { kind: 'merge', hymnId: variantOf };
		const results = compare(raw, newId, raw.hymnal).filter((r) => r.decision !== 'distinct');
		const merge = results.find((r) => isAutoMerge(r, r.sameTitle));
		if (merge) return { kind: 'merge', hymnId: merge.id };
		const possible = results.filter((r) => isPossible(r, r.sameTitle));
		if (possible.length > 0) {
			return {
				kind: 'possible',
				candidates: possible.map((r) => duplicate(r.id, newId, r.similarity, r.sameTitle))
			};
		}
		return { kind: 'distinct' };
	}

	/** The hymn this lettered number ("309A") is a variant of, when the lyrics are the same. */
	function sameTextVariant(raw: FetchedHymn, newId: string): string | undefined {
		const base = variantBase(raw.number);
		if (!base) return undefined;
		const own = shingles(raw.sections);
		let best: { id: string; similarity: number } | undefined;
		for (const id of byBase.get(variantKey(raw.hymnal, base)) ?? []) {
			if (decided.get(pairKey(id, newId)) === 'distinct') continue;
			compared++;
			const similarity = jaccard(own, lyricsOf(hymns.get(id)!));
			if (similarity >= MERGE_THRESHOLD && (!best || similarity > best.similarity)) {
				best = { id, similarity };
			}
		}
		return best?.id;
	}

	/**
	 * For a hymnal number another source already provides: is it the same hymn? The shared
	 * number counts as a shared title: titles often differ between sites ("Ah ! qu'il est doux" /
	 * "Ah ! Qu'il est doux pour des frères").
	 */
	function sameHymn(raw: FetchedHymn, hymn: Hymn): boolean {
		return isAutoMerge(compareLyrics(shingles(raw.sections), shingles(hymn.sections)), true);
	}

	return { match, remember, sameHymn, compare, stats: () => ({ compared }) };
}

function duplicate(a: string, b: string, similarity: number, sameTitle: boolean): DuplicateItem {
	return {
		a,
		b,
		similarity: Math.round(similarity * 100) / 100,
		reason: sameTitle ? 'same title' : 'similar lyrics'
	};
}

/** Possible duplicates among hymns already in content, not yet decided (`duplicates`). */
export function findDuplicates(content: ContentIndex, decisions: MergeDecision[]): DuplicateItem[] {
	const matcher = createMatcher(content, decisions);
	const found = new Map<string, DuplicateItem>();
	for (const hymn of content.hymns.values()) {
		if (isSampleOnly(hymn)) continue;
		for (const r of matcher.compare(hymn, hymn.id)) {
			if (r.decision) continue;
			if (!isPossible(r, r.sameTitle)) continue;
			const [a, b] = r.id < hymn.id ? [r.id, hymn.id] : [hymn.id, r.id];
			found.set(pairKey(a, b), duplicate(a, b, r.similarity, r.sameTitle));
		}
	}
	return [...found.values()].sort((x, y) => y.similarity - x.similarity || x.a.localeCompare(y.a));
}
