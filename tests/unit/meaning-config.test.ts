import { describe, expect, it } from 'vitest';
import { FULL_DIMS, MEANING_CONFIG, configId } from '../../src/lib/meaning/config';

describe('meaning config', () => {
	it('gives the default id', () => {
		expect(configId(MEANING_CONFIG)).toBe('te3-large/title+theme+stanza/1024/i8/v1');
		expect(FULL_DIMS).toBe(3072);
	});

	it('changes the id with representation, dims or rev', () => {
		const base = configId(MEANING_CONFIG);
		expect(configId({ ...MEANING_CONFIG, representation: 'stanza' })).not.toBe(base);
		expect(configId({ ...MEANING_CONFIG, dims: 512 })).not.toBe(base);
		expect(configId({ ...MEANING_CONFIG, rev: MEANING_CONFIG.rev + 1 })).not.toBe(base);
	});

	it('has the limits of the plan and the measured fusion weights', () => {
		// 20 MB: 1,024 dims beat 512 by ≥ 3 top-10 points (research.md "Evaluation results").
		expect(MEANING_CONFIG.maxBytes).toBe(20 * 1024 * 1024);
		expect(MEANING_CONFIG.fusion).toEqual({ k: 60, wMeaning: 1, wWords: 0 });
		expect(MEANING_CONFIG.minSectionChars).toBe(40);
	});
});
