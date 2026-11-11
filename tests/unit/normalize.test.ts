import { describe, expect, it } from 'vitest';
import { foldWithMap, normalizeText, tokenize } from '$lib/search/normalize';

describe('normalizeText (FR-005)', () => {
	it('ignores case and accents', () => {
		expect(normalizeText('Éternel')).toBe('eternel');
		expect(normalizeText('À TOI LA GLOIRE')).toBe('a toi la gloire');
		expect(normalizeText('Ô ressuscité')).toBe('o ressuscite');
	});

	it('expands ligatures', () => {
		expect(normalizeText('cœur')).toBe('coeur');
		expect(normalizeText('Œuvre')).toBe('oeuvre');
		expect(normalizeText('ex æquo')).toBe('ex aequo');
	});

	it('treats punctuation and both apostrophes as word separators', () => {
		expect(normalizeText("l'Éternel")).toBe('l eternel');
		expect(normalizeText('l’Éternel')).toBe('l eternel');
		expect(normalizeText('Gloire, gloire ! (bis)')).toBe('gloire gloire bis');
		expect(normalizeText('  plusieurs   espaces  ')).toBe('plusieurs espaces');
	});

	it('keeps digits', () => {
		expect(normalizeText('JEM n°245')).toBe('jem n 245');
	});

	it('never modifies the original string (FR-020)', () => {
		const original = 'À toi la gloire, ô Ressuscité !';
		const copy = original.slice();
		normalizeText(original);
		tokenize(original);
		foldWithMap(original);
		expect(original).toBe(copy);
	});
});

describe('tokenize', () => {
	it('returns normalised words', () => {
		expect(tokenize("Qu'il est doux, ô Seigneur")).toEqual([
			'qu',
			'il',
			'est',
			'doux',
			'o',
			'seigneur'
		]);
	});

	it('returns an empty list for blank or punctuation-only input', () => {
		expect(tokenize('')).toEqual([]);
		expect(tokenize(' ,;! ')).toEqual([]);
	});
});

describe('foldWithMap', () => {
	it('maps each folded character back to its original position', () => {
		const original = 'Cœur à Dieu';
		const { text, map } = foldWithMap(original);
		expect(text).toBe('coeur a dieu');
		expect(map).toHaveLength(text.length);
		// "oe" both come from "œ" at index 1
		expect(map[1]).toBe(1);
		expect(map[2]).toBe(1);
		// "a" comes from "à" at index 5
		expect(original[map[text.indexOf(' a ') + 1]]).toBe('à');
	});
});
