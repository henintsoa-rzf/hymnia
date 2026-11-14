/**
 * Example searches for a first visit (specs/006-search-start-panel/research.md, R5): a number,
 * a title and a few words of lyrics, taken from the catalog that is loaded. A fixed list would
 * find nothing in a build that publishes other hymns (public, personal-use or test data).
 * Deterministic: the same catalog always gives the same examples.
 */
import type { CatalogApi, EntryRef } from '../data/catalog';
import { titleIn } from '../domain/titles';
import { normalizeText } from './normalize';

export type SearchExample = {
	kind: 'number' | 'title' | 'lyrics';
	query: string;
	/** The hymn the example is meant to find. */
	hymnId: string;
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
/** Punctuation around a word, not inside it (« d’amour » keeps its apostrophe). */
const bare = (word: string) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

const MIN_LETTERS = 16;

/**
 * First 3 words of a lyrics line that does not just repeat the title and is distinctive enough,
 * or nothing.
 */
function lyricsOf(ref: EntryRef): string | undefined {
	const { hymn } = ref;
	const title = normalizeText(titleIn(hymn, ref.entry.hymnal, ref.entry.number));
	const sections = [...hymn.sections].sort(
		(a, b) => Number(b.type === 'verse') - Number(a.type === 'verse')
	);
	for (const line of sections[0]?.lines ?? []) {
		const picked = words(line).slice(0, 3).map(bare).filter(Boolean);
		// Short common words (« Je ne manquerai ») match too many hymns to teach anything.
		if (picked.length < 3 || picked.join('').length < MIN_LETTERS) continue;
		if (title.includes(normalizeText(picked.join(' ')))) continue;
		return picked.join(' ');
	}
	return undefined;
}

export function pickExamples(catalog: CatalogApi): SearchExample[] {
	const refs = catalog.getHymnals().flatMap((h) => catalog.listEntries(h.id));
	const used = new Set<string>();
	const examples: SearchExample[] = [];

	const first = refs[0];
	if (!first) return examples;
	const abbreviation = catalog.getHymnal(first.entry.hymnal)?.abbreviations[0];
	if (abbreviation) {
		examples.push({
			kind: 'number',
			query: `${abbreviation} ${first.entry.number}`,
			hymnId: first.hymn.id
		});
		used.add(first.hymn.id);
	}

	const titled = refs.find((r) => {
		if (used.has(r.hymn.id)) return false;
		const n = words(titleIn(r.hymn, r.entry.hymnal, r.entry.number)).length;
		return n >= 2 && n <= 5;
	});
	if (titled) {
		examples.push({
			kind: 'title',
			query: titleIn(titled.hymn, titled.entry.hymnal, titled.entry.number),
			hymnId: titled.hymn.id
		});
		used.add(titled.hymn.id);
	}

	for (const ref of refs) {
		if (used.has(ref.hymn.id)) continue;
		const query = lyricsOf(ref);
		if (query) {
			examples.push({ kind: 'lyrics', query, hymnId: ref.hymn.id });
			break;
		}
	}
	return examples;
}
