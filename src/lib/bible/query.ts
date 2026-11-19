/**
 * Texts made from selected verses (specs/015-bible-verse-search): the query sent for embedding
 * (research R4) and the text copied or shared (contracts/bible-ui.md §5).
 */
import { compareVerseIds, parseVerseId, type VerseId } from './books';
import { formatLabel } from './reference';

type VerseSource = { verseText(id: VerseId): string | undefined; name?: string };

/**
 * The query form the search from verses uses, set by the measure of research R4
 * (tests/queries/verse-evaluation.json): the verses' text alone, or the label first.
 */
export const VERSE_QUERY_FORM: 'plain' | 'labelled' = 'labelled';

/** Known verses, unique, in Bible order. */
export function knownInOrder(ids: Iterable<VerseId>, bible: VerseSource): VerseId[] {
	return [...new Set(ids)].filter((id) => bible.verseText(id)).sort(compareVerseIds);
}

/**
 * The query text: the verses' text in Bible order, joined by one space, with no numbers. With
 * `withLabel`, the label comes first (« Jean 3:16-17 — … »), the form research R4 measures.
 */
export function verseQueryText(
	ids: Iterable<VerseId>,
	bible: VerseSource,
	options: { withLabel?: boolean } = { withLabel: VERSE_QUERY_FORM === 'labelled' }
): string {
	const known = knownInOrder(ids, bible);
	const text = known.map((id) => bible.verseText(id)).join(' ');
	return options.withLabel ? `${formatLabel(known)} — ${text}` : text;
}

/**
 * The text copied or shared (contracts/bible-ui.md §5): runs of consecutive verses as
 * paragraphs, then « — <label> (<translation>) ».
 */
export function copyText(ids: Iterable<VerseId>, bible: VerseSource): string {
	const known = knownInOrder(ids, bible);
	if (known.length === 0) return '';
	const paragraphs: string[][] = [];
	known.forEach((id, i) => {
		const ref = parseVerseId(id)!;
		const before = i > 0 ? parseVerseId(known[i - 1])! : undefined;
		const follows =
			before &&
			before.book === ref.book &&
			before.chapter === ref.chapter &&
			before.verse + 1 === ref.verse;
		if (follows) paragraphs.at(-1)!.push(bible.verseText(id)!);
		else paragraphs.push([bible.verseText(id)!]);
	});
	const text = paragraphs.map((p) => p.join(' ')).join('\n\n');
	return `${text}\n— ${formatLabel(known)} (${bible.name ?? 'Louis Segond 1910'})`;
}
