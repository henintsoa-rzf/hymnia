import { describe, expect, it } from 'vitest';
import { sharedWords, wordKey } from '../helpers/query-words';

describe('reference query word rule (FR-019)', () => {
	it('ignores stop words, accents and case', () => {
		expect(sharedWords('le pardon de Dieu', 'Ô DIEU, ton pardon est grand')).toEqual([
			'pardon',
			'dieu'
		]);
		expect(sharedWords('la foi et les œuvres', 'la grâce et le salut')).toEqual([]);
	});

	it('treats plurals and words of the same stem as the same word', () => {
		expect(wordKey('morts')).toBe(wordKey('mort'));
		expect(sharedWords('fidélité', 'un ami fidèle')).toEqual(['fidelite']);
		expect(sharedWords('rédemption', 'mon Rédempteur vit')).toEqual(['redemption']);
		expect(sharedWords('souverain sacrificateur', 'il intercède pour nous')).toEqual([]);
	});
});
