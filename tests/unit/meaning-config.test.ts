import { describe, expect, it } from 'vitest';
import { FULL_DIMS, MEANING_CONFIG, configId } from '../../src/lib/meaning/config';

describe('meaning config', () => {
	it('gives the default id', () => {
		expect(configId(MEANING_CONFIG)).toBe('te3-large/title+stanza/512/i8/v1');
		expect(FULL_DIMS).toBe(3072);
	});

	it('changes the id with representation, dims or rev', () => {
		const base = configId(MEANING_CONFIG);
		expect(configId({ ...MEANING_CONFIG, representation: 'stanza' })).not.toBe(base);
		expect(configId({ ...MEANING_CONFIG, dims: 1024 })).not.toBe(base);
		expect(configId({ ...MEANING_CONFIG, rev: MEANING_CONFIG.rev + 1 })).not.toBe(base);
	});

	it('has the limits and fusion of the plan', () => {
		expect(MEANING_CONFIG.maxBytes).toBe(10 * 1024 * 1024);
		expect(MEANING_CONFIG.fusion).toEqual({ k: 60, wMeaning: 1, wWords: 1 });
		expect(MEANING_CONFIG.minSectionChars).toBe(40);
	});
});
