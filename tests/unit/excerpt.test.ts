import { describe, expect, it } from 'vitest';
import { buildExcerpt, MAX_EXCERPT_LENGTH } from '$lib/search/excerpt';
import { tokenize } from '$lib/search/normalize';

const lines = [
	'Torrents d’amour et de grâce,',
	'Amour du Sauveur en croix !',
	'À ce grand fleuve qui passe',
	'Je m’abandonne et je crois.'
];
const highlighted = (e: { text: string; highlights: [number, number][] }) =>
	e.highlights.map(([s, end]) => e.text.slice(s, end));

describe('buildExcerpt (FR-008, FR-020)', () => {
	it('picks the line with the most matched words', () => {
		const excerpt = buildExcerpt(lines, tokenize('grand fleuve'))!;
		expect(excerpt.text).toBe('À ce grand fleuve qui passe');
		expect(highlighted(excerpt)).toEqual(['grand', 'fleuve']);
	});

	it('keeps the original text, accents and apostrophes', () => {
		const excerpt = buildExcerpt(lines, tokenize('a ce grand'))!;
		expect(excerpt.text).toBe('À ce grand fleuve qui passe');
		expect(highlighted(excerpt)).toEqual(['À', 'ce', 'grand']);
	});

	it('highlights accented and apostrophe words as written', () => {
		const excerpt = buildExcerpt(lines, tokenize('m abandonne grace'))!;
		expect(excerpt.text).toBe('Je m’abandonne et je crois.');
		expect(highlighted(excerpt)).toEqual(['m', 'abandonne']);
	});

	it('highlights prefix matches on the whole word', () => {
		const excerpt = buildExcerpt(lines, tokenize('sauv'))!;
		expect(highlighted(excerpt)).toEqual(['Sauveur']);
	});

	it('highlights one-typo matches for words of 5+ letters', () => {
		const excerpt = buildExcerpt(lines, tokenize('fleuce'))!;
		expect(highlighted(excerpt)).toEqual(['fleuve']);
	});

	it('returns undefined when nothing matches', () => {
		expect(buildExcerpt(lines, tokenize('berger'))).toBeUndefined();
	});

	it('shortens long lines around the first match', () => {
		const long = 'mot '.repeat(60) + 'cible ' + 'fin '.repeat(30);
		const excerpt = buildExcerpt([long], tokenize('cible'))!;
		expect(excerpt.text.length).toBeLessThanOrEqual(MAX_EXCERPT_LENGTH + 2);
		expect(highlighted(excerpt)).toEqual(['cible']);
		expect(excerpt.text.startsWith('…')).toBe(true);
	});
});
