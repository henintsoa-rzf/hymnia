import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { createBible } from '$lib/bible/bible';
import { SELECTION_KEY, createSelection, fromUrlParam, toUrlParam } from '$lib/bible/selection';
import { MemoryStorage } from '../helpers/memory-storage';

const bible = createBible(
	JSON.parse(readFileSync(new URL('../../content/bible/lsg1910.json', import.meta.url), 'utf8'))
);
const make = (storage = new MemoryStorage()) =>
	createSelection({ storage, verseText: bible.verseText });

describe('verse selection', () => {
	it('adds and removes verses, kept unique and in Bible order', () => {
		const selection = make();
		expect(selection.toggle('ROM.8.39')).toBe('added');
		expect(selection.toggle('PSA.23.1')).toBe('added');
		expect(selection.toggle('ROM.8.38')).toBe('added');
		expect(get(selection).ids).toEqual(['PSA.23.1', 'ROM.8.38', 'ROM.8.39']);
		expect(get(selection).label).toBe('Psaume 23:1 ; Romains 8:38-39');
		expect(selection.toggle('PSA.23.1')).toBe('removed');
		expect(get(selection).ids).toEqual(['ROM.8.38', 'ROM.8.39']);
	});

	it('gives the query text (label, then the texts in Bible order), and counts code points', () => {
		const selection = make();
		selection.toggle('JHN.3.17');
		selection.toggle('JHN.3.16');
		const { text, chars } = get(selection);
		expect(text).toBe(
			`Jean 3:16-17 — ${bible.verseText('JHN.3.16')} ${bible.verseText('JHN.3.17')}`
		);
		expect(chars).toBe([...text].length);
	});

	it('refuses a verse that would pass 2,000 characters, and changes nothing', () => {
		const selection = make();
		let result: string = 'added';
		let n = 0;
		while (result === 'added') result = selection.toggle(`PSA.119.${++n}`);
		expect(result).toBe('too-long');
		const state = get(selection);
		expect(state.ids).toHaveLength(n - 1);
		expect(state.chars).toBeLessThanOrEqual(2000);
		expect(state.chars + 1 + [...bible.verseText(`PSA.119.${n}`)!].length).toBeGreaterThan(
			2000 - 10
		);
		// Removing still works at the limit.
		expect(selection.toggle('PSA.119.1')).toBe('removed');
	});

	it('ignores unknown verses', () => {
		const selection = make();
		expect(selection.toggle('JHN.3.99')).toBe('removed');
		expect(get(selection).ids).toEqual([]);
	});

	it('clears, and replaces', () => {
		const selection = make();
		selection.toggle('JHN.3.16');
		selection.clear();
		expect(get(selection).ids).toEqual([]);
		selection.replace(['JHN.3.17', 'JHN.3.16', 'nope']);
		expect(get(selection).ids).toEqual(['JHN.3.16', 'JHN.3.17']);
	});

	it('survives a new store on the same storage, and ignores broken storage', () => {
		const storage = new MemoryStorage();
		make(storage).toggle('JHN.3.16');
		expect(get(make(storage)).ids).toEqual(['JHN.3.16']);
		storage.setItem(SELECTION_KEY, '{broken');
		expect(get(make(storage)).ids).toEqual([]);
		storage.failReads = true;
		expect(get(make(storage)).ids).toEqual([]);
	});
});

describe('URL form', () => {
	it('writes runs of consecutive verses', () => {
		expect(toUrlParam(['PSA.23.1', 'PSA.23.2', 'PSA.23.3', 'PSA.23.4', 'JHN.10.11'])).toBe(
			'psaumes.23.1-4~jean.10.11'
		);
		expect(toUrlParam(['JHN.3.16', 'JHN.3.18', 'JHN.3.17', 'JHN.3.21'])).toBe(
			'jean.3.16-18~jean.3.21'
		);
		expect(toUrlParam([])).toBe('');
	});

	it('reads it back, ignoring unknown or out-of-range parts', () => {
		expect(fromUrlParam('psaumes.23.1-4~jean.10.11', bible.verseCount)).toEqual([
			'PSA.23.1',
			'PSA.23.2',
			'PSA.23.3',
			'PSA.23.4',
			'JHN.10.11'
		]);
		expect(fromUrlParam('nope.1.1~jean.3.99~jean.22.1~jean.3.16', bible.verseCount)).toEqual([
			'JHN.3.16'
		]);
		expect(fromUrlParam('jean.3.35-40', bible.verseCount)).toEqual(['JHN.3.35', 'JHN.3.36']);
		expect(fromUrlParam('', bible.verseCount)).toEqual([]);
		expect(fromUrlParam(null, bible.verseCount)).toEqual([]);
		expect(fromUrlParam('garbage', bible.verseCount)).toEqual([]);
	});
});
