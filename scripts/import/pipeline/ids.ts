/**
 * Stable hymn ids for new hymns (data-model.md, "Derived values"). An id never changes once
 * written, and ids are never reused (FR-028): callers pass every id already used, including
 * redirect sources.
 */
import { tokenize } from '../../../src/lib/search/normalize';

export function slug(text: string): string {
	const words = tokenize(text);
	return words.length === 0 ? 'chant' : words.join('-');
}

export function newHymnId(
	title: string,
	hymnal: string,
	number: string,
	taken: ReadonlySet<string>
): string {
	const base = slug(title);
	if (!taken.has(base)) return base;
	const specific = `${base}-${hymnal}-${slug(number)}`;
	if (!taken.has(specific)) return specific;
	for (let n = 2; ; n++) {
		const candidate = `${specific}-${n}`;
		if (!taken.has(candidate)) return candidate;
	}
}
