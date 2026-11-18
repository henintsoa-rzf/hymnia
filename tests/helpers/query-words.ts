/**
 * Feature 011 (FR-019): a reference query by meaning shares no word with the stanza it targets,
 * so word search cannot find it by its words. Stop words do not count. Two words are the same
 * when their normalised forms (no accents, lowercase) match after dropping a plural s/x, or
 * share their first 5 letters (fidèle / fidélité, sauveur / sauvé, rédemption / rédempteur).
 */
import { tokenize } from '../../src/lib/search/normalize';

/** French stop words, normalised (no accents). */
export const STOP_WORDS = new Set(
	`a ai aie aient aies ait as au aux avaient avais avait avant avec avez aviez avions avoir avons
	ayant c ca ce ceci cela celle celles celui ces cet cette ceux chaque comme d dans de des du
	elle elles en es est et etaient etais etait etant ete etes etiez etions etre eu eue eues eurent
	eus eusse eut eux fut furent fus il ils j je jusqu l la le les leur leurs lui m ma mais me meme
	mes moi mon n ne ni nos notre nous on ont ou par pas peu plus pour qu quand que quel quelle
	quelles quels qui s sa sans se sera serai seront ses si son sont sous suis sur t ta te tes toi
	ton tous tout toute toutes tres tu un une uns vos votre vous vu y o oh`.split(/\s+/)
);

/** The comparison key of a normalised word. */
export function wordKey(word: string): string {
	const singular = word.length > 3 ? word.replace(/[sx]$/, '') : word;
	return singular.slice(0, 5);
}

/** Normalised content words (no stop words) of a text. */
export const contentWords = (text: string) => tokenize(text).filter((w) => !STOP_WORDS.has(w));

/** The query words that the target text also holds (empty when the query is valid). */
export function sharedWords(query: string, target: string): string[] {
	const keys = new Set(contentWords(target).map(wordKey));
	return [...new Set(contentWords(query))].filter((w) => keys.has(wordKey(w)));
}
