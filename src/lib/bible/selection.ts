/**
 * The verses the user has chosen (specs/015-bible-verse-search, data-model.md "Verse
 * selection"): kept while the app is open, across chapters and books, mirrored in
 * `sessionStorage` so a reload of the tab keeps it. Never saved with the collections.
 * The joined text never passes `MAX_EMBED_CHARS`, the length the Worker accepts (FR-011).
 */
import { writable, type Readable } from 'svelte/store';
import { MAX_EMBED_CHARS } from '../meaning/config';
import {
	bookByCode,
	bookBySlug,
	compareVerseIds,
	parseVerseId,
	verseId,
	type BookCode,
	type VerseId
} from './books';
import { knownInOrder, verseQueryText } from './query';
import { formatLabel } from './reference';

export const SELECTION_KEY = 'hymnia.bible.selection';

export type SelectionState = {
	ids: VerseId[];
	/** The query text (research R4): the verses' text in Bible order, label first if measured so. */
	text: string;
	/** Code points of `text`. */
	chars: number;
	/** « Psaume 23:1-4 ; Jean 10:11 ». */
	label: string;
};

export type Selection = Readable<SelectionState> & {
	toggle(id: VerseId): 'added' | 'removed' | 'too-long';
	clear(): void;
	replace(ids: VerseId[]): void;
	current(): SelectionState;
};

export function createSelection(options: {
	storage: Storage | undefined;
	verseText: (id: VerseId) => string | undefined;
	maxChars?: number;
}): Selection {
	const { storage, maxChars = MAX_EMBED_CHARS } = options;
	const source = { verseText: options.verseText };

	const stateOf = (ids: Iterable<VerseId>): SelectionState => {
		const known = knownInOrder(ids, source);
		const text = verseQueryText(known, source);
		return { ids: known, text, chars: [...text].length, label: formatLabel(known) };
	};

	let initial: VerseId[] = [];
	try {
		const raw = storage?.getItem(SELECTION_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (Array.isArray(parsed)) initial = parsed.filter((x): x is string => typeof x === 'string');
	} catch {
		// Blocked or broken: start empty.
	}

	let state = stateOf(initial);
	const store = writable(state);
	const set = (next: SelectionState) => {
		state = next;
		store.set(next);
		try {
			storage?.setItem(SELECTION_KEY, JSON.stringify(next.ids));
		} catch {
			// Kept in memory for this visit.
		}
	};

	return {
		subscribe: store.subscribe,
		current: () => state,
		toggle(id) {
			if (state.ids.includes(id)) {
				set(stateOf(state.ids.filter((x) => x !== id)));
				return 'removed';
			}
			if (!options.verseText(id)) return 'removed';
			const next = stateOf([...state.ids, id]);
			if (next.chars > maxChars) return 'too-long';
			set(next);
			return 'added';
		},
		clear: () => set(stateOf([])),
		replace(ids) {
			// A shared link may hold more than the limit: keep verses in order while they fit.
			let next = stateOf([]);
			for (const id of knownInOrder(ids, source)) {
				const longer = stateOf([...next.ids, id]);
				if (longer.chars > maxChars) break;
				next = longer;
			}
			set(next);
		}
	};
}

/* ---------------------------------------------------------- URL form */

/** `psaumes.23.1-4~jean.10.11`: runs of consecutive verses of one chapter (data-model.md). */
export function toUrlParam(ids: VerseId[]): string {
	const refs = [...new Set(ids)]
		.filter((id) => parseVerseId(id))
		.sort(compareVerseIds)
		.map((id) => parseVerseId(id)!);
	const parts: string[] = [];
	for (let i = 0; i < refs.length;) {
		let j = i;
		while (
			j + 1 < refs.length &&
			refs[j + 1].book === refs[i].book &&
			refs[j + 1].chapter === refs[i].chapter &&
			refs[j + 1].verse === refs[j].verse + 1
		)
			j++;
		const slug = bookByCode(refs[i].book)!.slug;
		const range = i === j ? `${refs[i].verse}` : `${refs[i].verse}-${refs[j].verse}`;
		parts.push(`${slug}.${refs[i].chapter}.${range}`);
		i = j + 1;
	}
	return parts.join('~');
}

/**
 * Verse ids from the URL form. Unknown books, chapters and verses are ignored; a range is cut
 * to the verses of its chapter.
 */
export function fromUrlParam(
	param: string | null,
	verseCount: (book: BookCode, chapter: number) => number
): VerseId[] {
	const ids: VerseId[] = [];
	for (const part of (param ?? '').split('~')) {
		const match = /^([a-z0-9-]+)\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(part.trim());
		if (!match) continue;
		const book = bookBySlug(match[1]);
		if (!book) continue;
		const chapter = Number(match[2]);
		const count = verseCount(book.code, chapter);
		const first = Number(match[3]);
		const last = Math.min(match[4] ? Number(match[4]) : first, count);
		for (let v = Math.max(first, 1); v <= last; v++) ids.push(verseId(book.code, chapter, v));
	}
	return [...new Set(ids)];
}

let app: Selection | undefined;

/** The selection of this visit (one per tab), stored in `sessionStorage`. */
export function appSelection(bible: { verseText: (id: VerseId) => string | undefined }): Selection {
	if (!app) {
		let storage: Storage | undefined;
		try {
			storage = typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
		} catch {
			storage = undefined;
		}
		app = createSelection({ storage, verseText: bible.verseText });
	}
	return app;
}
